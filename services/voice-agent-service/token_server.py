"""Simple token server for testing the voice agent.

This generates JWT tokens for LiveKit room access.
Run this alongside the agent: `py -3.13 token_server.py`
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from livekit import api


class TokenHandler(BaseHTTPRequestHandler):
    """HTTP handler for generating LiveKit tokens."""
    
    def do_GET(self):
        """Handle GET requests for token generation."""
        # Parse query parameters
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        
        # Extract identity from query string
        identity = params.get('identity', ['test_farmer'])[0]
        room_name = params.get('room', ['test_room'])[0]
        
        # Generate token
        token = self._generate_token(identity, room_name)
        
        # Dispatch agent to the room
        self._dispatch_agent(room_name)
        
        # Send response
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response = {
            'token': token,
            'identity': identity,
            'room': room_name,
        }
        self.wfile.write(json.dumps(response).encode())
        
        print(f"✓ Token generated for {identity} in room {room_name}")
    
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
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_subscribe=True,
                )
            )
        )
        
        return token.to_jwt()
    
    def _dispatch_agent(self, room_name: str) -> None:
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
            
            response = requests.post(dispatch_url, headers=headers, json=data, timeout=5)
            if response.status_code == 200:
                print(f"✓ Agent dispatched to room: {room_name}")
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
    server = HTTPServer(('localhost', port), TokenHandler)
    
    print(f"🔑 Token server running on http://localhost:{port}")
    print(f"   Get token: http://localhost:{port}/token?identity=farmer_123&room=test_room")
    print("   Press Ctrl+C to stop\n")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n✓ Token server stopped")
        server.server_close()


if __name__ == '__main__':
    main()
