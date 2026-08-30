import { useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
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
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
} from '@expo-google-fonts/be-vietnam-pro';
import { colors } from '../theme/colors';

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

const weatherAlerts = [
  {
    id: '1',
    title: 'Heavy Rain Expected',
    description:
      'Moderate to heavy rainfall expected tomorrow afternoon. Ensure proper drainage in fields to prevent waterlogging.',
    validUntil: 'Tomorrow 6:00 PM',
    icon: 'weather-pouring',
  },
];

const farmerAdvice = [
  {
    id: '1',
    type: 'do' as const,
    label: 'Irrigation',
    text: 'Good time to hold off on irrigation due to expected rainfall. Conserve water.',
  },
  {
    id: '2',
    type: 'dont' as const,
    label: 'Pesticides',
    text: 'Postpone any planned pesticide or fertilizer sprays, as they may be washed away by the rain.',
  },
];

const forecast = [
  { day: 'Today', icon: 'weather-partly-cloudy', high: 32, low: 24, isToday: true },
  { day: 'Mon', icon: 'weather-rainy', high: 28, low: 22 },
  { day: 'Tue', icon: 'weather-partly-cloudy', high: 30, low: 23 },
  { day: 'Wed', icon: 'weather-sunny', high: 34, low: 25 },
  { day: 'Thu', icon: 'weather-sunny', high: 35, low: 26 },
];

export default function WeatherScreen({ onNavigate }: WeatherScreenProps) {
  const { width } = useWindowDimensions();
  const [bottomActive, setBottomActive] = useState<BottomTab>('weather');
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
  });

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  const isWide = width > 600;
  const contentMaxWidth = isWide ? 672 : width;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <Pressable
            style={styles.appBarBackBtn}
            onPress={() => onNavigate?.('home')}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.primary}
            />
          </Pressable>
          <Text style={styles.appBarTitle}>Kissan Rehnuma</Text>
        </View>
        <Pressable style={styles.appBarProfileBtn}>
          <MaterialCommunityIcons
            name="account-circle"
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
          { maxWidth: contentMaxWidth },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Image with City Overlay */}
        <View style={styles.headerImageContainer}>
          <Image
            source={require('../../assets/weather_header.jpg')}
            style={styles.headerImage}
            resizeMode="cover"
          />
          {/* Gradient overlay */}
          <View style={styles.headerGradient} />
          {/* City info */}
          <View style={styles.headerCityOverlay}>
            <Text style={styles.headerCityName}>Multan</Text>
            <Text style={styles.headerCityWeather}>
              Partly Cloudy {'\u2022'} 32{'\u00B0'}C
            </Text>
          </View>
        </View>

        {/* Weather Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weather Alerts</Text>
          {weatherAlerts.map((alert) => (
            <View key={alert.id} style={styles.alertCard}>
              {/* Red left stripe */}
              <View style={styles.alertStripe} />
              <View style={styles.alertContent}>
                <View style={styles.alertIconCircle}>
                  <MaterialCommunityIcons
                    name="alert"
                    size={24}
                    color={colors.onErrorContainer}
                  />
                </View>
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertDescription}>
                    {alert.description}
                  </Text>
                  <Text style={styles.alertTimestamp}>
                    Valid until: {alert.validUntil}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Farmer's Advice */}
        <View style={styles.section}>
          <View style={styles.adviceSectionHeader}>
            <MaterialCommunityIcons
              name="lightbulb-on"
              size={22}
              color={colors.primary}
            />
            <Text style={styles.adviceSectionTitle}>Farmer's Advice</Text>
          </View>
          <View style={styles.adviceCard}>
            {farmerAdvice.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.adviceItem,
                  index < farmerAdvice.length - 1 && styles.adviceItemBorder,
                ]}
              >
                <MaterialCommunityIcons
                  name={item.type === 'do' ? 'check-circle' : 'cancel'}
                  size={22}
                  color={colors.tertiaryContainer}
                  style={styles.adviceIcon}
                />
                <Text style={styles.adviceText}>
                  <Text style={styles.adviceLabel}>{item.label}: </Text>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 5-Day Forecast */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5-Day Forecast</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.forecastScroll}
            snapToInterval={112}
            decelerationRate={Platform.OS === 'web' ? undefined : 'fast'}
          >
            {forecast.map((day) => (
              <View
                key={day.day}
                style={[
                  styles.forecastCard,
                  day.isToday && styles.forecastCardToday,
                ]}
              >
                <Text
                  style={[
                    styles.forecastDay,
                    day.isToday && styles.forecastDayToday,
                  ]}
                >
                  {day.day}
                </Text>
                <MaterialCommunityIcons
                  name={day.icon as any}
                  size={32}
                  color={day.isToday ? colors.primary : colors.secondary}
                />
                <Text style={styles.forecastHigh}>{day.high}{'\u00B0'}</Text>
                <Text style={styles.forecastLow}>{day.low}{'\u00B0'}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
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
                if (tab.key === 'home' && onNavigate) onNavigate('home');
                if (tab.key === 'disease' && onNavigate) onNavigate('disease');
                if (tab.key === 'market' && onNavigate) onNavigate('market');
                if (tab.key === 'helpline' && onNavigate) onNavigate('helpline');
              }}
            >
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={24}
                color={
                  isActive
                    ? colors.onPrimaryContainer
                    : colors.onSurfaceVariant
                }
              />
              <Text
                style={[
                  styles.navLabel,
                  isActive ? styles.navLabelActive : styles.navLabelInactive,
                ]}
              >
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
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 4,
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appBarBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginLeft: -8,
  },
  appBarTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  appBarProfileBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  // ─── Scroll Content ───
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
    gap: 24,
    alignSelf: 'center' as const,
    width: '100%',
    paddingHorizontal: 20,
  },
  // ─── Header Image ───
  headerImageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 250,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  headerCityOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    justifyContent: 'flex-end',
  },
  headerCityName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerCityWeather: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 18,
    fontWeight: '400',
    color: '#ffffff',
    lineHeight: 28,
  },
  // ─── Section ───
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 24,
    fontWeight: '600',
    color: colors.onSurface,
  },
  // ─── Weather Alert Card ───
  alertCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  alertStripe: {
    width: 8,
    backgroundColor: colors.error,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 16,
    flex: 1,
  },
  alertIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  alertTextContainer: {
    flex: 1,
    gap: 4,
  },
  alertTitle: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
    letterSpacing: 0.14,
    marginBottom: 4,
  },
  alertDescription: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    lineHeight: 24,
  },
  alertTimestamp: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 12,
    fontWeight: '500',
    color: colors.outline,
    marginTop: 8,
  },
  // ─── Farmer's Advice ───
  adviceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adviceSectionTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 24,
    fontWeight: '600',
    color: colors.primary,
  },
  adviceCard: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.secondary,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  adviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  adviceItemBorder: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(125, 87, 20, 0.15)',
    marginBottom: 16,
  },
  adviceIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  adviceText: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurface,
    lineHeight: 24,
    flex: 1,
  },
  adviceLabel: {
    fontWeight: '700',
    fontFamily: 'BeVietnamPro_600SemiBold',
  },
  // ─── 5-Day Forecast ───
  forecastScroll: {
    gap: 12,
    paddingVertical: 4,
  },
  forecastCard: {
    minWidth: 100,
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  forecastCardToday: {
    borderColor: colors.primaryContainer,
    borderWidth: 2,
  },
  forecastDay: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
    letterSpacing: 0.14,
  },
  forecastDayToday: {
    color: colors.primary,
  },
  forecastHigh: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  forecastLow: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 12,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
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
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  navItemActive: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 28,
  },
  navLabel: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  navLabelActive: {
    color: colors.onPrimaryContainer,
  },
  navLabelInactive: {
    color: colors.onSurfaceVariant,
  },
});
