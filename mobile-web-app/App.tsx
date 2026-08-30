import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { colors } from './src/theme/colors';
import SplashScreenView from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LanguageSelectionScreen from './src/screens/LanguageSelectionScreen';
import LoginSignupScreen from './src/screens/LoginSignupScreen';
import HomeDashboard from './src/screens/HomeDashboard';
import DiseaseScanScreen from './src/screens/DiseaseScanScreen';
import WeatherScreen from './src/screens/WeatherScreen';
import MarketRatesScreen from './src/screens/MarketRatesScreen';
import HelplineScreen from './src/screens/HelplineScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Keep native splash visible while app initializes
SplashScreen.preventAutoHideAsync().catch(() => {
  // On web or if native splash isn't configured, this may fail — safe to ignore
});

type Screen = 'loading' | 'splash' | 'onboarding' | 'language' | 'login' | 'home' | 'disease' | 'weather' | 'market' | 'helpline' | 'settings';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('loading');

  useEffect(() => {
    // Brief delay to let the app fully mount, then hide native splash
    // and show our JS animated splash
    const timer = setTimeout(async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Safe to ignore on web
      }
      setCurrentScreen('splash');
    }, 100);

    return () => clearTimeout(timer);
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
    if (currentScreen === 'weather') {
      return <WeatherScreen onNavigate={(s) => setCurrentScreen(s as Screen)} />;
    }
    if (currentScreen === 'market') {
      return <MarketRatesScreen onNavigate={(s) => setCurrentScreen(s as Screen)} />;
    }
    if (currentScreen === 'helpline') {
      return <HelplineScreen onNavigate={(s) => setCurrentScreen(s as Screen)} />;
    }
    if (currentScreen === 'settings') {
      return <SettingsScreen onNavigate={(s) => setCurrentScreen(s as Screen)} />;
    }
    return <HomeDashboard onNavigate={(s) => setCurrentScreen(s as Screen)} />;
  };

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      {renderScreen()}
    </SafeAreaProvider>
  );
}
