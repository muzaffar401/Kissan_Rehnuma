import { useEffect, useState } from 'react';
import { View, I18nManager } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { tokenStorage } from './src/services/tokenStorage';
import i18n, { isRTL } from './src/i18n';
import SplashScreenView from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LanguageSelectionScreen from './src/screens/LanguageSelectionScreen';
import LoginSignupScreen from './src/screens/LoginSignupScreen';
import HomeDashboard from './src/screens/HomeDashboard';
import DiseaseScanScreen from './src/screens/DiseaseScanScreen';
import ScanHistoryScreen from './src/screens/ScanHistoryScreen';
import WeatherScreen from './src/screens/WeatherScreen';
import MarketRatesScreen from './src/screens/MarketRatesScreen';
import HelplineScreen from './src/screens/HelplineScreen';
import FaqScreen from './src/screens/FaqScreen';
import VoiceCallScreen from './src/screens/VoiceCallScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Keep native splash visible while app initializes
SplashScreen.preventAutoHideAsync().catch(() => {
  // On web or if native splash isn't configured, this may fail — safe to ignore
});

type Screen = 'loading' | 'splash' | 'onboarding' | 'language' | 'login' | 'home' | 'disease' | 'history' | 'weather' | 'market' | 'helpline' | 'voice-call' | 'settings' | 'faq';

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppInner() {
  const { colors } = useTheme();
  const [currentScreen, setCurrentScreen] = useState<Screen>('loading');

  useEffect(() => {
    // ─── Restore session on app start ───
    // Check if user is already logged in with a valid token.
    // If yes → skip splash/onboarding/login, go straight to home.
    const restoreSession = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Safe to ignore on web
      }

      // Load saved language preference and apply it
      const savedLang = await tokenStorage.getLanguage();
      if (savedLang) {
        await i18n.changeLanguage(savedLang);
        // Sync RTL layout direction for Urdu/Sindhi
        const rtl = isRTL(savedLang);
        if (I18nManager.isRTL !== rtl) {
          I18nManager.forceRTL(rtl);
        }
      }

      const hasValidToken = await tokenStorage.isTokenValid();

      if (hasValidToken) {
        // Token exists and is not expired → go to home
        console.log('[App] Valid token found — restoring session');
        setCurrentScreen('home');
        return;
      }

      // No valid token — check if onboarding was already completed
      const onboardingDone = await tokenStorage.isOnboardingComplete();

      if (onboardingDone) {
        // User has seen onboarding before but is not logged in → login screen
        console.log('[App] Onboarding complete, no valid token → login');
        setCurrentScreen('login');
      } else {
        // First time user → show splash → onboarding flow
        console.log('[App] First time → splash → onboarding');
        setCurrentScreen('splash');
      }
    };

    restoreSession();
  }, []);

  const renderScreen = () => {
    if (currentScreen === 'loading') {
      return <View style={{ flex: 1, backgroundColor: colors.primaryContainer }} />;
    }
    if (currentScreen === 'splash') {
      return <SplashScreenView onComplete={() => setCurrentScreen('onboarding')} />;
    }
    if (currentScreen === 'onboarding') {
      return <OnboardingScreen onComplete={() => setCurrentScreen('language')} />;
    }
    if (currentScreen === 'language') {
      return <LanguageSelectionScreen onComplete={() => setCurrentScreen('login')} />;
    }
    if (currentScreen === 'login') {
      return <LoginSignupScreen onComplete={() => setCurrentScreen('home')} />;
    }
    if (currentScreen === 'disease') {
      return <DiseaseScanScreen onNavigate={(s) => setCurrentScreen(s as Screen)} />;
    }
    if (currentScreen === 'history') {
      return <ScanHistoryScreen onNavigate={(s) => setCurrentScreen(s as Screen)} />;
    }
    if (currentScreen === 'weather') {
      return <WeatherScreen onNavigate={(s) => setCurrentScreen(s as Screen)} />;
    }
    if (currentScreen === 'market') {
      return <MarketRatesScreen onNavigate={(s) => setCurrentScreen(s as Screen)} />;
    }
    if (currentScreen === 'helpline') {
      return <HelplineScreen onNavigate={(s) => setCurrentScreen(s as Screen)} />;
    }
    if (currentScreen === 'voice-call') {
      return <VoiceCallScreen onNavigate={(s) => setCurrentScreen(s as Screen)} />;
    }
    if (currentScreen === 'settings') {
      return <SettingsScreen onNavigate={(s) => setCurrentScreen(s as Screen)} />;
    }
    if (currentScreen === 'faq') {
      return <FaqScreen onNavigate={(s) => setCurrentScreen(s as Screen)} />;
    }
    return <HomeDashboard onNavigate={(s) => setCurrentScreen(s as Screen)} />;
  };

  return renderScreen();
}
