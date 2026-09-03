import { useCallback, useState } from 'react';
import {
  Animated,
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
import { useTheme } from '../theme/ThemeContext';
import type { ColorPalette } from '../theme/colors';
import { useTranslation } from 'react-i18next';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FaqScreenProps {
  onNavigate?: (screen: string) => void;
}

const FAQS = [
  { id: '1', questionKey: 'faq.q1', answerKey: 'faq.a1', icon: 'leaf' as const, color: '#4a6b57' },
  { id: '2', questionKey: 'faq.q2', answerKey: 'faq.a2', icon: 'paw-print' as const, color: '#9a4e40' },
  { id: '3', questionKey: 'faq.q3', answerKey: 'faq.a3', icon: 'tag' as const, color: '#c68a00' },
  { id: '4', questionKey: 'faq.q4', answerKey: 'faq.a4', icon: 'weather-cloudy' as const, color: '#3b7dd8' },
  { id: '5', questionKey: 'faq.q5', answerKey: 'faq.a5', icon: 'phone' as const, color: '#4a6b57' },
  { id: '6', questionKey: 'faq.q6', answerKey: 'faq.a6', icon: 'image-filter-center-focus' as const, color: '#9a4e40' },
  { id: '7', questionKey: 'faq.q7', answerKey: 'faq.a7', icon: 'translate' as const, color: '#3b7dd8' },
  { id: '8', questionKey: 'faq.q8', answerKey: 'faq.a8', icon: 'account-edit' as const, color: '#c68a00' },
];

export default function FaqScreen({ onNavigate }: FaqScreenProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
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
          style={styles.appBarBackBtn}
          onPress={() => onNavigate?.('settings')}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
        <Text style={styles.appBarTitle}>{t('faq.title')}</Text>
        <View style={styles.appBarSpacer} />
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
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerIconCircle}>
            <MaterialCommunityIcons name="frequently-asked-questions" size={32} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>{t('faq.headerTitle')}</Text>
          <Text style={styles.headerSubtitle}>{t('faq.headerSubtitle')}</Text>
        </View>

        {/* FAQ Items */}
        <View style={styles.faqList}>
          {FAQS.map((faq) => {
            const isOpen = openFaq === faq.id;
            return (
              <View key={faq.id} style={[styles.faqItem, isOpen && styles.faqItemOpen]}>
                <Pressable
                  style={styles.faqHeader}
                  onPress={() => toggleFaq(faq.id)}
                >
                  <View style={[styles.faqIconCircle, { backgroundColor: `${faq.color}18` }]}>
                    <MaterialCommunityIcons
                      name={faq.icon as any}
                      size={18}
                      color={faq.color}
                    />
                  </View>
                  <Text style={[styles.faqQuestion, isOpen && styles.faqQuestionOpen]}>
                    {t(faq.questionKey)}
                  </Text>
                  <Animated.View
                    style={{
                      transform: [{ rotate: isOpen ? '180deg' : '0deg' }],
                    }}
                  >
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={22}
                      color={isOpen ? colors.primary : colors.onSurfaceVariant}
                    />
                  </Animated.View>
                </Pressable>
                {isOpen && (
                  <View style={styles.faqAnswer}>
                    <View style={styles.faqAnswerDivider} />
                    <Text style={styles.faqAnswerText}>{t(faq.answerKey)}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Bottom help text */}
        <View style={styles.bottomHelp}>
          <MaterialCommunityIcons name="information-outline" size={18} color={colors.onSurfaceVariant} />
          <Text style={styles.bottomHelpText}>{t('faq.bottomHelp')}</Text>
        </View>
      </ScrollView>
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
  appBarBackBtn: {
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
  appBarSpacer: {
    width: 48,
  },
  // ─── Scroll Content ───
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignSelf: 'center' as const,
    width: '100%',
    gap: 20,
  },
  // ─── Header Card ───
  headerCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: colors.primaryContainer,
    borderRadius: 16,
    gap: 8,
  },
  headerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  headerSubtitle: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 13,
    fontWeight: '400',
    color: colors.onPrimaryContainer,
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 20,
  },
  // ─── FAQ List ───
  faqList: {
    gap: 8,
  },
  faqItem: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
    overflow: 'hidden',
  },
  faqItemOpen: {
    borderColor: colors.primaryContainer,
    borderWidth: 1.5,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  faqIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  faqQuestion: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
    lineHeight: 19,
    flex: 1,
    paddingRight: 8,
  },
  faqQuestionOpen: {
    color: colors.primary,
  },
  faqAnswer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  faqAnswerDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
    marginBottom: 12,
    marginLeft: 42,
  },
  faqAnswerText: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 13,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    lineHeight: 21,
    marginLeft: 42,
  },
  // ─── Bottom Help ───
  bottomHelp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  bottomHelpText: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
});
