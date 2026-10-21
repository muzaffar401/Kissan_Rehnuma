import os
import time
import unittest
from unittest.mock import MagicMock, patch

import jwt
from token_server import TokenHandler


class TokenAuthTests(unittest.TestCase):
    secret = "unit-test-secret-at-least-thirty-two-characters"

    def handler(self, claims=None, token=None):
        handler = object.__new__(TokenHandler)
        handler.path = "/?identity=999&farmer_id=999&room=victim&farmer_name=Spoofed"
        handler.headers = {}
        if claims is not None:
            token = jwt.encode(claims, self.secret, algorithm="HS256")
        if token:
            handler.headers["Authorization"] = "Bearer " + token
        handler._json_response = MagicMock()
        handler._generate_token = MagicMock(return_value="room-token")
        return handler

    def test_missing_expired_refresh_and_invalid_identity_rejected(self):
        base = {"sub": "7", "exp": time.time() + 60, "type": "access"}
        invalid = [None, {**base, "exp": time.time() - 60}, {**base, "type": "refresh"},
                   {**base, "sub": "invalid"}, {**base, "sub": "0"}, {"sub": "7", "exp": time.time() + 60}]
        with patch.dict(os.environ, {"JWT_SECRET_KEY": self.secret, "JWT_ALGORITHM": "HS256"}):
            for claims in invalid:
                handler = self.handler(claims)
                handler.do_GET()
                self.assertEqual(handler._json_response.call_args.args[0], 401)
                handler._generate_token.assert_not_called()

    def test_farmer_and_room_cannot_be_spoofed_by_query(self):
        handler = self.handler({"sub": "7", "exp": time.time() + 60, "type": "access", "name": "Ahmed"})
        with patch.dict(os.environ, {"JWT_SECRET_KEY": self.secret, "JWT_ALGORITHM": "HS256"}), \
             patch("token_server.threading.Thread") as thread, patch("builtins.print"):
            handler.do_GET()
        status, body = handler._json_response.call_args.args
        self.assertEqual(status, 200)
        self.assertEqual(body["identity"], "7")
        self.assertTrue(body["room"].startswith("krn-"))
        self.assertNotEqual(body["room"], "victim")
        self.assertEqual(thread.call_args.kwargs["kwargs"]["farmer_name"], "Ahmed")
        self.assertEqual(thread.call_args.kwargs["kwargs"]["farmer_id"], "7")

    def test_room_token_grants_data_access_and_short_join_expiry(self):
        with patch.dict(os.environ, {"LIVEKIT_API_KEY": "test-key", "LIVEKIT_API_SECRET": self.secret}):
            token = TokenHandler._generate_token(self.handler(), "7", "private-room")
        claims = jwt.decode(token, self.secret, algorithms=["HS256"], options={"verify_aud": False})
        self.assertEqual(claims["sub"], "7")
        self.assertEqual(claims["video"]["room"], "private-room")
        self.assertTrue(claims["video"]["canPublishData"])
        self.assertLessEqual(claims["exp"] - time.time(), 15 * 60)


if __name__ == "__main__":
    unittest.main()
