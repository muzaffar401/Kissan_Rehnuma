# In-call photo assessment and help requests

The voice screen keeps its LiveKit room mounted while displaying photo, assessment,
request draft, confirmation and receipt cards. This first version supports one
photo-linked submission per call. Weather, market and complaint-status tools remain.

The initial call shows only the assistant and call controls. The agent asks one
relevant missing question, explains why a photo helps and requests permission
before opening the crop/animal photo card. The category comes from the conversation.
Only the current step is shown: photo capture, photo preview/send, analysis progress,
assessment, spoken request details, confirmation, or receipt. Choosing a photo does
not analyze it until the farmer presses Send. A farmer without a photo can dismiss
the photo step and continue the conversation. Financial assistance appears after
it is requested; typing request details is an optional fallback, not the default.
The photo thumbnail and assessment stay in the same card while spoken details are
collected. Help selection does not open a separately titled panel. Only the final
submission needs a review/confirmation step.

The verified service assessment is persisted in the agent's chat context and the
current workflow is supplied on subsequent voice turns. The read-only
`check_photo_assessment_status` tool lets the agent answer whether a result arrived.
Automatic result narration uses `tool_choice="none"` so it cannot immediately open
another workflow step; the agent must wait for the farmer's next choice.

## Existing services are reused

- Crop upload: the existing `cropService.detectDisease()` through the gateway.
- Animal upload: the existing `animalService.detectDisease()` through the gateway.
- No second vision model or image-analysis endpoint is introduced.
- After upload, the app sends only `scan_id`, photo kind and photo-state version.
  The agent loads that scan from the appropriate service's farmer-filtered history,
  checks ownership and uses a bounded assessment summary. Prescriptions are not
  forwarded into the voice workflow.
- Requests use the existing complaints, complaint events and tool-execution tables.
  Assistance uses `general_inquiry`; expert review uses crop/animal categories.
  Admin staff can read the linked scan ID and update the existing complaint status.

## Configuration and rollout

Deploy the frontend, voice agent and token server together. Token generation now
requires an access JWT; old anonymous test clients must authenticate.

The **token server** requires the same `JWT_SECRET_KEY` and `JWT_ALGORITHM` as auth.
It verifies an unexpired `type=access` token, derives farmer ID/name from signed
claims and generates a new private room. Query parameters cannot select another
farmer or room. Existing LiveKit credentials are still required.

The **voice agent** requires these internal service URLs:

```text
CROP_DISEASE_SERVICE_URL=http://localhost:8001
ANIMAL_DISEASE_SERVICE_URL=http://localhost:8003
```

Docker Compose sets Docker-network URLs and the token server's JWT variables.
The existing initial voice Alembic migration must already be applied, including
the unique `(farmer_id, idempotency_key)` constraint on `tool_executions`.
No new schema migration is needed.

Example Compose rebuild from the repository root (when deploying):

```sh
docker compose up -d --build voice-agent voice-token
```

Build/deploy the Expo web frontend using the project's normal release process.

## RPC contract

- `kissan.ui`: agent-to-app versioned snapshot. The app only accepts agent callers.
  It acknowledges the matching version only after React commits the in-call card.
  A failed/missing/stale render acknowledgement must not be described as a visible
  photo card. The active call layout puts the card above the waveform and removes
  the large avatar; workflow updates scroll to the card on small viewports.
- `kissan.action`: app-to-agent actions. The agent only accepts the authenticated
  farmer participant: `sync`, `photo`, `skip_photo`, `scan`, `select`, `prepare`, `confirm`, `cancel`.
  Selecting help opens the `details` stage; `start_help_request` provides the same
  transition for a voice-selected expert/assistance request.
- All writes/voice tools share a per-room lock. Stale photo versions and stale
  draft IDs are rejected. The app ignores snapshots older than its current version.
- `prepare` creates an in-memory draft, never a complaint. The farmer reviews its
  request type, district and description before submitting.
- Tap confirmation includes the exact draft ID. Voice confirmation requires a
  **final STT transcript** matching an explicit phrase, bound to the current draft:
  `confirm request`, `submit my request`, `yes submit my request`,
  `darkhwast jama kar dein`, `darkhast jama kar dein`,
  `درخواست جمع کریں`, `درخواست جمع کر دیں`, `میری درخواست جمع کر دیں`.
  Bare yes/haan is not accepted. Editing/cancelling clears voice confirmation.
  The mutating voice tool disables interruptions once consent has been validated,
  following LiveKit's guidance for tools that write data.
- Complaint + idempotency receipt are committed in one transaction. Repeating a
  confirmation reuses the receipt. A failed UI update after commit does not lose it.
- `sync` retrieves the in-call snapshot and refreshes an existing receipt's status
  from the complaints table, including admin updates.

## Manual acceptance check

1. Sign in and start a web voice call. Verify no photo/request panel appears initially.
2. Describe crop or livestock symptoms in Urdu. Answer the assistant's missing
   question and agree to send a photo. Verify only then the correct card opens,
   with no crop/animal selector and without leaving the call screen.
3. Choose/take a photo, review the preview and send it. Confirm selection alone
   does not analyze it, and sending makes exactly one existing detection POST
   is made; the subsequent agent request only reads farmer-filtered history.
4. Verify low-confidence/non-subject/failed scans do not display a diagnosis as
   confirmed. Photo controls should be replaced by the assessment. Ask for expert
   review, or explain a financial need to open assistance by voice.
5. Provide district/problem. Check that a draft appears and that no complaint is
   created yet. Say only “yes”: it must still not submit.
6. Say `درخواست جمع کریں` / `confirm request`, or press Confirm. Verify a reference
   appears and the existing admin panel contains one request with the scan ID.
7. Double-tap/retry confirmation; verify no second complaint. Cancel a different
   draft and verify its stale confirm action is rejected.
8. Change the complaint status in admin and press Refresh request status. Also ask
   the agent about complaint status.
9. Briefly interrupt the network. Reconnecting should disable actions; reconnection
   syncs the same live workflow. If the room ends, the UI must leave connected state
   and stop the microphone/audio elements.
10. Expired JWTs use the existing silent refresh flow. Missing/refresh-only tokens
    and attempts to spoof farmer/room query parameters must be rejected.

## Automated checks

```sh
# From services/voice-agent-service
python -m unittest discover -s tests -v

# From mobile-web-app
node --test tests/voiceWorkflow.test.cjs
npx tsc --noEmit
npx expo export --platform web
```

Backend tests mock external HTTP/database boundaries. They do not establish real
LiveKit audio quality, production database health or third-party delivery.

An optional browser regression check, `node tests/browser/voiceCard.smoke.cjs`,
runs against an existing Expo web dev server at localhost:8081. It requires
Playwright (or `PLAYWRIGHT_MODULE` pointing to an installed copy), uses mocked
authentication/backend/RTC, and verifies that the photo button is inside a
375-by-667 viewport and a matching render acknowledgement is returned.

## Scope

This is the **web** workflow on the existing voice screen. Native LiveKit/Expo
integration remains a separate task. No NGO API, medicine purchase, expert booking,
automatic assignment or assistance approval is claimed. These are internal requests
for Kissan Rehnuma staff to review.

Drafts and selected photos last for the active agent session; a full page reload or
new call does not restore an unsubmitted draft. Submitted complaints persist and
can be queried through the existing status tool. Reconnection to the same surviving
room can sync the active draft. There are no new background reminder jobs.

## Official references

- [LiveKit: forwarding tools to the frontend](https://docs.livekit.io/agents/logic/tools/forwarding/)
- [LiveKit: RPC payloads, errors and response timeouts](https://docs.livekit.io/transport/data/rpc/)
- [LiveKit: session and transcription events](https://docs.livekit.io/agents/logic/sessions/)
- [LiveKit: inserting agent replies](https://docs.livekit.io/agents/multimodality/text/)
- [LiveKit: interruption protection for mutating tools](https://docs.livekit.io/agents/logic/tools/definition/)
