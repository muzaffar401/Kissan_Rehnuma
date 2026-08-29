# Testing Guide - Voice Agent Service

## Quick Start

### 1. Start the Token Server (Terminal 1)
```bash
cd services/voice-agent-service
py -3.13 token_server.py
```

You should see:
```
🔑 Token server running on http://localhost:8080
   Get token: http://localhost:8080/token?identity=farmer_123&room=test_room
   Press Ctrl+C to stop
```

### 2. Start the Voice Agent (Terminal 2)
```bash
cd services/voice-agent-service
py -3.13 -m app.main dev
```

Wait for:
```
INFO livekit.agents - worker connected
```

### 3. Open the Test Page
Open `test.html` in your browser:
```bash
# Windows
start test.html

# Or just double-click the file
```

## How to Test

1. **Click "Connect"** in the test page
2. **Allow microphone access** when browser asks
3. **Speak in Roman Urdu**, for example:
   - "Assalam o Alaikum, main kisan rehnuma se baat kar raha hu"
   - "Mujhe gandum ki fasal mein bimari lag gayi hai"
   - "Aaj ka mosam kaisa hai?"
   - "Gandum ka market rate kya hai?"

4. **The agent will respond** in Roman Urdu through your speakers

## What to Try

### Register a Complaint
```
"Mujhe gandum ki fasal mein zard rang ke daagh nazar aa rahe hain. 
Ye Punjab ke ilaqay mein hai. Fasal abhi 2 mahine purani hai."
```

The agent should:
- Ask clarifying questions
- Use the `register_complaint` tool
- Give you a reference number

### Check Weather
```
"Aaj ka mosam kaisa hai? Kya barish hone wali hai?"
```

The agent should:
- Use the `check_weather_alert` tool
- Tell you about weather conditions

### Market Rates
```
"Gandum ka aaj ka rate kya hai?"
```

The agent should:
- Use the `get_market_rates` tool
- Tell you current market prices

### Check Complaint Status
```
"Meri complaint ka kya hua? Reference number CR-20260829-ABC123 tha."
```

The agent should:
- Use the `check_complaint_status` tool
- Tell you the status

## Troubleshooting

### "Failed to get token"
- Make sure token server is running on port 8080
- Check that LIVEKIT_API_KEY and LIVEKIT_API_SECRET are set in `.env`

### "Connection failed"
- Check your internet connection
- Verify LIVEKIT_URL is correct in `.env`
- Make sure the agent is running and connected to LiveKit

### No audio from agent
- Check browser permissions for audio
- Make sure speakers are not muted
- Check browser console for errors (F12)

### Agent not responding
- Check the agent terminal for errors
- Verify OPENROUTER_API_KEY and DEEPGRAM_API_KEY are valid
- Check UPLIFT_API_KEY is working

### Microphone not working
- Allow microphone access in browser
- Check if another app is using the microphone
- Try a different browser

## Logs

Check these logs for debugging:

1. **Token Server Terminal** - Shows token generation
2. **Agent Terminal** - Shows agent processing, tool calls
3. **Browser Console** (F12) - Shows connection status, errors
4. **Test Page Logs** - Shows real-time status updates

## Database Check

After registering complaints, check the database:

```bash
psql -U postgres -d voice_agent

# List all complaints
SELECT reference_number, category, status, created_at FROM complaints ORDER BY created_at DESC;

# List voice sessions
SELECT id, farmer_id, status, started_at FROM voice_sessions ORDER BY started_at DESC;

# List tool executions
SELECT tool_name, status, execution_time_ms FROM tool_executions ORDER BY created_at DESC;
```

## Expected Behavior

### Good Response Flow
1. You speak → Agent sees speech via Deepgram STT
2. Agent processes → LLM decides what to do
3. Agent calls tool (if needed) → Gets result
4. Agent generates response → LLM creates Roman Urdu response
5. Agent speaks → Uplift TTS converts to audio
6. You hear response → Audio plays through speakers

### Timing
- STT: ~1-2 seconds
- LLM: ~2-5 seconds
- TTS: ~1-3 seconds
- **Total: ~4-10 seconds** (depending on response complexity)

## Production Notes

Before deploying:

1. **Replace test token server** with proper authentication
2. **Add CORS restrictions** to token server
3. **Use HTTPS** for token endpoint
4. **Implement proper user authentication**
5. **Add rate limiting**
6. **Set up monitoring** (Prometheus metrics already included)
7. **Configure proper logging** (JSON logs ready)

## API Keys Check

Make sure all keys are valid:

```bash
# Test OpenRouter
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY"

# Test Deepgram
curl https://api.deepgram.com/v1/listen \
  -H "Authorization: Token YOUR_DEEPGRAM_KEY"

# Test Uplift AI
curl -X POST https://api.upliftai.org/v1/synthesis/text-to-speech \
  -H "Authorization: Bearer YOUR_UPLIFT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"voiceId":"v_8eelc901","text":"Test","outputFormat":"WAV_22050_16"}'
```
