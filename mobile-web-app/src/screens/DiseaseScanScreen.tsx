import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
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

type ScanTab = 'crop' | 'animal';
type BottomTab = 'home' | 'disease' | 'weather' | 'market' | 'helpline';

interface DiseaseScanScreenProps {
  initialTab?: ScanTab;
  onNavigate?: (screen: string) => void;
}

const bottomTabs: { key: BottomTab; icon: string; label: string }[] = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'disease', icon: 'leaf', label: 'Disease' },
  { key: 'weather', icon: 'weather-sunny', label: 'Weather' },
  { key: 'market', icon: 'tag', label: 'Market' },
  { key: 'helpline', icon: 'phone', label: 'Helpline' },
];

export default function DiseaseScanScreen({
  initialTab = 'crop',
  onNavigate,
}: DiseaseScanScreenProps) {
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<ScanTab>(initialTab);
  const [bottomActive, setBottomActive] = useState<BottomTab>('disease');
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
  });

  // Scanner line animation
  const scannerY = useRef(new Animated.Value(0)).current;
  const scannerOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const scannerAnim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scannerY, {
            toValue: 1,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scannerOpacity, {
            toValue: 0.8,
            duration: 1250,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scannerY, {
            toValue: 0,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scannerOpacity, {
            toValue: 0.3,
            duration: 1250,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    scannerAnim.start();
    return () => scannerAnim.stop();
  }, []);

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  const isWide = width > 600;
  const viewfinderMaxWidth = isWide ? 480 : width - 40;

  const isCrop = activeTab === 'crop';
  const title = isCrop ? 'Scan Crop' : 'Scan Animal';
  const instruction = isCrop
    ? 'Place the leaf inside the frame and tap the button.'
    : "Place the animal's affected area inside the frame and tap the button.";

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <Pressable style={styles.appBarIconBtn} onPress={() => onNavigate?.('home')}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
        <Text style={styles.appBarTitle}>{title}</Text>
        <Pressable style={styles.appBarIconBtn}>
          <MaterialCommunityIcons
            name="account-circle"
            size={24}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tabBtn, isCrop && styles.tabBtnActive]}
          onPress={() => setActiveTab('crop')}
        >
          <MaterialCommunityIcons
            name="leaf"
            size={18}
            color={isCrop ? colors.onPrimaryContainer : colors.onSurfaceVariant}
          />
          <Text
            style={[styles.tabText, isCrop && styles.tabTextActive]}
          >
            Crop Disease
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, !isCrop && styles.tabBtnActive]}
          onPress={() => setActiveTab('animal')}
        >
          <MaterialCommunityIcons
            name="cow"
            size={18}
            color={!isCrop ? colors.onPrimaryContainer : colors.onSurfaceVariant}
          />
          <Text
            style={[styles.tabText, !isCrop && styles.tabTextActive]}
          >
            Animal Disease
          </Text>
        </Pressable>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Instruction */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionText}>{instruction}</Text>
        </View>

        {/* Camera Viewfinder */}
        <View
          style={[
            styles.viewfinderContainer,
            { maxWidth: viewfinderMaxWidth },
          ]}
        >
          {/* Background placeholder */}
          <View style={styles.viewfinderBg}>
            <MaterialCommunityIcons
              name={isCrop ? 'leaf-circle-outline' : 'cow'}
              size={64}
              color={colors.outlineVariant}
            />
          </View>

          {/* Dark overlay with cutout effect */}
          <View style={styles.viewfinderOverlay} />

          {/* Corner brackets */}
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />

          {/* Animated scanner line */}
          <Animated.View
            style={[
              styles.scannerLine,
              {
                top: scannerY.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['15%', '85%'],
                }),
                opacity: scannerOpacity,
              },
            ]}
          />

          {/* AI Active badge (Animal tab only) */}
          {!isCrop && (
            <View style={styles.aiBadge}>
              <MaterialCommunityIcons
                name="auto-fix"
                size={16}
                color={colors.onSecondaryContainer}
              />
              <Text style={styles.aiBadgeText}>AI Active</Text>
            </View>
          )}
        </View>

        {/* Action Button */}
        <Pressable style={styles.scanButton}>
          <MaterialCommunityIcons
            name="camera"
            size={20}
            color={colors.onPrimary}
          />
          <Text style={styles.scanButtonText}>Take Photo to Scan</Text>
        </Pressable>
      </View>

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
                if (tab.key === 'home') onNavigate?.('home');
                if (tab.key === 'weather') onNavigate?.('weather');
                if (tab.key === 'market') onNavigate?.('market');
                if (tab.key === 'helpline') onNavigate?.('helpline');
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
  appBarIconBtn: {
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
  // ─── Tab Switcher ───
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: colors.primaryContainer,
  },
  tabText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.14,
  },
  tabTextActive: {
    color: colors.onPrimaryContainer,
  },
  // ─── Main Content ───
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: 'center',
  },
  instructionCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginBottom: 24,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  instructionText: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurface,
    textAlign: 'center',
    lineHeight: 24,
  },
  // ─── Camera Viewfinder ───
  viewfinderContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: colors.surfaceDim,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  viewfinderBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  viewfinderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  // Corner brackets
  cornerTL: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    width: 32,
    height: 32,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#ffffff',
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    position: 'absolute',
    top: '15%',
    right: '15%',
    width: 32,
    height: 32,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#ffffff',
    borderTopRightRadius: 8,
  },
  cornerBL: {
    position: 'absolute',
    bottom: '15%',
    left: '15%',
    width: 32,
    height: 32,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#ffffff',
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    position: 'absolute',
    bottom: '15%',
    right: '15%',
    width: 32,
    height: 32,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#ffffff',
    borderBottomRightRadius: 8,
  },
  // Scanner line
  scannerLine: {
    position: 'absolute',
    left: '15%',
    right: '15%',
    height: 2,
    backgroundColor: colors.primaryFixedDim,
    borderRadius: 1,
    shadowColor: colors.onPrimaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  // AI badge
  aiBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  aiBadgeText: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 12,
    fontWeight: '500',
    color: colors.onSecondaryContainer,
  },
  // ─── Action Button ───
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 32,
    marginTop: 24,
    width: '100%',
    maxWidth: 384,
    alignSelf: 'center',
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  scanButtonText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
    letterSpacing: 0.14,
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
