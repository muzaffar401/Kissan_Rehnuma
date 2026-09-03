import { useCallback, useState } from 'react';
import {
  Animated,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
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

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

const CATEGORIES = [
  { id: '1', titleKey: 'helpline.agriculturalExperts', descKey: 'helpline.agriculturalDesc', icon: 'brain' },
  { id: '2', titleKey: 'helpline.livestockAnimals', descKey: 'helpline.livestockDesc', icon: 'paw-print' },
  { id: '3', titleKey: 'helpline.marketExperts', descKey: 'helpline.marketDesc', icon: 'storefront-outline' },
  { id: '4', titleKey: 'helpline.appSupport', descKey: 'helpline.appSupportDesc', icon: 'cellphone' },
];

const FAQS = [
  { id: '1', questionKey: 'helpline.faq1Question', answerKey: 'helpline.faq1Answer' },
  { id: '2', questionKey: 'helpline.faq2Question', answerKey: 'helpline.faq2Answer' },
  { id: '3', questionKey: 'helpline.faq3Question', answerKey: 'helpline.faq3Answer' },
];

export default function HelplineScreen({ onNavigate }: HelplineScreenProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [bottomActive, setBottomActive] = useState<BottomTab>('helpline');
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
  });

  const isWide = width > 600;
  const contentMaxWidth = isWide ? 672 : width;

  const toggleFaq = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenFaq((prev) => (prev === id ? null : id));
  }, []);

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
        <Pressable style={styles.appBarBtn}>
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
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image
            source={require('../../assets/helpline_hero.jpg')}
            style={styles.heroImage}
            resizeMode="contain"
          />
          <Text style={styles.heroTitle}>{t('helpline.contactExperts')}</Text>
          <Text style={styles.heroDescription}>
            {t('helpline.heroDescription')}
          </Text>
          <Pressable
            style={styles.callNowBtn}
            onPress={() => onNavigate?.('voice-call')}
          >
            <MaterialCommunityIcons
              name="phone"
              size={20}
              color={colors.onPrimary}
            />
            <Text style={styles.callNowBtnText}>{t('helpline.callNow')}</Text>
          </Pressable>
        </View>

        {/* Contact Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('helpline.contactCategories')}</Text>
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryCard,
                  { width: isWide ? (contentMaxWidth - 40 - 16) / 2 : contentMaxWidth - 40 },
                ]}
              >
                <View style={styles.categoryIconCircle}>
                  <MaterialCommunityIcons
                    name={cat.icon as any}
                    size={28}
                    color={colors.onSecondaryContainer}
                  />
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryTitle}>{t(cat.titleKey)}</Text>
                  <Text style={styles.categoryDesc}>{t(cat.descKey)}</Text>
                </View>
                <Pressable
                  style={styles.categoryCallBtn}
                  onPress={() => onNavigate?.('voice-call')}
                >
                  <MaterialCommunityIcons
                    name="phone"
                    size={20}
                    color={colors.primary}
                  />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.faqSectionTitle}>{t('helpline.commonQuestions')}</Text>
          {FAQS.map((faq) => {
            const isOpen = openFaq === faq.id;
            return (
              <View key={faq.id} style={styles.faqItem}>
                <Pressable
                  style={styles.faqHeader}
                  onPress={() => toggleFaq(faq.id)}
                >
                  <Text style={styles.faqQuestion}>{t(faq.questionKey)}</Text>
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: isOpen ? '180deg' : '0deg',
                        },
                      ],
                    }}
                  >
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={24}
                      color={colors.onSurface}
                    />
                  </Animated.View>
                </Pressable>
                {isOpen && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{t(faq.answerKey)}</Text>
                  </View>
                )}
              </View>
            );
          })}
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
    paddingVertical: 16,
    gap: 40,
    alignSelf: 'center' as const,
    width: '100%',
    paddingHorizontal: 20,
  },
  // ─── Hero Section ───
  heroSection: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
    alignItems: 'flex-start',
    gap: 12,
  },
  heroImage: {
    width: '100%',
    maxWidth: 320,
    height: 200,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 8,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 32,
  },
  heroDescription: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    lineHeight: 24,
    maxWidth: 480,
  },
  callNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 32,
    marginTop: 8,
    alignSelf: 'stretch',
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  callNowBtnText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
    letterSpacing: 0.14,
  },
  // ─── Categories Section ───
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 24,
    fontWeight: '600',
    color: colors.onBackground,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  categoryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  categoryIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryInfo: {
    flex: 1,
    gap: 4,
  },
  categoryTitle: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
    lineHeight: 20,
    letterSpacing: 0.14,
  },
  categoryDesc: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 12,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    lineHeight: 16,
  },
  categoryCallBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // ─── FAQ Section ───
  faqSection: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
    gap: 8,
  },
  faqSectionTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 24,
    fontWeight: '600',
    color: colors.onBackground,
    marginBottom: 12,
  },
  faqItem: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestion: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
    lineHeight: 20,
    letterSpacing: 0.14,
    flex: 1,
    paddingRight: 12,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  faqAnswerText: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    lineHeight: 24,
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
