import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import * as ImagePicker from 'expo-image-picker';
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
import { cropService, animalService, type DetectResponse, type AnimalDetectResponse, type ApiError } from '../services';
import { pdfService } from '../services/pdfService';

/** Unified display type — works for both crop and animal diagnoses */
interface ScanResult {
  scan_id: string;
  is_positive: boolean;       // is_plant or is_animal
  disease_name: string | null;
  scientific_name: string | null;
  confidence: number | null;
  symptoms: string[];
  causes: string;
  treatment_recommendations: string;
  prevention_tips: string[];
  category_label: string;     // 'Crop' or 'Animal'
  category_value: string | null; // crop_type or animal_type
  affected_label: string;     // 'Affected Crops' or 'Affected Species'
  affected_value: string;
  image_url: string;
  message: string;
  /** Original data for PDF generation */
  rawCrop?: DetectResponse;
  rawAnimal?: AnimalDetectResponse;
}

type ScanTab = 'crop' | 'animal';
type BottomTab = 'home' | 'disease' | 'weather' | 'market' | 'helpline';
type ScanPhase = 'idle' | 'preview' | 'analyzing' | 'result' | 'error';

interface DiseaseScanScreenProps {
  initialTab?: ScanTab;
  onNavigate?: (screen: string) => void;
}

const BOTTOM_TABS: { key: BottomTab; icon: string; labelKey: string }[] = [
  { key: 'home', icon: 'home', labelKey: 'common.nav.home' },
  { key: 'disease', icon: 'leaf', labelKey: 'common.nav.disease' },
  { key: 'weather', icon: 'weather-sunny', labelKey: 'common.nav.weather' },
  { key: 'market', icon: 'tag', labelKey: 'common.nav.market' },
  { key: 'helpline', icon: 'phone', labelKey: 'common.nav.helpline' },
];

export default function DiseaseScanScreen({
  initialTab = 'crop',
  onNavigate,
}: DiseaseScanScreenProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<ScanTab>(initialTab);
  const [bottomActive, setBottomActive] = useState<BottomTab>('disease');

  // ─── Scan state ───
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
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

  // ─── Image Picker handlers ───
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
        setScanPhase('preview');
        setScanResult(null);
        setErrorMessage('');
        setErrorCode('');
      }
    } catch (err) {
      Alert.alert(t('common.error'), t('disease.errorPickImage'));
    }
  };

  const handleTakePhoto = async () => {
    try {
      // Request camera permission
      const permResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert(
          t('disease.cameraPermissionTitle'),
          t('disease.cameraPermissionMessage'),
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
        setScanPhase('preview');
        setScanResult(null);
        setErrorMessage('');
        setErrorCode('');
      }
    } catch (err) {
      Alert.alert(t('common.error'), t('disease.errorTakePhoto'));
    }
  };

  // ─── API call: Detect disease (crop or animal based on activeTab) ───
  const handleScan = async () => {
    if (!selectedImage) return;
    setScanPhase('analyzing');
    setErrorMessage('');
    setErrorCode('');

    try {
      const imageName = selectedImage.uri.split('/').pop() || (isCrop ? 'leaf.jpg' : 'animal.jpg');
      const imageType = imageName.endsWith('.png') ? 'image/png' : 'image/jpeg';

      if (isCrop) {
        const result = await cropService.detectDisease(
          selectedImage.uri, imageName, imageType, i18n.language,
        );
        setScanResult({
          scan_id: result.scan_id,
          is_positive: result.is_plant,
          disease_name: result.disease_name,
          scientific_name: result.scientific_name,
          confidence: result.confidence,
          symptoms: result.symptoms || [],
          causes: result.causes,
          treatment_recommendations: result.treatment_recommendations,
          prevention_tips: result.prevention_tips || [],
          category_label: t('disease.scanCropTitle'),
          category_value: result.crop_type,
          affected_label: t('disease.affectedCrops'),
          affected_value: result.affected_crops,
          image_url: result.image_url,
          message: result.message,
          rawCrop: result,
        });
      } else {
        const result = await animalService.detectDisease(
          selectedImage.uri, imageName, imageType, i18n.language,
        );
        setScanResult({
          scan_id: result.scan_id,
          is_positive: result.is_animal,
          disease_name: result.disease_name,
          scientific_name: result.scientific_name,
          confidence: result.confidence,
          symptoms: result.symptoms || [],
          causes: result.causes,
          treatment_recommendations: result.treatment_recommendations,
          prevention_tips: result.prevention_tips || [],
          category_label: t('disease.scanAnimalTitle'),
          category_value: result.animal_type,
          affected_label: t('disease.affectedSpecies'),
          affected_value: result.affected_species,
          image_url: result.image_url,
          message: result.message,
          rawAnimal: result,
        });
      }
      setScanPhase('result');
    } catch (err) {
      const apiErr = err as ApiError;
      setScanPhase('error');
      setErrorCode(apiErr.error_code || 'UNKNOWN');
      setErrorMessage(
        apiErr.detail || t('disease.failedAnalyzeDefault'),
      );
    }
  };

  // ─── Download PDF report ───
  const handleDownloadReport = async () => {
    if (!scanResult) return;
    setIsDownloadingReport(true);
    try {
      // Use the original typed response for PDF generation
      const pdfData = scanResult.rawCrop || scanResult.rawAnimal;
      if (!pdfData) throw new Error('No scan data available for PDF');
      await pdfService.generateAndShareReport(pdfData);
    } catch (err) {
      console.error('PDF generation failed:', err);
      if (Platform.OS === 'web') {
        window.alert(t('disease.errorGenerateReport'));
      } else {
        Alert.alert(t('common.error'), t('disease.errorGenerateReport'));
      }
    } finally {
      setIsDownloadingReport(false);
    }
  };

  // ─── Reset to idle ───
  const handleReset = () => {
    setSelectedImage(null);
    setScanResult(null);
    setErrorMessage('');
    setErrorCode('');
    setScanPhase('idle');
  };

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  const isWide = width > 600;
  const viewfinderMaxWidth = isWide ? 480 : width - 40;

  const isCrop = activeTab === 'crop';
  const title = isCrop ? t('disease.scanCropTitle') : t('disease.scanAnimalTitle');
  const instruction = isCrop
    ? t('disease.cropInstruction')
    : t('disease.animalInstruction');

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
        <Pressable style={styles.appBarIconBtn} onPress={() => onNavigate?.('history')}>
          <MaterialCommunityIcons
            name="history"
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
            {t('disease.cropDiseaseTab')}
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
            {t('disease.animalDiseaseTab')}
          </Text>
        </Pressable>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.mainContent} contentContainerStyle={styles.mainContentInner}>
        {/* ─── IDLE PHASE: Viewfinder + action buttons ─── */}
        {scanPhase === 'idle' && (
          <>
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
              <View style={styles.viewfinderBg}>
                <MaterialCommunityIcons
                  name={isCrop ? 'leaf-circle-outline' : 'cow'}
                  size={64}
                  color={colors.outlineVariant}
                />
              </View>
              <View style={styles.viewfinderOverlay} />
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
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
              {!isCrop && (
                <View style={styles.aiBadge}>
                  <MaterialCommunityIcons name="auto-fix" size={16} color={colors.onSecondaryContainer} />
                  <Text style={styles.aiBadgeText}>{t('disease.aiActive')}</Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <Pressable style={styles.scanButton} onPress={handleTakePhoto}>
              <MaterialCommunityIcons name="camera" size={20} color={colors.onPrimary} />
              <Text style={styles.scanButtonText}>{t('disease.takePhoto')}</Text>
            </Pressable>
            <Pressable style={styles.galleryButton} onPress={handlePickImage}>
              <MaterialCommunityIcons name="image" size={20} color={colors.primary} />
              <Text style={styles.galleryButtonText}>{t('disease.pickFromGallery')}</Text>
            </Pressable>
          </>
        )}

        {/* ─── PREVIEW PHASE: Selected image + scan button ─── */}
        {scanPhase === 'preview' && selectedImage && (
          <>
            <View style={[styles.viewfinderContainer, { maxWidth: viewfinderMaxWidth }]}>
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
            </View>
            <Pressable style={styles.scanButton} onPress={handleScan}>
              <MaterialCommunityIcons name="magnify-scan" size={20} color={colors.onPrimary} />
              <Text style={styles.scanButtonText}>{t('disease.scanForDisease')}</Text>
            </Pressable>
            <Pressable style={styles.retakeButton} onPress={handleReset}>
              <MaterialCommunityIcons name="refresh" size={18} color={colors.onSurfaceVariant} />
              <Text style={styles.retakeButtonText}>{t('disease.chooseAnother')}</Text>
            </Pressable>
          </>
        )}

        {/* ─── ANALYZING PHASE: Loading indicator ─── */}
        {scanPhase === 'analyzing' && selectedImage && (
          <>
            <View style={[styles.viewfinderContainer, { maxWidth: viewfinderMaxWidth }]}>
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator size="large" color={colors.primaryFixedDim} />
                <Text style={styles.analyzingText}>{t('disease.analyzing')}</Text>
                <Text style={styles.analyzingSubtext}>{t('disease.aiProcessing')}</Text>
              </View>
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
            </View>
            <Text style={styles.waitText}>{t('disease.pleaseWait')}</Text>
          </>
        )}

        {/* ─── RESULT PHASE: Diagnosis display ─── */}
        {scanPhase === 'result' && scanResult && (
          <View style={styles.resultContainer}>
            {/* Not a plant/animal warning */}
            {!scanResult.is_positive && (
              <View style={[styles.resultHeader, { backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]}>
                <MaterialCommunityIcons name={isCrop ? 'leaf-off' : 'cat'} size={32} color="#FF9800" />
                <View style={styles.resultHeaderText}>
                  <Text style={styles.resultDiseaseName}>
                    {isCrop ? t('disease.notPlantImage') : t('disease.notAnimalImage')}
                  </Text>
                  <Text style={styles.resultConfidence}>
                    {scanResult.message || (isCrop ? t('disease.uploadClearCrop') : t('disease.uploadClearAnimal'))}
                  </Text>
                </View>
              </View>
            )}

            {/* Disease name card */}
            {scanResult.is_positive && (
              <>
                <View style={styles.resultHeader}>
                  <MaterialCommunityIcons
                    name={scanResult.disease_name === 'Healthy' ? 'check-circle' : 'alert-circle'}
                    size={32}
                    color={scanResult.disease_name === 'Healthy' ? '#4CAF50' : '#FF9800'}
                  />
                  <View style={styles.resultHeaderText}>
                    <Text style={styles.resultDiseaseName}>
                      {scanResult.disease_name || t('disease.unknown')}
                    </Text>
                    {scanResult.scientific_name ? (
                      <Text style={styles.resultConfidence}>
                        {scanResult.scientific_name}
                      </Text>
                    ) : null}
                    {scanResult.confidence != null && (
                      <Text style={styles.resultConfidence}>
                        {t('disease.confidence', { value: (scanResult.confidence * 100).toFixed(1) })}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Crop/Animal type badge */}
                {scanResult.category_value ? (
                  <View style={styles.severityBadge}>
                    <Text style={styles.severityBadgeText}>
                      {scanResult.category_label}: {scanResult.category_value}
                    </Text>
                  </View>
                ) : null}

                {/* Symptoms */}
                {scanResult.symptoms.length > 0 && (
                  <View style={styles.resultSection}>
                    <Text style={styles.resultSectionTitle}>{t('disease.symptoms')}</Text>
                    {scanResult.symptoms.map((s: string, i: number) => (
                      <View key={i} style={styles.resultBulletRow}>
                        <MaterialCommunityIcons name="circle-small" size={20} color={colors.primary} />
                        <Text style={styles.resultBulletText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Causes */}
                {scanResult.causes ? (
                  <View style={styles.resultSection}>
                    <Text style={styles.resultSectionTitle}>{t('disease.causes')}</Text>
                    <Text style={styles.resultBulletText}>{scanResult.causes}</Text>
                  </View>
                ) : null}

                {/* Treatment */}
                {scanResult.treatment_recommendations ? (
                  <View style={styles.resultSection}>
                    <Text style={styles.resultSectionTitle}>{t('disease.treatment')}</Text>
                    <Text style={styles.resultBulletText}>{scanResult.treatment_recommendations}</Text>
                  </View>
                ) : null}

                {/* Prevention */}
                {scanResult.prevention_tips.length > 0 && (
                  <View style={styles.resultSection}>
                    <Text style={styles.resultSectionTitle}>{t('disease.prevention')}</Text>
                    {scanResult.prevention_tips.map((p: string, i: number) => (
                      <View key={i} style={styles.resultBulletRow}>
                        <MaterialCommunityIcons name="shield-check" size={18} color={colors.primary} />
                        <Text style={styles.resultBulletText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Affected Crops / Affected Species */}
                {scanResult.affected_value ? (
                  <View style={styles.resultSection}>
                    <Text style={styles.resultSectionTitle}>{scanResult.affected_label}</Text>
                    <Text style={styles.resultBulletText}>{scanResult.affected_value}</Text>
                  </View>
                ) : null}

                {/* Message */}
                {scanResult.message ? (
                  <View style={[styles.resultSection, { backgroundColor: colors.secondaryContainer, borderColor: colors.secondaryContainer }]}>
                    <Text style={styles.resultBulletText}>{scanResult.message}</Text>
                  </View>
                ) : null}
              </>
            )}

            {/* Download Report button */}
            {scanResult.is_positive && (
              <Pressable
                style={[styles.scanButton, styles.downloadButton]}
                onPress={handleDownloadReport}
                disabled={isDownloadingReport}
              >
                {isDownloadingReport ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons name="file-pdf-box" size={20} color={colors.primary} />
                )}
                <Text style={styles.downloadButtonText}>
                  {isDownloadingReport ? t('disease.generating') : t('disease.downloadReport')}
                </Text>
              </Pressable>
            )}

            {/* Scan again */}
            <Pressable style={styles.scanButton} onPress={handleReset}>
              <MaterialCommunityIcons name="camera" size={20} color={colors.onPrimary} />
              <Text style={styles.scanButtonText}>{t('disease.scanAnother')}</Text>
            </Pressable>
          </View>
        )}

        {/* ─── ERROR PHASE: Error display + retry ─── */}
        {scanPhase === 'error' && (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={56} color="#E53935" />
            <Text style={styles.errorTitle}>{t('disease.analysisFailed')}</Text>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
            {errorCode !== 'NETWORK_ERROR' && errorCode !== 'TIMEOUT' && (
              <Text style={styles.errorCode}>{t('common.error')}: {errorCode}</Text>
            )}
            <Pressable style={styles.scanButton} onPress={selectedImage ? handleScan : handleReset}>
              <MaterialCommunityIcons name="refresh" size={20} color={colors.onPrimary} />
              <Text style={styles.scanButtonText}>
                {selectedImage ? t('common.tryAgain') : t('disease.scanAgain')}
              </Text>
            </Pressable>
            <Pressable style={styles.retakeButton} onPress={handleReset}>
              <Text style={styles.retakeButtonText}>{t('common.goBack')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {BOTTOM_TABS.map((tab) => {
          const isActive = bottomActive === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={styles.navItem}
              onPress={() => {
                setBottomActive(tab.key);
                if (tab.key === 'home') onNavigate?.('home');
                if (tab.key === 'weather') onNavigate?.('weather');
                if (tab.key === 'market') onNavigate?.('market');
                if (tab.key === 'helpline') onNavigate?.('helpline');
              }}
            >
              {/* Active indicator bar */}
              <View
                style={[
                  styles.navIndicatorBar,
                  isActive && styles.navIndicatorBarActive,
                ]}
              />
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={isActive ? 25 : 23}
                color={isActive ? colors.primary : colors.onSurfaceVariant}
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
  },
  mainContentInner: {
    alignItems: 'center',
    paddingBottom: 24,
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
  // ─── Gallery Button ───
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    backgroundColor: 'transparent',
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: 32,
    marginTop: 12,
    width: '100%',
    maxWidth: 384,
    alignSelf: 'center',
  },
  galleryButtonText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 0.14,
  },
  // ─── Preview Image ───
  previewImage: {
    width: '100%',
    height: '100%',
  },
  // ─── Retake Button ───
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    marginTop: 8,
    paddingHorizontal: 24,
  },
  retakeButtonText: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  // ─── Analyzing Overlay ───
  analyzingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  analyzingText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  analyzingSubtext: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
  },
  waitText: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 14,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    marginTop: 16,
    textAlign: 'center',
  },
  // ─── Result Display ───
  resultContainer: {
    width: '100%',
    maxWidth: 480,
    gap: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  resultHeaderText: {
    flex: 1,
  },
  resultDiseaseName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    textTransform: 'capitalize',
  },
  resultConfidence: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 13,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondaryContainer,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  severityBadgeText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSecondaryContainer,
    textTransform: 'capitalize',
  },
  resultSection: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: 6,
  },
  resultSectionTitle: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 4,
  },
  resultBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  resultBulletText: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 14,
    fontWeight: '400',
    color: colors.onSurface,
    flex: 1,
    lineHeight: 22,
  },
  // ─── Error Display ───
  errorContainer: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  errorTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    fontWeight: '700',
    color: '#E53935',
  },
  errorMessage: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 15,
    fontWeight: '400',
    color: colors.onSurface,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  errorCode: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 12,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  // ─── Download Report Button ───
  downloadButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginTop: 12,
  },
  downloadButtonText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 2,
  },
  navIndicatorBar: {
    width: 24,
    height: 3,
    borderRadius: 1.5,
    marginBottom: 6,
    backgroundColor: 'transparent',
  },
  navIndicatorBarActive: {
    backgroundColor: colors.primary,
  },
  navLabel: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  navLabelInactive: {
    color: colors.onSurfaceVariant,
  },
});
