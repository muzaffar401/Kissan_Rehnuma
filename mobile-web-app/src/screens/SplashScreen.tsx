import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, ImageStyle, StyleSheet, Text, View } from 'react-native';
import { useFonts, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { BeVietnamPro_400Regular } from '@expo-google-fonts/be-vietnam-pro';
import { NotoNastaliqUrdu_400Regular } from '@expo-google-fonts/noto-nastaliq-urdu';
import { colors } from '../theme/colors';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;

  // Loader dot animations
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    NotoNastaliqUrdu_400Regular,
  });

  // Pulsing dot animation helper
  const pulseDot = (anim: Animated.Value, delay: number) => {
    return Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
  };

  useEffect(() => {
    if (!fontsLoaded) return;

    // Start loader dots immediately
    Animated.parallel([pulseDot(dot1, 0), pulseDot(dot2, 200), pulseDot(dot3, 400)]).start();

    // Phase 1: Logo scales in
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 2: Text fades in
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        // Phase 3: Loader fades in
        Animated.timing(loaderOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          // Hold for 1.5s then navigate
          setTimeout(() => {
            onComplete();
          }, 1500);
        });
      });
    });
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  const getDotStyle = (anim: Animated.Value) => ({
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.6, 1.2],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    }),
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo.jpg')} style={styles.logo as ImageStyle} />
        </View>

        {/* App Name */}
        <Animated.View style={{ opacity: textOpacity }}>
          <Text style={styles.appName}>Kissan Rehnuma</Text>
          <Text style={styles.appNameUrdu}>کسان رہنما</Text>
        </Animated.View>
      </Animated.View>

      {/* Loader */}
      <Animated.View style={[styles.loaderContainer, { opacity: loaderOpacity }]}>
        <Animated.View style={[styles.dot, getDotStyle(dot1)]} />
        <Animated.View style={[styles.dot, getDotStyle(dot2)]} />
        <Animated.View style={[styles.dot, getDotStyle(dot3)]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginBottom: 24,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  appName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  appNameUrdu: {
    fontFamily: 'NotoNastaliqUrdu_400Regular',
    fontSize: 30,
    color: colors.onPrimaryContainer,
    textAlign: 'center',
    lineHeight: 48,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.onPrimaryContainer,
  },
});
