import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import CrossPager, { CrossPagerRef } from '../components/PagerView';
import { useFonts, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { BeVietnamPro_400Regular, BeVietnamPro_600SemiBold } from '@expo-google-fonts/be-vietnam-pro';
import { useTheme } from '../theme/ThemeContext';
import type { ColorPalette } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { tokenStorage } from '../services/tokenStorage';

const slides = [
  {
    id: 1,
    titleKey: 'onboarding.slide1Title',
    descKey: 'onboarding.slide1Desc',
    image: require('../../assets/onboarding_crop.jpg'),
  },
  {
    id: 2,
    titleKey: 'onboarding.slide2Title',
    descKey: 'onboarding.slide2Desc',
    image: require('../../assets/onboarding_animal.png'),
  },
  {
    id: 3,
    titleKey: 'onboarding.slide3Title',
    descKey: 'onboarding.slide3Desc',
    image: require('../../assets/onboarding_market.jpg'),
  },
  {
    id: 4,
    titleKey: 'onboarding.slide4Title',
    descKey: 'onboarding.slide4Desc',
    image: require('../../assets/onboarding_weather.jpg'),
  },
  {
    id: 5,
    titleKey: 'onboarding.slide5Title',
    descKey: 'onboarding.slide5Desc',
    image: require('../../assets/onboarding_helpline.png'),
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(0);
  const pagerRef = useRef<CrossPagerRef>(null);
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_600SemiBold,
  });

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  const handleNext = () => {
    if (currentPage < slides.length - 1) {
      pagerRef.current?.setPage(currentPage + 1);
    } else {
      tokenStorage.setOnboardingComplete(); // persist: don't show onboarding again
      onComplete();
    }
  };

  const handleSkip = () => {
    tokenStorage.setOnboardingComplete(); // persist: don't show onboarding again
    onComplete();
  };

  return (
    <View style={styles.container}>
      {/* Skip button */}
      <View style={styles.header}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>

      {/* Pager */}
      <CrossPager
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e: { nativeEvent: { position: number } }) => setCurrentPage(e.nativeEvent.position)}
      >
        {slides.map((slide) => (
          <View key={slide.id} style={styles.slide}>
            <View style={styles.imageContainer}>
              <Image source={slide.image} style={styles.image} resizeMode="contain" />
            </View>
            <Text style={styles.title}>{t(slide.titleKey)}</Text>
            <Text style={styles.description}>{t(slide.descKey)}</Text>
          </View>
        ))}
      </CrossPager>

      {/* Bottom controls */}
      <View style={styles.footer}>
        {/* Dot indicators */}
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentPage ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started button */}
        <Pressable style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentPage === slides.length - 1 ? t('onboarding.getStarted') : t('onboarding.next')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 0.14,
  },
  pager: {
    flex: 1,
    paddingTop: 100,
    paddingBottom: 140,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 32,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  description: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainer,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 32,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: colors.outlineVariant,
  },
  nextButton: {
    width: '100%',
    maxWidth: 448,
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
    letterSpacing: 0.14,
  },
});
