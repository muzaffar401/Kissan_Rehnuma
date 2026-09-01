import { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  useFonts,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
} from '@expo-google-fonts/be-vietnam-pro';
import { colors } from '../theme/colors';
import { weatherService, CurrentWeatherResponse, ForecastEntry, AlertHistoryItem, AdvisoryResponse } from '../services/weatherService';
import { tokenStorage } from '../services/tokenStorage';

type BottomTab = 'home' | 'disease' | 'weather' | 'market' | 'helpline';

interface WeatherScreenProps {
  onNavigate?: (screen: string) => void;
}

const bottomTabs: { key: BottomTab; icon: string; label: string }[] = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'disease', icon: 'leaf', label: 'Disease' },
  { key: 'weather', icon: 'weather-sunny', label: 'Weather' },
  { key: 'market', icon: 'tag', label: 'Market' },
  { key: 'helpline', icon: 'phone', label: 'Helpline' },
];

// Map wind + rain conditions to a weather icon name
function getWeatherIcon(rain_mm: number, wind_kmh: number, temp: number): string {
  if (rain_mm > 5) return 'weather-pouring';
  if (rain_mm > 1) return 'weather-rainy';
  if (wind_kmh > 30) return 'weather-windy';
  if (temp > 30) return 'weather-sunny';
  return 'weather-partly-cloudy';
}

function getWeatherCondition(rain_mm: number, wind_kmh: number, temp: number): string {
  if (rain_mm > 5) return 'Heavy Rain';
  if (rain_mm > 1) return 'Light Rain';
  if (wind_kmh > 30) return 'Windy';
  if (temp > 35) return 'Hot & Sunny';
  if (temp > 28) return 'Sunny';
  return 'Partly Cloudy';
}

// Get day label from ISO date string
function getDayLabel(isoTime: string, index: number): string {
  if (index === 0) return 'Today';
  const date = new Date(isoTime);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

// Derive farmer advice from current weather — REMOVED, now LLM-based via backend

export default function WeatherScreen({ onNavigate }: WeatherScreenProps) {
  const { width } = useWindowDimensions();
  const [bottomActive, setBottomActive] = useState<BottomTab>('weather');

  const [current, setCurrent] = useState<CurrentWeatherResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastEntry[]>([]);
  const [alerts, setAlerts] = useState<AlertHistoryItem[]>([]);
  const [advice, setAdvice] = useState<AdvisoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
  });

  const fetchData = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const userId = await tokenStorage.getUserId();
      const farmerId = parseInt(userId || '0', 10);
      if (!farmerId) throw new Error('Not logged in');

      // All 4 calls run in parallel — advisory is cached server-side (30 min TTL)
      const [currentData, forecastData, alertData, advisoryData] = await Promise.all([
        weatherService.getCurrentWeather(farmerId),
        weatherService.getForecast(farmerId),
        weatherService.getAlertHistory(farmerId),
        weatherService.getAdvisory(farmerId).catch(() => null),
      ]);

      setCurrent(currentData);
      setForecast(forecastData.forecast.slice(0, 5));
      setAlerts(alertData.alerts.slice(0, 3));
      if (advisoryData) setAdvice(advisoryData);
    } catch (e: any) {
      setError(e?.detail || 'Could not load weather data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (!fontsLoaded) return <View style={styles.container} />;

  const isWide = width > 600;
  const contentMaxWidth = isWide ? 672 : width;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <Pressable style={styles.appBarBackBtn} onPress={() => onNavigate?.('home')}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
          </Pressable>
          <Text style={styles.appBarTitle}>Kissan Rehnuma</Text>
        </View>
        <Pressable style={styles.appBarProfileBtn} onPress={() => fetchData(true)}>
          <MaterialCommunityIcons name="refresh" size={24} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { maxWidth: contentMaxWidth }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} />}
      >
        {/* Loading */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading weather data...</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons name="weather-cloudy-alert" size={48} color={colors.outline} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => fetchData()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Content */}
        {!loading && !error && current && (
          <>
            {/* Header Image with live weather overlay */}
            <View style={styles.headerImageContainer}>
              <Image source={require('../../assets/weather_header.jpg')} style={styles.headerImage} resizeMode="cover" />
              <View style={styles.headerGradient} />
              <View style={styles.headerCityOverlay}>
                <Text style={styles.headerCityName}>
                  {current.latitude.toFixed(2)}°N, {current.longitude.toFixed(2)}°E
                </Text>
                <Text style={styles.headerCityWeather}>
                  {getWeatherCondition(current.rain_mm, current.wind_speed_kmh, current.temperature)}
                  {' \u2022 '}{Math.round(current.temperature)}{'\u00B0'}C
                </Text>
                <Text style={styles.headerSubInfo}>
                  Humidity {current.humidity}% · Wind {Math.round(current.wind_speed_kmh)} km/h
                </Text>
              </View>
            </View>

            {/* Alert History */}
            {alerts.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Weather Alerts</Text>
                {alerts.map((alert, idx) => (
                  <View key={idx} style={styles.alertCard}>
                    <View style={styles.alertStripe} />
                    <View style={styles.alertContent}>
                      <View style={styles.alertIconCircle}>
                        <MaterialCommunityIcons name="alert" size={24} color={colors.onErrorContainer} />
                      </View>
                      <View style={styles.alertTextContainer}>
                        <Text style={styles.alertTitle}>{alert.alert_type}</Text>
                        <Text style={styles.alertDescription}>{alert.message}</Text>
                        <Text style={styles.alertTimestamp}>
                          {new Date(alert.sent_at).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Farmer's Advice — LLM Generated */}
            {advice && (
              <View style={styles.section}>
                <View style={styles.adviceSectionHeader}>
                  <MaterialCommunityIcons name="lightbulb-on" size={22} color={colors.primary} />
                  <Text style={styles.adviceSectionTitle}>Farmer's Advice</Text>
                  {advice.source === 'llm' && (
                    <View style={styles.llmBadge}>
                      <Text style={styles.llmBadgeText}>AI</Text>
                    </View>
                  )}
                </View>
                <View style={styles.adviceCard}>
                  <MaterialCommunityIcons
                    name="lightbulb-on-outline"
                    size={28}
                    color={colors.primary}
                    style={styles.adviceCardIcon}
                  />
                  <Text style={styles.adviceCardText}>{advice.advice}</Text>
                </View>
              </View>
            )}

            {/* Forecast */}
            {forecast.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Forecast</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.forecastScroll}
                  snapToInterval={112}
                  decelerationRate={Platform.OS === 'web' ? undefined : 'fast'}
                >
                  {forecast.map((entry, index) => (
                    <View
                      key={index}
                      style={[styles.forecastCard, index === 0 && styles.forecastCardToday]}
                    >
                      <Text style={[styles.forecastDay, index === 0 && styles.forecastDayToday]}>
                        {getDayLabel(entry.time, index)}
                      </Text>
                      <MaterialCommunityIcons
                        name={getWeatherIcon(entry.rain_mm, entry.wind_kmh, entry.temp_max) as any}
                        size={32}
                        color={index === 0 ? colors.primary : colors.secondary}
                      />
                      <Text style={styles.forecastHigh}>{Math.round(entry.temp_max)}{'\u00B0'}</Text>
                      <Text style={styles.forecastLow}>{Math.round(entry.temp_min)}{'\u00B0'}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {bottomTabs.map((tab) => {
          const isActive = bottomActive === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => {
                setBottomActive(tab.key);
                if (tab.key !== 'weather' && onNavigate) onNavigate(tab.key);
              }}
            >
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={24}
                color={isActive ? colors.onPrimaryContainer : colors.onSurfaceVariant}
              />
              <Text style={[styles.navLabel, isActive ? styles.navLabelActive : styles.navLabelInactive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  appBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56, backgroundColor: colors.surface,
    shadowColor: '#4A453C', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 4,
  },
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appBarBackBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, marginLeft: -8 },
  appBarTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, fontWeight: '700', color: colors.primary },
  appBarProfileBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  scrollView: { flex: 1 },
  scrollContent: { paddingVertical: 16, gap: 24, alignSelf: 'center' as const, width: '100%', paddingHorizontal: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 16, color: colors.onSurfaceVariant },
  errorText: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 14, color: colors.error, textAlign: 'center' },
  retryButton: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 8 },
  retryText: { fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 14, color: colors.onPrimary },
  headerImageContainer: { borderRadius: 12, overflow: 'hidden', height: 250, shadowColor: '#4A453C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  headerImage: { width: '100%', height: '100%' },
  headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  headerCityOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, justifyContent: 'flex-end', gap: 2 },
  headerCityName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, fontWeight: '700', color: '#ffffff' },
  headerCityWeather: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 18, fontWeight: '400', color: '#ffffff', lineHeight: 28 },
  headerSubInfo: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  section: { gap: 12 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 24, fontWeight: '600', color: colors.onSurface },
  alertCard: { backgroundColor: colors.surfaceContainer, borderRadius: 12, borderWidth: 1, borderColor: colors.outlineVariant, overflow: 'hidden', flexDirection: 'row' },
  alertStripe: { width: 8, backgroundColor: colors.error },
  alertContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, padding: 16, flex: 1 },
  alertIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.errorContainer, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  alertTextContainer: { flex: 1, gap: 4 },
  alertTitle: { fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 14, fontWeight: '600', color: colors.onSurface, letterSpacing: 0.14, marginBottom: 4 },
  alertDescription: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 16, fontWeight: '400', color: colors.onSurfaceVariant, lineHeight: 24 },
  alertTimestamp: { fontFamily: 'BeVietnamPro_500Medium', fontSize: 12, fontWeight: '500', color: colors.outline, marginTop: 8 },
  adviceSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adviceSectionTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 24, fontWeight: '600', color: colors.primary },
  adviceCard: { backgroundColor: colors.secondaryContainer, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.secondary, shadowColor: '#4A453C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  adviceCardIcon: { marginTop: 2, flexShrink: 0 },
  adviceCardText: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 16, fontWeight: '400', color: colors.onSurface, lineHeight: 26, flex: 1 },
  llmBadge: { backgroundColor: colors.primaryContainer, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 },
  llmBadgeText: { fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 10, fontWeight: '600', color: colors.primary },
  forecastScroll: { gap: 12, paddingVertical: 4 },
  forecastCard: { minWidth: 100, alignItems: 'center', padding: 16, backgroundColor: colors.surfaceContainerLowest, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceVariant, shadowColor: '#4A453C', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, gap: 8 },
  forecastCardToday: { borderColor: colors.primaryContainer, borderWidth: 2 },
  forecastDay: { fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 14, fontWeight: '600', color: colors.onSurface, letterSpacing: 0.14 },
  forecastDayToday: { color: colors.primary },
  forecastHigh: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700', color: colors.onSurface },
  forecastLow: { fontFamily: 'BeVietnamPro_500Medium', fontSize: 12, fontWeight: '500', color: colors.onSurfaceVariant },
  bottomNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: colors.surfaceContainer, height: 80, paddingHorizontal: 8, paddingBottom: Platform.OS === 'ios' ? 20 : 8, borderTopWidth: 1, borderTopColor: colors.surfaceDim, shadowColor: '#4A453C', shadowOffset: { width: 0, height: -1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 8 },
  navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 56, paddingVertical: 4, paddingHorizontal: 16, borderRadius: 16 },
  navItemActive: { backgroundColor: colors.primaryContainer, borderRadius: 28 },
  navLabel: { fontFamily: 'BeVietnamPro_500Medium', fontSize: 12, fontWeight: '500', marginTop: 4 },
  navLabelActive: { color: colors.onPrimaryContainer },
  navLabelInactive: { color: colors.onSurfaceVariant },
});
