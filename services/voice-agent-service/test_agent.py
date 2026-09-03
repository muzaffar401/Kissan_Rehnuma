"""Test the Kissan Rehnuma chat agent with various queries."""
import json
import sys
import httpx

CHAT_URL = "http://localhost:8090/api/chat"

def test(name: str, user_message: str):
    """Send a message and print the results."""
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"USER: {user_message}")
    print(f"{'='*60}")
    
    try:
        r = httpx.post(
            CHAT_URL,
            json={"messages": [{"role": "user", "content": user_message}]},
            timeout=45,
        )
        data = r.json()
        
        if "error" in data:
            print(f"ERROR: {data['error']}")
            return
        
        # Show tool calls
        tool_calls = data.get("tool_calls", [])
        if tool_calls:
            for tc in tool_calls:
                print(f"TOOL CALL: {tc['name']}({json.dumps(tc['arguments'], ensure_ascii=False)})")
                result = tc.get("result", {})
                print(f"RESULT: {json.dumps(result, ensure_ascii=False)[:200]}")
        else:
            print("NO TOOL CALLS (direct response)")
        
        # Show reply
        reply = data.get("reply", "")
        print(f"REPLY: {reply}")
        
    except Exception as e:
        print(f"EXCEPTION: {e}")


# Test 1: Weather (should call check_weather_alert with NO arguments)
test("Weather Query", "\u0645\u0648\u0633\u0645 \u06a9\u0627 \u062d\u0627\u0644 \u0628\u062a\u0627\u0624")

# Test 2: Market rates (should call get_market_rates)
test("Market Rate Query", "\u0622\u0644\u0648 \u06a9\u0627 \u0631\u06cc\u0679 \u0628\u062a\u0627\u0624")

# Test 3: Complaint status (should call check_complaint_status with NO arguments)
test("Complaint Status", "\u0645\u06cc\u0631\u06cc \u0634\u06a9\u0627\u06cc\u062a \u06a9\u0627 \u06a9\u06cc\u0627 \u06c1\u0648\u0627")

# Test 4: Register complaint (should ask for details first)
test("Register Complaint", "\u0634\u06a9\u0627\u06cc\u062a \u062f\u0631\u062c \u06a9\u0631\u0646\u06cc \u06c1\u06cc")

# Test 5: English weather query
test("English Weather", "What is the weather like?")

# Test 6: English complaint status
test("English Complaint Status", "Check my complaint status")
