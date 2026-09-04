<h1 align="center">Kissan Rehnuma — Mobile & Web App</h1>

<p align="center">
  React Native (Expo) frontend targeting both mobile devices and web browsers
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-SDK_57-000020?logo=expo" alt="Expo" />
  <img src="https://img.shields.io/badge/React_Native-TypeScript-61dafb?logo=react" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Material_Design-3-7F3FBF" alt="MD3" />
</p>

---

## Overview

Single React Native codebase that runs on Android, iOS, and web browsers via Expo. Built with TypeScript and Material Design 3 theming (light + dark mode). All screens are bilingual — English and Urdu with PlusJakartaSans and BeVietnamPro font families.

The app communicates exclusively through the API Gateway (`/api/v1/*`), which proxies requests to the appropriate microservice.

---

## Screens

| Screen | Description | Backend Service |
|--------|-------------|-----------------|
| **SplashScreen** | Animated app launch with logo | — |
| **OnboardingScreen** | 3-slide feature introduction carousel | — |
| **LanguageSelectionScreen** | English / اردو language picker | — |
| **LoginSignupScreen** | Tabbed login & signup with OTP verification | User Auth |
| **HomeDashboard** | Feature grid, greeting, bottom navigation | — |
| **DiseaseScanScreen** | Camera/gallery image upload for crop detection | Crop Disease |
| **ScanHistoryScreen** | Past crop + animal scan results | Crop/Animal Disease |
| **WeatherScreen** | Current weather, 7-day forecast, AI advisory | Weather Alert |
| **MarketRatesScreen** | Mandi prices, search, category filters | Market Rate |
| **HelplineScreen** | Voice call interface with LiveKit WebRTC | Voice Agent |
| **SettingsScreen** | Dark mode toggle, language, profile, logout | — |
| **FaqScreen** | Frequently asked questions | — |
| **VoiceCallScreen** | Active WebRTC voice session with AI agent | Voice Agent |

---

## Project Structure

```
mobile-web-app/
├── src/
│   ├── screens/              # One file per screen
│   ├── components/           # Reusable UI (ScreenWrapper, etc.)
│   ├── services/
│   │   ├── config.ts         # API base URL, endpoint paths
│   │   ├── api.ts            # Axios instance with JWT interceptor
│   │   ├── authService.ts    # Login, signup, OTP, profile
│   │   ├── cropService.ts    # Disease detection, history
│   │   ├── animalService.ts  # Animal diagnosis, history
│   │   ├── weatherService.ts # Weather, forecast, advisory
│   │   └── marketService.ts  # Market rates, trending
│   └── theme/
│       └── ThemeContext.tsx   # Light/dark mode with useTheme() hook
├── assets/                   # Images, icons, fonts
├── App.tsx                   # Root component with ThemeProvider
├── app.json                  # Expo configuration
├── package.json
└── tsconfig.json
```

---

## Key Features

### Material Design 3 Theming
- Full light and dark mode with custom color palettes
- `useTheme()` hook provides `colors` object to every component
- Persisted preference via AsyncStorage

### Bottom Navigation
- 6-tab bottom nav with MD3 indicator bar (active tab highlighted)
- Shared across Home, Disease, Weather, Market, Helpline, Settings

### Bilingual Support
- English and Urdu translations for all UI text
- RTL-aware layout for Urdu content
- PlusJakartaSans (English) + BeVietnamPro (Urdu) fonts

### API Communication
- Single Axios instance with JWT token interceptor
- Automatic token refresh on 401 responses
- Gateway-only communication (frontend never calls microservices directly)

---

## Quick Start

### Development

```bash
cd mobile-web-app

npm install

# Start Expo dev server
npx expo start

# Web only
npx expo start --web        # opens http://localhost:8081
```

### Production Build (Web)

```bash
# Static export for Vercel/Netlify
npx expo export -p web

# Output in dist/ directory
# Deploy dist/ to any static hosting provider
```

### Vercel Deployment

Create `vercel.json` in `mobile-web-app/`:

```json
{
  "buildCommand": "expo export -p web",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "framework": null,
  "rewrites": [{ "source": "/:path*", "destination": "/" }]
}
```

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Expo SDK 57** | Cross-platform React Native framework |
| **TypeScript** | Type-safe development |
| **Material Design 3** | Design system (custom theme, not library) |
| **React Native Paper** | MD3 components (TextInput, etc.) |
| **Axios** | HTTP client with interceptors |
| **AsyncStorage** | Persistent token & preference storage |
| **Expo Image Picker** | Camera/gallery image selection |
| **LiveKit Client** | WebRTC for voice helpline |
| **Metro Bundler** | JavaScript bundler for web export |

---

## Environment Configuration

API URLs are configured in [`src/services/config.ts`](src/services/config.ts):

- **Development:** Connects to `http://localhost:3000` (API Gateway)
- **Production:** Set to your deployed gateway URL (e.g., `https://kissan-api-gateway.onrender.com`)
- **Mobile device:** Auto-detects `window.location.hostname` for LAN access
