# Mobile browser testing

Run from `mobile-web-app` in PowerShell to export a preview that uses the same HTTPS origin for the API and voice token:

```powershell
$env:EXPO_PUBLIC_SAME_ORIGIN_API = 'true'
node node_modules/expo/bin/cli export --platform web --output-dir .expo/mobile-preview
Remove-Item Env:EXPO_PUBLIC_SAME_ORIGIN_API
```

From the repository root, start the optional preview and temporary Cloudflare tunnel:

```powershell
docker compose --profile mobile-test up -d mobile-preview mobile-tunnel
docker compose logs --tail 60 mobile-tunnel
```

Open the `https://...trycloudflare.com` URL from the logs in mobile Chrome or Safari. Log in and allow microphone access when starting a call. The phone can use Wi-Fi or mobile data. Keep the laptop awake and Docker running.

This URL is public and temporary; it can change when the tunnel restarts. Login is still required for protected API endpoints. Re-export after frontend changes; restart `mobile-preview` after changing its nginx configuration.

Stop public access when testing is finished:

```powershell
docker compose --profile mobile-test stop mobile-tunnel mobile-preview
```

The normal laptop development server and default Compose services do not require this profile.

If Docker cannot reach Cloudflare but Windows can, use the official Windows `cloudflared` client instead:

```powershell
cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8090
```

Keep that process running. The preview port is bound to laptop loopback only; the phone should use the HTTPS tunnel URL. Stop that Windows process to close its public tunnel.
