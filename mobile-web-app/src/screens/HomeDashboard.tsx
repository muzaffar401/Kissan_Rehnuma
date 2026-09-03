import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  useFonts,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
} from '@expo-google-fonts/be-vietnam-pro';
import { useTheme } from '../theme/ThemeContext';
import type { ColorPalette } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { tokenStorage } from '../services/tokenStorage';
import { weatherService } from '../services/weatherService';
import type { CurrentWeatherResponse, AdvisoryResponse } from '../services/weatherService';
import { marketService } from '../services/marketService';
import type { TrendEntry } from '../services/marketService';
import { translateCropName } from '../services/cropTranslations';

type TabKey = 'home' | 'disease' | 'weather' | 'market' | 'helpline';

interface HomeDashboardProps {
  onNavigate?: (screen: string) => void;
}

type IconName = typeof MaterialCommunityIcons extends React.ComponentType<{ name: infer N }> ? N : string;

type NavTab = { key: TabKey; icon: any; labelKey: string };
const NAV_TABS: NavTab[] = [
  { key: 'home', icon: 'home', labelKey: 'common.nav.home' },
  { key: 'disease', icon: 'leaf', labelKey: 'common.nav.disease' },
  { key: 'weather', icon: 'weather-sunny', labelKey: 'common.nav.weather' },
  { key: 'market', icon: 'tag', labelKey: 'common.nav.market' },
  { key: 'helpline', icon: 'phone', labelKey: 'common.nav.helpline' },
];

type FeatureCard = {
  id: string; titleKey: string; subtitleKey: string;
  image?: any; iconName?: any; isImage: boolean; isUrgent?: boolean;
};
const FEATURE_CARDS: FeatureCard[] = [
  { id: 'crop', titleKey: 'dashboard.cropDisease', subtitleKey: 'dashboard.scanCrop', image: require('../../assets/onboarding_crop.jpg'), isImage: true },
  { id: 'animal', titleKey: 'dashboard.animalDisease', subtitleKey: 'dashboard.scanAnimal', iconName: 'cow' as any, isImage: false },
  { id: 'market', titleKey: 'dashboard.marketRates', subtitleKey: 'dashboard.marketRates', image: require('../../assets/onboarding_market.jpg'), isImage: true },
  { id: 'helpline', titleKey: 'dashboard.callHelpline', subtitleKey: 'dashboard.callHelpline', image: require('../../assets/onboarding_helpline.png'), isImage: true, isUrgent: true },
];

// ── Helpers ────────────────────────────────────────────────────────

function getGreetingKey(): string {
  const h = new Date().getHours();
  if (h < 5) return 'dashboard.goodNight';
  if (h < 12) return 'dashboard.goodMorning';
  if (h < 17) return 'dashboard.goodAfternoon';
  if (h < 21) return 'dashboard.goodEvening';
  return 'dashboard.goodNight';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getWeatherIcon(rain: number, wind: number, temp: number): string {
  if (rain > 5) return 'weather-pouring';
  if (rain > 1) return 'weather-rainy';
  if (wind > 30) return 'weather-windy';
  if (temp > 35) return 'weather-sunny';
  return 'weather-partly-cloudy';
}

function getWeatherConditionKey(rain: number, wind: number, temp: number): string {
  if (rain > 5) return 'dashboard.weatherHeavyRain';
  if (rain > 1) return 'dashboard.weatherLightRain';
  if (wind > 30) return 'dashboard.weatherWindy';
  if (temp > 35) return 'dashboard.weatherHotSunny';
  if (temp > 28) return 'dashboard.weatherSunny';
  return 'dashboard.weatherPartlyCloudy';
}

function getTrendIcon(direction: string): string {
  switch (direction) {
    case 'up': return 'trending-up';
    case 'down': return 'trending-down';
    case 'new': return 'star';
    default: return 'trending-neutral';
  }
}

function getTrendColor(direction: string, colors: ColorPalette): string {
  switch (direction) {
    case 'up': return '#d32f2f';
    case 'down': return '#2e7d32';
    case 'new': return '#f57c00';
    default: return colors.onSurfaceVariant;
  }
}

// ── Component ──────────────────────────────────────────────────────

export default function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
  });

  // ── Live data state ──
  const [userName, setUserName] = useState<string>('');
  const [weather, setWeather] = useState<CurrentWeatherResponse | null>(null);
  const [advisory, setAdvisory] = useState<AdvisoryResponse | null>(null);
  const [trending, setTrending] = useState<TrendEntry[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch all data ──
  const fetchDashboardData = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setWeatherLoading(true);

    try {
      // Load farmer name
      const name = await tokenStorage.getUserName();
      if (name) setUserName(name);

      // Get farmer id
      const userId = await tokenStorage.getUserId();
      const farmerId = parseInt(userId || '0', 10);

      if (farmerId) {
        // Fetch weather + advisory + trending in parallel
        const [weatherData, advisoryData, trendingData] = await Promise.allSettled([
          weatherService.getCurrentWeather(farmerId),
          weatherService.getAdvisory(farmerId, i18n.language),
          marketService.getTrending(7),
        ]);

        if (weatherData.status === 'fulfilled') setWeather(weatherData.value);
        if (advisoryData.status === 'fulfilled') setAdvisory(advisoryData.value);
        if (trendingData.status === 'fulfilled') setTrending(trendingData.value.trends.slice(0, 3));
      }
    } catch {
      // Non-fatal: dashboard still shows with defaults
    } finally {
      setWeatherLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  // Responsive grid: 2 columns with gap, constrained max width
  const isWide = width > 600;
  const contentMaxWidth = isWide ? 672 : width;
  const cardGap = 12;
  const cardWidth = isWide
    ? (contentMaxWidth - 40 - cardGap) / 2
    : (width - 40 - cardGap) / 2;

  const handleTabPress = (key: TabKey) => {
    setActiveTab(key);
    if (key === 'disease' && onNavigate) {
      onNavigate('disease');
    }
    if (key === 'weather' && onNavigate) {
      onNavigate('weather');
    }
    if (key === 'market' && onNavigate) {
      onNavigate('market');
    }
    if (key === 'helpline' && onNavigate) {
      onNavigate('helpline');
    }
  };

  const handleCardPress = (cardId: string) => {
    if ((cardId === 'crop' || cardId === 'animal') && onNavigate) {
      onNavigate('disease');
    }
    if (cardId === 'market' && onNavigate) {
      onNavigate('market');
    }
    if (cardId === 'helpline' && onNavigate) {
      onNavigate('helpline');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <Pressable style={styles.appBarButton}>
          <MaterialCommunityIcons
            name="tractor-variant"
            size={24}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
        <Text style={styles.appBarTitle}>{t('common.appName')}</Text>
        <Pressable style={styles.appBarButton} onPress={() => onNavigate?.('settings')}>
          <MaterialCommunityIcons
            name="cog"
            size={24}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
      </View>

      {/* Main Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { maxWidth: contentMaxWidth, paddingHorizontal: 20 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchDashboardData(true)} />
        }
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingName}>
            {userName ? t('dashboard.helloName', { name: userName }) : t('dashboard.hello')}
          </Text>
          <Text style={styles.greetingTime}>{t(getGreetingKey())}</Text>
          <Text style={styles.greetingDate}>{formatDate()}</Text>
        </View>

        {/* Weather Card */}
        {weatherLoading ? (
          <View style={styles.weatherCard}>
            <ActivityIndicator size="large" color={colors.primary} style={{ paddingVertical: 24 }} />
          </View>
        ) : weather ? (
          <Pressable onPress={() => onNavigate?.('weather')}>
            <View style={styles.weatherCard}>
              <View style={styles.weatherIconCircle}>
                <MaterialCommunityIcons
                  name={getWeatherIcon(weather.rain_mm, weather.wind_speed_kmh, weather.temperature) as any}
                  size={40}
                  color={colors.onSecondaryContainer}
                />
              </View>
              <View style={styles.weatherInfo}>
                <View style={styles.weatherTempRow}>
                  <Text style={styles.weatherTemp}>{Math.round(weather.temperature)}°C</Text>
                  <Text style={styles.weatherCondition}>
                    {t(getWeatherConditionKey(weather.rain_mm, weather.wind_speed_kmh, weather.temperature))}
                  </Text>
                </View>
                <Text style={styles.weatherDesc} numberOfLines={2}>
                  {advisory?.advice
                    ? advisory.advice.length > 80
                      ? advisory.advice.slice(0, 80) + '...'
                      : advisory.advice
                    : t('dashboard.humidityWind', { humidity: weather.humidity, wind: weather.wind_speed_kmh })}
                </Text>
                <Text style={styles.weatherTapHint}>{t('dashboard.tapForDetails')}</Text>
              </View>
            </View>
          </Pressable>
        ) : (
          <Pressable onPress={() => onNavigate?.('weather')}>
            <View style={styles.weatherCard}>
              <View style={styles.weatherIconCircle}>
                <MaterialCommunityIcons name="weather-sunny" size={40} color={colors.onSecondaryContainer} />
              </View>
              <View style={styles.weatherInfo}>
                <Text style={styles.weatherCondition}>{t('dashboard.weatherUnavailable')}</Text>
                <Text style={styles.weatherDesc}>{t('dashboard.weatherLocationHint')}</Text>
                <Text style={styles.weatherTapHint}>{t('dashboard.tapToRetry')}</Text>
              </View>
            </View>
          </Pressable>
        )}

        {/* Trending Market Rates (only if data available) */}
        {trending.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('dashboard.marketTrends')}</Text>
              <Pressable onPress={() => onNavigate?.('market')}>
                <Text style={styles.sectionLink}>{t('dashboard.viewAll')}</Text>
              </Pressable>
            </View>
            <View style={styles.trendRow}>
              {trending.map((trend) => (
                <View key={trend.crop} style={styles.trendItem}>
                  <Text style={styles.trendCrop} numberOfLines={1}>{translateCropName(t, trend.crop)}</Text>
                  <View style={styles.trendPriceRow}>
                    <Text style={styles.trendPrice}>Rs {Math.round(trend.current_avg)}/kg</Text>
                    <MaterialCommunityIcons
                      name={getTrendIcon(trend.direction) as any}
                      size={16}
                      color={getTrendColor(trend.direction, colors)}
                    />
                  </View>
                  {trend.change_percent != null && (
                    <Text style={[styles.trendChange, { color: getTrendColor(trend.direction, colors) }]}>
                      {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '—'} {Math.abs(Math.round(trend.change_percent))}%
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Feature Grid */}
        <View style={[styles.featureGrid, isWide && styles.featureGridWide]}>
          {FEATURE_CARDS.map((card) => (
            <Pressable
              key={card.id}
              style={[
                styles.featureCard,
                card.isUrgent && styles.featureCardUrgent,
                { width: cardWidth },
              ]}
              onPress={() => handleCardPress(card.id)}
            >
              {/* Urgent badge */}
              {card.isUrgent && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentText}>{t('dashboard.urgent')}</Text>
                </View>
              )}

              {/* Card icon/image */}
              {card.isImage ? (
                <Image
                  source={card.image}
                  style={[
                    styles.cardImage,
                    card.isUrgent && styles.cardImageUrgent,
                  ]}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.cardIconBox}>
                  <MaterialCommunityIcons
                    name={card.iconName as any}
                    size={32}
                    color={colors.onPrimaryContainer}
                  />
                </View>
              )}

              {/* Card text */}
              <View style={styles.cardTextContainer}>
                <Text
                  style={[
                    styles.cardTitle,
                    card.isUrgent && styles.cardTitleUrgent,
                  ]}
                >
                  {t(card.titleKey)}
                </Text>
                <Text
                  style={[
                    styles.cardSubtitle,
                    card.isUrgent && styles.cardSubtitleUrgent,
                  ]}
                >
                  {t(card.subtitleKey)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {NAV_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={styles.navItem}
              onPress={() => handleTabPress(tab.key)}
            >
              {/* Active indicator bar */}
              <View
                style={[
                  styles.navIndicatorBar,
                  isActive && styles.navIndicatorBarActive,
                ]}
              />
              <MaterialCommunityIcons
                name={tab.icon}
                size={isActive ? 25 : 23}
                color={isActive ? colors.primary : colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.navLabel,
                  isActive ? styles.navLabelActive : styles.navLabelInactive,
                ]}
              >
                {t(tab.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  // ─── Top App Bar ───
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainer,
  },
  appBarButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  appBarTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    flex: 1,
    textAlign: 'center',
  },
  // ─── Scroll Content ───
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 24,
    gap: 40,
    alignSelf: 'center' as const,
    width: '100%',
  },
  // ─── Greeting ───
  greetingSection: {
    gap: 4,
  },
  greetingName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    fontWeight: '700',
    color: colors.onSurface,
  },
  greetingTime: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    lineHeight: 24,
  },
  greetingDate: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.outline,
    letterSpacing: 0.14,
  },
  // ─── Weather Card ───
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 12,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.surfaceDim,
  },
  weatherIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherInfo: {
    flex: 1,
    gap: 4,
  },
  weatherTempRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  weatherTemp: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    fontWeight: '700',
    color: colors.onSurface,
  },
  weatherCondition: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.14,
  },
  weatherDesc: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    lineHeight: 24,
    marginTop: 4,
  },
  weatherTapHint: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  // ─── Market Trends Section ───
  sectionContainer: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  sectionLink: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 0.1,
  },
  trendRow: {
    flexDirection: 'row',
    gap: 10,
  },
  trendItem: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.surfaceDim,
  },
  trendCrop: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
  },
  trendPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  trendPrice: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
    flex: 1,
  },
  trendChange: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  // ─── Feature Grid ───
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  featureGridWide: {
    justifyContent: 'flex-start',
  },
  featureCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 160,
    borderWidth: 1,
    borderColor: colors.surfaceDim,
  },
  featureCardUrgent: {
    backgroundColor: colors.secondaryContainer,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  cardImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  cardImageUrgent: {
    borderRadius: 8,
  },
  cardIconBox: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextContainer: {
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 4,
  },
  cardTitleUrgent: {
    color: colors.onSecondaryContainer,
  },
  cardSubtitle: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.14,
  },
  cardSubtitleUrgent: {
    color: colors.onSecondaryContainer,
  },
  // Urgent badge
  urgentBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 1,
  },
  urgentText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  // ─── Bottom Navigation ───
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceContainer,
    height: 80,
    paddingHorizontal: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceDim,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 2,
  },
  navIndicatorBar: {
    width: 24,
    height: 3,
    borderRadius: 1.5,
    marginBottom: 6,
    backgroundColor: 'transparent',
  },
  navIndicatorBarActive: {
    backgroundColor: colors.primary,
  },
  navLabel: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  navLabelInactive: {
    color: colors.onSurfaceVariant,
  },
});
