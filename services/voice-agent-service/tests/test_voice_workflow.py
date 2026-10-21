"""Run: python -m unittest discover -s tests -v (from voice-agent-service)."""

import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

from app.agents.context import SessionContext, get_session_context, set_session_context
from app.agents.kissan_agent import KissanRehnumaAgent
from app.agents.tools.complaint import register_complaint
from app.services.voice_workflow import HelpDraft, VoiceWorkflow, is_voice_confirmation
from livekit.agents.llm import ToolContext


class WorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_photo_status_reads_result_without_changing_screen(self):
        workflow, _ = self.make_workflow()
        before = workflow.snapshot()
        result = await workflow.check_photo_assessment_status()
        self.assertTrue(result["received"])
        self.assertEqual(result["assessment"], workflow.assessment)
        self.assertEqual(workflow.snapshot(), before)

    async def test_uploaded_result_is_persisted_before_voice_notification(self):
        workflow, handler = self.make_workflow()
        agent = workflow.session.current_agent
        agent.update_chat_ctx = AsyncMock()
        with patch.object(workflow, "_load_scan", new=AsyncMock()):
            await handler(SimpleNamespace(caller_identity="7", payload=json.dumps({
                "action": "scan", "kind": "crop", "scan_id": workflow.assessment["scan_id"],
                "photo_version": workflow.version})))
        agent.update_chat_ctx.assert_awaited_once()
        self.assertIn(workflow.assessment["scan_id"],
                      agent.chat_ctx.copy.return_value.add_message.call_args.kwargs["content"])
        workflow.speak.assert_called_once()

    async def test_result_notification_cannot_chain_ui_tools(self):
        workflow = VoiceWorkflow(MagicMock(), SimpleNamespace(generate_reply=AsyncMock()),
                                 SessionContext(7, uuid4()), "7")
        workflow.speak("Explain result and wait")
        await asyncio.gather(*workflow.tasks)
        self.assertEqual(workflow.session.generate_reply.call_args.kwargs["tool_choice"], "none")

    async def test_agent_receives_current_result_on_next_voice_turn(self):
        workflow, _ = self.make_workflow()
        agent = KissanRehnumaAgent(workflow=workflow)
        turn = MagicMock()
        await agent.on_user_turn_completed(turn, None)
        content = turn.add_message.call_args.kwargs["content"]
        self.assertIn(workflow.assessment["scan_id"], content)
        self.assertIn("photo WAS received", content)

    def make_workflow(self):
        handlers = {}
        async def acknowledge(**kwargs):
            return json.dumps({"received": True, "version": json.loads(kwargs["payload"])["version"]})
        local = SimpleNamespace(perform_rpc=AsyncMock(side_effect=acknowledge))
        def register(name):
            def decorate(handler):
                handlers[name] = handler
                return handler
            return decorate
        local.register_rpc_method = register
        workflow = VoiceWorkflow(SimpleNamespace(local_participant=local), MagicMock(),
                                 SessionContext(7, uuid4()), "7")
        workflow.assessment = {"scan_id": str(uuid4()), "status": "completed",
                               "disease_name": "Possible leaf issue", "subject": "cotton", "symptoms": []}
        workflow.phase = "assessment"
        workflow.speak = MagicMock()
        workflow.register()
        return workflow, handlers["kissan.action"]

    async def prepare(self, workflow, request_type="assistance"):
        await workflow._prepare(HelpDraft(request_type=request_type, district="Multan",
                                         description="Cotton leaves damaged; needs help"))

    async def test_no_submission_without_explicit_transcript(self):
        workflow, _ = self.make_workflow()
        await self.prepare(workflow)
        for speech in ["yes", "haan", "جی ہاں", "do not submit my request", "confirm request but change district"]:
            workflow.on_transcript(SimpleNamespace(is_final=True, transcript=speech))
            with self.assertRaises(ValueError):
                await workflow._submit(workflow.draft["id"], "voice")
        self.assertIsNone(workflow.receipt)

    async def test_confirmation_is_bound_to_exact_draft(self):
        workflow, _ = self.make_workflow()
        await self.prepare(workflow)
        old_id = workflow.draft["id"]
        workflow.on_transcript(SimpleNamespace(is_final=True, transcript="درخواست جمع کریں۔"))
        self.assertEqual(workflow.confirmed_draft, old_id)
        await workflow._prepare(HelpDraft(request_type="expert", district="Lahore",
                                         description="Changed request for expert review"))
        self.assertIsNone(workflow.confirmed_draft)
        with self.assertRaises(ValueError):
            await workflow._submit(old_id, "tap")
        with self.assertRaises(ValueError):
            await workflow._submit(workflow.draft["id"], "voice")

    async def test_interim_speech_never_confirms(self):
        workflow, _ = self.make_workflow()
        await self.prepare(workflow)
        workflow.on_transcript(SimpleNamespace(is_final=False, transcript="confirm request"))
        self.assertIsNone(workflow.confirmed_draft)

    async def test_rpc_rejects_another_participant(self):
        workflow, handler = self.make_workflow()
        await self.prepare(workflow)
        with self.assertRaises(Exception) as raised:
            await handler(SimpleNamespace(caller_identity="8", payload=json.dumps({"action": "confirm", "draft_id": workflow.draft["id"]})))
        self.assertEqual(raised.exception.code, 2001)
        self.assertIsNone(workflow.receipt)

    async def test_double_tap_and_voice_retry_create_one_complaint(self):
        workflow, handler = self.make_workflow()
        await self.prepare(workflow)
        draft_id = workflow.draft["id"]
        db = MagicMock()
        db.__aenter__ = AsyncMock(return_value=db)
        db.__aexit__ = AsyncMock(return_value=False)
        db.execute = AsyncMock(return_value=SimpleNamespace(scalar_one_or_none=lambda: None))
        db.commit = AsyncMock()
        repo = MagicMock()
        repo.create_complaint = AsyncMock(return_value=SimpleNamespace(reference_number="KR-test"))
        repo.log_tool_execution = AsyncMock()
        with patch("app.services.voice_workflow.get_session_factory", return_value=lambda: db), \
             patch("app.services.voice_workflow.ComplaintRepository", return_value=repo):
            data = SimpleNamespace(caller_identity="7", payload=json.dumps({"action": "confirm", "draft_id": draft_id}))
            results = await asyncio.gather(handler(data), handler(data))
            await workflow._submit(draft_id, "voice")
        repo.create_complaint.assert_awaited_once()
        db.commit.assert_awaited_once()
        self.assertTrue(all(json.loads(r)["receipt"]["reference_number"] == "KR-test" for r in results))
        created = repo.create_complaint.call_args.kwargs
        self.assertEqual(created["farmer_id"], UUID(int=7))
        self.assertEqual(created["category"].value, "general_inquiry")
        self.assertIn("not submitted to an NGO", created["description"])

    async def test_persisted_receipt_is_reused_after_uncertain_response(self):
        workflow, _ = self.make_workflow()
        await self.prepare(workflow)
        receipt = {"draft_id": workflow.draft["id"], "reference_number": "KR-existing",
                   "status": "registered", "request_type": "assistance"}
        db = MagicMock()
        db.__aenter__ = AsyncMock(return_value=db)
        db.__aexit__ = AsyncMock(return_value=False)
        db.execute = AsyncMock(return_value=SimpleNamespace(scalar_one_or_none=lambda:
            SimpleNamespace(response_payload=json.dumps(receipt))))
        repo = MagicMock()
        repo.create_complaint = AsyncMock()
        with patch("app.services.voice_workflow.get_session_factory", return_value=lambda: db), \
             patch("app.services.voice_workflow.ComplaintRepository", return_value=repo):
            await workflow._submit(workflow.draft["id"], "tap")
        repo.create_complaint.assert_not_awaited()
        self.assertEqual(workflow.receipt, receipt)

    async def test_commit_failure_never_reports_submitted(self):
        workflow, _ = self.make_workflow()
        await self.prepare(workflow)
        db = MagicMock()
        db.__aenter__ = AsyncMock(return_value=db)
        db.__aexit__ = AsyncMock(return_value=False)
        db.execute = AsyncMock(return_value=SimpleNamespace(scalar_one_or_none=lambda: None))
        db.commit = AsyncMock(side_effect=RuntimeError("Database unavailable"))
        repo = MagicMock()
        repo.create_complaint = AsyncMock(return_value=SimpleNamespace(reference_number="KR-not-saved"))
        repo.log_tool_execution = AsyncMock()
        with patch("app.services.voice_workflow.get_session_factory", return_value=lambda: db), \
             patch("app.services.voice_workflow.ComplaintRepository", return_value=repo):
            with self.assertRaises(RuntimeError):
                await workflow._submit(workflow.draft["id"], "tap")
        self.assertIsNone(workflow.receipt)
        self.assertEqual(workflow.phase, "confirmation")

    async def test_photo_cannot_replace_pending_confirmation(self):
        workflow, _ = self.make_workflow()
        await self.prepare(workflow)
        with self.assertRaises(ValueError):
            await workflow._request_photo("animal")

    async def test_scan_uses_existing_service_and_rejects_wrong_owner(self):
        workflow, _ = self.make_workflow()
        scan_id = str(uuid4())
        response = MagicMock()
        response.__aenter__ = AsyncMock(return_value=response)
        response.__aexit__ = AsyncMock(return_value=False)
        response.json = AsyncMock(return_value=[{"scan_id": scan_id, "user_id": "8"}])
        http = MagicMock()
        http.get.return_value = response
        settings = SimpleNamespace(crop_disease_service_url="http://crop-service", animal_disease_service_url="http://animal-service")
        with patch("app.services.voice_workflow.get_http_session", new=AsyncMock(return_value=http)), \
             patch("app.services.voice_workflow.get_settings", return_value=settings), \
             patch("app.services.voice_workflow.generate_internal_jwt", return_value="internal-token"):
            with self.assertRaises(ValueError):
                await workflow._load_scan(scan_id, "crop")
            self.assertEqual(http.get.call_args.args[0], "http://crop-service/api/v1/disease/history")
            self.assertEqual(http.get.call_args.kwargs["params"]["user_id"], "7")
            response.json.return_value = [{"scan_id": scan_id, "user_id": "7", "status": "completed", "crop_type": "cotton"}]
            await workflow._load_scan(scan_id, "crop")
            self.assertEqual(workflow.assessment["scan_id"], scan_id)
            self.assertEqual(workflow.assessment["subject"], "cotton")
            response.json.return_value = [{"scan_id": scan_id, "user_id": "7", "status": "low_confidence",
                                           "disease_name": "Unreliable prediction", "symptoms": ["Unreliable symptom"]}]
            await workflow._load_scan(scan_id, "crop")
            self.assertEqual(workflow.assessment["disease_name"], "")
            self.assertEqual(workflow.assessment["symptoms"], [])

    async def test_cancelled_draft_cannot_be_submitted(self):
        workflow, handler = self.make_workflow()
        await self.prepare(workflow)
        draft_id = workflow.draft["id"]
        await handler(SimpleNamespace(caller_identity="7", payload=json.dumps({"action": "cancel", "draft_id": draft_id})))
        with self.assertRaises(ValueError):
            await workflow._submit(draft_id, "tap")

    async def test_farmer_context_is_isolated_between_tasks(self):
        async def caller(farmer_id):
            set_session_context(SessionContext(farmer_id, uuid4()))
            await asyncio.sleep(0)
            return get_session_context().farmer_id
        self.assertEqual(await asyncio.gather(caller(7), caller(8)), [7, 8])

    async def test_agent_exposes_bound_workflow_tools(self):
        workflow, _ = self.make_workflow()
        agent = KissanRehnumaAgent(workflow=workflow)
        names = {tool.info.name for tool in agent.tools}
        self.assertTrue({"request_photo", "prepare_help_request", "confirm_help_request"}.issubset(names))
        schemas = ToolContext(agent.tools).parse_function_tools(format="openai")
        photo_schema = next(s["function"] for s in schemas if s["function"]["name"] == "request_photo")
        self.assertIn("kind", photo_schema["parameters"]["properties"])
        self.assertNotIn("self", photo_schema["parameters"]["properties"])
        # Exercise the decorated bound method, not just its internal helper.
        result = await workflow.request_photo("animal")
        self.assertTrue(result["success"])
        self.assertEqual(workflow.kind, "animal")

    async def test_photo_tool_never_claims_visibility_without_render_ack(self):
        workflow, _ = self.make_workflow()
        workflow.room.local_participant.perform_rpc.side_effect = RuntimeError("UI disconnected")
        result = await workflow.request_photo("crop")
        self.assertFalse(result["success"])
        self.assertFalse(result["ui_delivered"])
        self.assertIn("NOT been confirmed", result["message"])
        self.assertEqual(workflow.phase, "photo")

    async def test_stale_render_ack_does_not_confirm_card(self):
        workflow, _ = self.make_workflow()
        workflow.room.local_participant.perform_rpc.side_effect = None
        workflow.room.local_participant.perform_rpc.return_value = '{"received":true,"version":-1}'
        result = await workflow.request_photo("crop")
        self.assertFalse(result["ui_delivered"])

    async def test_repeated_visible_photo_request_preserves_upload_version(self):
        workflow, _ = self.make_workflow()
        await workflow.request_photo("crop")
        version = workflow.version
        result = await workflow.request_photo("crop")
        self.assertTrue(result["ui_delivered"])
        self.assertEqual(workflow.version, version)

    async def test_initial_call_has_no_requested_workflow(self):
        workflow = VoiceWorkflow(MagicMock(), MagicMock(), SessionContext(7, uuid4()), "7")
        self.assertEqual(workflow.snapshot()["phase"], "idle")
        self.assertIsNone(workflow.snapshot()["help_type"])

    async def test_voice_help_selection_prepares_details_without_submitting(self):
        workflow, _ = self.make_workflow()
        result = await workflow.start_help_request("assistance")
        self.assertFalse(result["submitted"])
        self.assertEqual(workflow.phase, "details")
        self.assertEqual(workflow.snapshot()["help_type"], "assistance")
        self.assertIsNone(workflow.draft)
        self.assertIsNone(workflow.receipt)

    async def test_skipping_photo_returns_to_conversation(self):
        workflow, handler = self.make_workflow()
        await workflow.request_photo("crop")
        result = await handler(SimpleNamespace(caller_identity="7", payload='{"action":"skip_photo"}'))
        self.assertEqual(json.loads(result)["phase"], "idle")
        self.assertIsNone(workflow.assessment)
        self.assertIsNone(workflow.draft)

    async def test_help_selection_requires_photo_result(self):
        workflow, _ = self.make_workflow()
        workflow.assessment = None
        with self.assertRaises(ValueError):
            await workflow._start_help("expert")

    async def test_refresh_reads_admin_updated_status(self):
        workflow, handler = self.make_workflow()
        workflow.receipt = {"draft_id": str(uuid4()), "reference_number": "KR-existing",
                            "status": "registered", "request_type": "expert"}
        db = MagicMock()
        db.__aenter__ = AsyncMock(return_value=db)
        db.__aexit__ = AsyncMock(return_value=False)
        repo = MagicMock()
        repo.get_complaint_by_reference = AsyncMock(return_value=SimpleNamespace(
            farmer_id=UUID(int=7), status=SimpleNamespace(value="in_review")))
        with patch("app.services.voice_workflow.get_session_factory", return_value=lambda: db), \
             patch("app.services.voice_workflow.ComplaintRepository", return_value=repo):
            response = await handler(SimpleNamespace(caller_identity="7", payload='{"action":"sync"}'))
        self.assertEqual(json.loads(response)["receipt"]["status"], "in_review")

    async def test_stale_photo_result_cannot_replace_current_case(self):
        workflow, handler = self.make_workflow()
        with self.assertRaises(Exception) as raised:
            await handler(SimpleNamespace(caller_identity="7", payload=json.dumps({
                "action": "scan", "kind": "crop", "scan_id": str(uuid4()), "photo_version": -1})))
        self.assertEqual(raised.exception.code, 2002)

    async def test_photo_flow_cannot_bypass_confirmation_via_legacy_tool(self):
        workflow, _ = self.make_workflow()
        workflow.context.photo_workflow = workflow
        set_session_context(workflow.context)
        result = await register_complaint(category="crop_disease", description="Crop issue",
                                          district="Multan")
        self.assertFalse(result["success"])
        self.assertIn("prepare_help_request", result["message"])

    async def test_mutating_voice_tool_disables_interruptions_after_consent(self):
        workflow, _ = self.make_workflow()
        await self.prepare(workflow)
        context = MagicMock()
        result = await workflow.confirm_help_request(context)
        self.assertFalse(result["success"])
        context.disallow_interruptions.assert_not_called()
        workflow.on_transcript(SimpleNamespace(is_final=True, transcript="confirm request"))
        async def submit(draft_id, channel):
            workflow.receipt = {"draft_id": draft_id, "reference_number": "KR-voice", "status": "registered"}
        with patch.object(workflow, "_submit", side_effect=submit):
            result = await workflow.confirm_help_request(context)
        self.assertTrue(result["success"])
        context.disallow_interruptions.assert_called_once()


class ConfirmationTests(unittest.TestCase):
    def test_supported_phrases_and_rejections(self):
        for text in ["Confirm request!", "درخواست جمع کریں۔", "darkhwast jama kar dein"]:
            self.assertTrue(is_voice_confirmation(text))
        for text in ["yes", "no", "don't confirm request", "درخواست جمع نہ کریں"]:
            self.assertFalse(is_voice_confirmation(text))


if __name__ == "__main__":
    unittest.main()
