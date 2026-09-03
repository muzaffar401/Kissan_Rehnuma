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
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { weatherService, CurrentWeatherResponse, ForecastEntry, AlertHistoryItem, AdvisoryResponse } from '../services/weatherService';
import { tokenStorage } from '../services/tokenStorage';

type BottomTab = 'home' | 'disease' | 'weather' | 'market' | 'helpline';

interface WeatherScreenProps {
  onNavigate?: (screen: string) => void;
}

const BOTTOM_TABS: { key: BottomTab; icon: string; labelKey: string }[] = [
  { key: 'home', icon: 'home', labelKey: 'common.nav.home' },
  { key: 'disease', icon: 'leaf', labelKey: 'common.nav.disease' },
  { key: 'weather', icon: 'weather-sunny', labelKey: 'common.nav.weather' },
  { key: 'market', icon: 'tag', labelKey: 'common.nav.market' },
  { key: 'helpline', icon: 'phone', labelKey: 'common.nav.helpline' },
];

// Map wind + rain conditions to a weather icon name
function getWeatherIcon(rain_mm: number, wind_kmh: number, temp: number): string {
  if (rain_mm > 5) return 'weather-pouring';
  if (rain_mm > 1) return 'weather-rainy';
  if (wind_kmh > 30) return 'weather-windy';
  if (temp > 30) return 'weather-sunny';
  return 'weather-partly-cloudy';
}

function getWeatherConditionKey(rain_mm: number, wind_kmh: number, temp: number): string {
  if (rain_mm > 5) return 'weather.heavyRain';
  if (rain_mm > 1) return 'weather.lightRain';
  if (wind_kmh > 30) return 'weather.windy';
  if (temp > 35) return 'weather.hotSunny';
  if (temp > 28) return 'weather.sunny';
  return 'weather.partlyCloudy';
}

// Map English short day names to i18n keys
const _DAY_KEYS: Record<string, string> = {
  Sun: 'weekdays.sun', Mon: 'weekdays.mon', Tue: 'weekdays.tue',
  Wed: 'weekdays.wed', Thu: 'weekdays.thu', Fri: 'weekdays.fri',
  Sat: 'weekdays.sat',
};

// Get day label i18n key from ISO date string
function getDayLabelKey(isoTime: string, index: number): string {
  if (index === 0) return 'weather.today';
  const date = new Date(isoTime);
  const en = date.toLocaleDateString('en-US', { weekday: 'short' });
  return _DAY_KEYS[en] || en;
}

// Group hourly forecast entries into daily summaries
function groupForecastByDay(entries: ForecastEntry[]): ForecastEntry[] {
  const dayMap = new Map<string, ForecastEntry[]>();
  for (const entry of entries) {
    const dateKey = entry.time.split('T')[0]; // "2026-09-04"
    if (!dayMap.has(dateKey)) dayMap.set(dateKey, []);
    dayMap.get(dateKey)!.push(entry);
  }
  const daily: ForecastEntry[] = [];
  for (const [, group] of dayMap) {
    daily.push({
      time: group[0].time,
      temp_min: Math.min(...group.map(e => e.temp_min)),
      temp_max: Math.max(...group.map(e => e.temp_max)),
      rain_mm: group.reduce((sum, e) => sum + e.rain_mm, 0),
      wind_kmh: Math.max(...group.map(e => e.wind_kmh)),
    });
  }
  return daily;
}

// Derive farmer advice from current weather — REMOVED, now LLM-based via backend

export default function WeatherScreen({ onNavigate }: WeatherScreenProps) {
  const { t } = useTranslation();
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
        weatherService.getAdvisory(farmerId, i18n.language).catch(() => null),
      ]);

      setCurrent(currentData);
      setForecast(groupForecastByDay(forecastData.forecast).slice(0, 7));
      setAlerts(alertData.alerts.slice(0, 3));
      if (advisoryData) setAdvice(advisoryData);
    } catch (e: any) {
      setError(e?.detail || t('weather.couldNotLoad'));
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
          <Text style={styles.appBarTitle}>{t('common.appName')}</Text>
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
            <Text style={styles.loadingText}>{t('weather.loadingData')}</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons name="weather-cloudy-alert" size={48} color={colors.outline} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => fetchData()}>
              <Text style={styles.retryText}>{t('weather.retry')}</Text>
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
                  {t(getWeatherConditionKey(current.rain_mm, current.wind_speed_kmh, current.temperature))}
                  {' \u2022 '}{Math.round(current.temperature)}{'\u00B0'}C
                </Text>
                <Text style={styles.headerSubInfo}>
                  {t('weather.humidityWind', { humidity: current.humidity, wind: Math.round(current.wind_speed_kmh) })}
                </Text>
              </View>
            </View>

            {/* Alert History */}
            {alerts.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('weather.weatherAlerts')}</Text>
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
                  <Text style={styles.adviceSectionTitle}>{t('weather.farmersAdvice')}</Text>
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
                <Text style={styles.sectionTitle}>{t('weather.forecast')}</Text>
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
                        {t(getDayLabelKey(entry.time, index))}
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
        {BOTTOM_TABS.map((tab) => {
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
                {t(tab.labelKey)}
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
