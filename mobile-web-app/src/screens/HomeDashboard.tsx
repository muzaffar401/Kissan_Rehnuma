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
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
} from '@expo-google-fonts/be-vietnam-pro';
import { colors } from '../theme/colors';

type TabKey = 'home' | 'disease' | 'weather' | 'market' | 'helpline';

interface HomeDashboardProps {
  onNavigate?: (screen: string) => void;
}

type IconName = typeof MaterialCommunityIcons extends React.ComponentType<{ name: infer N }> ? N : string;

const navTabs: { key: TabKey; icon: any; label: string }[] = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'disease', icon: 'leaf', label: 'Disease' },
  { key: 'weather', icon: 'weather-sunny', label: 'Weather' },
  { key: 'market', icon: 'tag', label: 'Market' },
  { key: 'helpline', icon: 'phone', label: 'Helpline' },
];

const featureCards = [
  {
    id: 'crop',
    title: 'Crop Disease',
    subtitle: 'Scan Crop',
    image: require('../../assets/onboarding_crop.jpg'),
    isImage: true,
  },
  {
    id: 'animal',
    title: 'Animal Disease',
    subtitle: 'Scan Animal',
    iconName: 'cow' as any,
    isImage: false,
  },
  {
    id: 'market',
    title: 'Market Rates',
    subtitle: 'Market Rates',
    image: require('../../assets/onboarding_market.jpg'),
    isImage: true,
  },
  {
    id: 'helpline',
    title: 'Helpline',
    subtitle: 'Call Helpline',
    image: require('../../assets/onboarding_helpline.png'),
    isImage: true,
    isUrgent: true,
  },
];

export default function HomeDashboard({ onNavigate }: HomeDashboardProps) {
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
        <Text style={styles.appBarTitle}>Kissan Rehnuma</Text>
        <Pressable style={styles.appBarButton} onPress={() => onNavigate?.('settings')}>
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
          { maxWidth: contentMaxWidth, paddingHorizontal: 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingName}>Hello, Ahmad</Text>
          <Text style={styles.greetingTime}>Good Morning</Text>
          <Text style={styles.greetingDate}>Oct 24, 2023</Text>
        </View>

        {/* Weather Card */}
        <View style={styles.weatherCard}>
          <View style={styles.weatherIconCircle}>
            <MaterialCommunityIcons
              name="weather-sunny"
              size={40}
              color={colors.onSecondaryContainer}
            />
          </View>
          <View style={styles.weatherInfo}>
            <View style={styles.weatherTempRow}>
              <Text style={styles.weatherTemp}>28°C</Text>
              <Text style={styles.weatherCondition}>Sunny</Text>
            </View>
            <Text style={styles.weatherDesc}>
              Sunny, good for irrigation
            </Text>
          </View>
        </View>

        {/* Feature Grid */}
        <View style={[styles.featureGrid, isWide && styles.featureGridWide]}>
          {featureCards.map((card) => (
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
                  <Text style={styles.urgentText}>URGENT</Text>
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
                  {card.title}
                </Text>
                <Text
                  style={[
                    styles.cardSubtitle,
                    card.isUrgent && styles.cardSubtitleUrgent,
                  ]}
                >
                  {card.subtitle}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => handleTabPress(tab.key)}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={24}
                color={
                  isActive ? colors.onPrimaryContainer : colors.onSurfaceVariant
                }
                style={isActive ? { fontWeight: 'bold' } : undefined}
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
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainer,
  },
  appBarButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
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
