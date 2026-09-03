"""Simple chat test interface for the Kissan Rehnuma voice agent.

Run: py -3.13 chat_test.py
Open: http://localhost:8090

This lets you test the LLM + tools via text chat before testing via voice.
"""

import json
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
import httpx
import uvicorn

from app.agents.instructions import build_instructions

app = FastAPI()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Tool definitions — same as voice agent but with mock responses for testing
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "check_weather_alert",
            "description": "Check current weather conditions and forecast for the farmer. Call IMMEDIATELY when farmer asks about weather/mausam. Takes NO arguments. Do NOT ask any questions before calling it.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_market_rates",
            "description": "Get current market rates for a crop across all mandis. Call when farmer asks about crop prices. Pass crop name in Roman Urdu.",
            "parameters": {
                "type": "object",
                "properties": {
                    "crop": {
                        "type": "string",
                        "description": 'Crop name in Roman Urdu (e.g., "aloo", "gandum", "tamatar")',
                    },
                    "mandi": {
                        "type": "string",
                        "description": "Market/mandi name. Use 'nearest' if not specified.",
                    },
                },
                "required": ["crop"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "register_complaint",
            "description": "Register a new farmer complaint.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "description": "Complaint category"},
                    "description": {"type": "string", "description": "Complaint description"},
                    "district": {"type": "string", "description": "District name"},
                    "crop": {"type": "string", "description": "Crop name (optional)"},
                    "urgency": {"type": "string", "description": "urgency level"},
                },
                "required": ["category", "description", "district"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_complaint_status",
            "description": "Check the status of the farmer's complaints. Call IMMEDIATELY when farmer asks about shikayat/complaint status. Takes NO arguments — system identifies farmer automatically. Do NOT ask for reference number.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
]


async def execute_tool(name: str, arguments: dict) -> dict:
    """Execute a tool and return the result. Calls real backend services."""
    farmer_id = "1"  # Test farmer ID

    if name == "check_weather_alert":
        # Call real weather service
        async with httpx.AsyncClient() as client:
            # Generate a simple JWT
            from jose import jwt
            from datetime import datetime, timedelta
            token = jwt.encode(
                {"sub": farmer_id, "iss": "chat-test", "exp": datetime.utcnow() + timedelta(minutes=5)},
                "change-this-secret-key",
                algorithm="HS256",
            )
            headers = {"Authorization": f"Bearer {token}"}
            try:
                r = await client.get(
                    f"http://localhost:8004/api/v1/weather/current/{farmer_id}",
                    headers=headers,
                    timeout=10,
                )
                if r.status_code == 200:
                    data = r.json()
                    return {
                        "success": True,
                        "message": (
                            f"Temperature {data.get('temperature', 'N/A')}°C, "
                            f"humidity {data.get('humidity', 'N/A')}%, "
                            f"wind {data.get('wind_speed_kmh', 'N/A')} km/h, "
                            f"rain {data.get('rain_mm', 'N/A')}mm."
                        ),
                    }
                else:
                    return {"success": False, "message": f"Weather service returned {r.status_code}: {r.text}"}
            except Exception as e:
                return {"success": False, "message": f"Weather service error: {str(e)}"}

    elif name == "get_market_rates":
        crop = arguments.get("crop", "")
        async with httpx.AsyncClient() as client:
            try:
                r = await client.get(f"http://localhost:8005/api/v1/rates/{crop}", timeout=10)
                if r.status_code == 200:
                    data = r.json()
                    prices = data.get("prices", [])
                    lines = []
                    for p in prices[:5]:
                        lines.append(f"{p.get('mandi', '?')}: Rs {p.get('price_per_kg', 0):.0f}/kg")
                    return {
                        "success": True,
                        "crop": data.get("crop", crop),
                        "message": ". ".join(lines) if lines else "No prices found.",
                    }
                else:
                    return {"success": False, "message": f"Market service returned {r.status_code}"}
            except Exception as e:
                return {"success": False, "message": f"Market service error: {str(e)}"}

    elif name == "register_complaint":
        return {
            "success": True,
            "reference_number": "KR-2026-TEST12345",
            "message": "Complaint registered successfully. Reference: KR-2026-TEST12345",
        }

    elif name == "check_complaint_status":
        return {
            "success": True,
            "complaints": [
                {
                    "category": "animal_disease",
                    "status": "registered",
                    "description": "جانور کو سخت بخار ہے",
                    "district": "Faisalabad",
                    "created": "2026-09-03",
                },
                {
                    "category": "animal_disease",
                    "status": "registered",
                    "description": "بھینس کو بہت تیز بخار ہے",
                    "district": "Multan",
                    "created": "2026-08-30",
                },
                {
                    "category": "crop_disease",
                    "status": "registered",
                    "description": "گندم کی فصل کو زنگ لگ گیا ہے",
                    "district": "Lahore",
                    "created": "2026-08-29",
                },
                {
                    "category": "crop_disease",
                    "status": "in_review",
                    "description": "گندم کے پتوں پر زرد دھبے",
                    "district": "Faisalabad",
                    "created": "2026-08-29",
                },
            ],
            "message": "Found 4 complaint(s). 1. animal_disease: جانور کو سخت بخار ہے — درج شدہ | 2. animal_disease: بھینس کو بہت تیز بخار ہے — درج شدہ | 3. crop_disease: گندم کی فصل کو زنگ لگ گیا ہے — درج شدہ | 4. crop_disease: گندم کے پتوں پر زرد دھبے — جائزہ لیا جا رہا ہے",
        }

    return {"success": False, "message": f"Unknown tool: {name}"}


@app.post("/api/chat")
async def chat(request: Request):
    """Handle chat messages — proxy to OpenRouter with tool calling."""
    body = await request.json()
    messages = body.get("messages", [])

    # Build messages with system prompt
    full_messages = [
        {"role": "system", "content": build_instructions()},
        {"role": "system", "content": (
            "The farmer's ID is 1. The system automatically looks up their "
            "complaints. NEVER ask for a reference number. When farmer asks "
            "about complaint status, call check_complaint_status() immediately "
            "with NO arguments."
        )},
    ] + messages

    # Call OpenRouter
    async with httpx.AsyncClient() as client:
        r = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8090",
                "X-Title": "Kissan Rehnuma Chat Test",
            },
            json={
                "model": OPENROUTER_MODEL,
                "messages": full_messages,
                "tools": TOOLS,
                "temperature": 0.3,
            },
            timeout=30,
        )

        if r.status_code != 200:
            return {"error": f"OpenRouter error {r.status_code}: {r.text}"}

        data = r.json()
        choice = data["choices"][0]
        message = choice["message"]

        # Check if LLM wants to call a tool
        if message.get("tool_calls"):
            tool_results = []
            for tc in message["tool_calls"]:
                fn_name = tc["function"]["name"]
                fn_args = json.loads(tc["function"]["arguments"])
                result = await execute_tool(fn_name, fn_args)
                tool_results.append({
                    "tool_call_id": tc["id"],
                    "role": "tool",
                    "name": fn_name,
                    "arguments": fn_args,
                    "result": result,
                })

            # Send tool results back to LLM for final response
            followup_messages = messages + [message] + [
                {"role": "tool", "content": json.dumps(tr["result"]), "tool_call_id": tr["tool_call_id"]}
                for tr in tool_results
            ]
            full_followup = [
                {"role": "system", "content": build_instructions()},
                {"role": "system", "content": (
                    "The farmer's ID is 1. The system automatically looks up their "
                    "complaints. NEVER ask for a reference number. When farmer asks "
                    "about complaint status, call check_complaint_status() immediately "
                    "with NO arguments."
                )},
            ] + followup_messages

            r2 = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:8090",
                    "X-Title": "Kissan Rehnuma Chat Test",
                },
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": full_followup,
                    "temperature": 0.3,
                },
                timeout=30,
            )

            if r2.status_code == 200:
                data2 = r2.json()
                final_msg = data2["choices"][0]["message"]["content"]
                return {
                    "reply": final_msg,
                    "tool_calls": tool_results,
                }
            else:
                return {"error": f"Follow-up OpenRouter error {r2.status_code}"}

        # No tool call — direct response
        return {
            "reply": message.get("content", ""),
            "tool_calls": [],
        }


HTML_PAGE = """<!DOCTYPE html>
<html lang="ur" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kissan Rehnuma — Chat Test</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; height: 100vh; display: flex; flex-direction: column; }
  header { background: #16213e; padding: 12px 20px; border-bottom: 2px solid #0f3460; }
  header h1 { font-size: 18px; color: #e94560; }
  header p { font-size: 12px; color: #888; margin-top: 4px; }
  #chat { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .msg { max-width: 80%; padding: 10px 14px; border-radius: 12px; line-height: 1.6; font-size: 15px; }
  .msg.user { align-self: flex-end; background: #0f3460; color: #fff; border-bottom-right-radius: 4px; }
  .msg.assistant { align-self: flex-start; background: #16213e; color: #eee; border-bottom-left-radius: 4px; }
  .msg.system { align-self: center; background: #0a0a1a; color: #888; font-size: 12px; padding: 6px 12px; border-radius: 8px; }
  .tool-call { align-self: center; background: #1a3a1a; color: #7f7; font-size: 12px; padding: 6px 12px; border-radius: 8px; font-family: monospace; max-width: 90%; word-break: break-all; }
  .tool-result { align-self: center; background: #3a3a1a; color: #ff7; font-size: 12px; padding: 6px 12px; border-radius: 8px; font-family: monospace; max-width: 90%; word-break: break-all; }
  #input-area { display: flex; gap: 8px; padding: 12px 16px; background: #16213e; border-top: 2px solid #0f3460; }
  #input { flex: 1; padding: 10px 14px; border: 1px solid #0f3460; border-radius: 8px; background: #1a1a2e; color: #eee; font-size: 15px; outline: none; }
  #input:focus { border-color: #e94560; }
  #send { padding: 10px 20px; background: #e94560; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: bold; }
  #send:hover { background: #c73e54; }
  #send:disabled { background: #555; cursor: not-allowed; }
  .quick-btns { display: flex; gap: 6px; padding: 8px 16px; background: #16213e; flex-wrap: wrap; }
  .quick-btn { padding: 6px 12px; background: #0f3460; color: #aaa; border: 1px solid #1a3a6e; border-radius: 16px; cursor: pointer; font-size: 12px; }
  .quick-btn:hover { background: #1a4a7e; color: #fff; }
</style>
</head>
<body>
<header>
  <h1>Kissan Rehnuma — Chat Test Interface</h1>
  <p>Same LLM + Tools as voice agent. Test tool calling here first.</p>
</header>
<div id="chat">
  <div class="msg assistant">السلام علیکم! میں کسان رہنما ہوں۔ بتائیے میں آپ کی کیا مدد کر سکتا ہوں؟</div>
</div>
<div class="quick-btns">
  <button class="quick-btn" onclick="sendQuick('موسم کا حال بتاؤ')">موسم کا حال</button>
  <button class="quick-btn" onclick="sendQuick('آلو کا ریٹ بتاؤ')">آلو کا ریٹ</button>
  <button class="quick-btn" onclick="sendQuick('گندم کے ریٹ بتاؤ')">گندم کے ریٹ</button>
  <button class="quick-btn" onclick="sendQuick('ٹماٹر کا ریٹ کیا ہے')">ٹماٹر کا ریٹ</button>
  <button class="quick-btn" onclick="sendQuick('شکایت درج کرنی ہے')">شکایت درج کرو</button>
  <button class="quick-btn" onclick="sendQuick('میری شکایت کا کیا ہوا')">شکایت کا حال</button>
  <button class="quick-btn" onclick="sendQuick('What can you do?')">کیا کر سکتے ہو؟</button>
</div>
<div id="input-area">
  <input id="input" type="text" placeholder="Type a message... (Urdu or English)" onkeydown="if(event.key==='Enter')send()">
  <button id="send" onclick="send()">Send</button>
</div>
<script>
const messages = [
  { role: "assistant", content: "السلام علیکم! میں کسان رہنما ہوں۔ بتائیے میں آپ کی کیا مدد کر سکتا ہوں؟" }
];

function addMsg(role, text) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function addToolCall(text) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = "tool-call";
  div.textContent = "🔧 " + text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function addToolResult(text) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = "tool-result";
  div.textContent = "📋 " + text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function send() {
  const input = document.getElementById("input");
  const btn = document.getElementById("send");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  btn.disabled = true;
  addMsg("user", text);
  messages.push({ role: "user", content: text });

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    const data = await res.json();

    if (data.error) {
      addMsg("system", "Error: " + data.error);
    } else {
      // Show tool calls
      if (data.tool_calls) {
        for (const tc of data.tool_calls) {
          addToolCall("Called: " + tc.name + "(" + JSON.stringify(tc.arguments) + ")");
          addToolResult("Result: " + JSON.stringify(tc.result));
        }
      }
      // Show reply
      if (data.reply) {
        addMsg("assistant", data.reply);
        messages.push({ role: "assistant", content: data.reply });
      }
    }
  } catch (e) {
    addMsg("system", "Network error: " + e.message);
  }

  btn.disabled = false;
  input.focus();
}

function sendQuick(text) {
  document.getElementById("input").value = text;
  send();
}
</script>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
async def index():
    return HTML_PAGE


if __name__ == "__main__":
    print("Chat test interface: http://localhost:8090")
    print("Press Ctrl+C to stop")
    uvicorn.run(app, host="0.0.0.0", port=8090)
