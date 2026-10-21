"""Simple token server for testing the voice agent.

This generates JWT tokens for LiveKit room access.
Run this alongside the agent: `py -3.13 token_server.py`
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import sys
import threading
import os
from uuid import uuid4
from datetime import timedelta
import jwt
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from livekit import api


class TokenHandler(BaseHTTPRequestHandler):
    """HTTP handler for generating LiveKit tokens."""
    
    def _json_response(self, status, body):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.end_headers()

    def do_GET(self):
        """Handle GET requests for token generation."""
        # Parse query parameters
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        
        # Farmer identity and private room are server-controlled, never query-controlled.
        secret = os.getenv('JWT_SECRET_KEY')
        if not secret or secret == 'change-this-secret-key':
            self._json_response(503, {'detail': 'Voice authentication is not configured'})
            return
        try:
            authorization = self.headers.get('Authorization', '')
            if not authorization.startswith('Bearer '):
                raise ValueError('Missing access token')
            claims = jwt.decode(authorization[7:], secret,
                                algorithms=[os.getenv('JWT_ALGORITHM', 'HS256')],
                                options={'require': ['exp', 'sub', 'type']})
            if claims['type'] != 'access' or int(claims['sub']) <= 0:
                raise ValueError('Invalid access token')
            farmer_id = str(int(claims['sub']))
        except (jwt.InvalidTokenError, ValueError, TypeError):
            self._json_response(401, {'detail': 'Sign in again to start a voice call'})
            return
        identity = farmer_id
        room_name = f'krn-{uuid4().hex}'
        farmer_name = str(claims.get('name') or 'kissan')[:100]
        language = params.get('language', ['ur'])[0] or 'ur'

        # Generate token
        token = self._generate_token(identity, room_name)

        # Dispatch agent to the room asynchronously so the token response
        # is not blocked by the LiveKit dispatch API call.
        threading.Thread(
            target=self._dispatch_agent,
            args=(room_name,),
            kwargs={'farmer_id': farmer_id, 'farmer_name': farmer_name, 'language': language},
            daemon=True,
        ).start()

        # Send response
        response = {
            'token': token,
            'identity': identity,
            'room': room_name,
        }
        self._json_response(200, response)

        print(f"✓ Token generated for {identity} in room {room_name} (farmer_id={farmer_id}, name={farmer_name!r}, lang={language})")
    
    def _generate_token(self, identity: str, room_name: str) -> str:
        """Generate a LiveKit access token."""
        # Get API credentials from environment
        import os
        api_key = os.getenv('LIVEKIT_API_KEY')
        api_secret = os.getenv('LIVEKIT_API_SECRET')
        
        if not api_key or not api_secret:
            raise ValueError("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set")
        
        # Create token with video grants
        token = (
            api.AccessToken(api_key, api_secret)
            .with_identity(identity)
            .with_ttl(timedelta(minutes=15))
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_publish_data=True,
                    can_subscribe=True,
                )
            )
        )
        
        return token.to_jwt()
    
    def _dispatch_agent(self, room_name: str, farmer_id: str = None, farmer_name: str = None, language: str = "ur") -> None:
        """Dispatch an agent to the room using LiveKit API."""
        import os
        import requests
        import base64
        import time
        import hmac
        import hashlib
        import json
        
        lk_url = os.getenv('LIVEKIT_URL')
        api_key = os.getenv('LIVEKIT_API_KEY')
        api_secret = os.getenv('LIVEKIT_API_SECRET')
        
        if not all([lk_url, api_key, api_secret]):
            print("⚠ Warning: Cannot dispatch agent - missing LiveKit credentials")
            return
        
        try:
            # Convert wss:// to https:// for API calls
            api_url = lk_url.replace('wss://', 'https://').replace('ws://', 'http://')
            dispatch_url = f"{api_url}/twirp/livekit.AgentDispatchService/CreateDispatch"
            
            # Create JWT token for API call
            import jwt
            now = int(time.time())
            payload = {
                "iss": api_key,
                "sub": f"agent-dispatch-{room_name}",
                "exp": now + 60,
                "nbf": now,
                "video": {
                    "roomList": True,
                    "roomRecord": False,
                    "roomAdmin": True,
                    "room": room_name,
                }
            }
            token = jwt.encode(payload, api_secret, algorithm="HS256")
            
            # Make dispatch request
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            data = {
                "room": room_name,
                "agentName": "kissan-rehnuma",
            }
            # Build metadata with farmer info and language for the agent
            meta = {}
            if farmer_id:
                meta["farmer_id"] = farmer_id
            if farmer_name:
                meta["farmer_name"] = farmer_name
            meta["language"] = language
            data["metadata"] = json.dumps(meta)

            response = requests.post(dispatch_url, headers=headers, json=data, timeout=5)
            if response.status_code == 200:
                print(f"✓ Agent dispatched to room: {room_name} (farmer_id={farmer_id}, name={farmer_name}, lang={language})")
            else:
                print(f"⚠ Agent dispatch failed: {response.status_code} - {response.text}")
        except ImportError:
            print("⚠ Warning: PyJWT not installed. Run: pip install PyJWT requests")
        except Exception as e:
            print(f"⚠ Warning: Failed to dispatch agent: {e}")
    
    def log_message(self, format, *args):
        """Suppress default logging."""
        pass


def main():
    """Run the token server."""
    port = 8080
    server = HTTPServer(('0.0.0.0', port), TokenHandler)

    print(f"🔑 Token server running on http://0.0.0.0:{port}")
    print(f"   Get token: http://<your-ip>:{port}/token?identity=farmer_123&room=test_room")
    print("   Press Ctrl+C to stop\n")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n✓ Token server stopped")
        server.server_close()


if __name__ == '__main__':
    main()
