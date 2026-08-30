import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import CrossPager, { CrossPagerRef } from '../components/PagerView';
import { useFonts, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { BeVietnamPro_400Regular, BeVietnamPro_600SemiBold } from '@expo-google-fonts/be-vietnam-pro';
import { colors } from '../theme/colors';

const slides = [
  {
    id: 1,
    title: 'Crop Disease Detection',
    description: 'Take a photo of your crop to instantly identify diseases and get expert advice.',
    image: require('../../assets/onboarding_crop.jpg'),
  },
  {
    id: 2,
    title: 'Animal Disease Detection',
    description: 'Scan your livestock to identify diseases early and get treatment guidance.',
    image: require('../../assets/onboarding_animal.png'),
  },
  {
    id: 3,
    title: 'Real-time Market Rates',
    description: 'Stay updated with the latest prices from markets across Pakistan.',
    image: require('../../assets/onboarding_market.jpg'),
  },
  {
    id: 4,
    title: 'Accurate Weather Alerts',
    description: 'Get localized weather forecasts and timely alerts to protect your crops.',
    image: require('../../assets/onboarding_weather.jpg'),
  },
  {
    id: 5,
    title: 'Expert Helpline',
    description: 'Connect with agricultural experts via voice call for instant guidance.',
    image: require('../../assets/onboarding_helpline.png'),
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
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
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <View style={styles.container}>
      {/* Skip button */}
      <View style={styles.header}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
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
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
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
            {currentPage === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#ffffff',
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
