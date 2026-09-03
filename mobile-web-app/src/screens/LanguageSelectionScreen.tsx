import { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFonts, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold } from '@expo-google-fonts/be-vietnam-pro';
import { NotoNastaliqUrdu_400Regular } from '@expo-google-fonts/noto-nastaliq-urdu';
import { colors } from '../theme/colors';
import { tokenStorage } from '../services/tokenStorage';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

interface LanguageSelectionScreenProps {
  onComplete: (language: string) => void;
}

const languages = [
  {
    id: 'en',
    nativeName: 'English',
    englishName: 'English',
    label: 'English',
  },
  {
    id: 'ur',
    nativeName: 'اردو',
    englishName: 'Urdu',
    label: 'Urdu',
    isRtl: true,
  },
  {
    id: 'sd',
    nativeName: 'سنڌي',
    englishName: 'Sindhi',
    label: 'Sindhi',
    isRtl: true,
  },
];

export default function LanguageSelectionScreen({ onComplete }: LanguageSelectionScreenProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    NotoNastaliqUrdu_400Regular,
  });

  // Animated scale for each card
  const cardScales = useRef(languages.reduce((acc, lang) => {
    acc[lang.id] = new Animated.Value(1);
    return acc;
  }, {} as Record<string, Animated.Value>)).current;

  // Animated check icon opacity
  const checkOpacities = useRef(languages.reduce((acc, lang) => {
    acc[lang.id] = new Animated.Value(0);
    return acc;
  }, {} as Record<string, Animated.Value>)).current;

  const handleSelect = (id: string) => {
    // Animate deselected card back to normal
    languages.forEach((lang) => {
      if (lang.id !== id) {
        Animated.timing(checkOpacities[lang.id], {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    });

    // Animate selected card
    Animated.sequence([
      Animated.parallel([
        Animated.timing(cardScales[id], {
          toValue: 0.97,
          duration: 100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(checkOpacities[id], {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(cardScales[id], {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    setSelected(id);
  };

  const handleContinue = async () => {
    if (selected) {
      // Apply language to i18next immediately
      await i18n.changeLanguage(selected);
      tokenStorage.setOnboardingComplete(selected); // persist onboarding + language
      onComplete(selected);
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('language.title')}</Text>
          <Text style={styles.subtitle}>{t('language.subtitle')}</Text>
        </View>

        {/* Language Cards */}
        <View style={styles.cardsContainer}>
          {languages.map((lang) => {
            const isSelected = selected === lang.id;
            return (
              <Pressable
                key={lang.id}
                onPress={() => handleSelect(lang.id)}
                style={styles.cardPressable}
              >
                <Animated.View
                  style={[
                    styles.card,
                    isSelected ? styles.cardSelected : styles.cardUnselected,
                    { transform: [{ scale: cardScales[lang.id] }] },
                  ]}
                >
                  {/* Language text */}
                  <View style={styles.cardTextContainer}>
                    <Text
                      style={[
                        styles.nativeName,
                        lang.id === 'ur' && styles.nativeNameUrdu,
                      ]}
                    >
                      {lang.nativeName}
                    </Text>
                    <Text
                      style={styles.englishName}
                    >
                      {lang.label}
                    </Text>
                  </View>

                  {/* Check icon */}
                  <Animated.View style={{ opacity: checkOpacities[lang.id] }}>
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                  </Animated.View>
                </Animated.View>
              </Pressable>
            );
          })}
        </View>

        {/* Continue Button */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={[
              styles.continueButton,
              !selected && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!selected}
          >
            <Text
              style={[
                styles.continueButtonText,
                !selected && styles.continueButtonTextDisabled,
              ]}
            >
              {t('language.continue')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    maxWidth: 448,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
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
  subtitle: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 24,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  cardPressable: {
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    height: 96,
    borderRadius: 12,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.secondary,
    backgroundColor: colors.surfaceContainer,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardUnselected: {
    borderWidth: 1,
    borderColor: colors.surfaceDim,
    backgroundColor: colors.surface,
  },
  cardTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nativeName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 24,
    fontWeight: '600',
    color: colors.onBackground,
    marginBottom: 4,
  },
  nativeNameUrdu: {
    fontFamily: 'NotoNastaliqUrdu_400Regular',
    fontSize: 28,
    lineHeight: 44,
  },
  englishName: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 12,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonContainer: {
    width: '100%',
  },
  continueButton: {
    width: '100%',
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: colors.outlineVariant,
  },
  continueButtonText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
    letterSpacing: 0.14,
  },
  continueButtonTextDisabled: {
    color: colors.onSurfaceVariant,
  },
});
