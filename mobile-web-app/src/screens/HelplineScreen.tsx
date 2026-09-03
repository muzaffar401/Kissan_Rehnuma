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
import { useTranslation } from 'react-i18next';

type BottomTab = 'home' | 'disease' | 'weather' | 'market' | 'helpline';

interface HelplineScreenProps {
  onNavigate?: (screen: string) => void;
}

const BOTTOM_TABS: { key: BottomTab; icon: string; labelKey: string }[] = [
  { key: 'home', icon: 'home', labelKey: 'common.nav.home' },
  { key: 'disease', icon: 'leaf', labelKey: 'common.nav.disease' },
  { key: 'weather', icon: 'weather-sunny', labelKey: 'common.nav.weather' },
  { key: 'market', icon: 'tag', labelKey: 'common.nav.market' },
  { key: 'helpline', icon: 'phone', labelKey: 'common.nav.helpline' },
];

const HELPLINE_FEATURES = [
  { id: '1', icon: 'clock-outline', titleKey: 'helpline.featHours', descKey: 'helpline.featHoursDesc' },
  { id: '2', icon: 'gift-outline', titleKey: 'helpline.featFree', descKey: 'helpline.featFreeDesc' },
  { id: '3', icon: 'message-text-outline', titleKey: 'helpline.featWhatsapp', descKey: 'helpline.featWhatsappDesc' },
];

export default function HelplineScreen({ onNavigate }: HelplineScreenProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [bottomActive, setBottomActive] = useState<BottomTab>('helpline');
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
  });

  const isWide = width > 600;
  const contentMaxWidth = isWide ? 672 : width;

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <Pressable
          style={styles.appBarBtn}
          onPress={() => onNavigate?.('home')}
        >
          <MaterialCommunityIcons
            name="tractor-variant"
            size={24}
            color={colors.primary}
          />
        </Pressable>
        <Text style={styles.appBarTitle}>{t('common.appName')}</Text>
        <Pressable
          style={styles.appBarBtn}
          onPress={() => onNavigate?.('settings')}
        >
          <MaterialCommunityIcons
            name="account-circle"
            size={24}
            color={colors.primary}
          />
        </Pressable>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { maxWidth: contentMaxWidth },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={styles.heroSection}>
          <View style={styles.heroImageWrapper}>
            <Image
              source={require('../../assets/helpline_hero.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="headset" size={16} color="#fff" />
              <Text style={styles.heroBadgeText}>{t('helpline.heroBadge')}</Text>
            </View>
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{t('helpline.contactExperts')}</Text>
            <Text style={styles.heroDescription}>
              {t('helpline.heroDescription')}
            </Text>
          </View>

          <Pressable
            style={styles.callNowBtn}
            onPress={() => onNavigate?.('voice-call')}
          >
            <View style={styles.callNowIconCircle}>
              <MaterialCommunityIcons
                name="phone"
                size={22}
                color={colors.primary}
              />
            </View>
            <Text style={styles.callNowBtnText}>{t('helpline.callNow')}</Text>
          </Pressable>
        </View>

        {/* Feature Cards */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresSectionTitle}>{t('helpline.whyUse')}</Text>
          <View style={styles.featuresGrid}>
            {HELPLINE_FEATURES.map((feat) => (
              <View key={feat.id} style={styles.featureCard}>
                <View style={styles.featureIconCircle}>
                  <MaterialCommunityIcons
                    name={feat.icon as any}
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.featureTextCol}>
                  <Text style={styles.featureTitle}>{t(feat.titleKey)}</Text>
                  <Text style={styles.featureDesc}>{t(feat.descKey)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
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
                if (tab.key === 'home' && onNavigate) onNavigate('home');
                if (tab.key === 'disease' && onNavigate) onNavigate('disease');
                if (tab.key === 'weather' && onNavigate) onNavigate('weather');
                if (tab.key === 'market' && onNavigate) onNavigate('market');
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
  appBarBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
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
    paddingVertical: 20,
    gap: 24,
    alignSelf: 'center' as const,
    width: '100%',
    paddingHorizontal: 20,
  },
  // ─── Hero Section ───
  heroSection: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
    overflow: 'hidden',
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  heroImageWrapper: {
    width: '100%',
    height: 160,
    overflow: 'hidden',
    position: 'relative' as any,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroBadge: {
    position: 'absolute' as any,
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroBadgeText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.3,
  },
  heroContent: {
    padding: 20,
    gap: 8,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    fontWeight: '700',
    color: colors.onBackground,
    lineHeight: 28,
  },
  heroDescription: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 14,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    lineHeight: 22,
  },
  callNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 52,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
  },
  callNowIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.onPrimaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callNowBtnText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 0.14,
  },
  // ─── Feature Cards ───
  featuresSection: {
    gap: 14,
  },
  featuresSectionTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: colors.onBackground,
  },
  featuresGrid: {
    gap: 12,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
  },
  featureIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.onPrimaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureTextCol: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  featureDesc: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 12,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    lineHeight: 17,
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
