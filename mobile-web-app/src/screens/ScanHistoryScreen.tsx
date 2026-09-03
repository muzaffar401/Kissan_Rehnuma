/**
 * Scan History Screen for Kissan Rehnuma.
 *
 * Shows all past crop and animal disease scans for the authenticated farmer.
 * Each card displays: image thumbnail, disease name, category (Crop/Animal),
 * confidence %, date/time, and a "View Report" action.
 *
 * Data source: GET /api/v1/crop/history + GET /api/v1/animal/history
 * Rate limited: 30 req/min | Circuit breaker: 5 failures → open
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
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
import { cropService, animalService, pdfService, type ApiError } from '../services';
import type { HistoryItem } from '../services/cropService';
import type { AnimalHistoryItem } from '../services/animalService';

// Unified history item for display
interface UnifiedHistoryItem {
  scan_id: string;
  disease_name: string | null;
  confidence: number | null;
  symptoms: string[];
  image_url: string;
  created_at: string;
  category: 'Crop' | 'Animal';
  categoryType: string | null; // crop_type or animal_type
  rawCrop?: HistoryItem;
  rawAnimal?: AnimalHistoryItem;
}

interface ScanHistoryScreenProps {
  onNavigate?: (screen: string) => void;
}

export default function ScanHistoryScreen({
  onNavigate,
}: ScanHistoryScreenProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isWide = width > 480;

  const [history, setHistory] = useState<UnifiedHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
  });

  // ─── Fetch history (both crop and animal) ───
  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage('');

    try {
      // Fetch both crop and animal history in parallel
      const [cropData, animalData] = await Promise.allSettled([
        cropService.getHistory(50),
        animalService.getHistory(50),
      ]);

      const cropItems: UnifiedHistoryItem[] =
        cropData.status === 'fulfilled'
          ? cropData.value.map((item) => ({
              scan_id: item.scan_id,
              disease_name: item.disease_name,
              confidence: item.confidence,
              symptoms: item.symptoms || [],
              image_url: item.image_url,
              created_at: item.created_at,
              category: 'Crop' as const,
              categoryType: item.crop_type,
              rawCrop: item,
            }))
          : [];

      const animalItems: UnifiedHistoryItem[] =
        animalData.status === 'fulfilled'
          ? animalData.value.map((item) => ({
              scan_id: item.scan_id,
              disease_name: item.disease_name,
              confidence: item.confidence,
              symptoms: item.symptoms || [],
              image_url: item.image_url,
              created_at: item.created_at,
              category: 'Animal' as const,
              categoryType: item.animal_type,
              rawAnimal: item,
            }))
          : [];

      // Merge and sort by created_at descending
      const merged = [...cropItems, ...animalItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setHistory(merged);

      // Log any errors
      if (cropData.status === 'rejected') {
        console.warn('Failed to fetch crop history:', cropData.reason);
      }
      if (animalData.status === 'rejected') {
        console.warn('Failed to fetch animal history:', animalData.reason);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setErrorMessage(
        apiErr.detail || t('scanHistory.failedLoadDefault'),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ─── Download report for a specific scan ───
  const handleDownloadReport = async (item: UnifiedHistoryItem) => {
    try {
      if (item.rawCrop) {
        await pdfService.generateAndShareReport(item.rawCrop);
      } else if (item.rawAnimal) {
        await pdfService.generateAndShareReport(item.rawAnimal);
      }
    } catch (err) {
      console.error('PDF generation failed:', err);
      if (Platform.OS === 'web') {
        window.alert(t('scanHistory.errorGenerateReport'));
      } else {
        Alert.alert(t('common.error'), t('scanHistory.errorGenerateReport'));
      }
    }
  };

  // ─── Format date ───
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  // ─── Confidence color ───
  const getConfidenceColor = (confidence: number) => {
    const pct = confidence * 100;
    if (pct >= 80) return '#2E7D32';
    if (pct >= 60) return '#E65100';
    return '#C62828';
  };

  // ─── Render scan card ───
  const renderScanCard = ({ item }: { item: UnifiedHistoryItem }) => {
    const isHealthy = item.disease_name?.toLowerCase() === 'healthy';
    const confidencePct =
      item.confidence != null ? (item.confidence * 100).toFixed(1) : null;
    const categoryColor = item.category === 'Crop' ? '#2E7D32' : '#1565C0';

    return (
      <View style={[styles.card, isWide && { width: (width - 60) / 2 }]}>
        {/* Image thumbnail */}
        <View style={styles.cardImageContainer}>
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <MaterialCommunityIcons
                name={item.category === 'Crop' ? 'leaf' : 'cow'}
                size={32}
                color={colors.onSurfaceVariant}
              />
            </View>
          )}
          {/* Status badge */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isHealthy ? '#2E7D32' : '#E65100' },
            ]}
          >
            <MaterialCommunityIcons
              name={isHealthy ? 'check-circle' : 'alert-circle'}
              size={14}
              color="#fff"
            />
            <Text style={styles.statusBadgeText}>
              {isHealthy ? t('scanHistory.healthy') : t('scanHistory.diseaseStatus')}
            </Text>
          </View>
          {/* Category badge */}
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
            <MaterialCommunityIcons
              name={item.category === 'Crop' ? 'sprout' : 'cow'}
              size={12}
              color="#fff"
            />
            <Text style={styles.categoryBadgeText}>{item.category === 'Crop' ? t('scanHistory.cropCategory') : t('scanHistory.animalCategory')}</Text>
          </View>
        </View>

        {/* Card body */}
        <View style={styles.cardBody}>
          <Text style={styles.cardDiseaseName} numberOfLines={1}>
            {item.disease_name || t('disease.unknown')}
          </Text>

          {item.categoryType && (
            <Text style={styles.cardCropType} numberOfLines={1}>
              {item.categoryType}
            </Text>
          )}

          {confidencePct && (
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>{t('scanHistory.confidenceLabel')}</Text>
              <Text
                style={[
                  styles.confidenceValue,
                  { color: getConfidenceColor(item.confidence ?? 0) },
                ]}
              >
                {confidencePct}%
              </Text>
            </View>
          )}

          {/* Date & time */}
          <View style={styles.dateRow}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={14}
              color={colors.onSurfaceVariant}
            />
            <Text style={styles.dateText}>
              {t('scanHistory.dateAtTime', { date: formatDate(item.created_at || ''), time: formatTime(item.created_at || '') })}
            </Text>
          </View>

          {/* Symptoms preview */}
          {item.symptoms && item.symptoms.length > 0 && (
            <Text style={styles.symptomsPreview} numberOfLines={2}>
              {item.symptoms[0]}
              {item.symptoms.length > 1
                ? t('scanHistory.symptomsMore', { count: item.symptoms.length - 1 })
                : ''}
            </Text>
          )}

          {/* Download button */}
          <Pressable
            style={styles.downloadBtn}
            onPress={() => handleDownloadReport(item)}
          >
            <MaterialCommunityIcons
              name="file-pdf-box"
              size={18}
              color={colors.primary}
            />
            <Text style={styles.downloadBtnText}>{t('scanHistory.downloadReport')}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  // ─── Loading state ───
  if (!fontsLoaded || loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.appBar}>
          <Pressable style={styles.appBarIconBtn} onPress={() => onNavigate?.('disease')}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
          <Text style={styles.appBarTitle}>{t('scanHistory.title')}</Text>
          <View style={styles.appBarIconBtn} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('scanHistory.loadingHistory')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Error state ───
  if (errorMessage && !history) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.appBar}>
          <Pressable style={styles.appBarIconBtn} onPress={() => onNavigate?.('disease')}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
          <Text style={styles.appBarTitle}>{t('scanHistory.title')}</Text>
          <View style={styles.appBarIconBtn} />
        </View>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="wifi-off"
            size={48}
            color={colors.onSurfaceVariant}
          />
          <Text style={styles.errorTitle}>{t('scanHistory.couldntLoad')}</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={() => fetchHistory()}>
            <MaterialCommunityIcons
              name="refresh"
              size={18}
              color={colors.onPrimary}
            />
            <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const scanData = history || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <Pressable style={styles.appBarIconBtn} onPress={() => onNavigate?.('disease')}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
        <Text style={styles.appBarTitle}>Scan History</Text>
        <Pressable style={styles.appBarIconBtn} onPress={() => fetchHistory(true)}>
          <MaterialCommunityIcons
            name="refresh"
            size={24}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          {t('scanHistory.scansFound', { count: scanData.length })}
        </Text>
      </View>

      {scanData.length === 0 ? (
        // ─── Empty state ───
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="scanner-off"
            size={64}
            color={colors.onSurfaceVariant}
          />
          <Text style={styles.emptyTitle}>{t('scanHistory.noScansYet')}</Text>
          <Text style={styles.emptyMessage}>
            {t('scanHistory.noScansMessage')}
          </Text>
          <Pressable
            style={styles.scanNowButton}
            onPress={() => onNavigate?.('disease')}
          >
            <MaterialCommunityIcons
              name="camera"
              size={18}
              color={colors.onPrimary}
            />
            <Text style={styles.scanNowButtonText}>{t('scanHistory.scanNow')}</Text>
          </Pressable>
        </View>
      ) : (
        // ─── Scan list ───
        <FlatList
          data={scanData}
          keyExtractor={(item, index) =>
            item.scan_id || `scan-${index}`
          }
          renderItem={renderScanCard}
          numColumns={isWide ? 2 : 1}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={isWide ? styles.columnWrapper : undefined}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchHistory(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// =========================================================
// Styles
// =========================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceDim,
  },

  // ─── App Bar ───
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

  // ─── Summary Bar ───
  summaryBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  summaryText: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 13,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },

  // ─── Loading ───
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginTop: 16,
  },

  // ─── Error ───
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    marginTop: 16,
  },
  errorMessage: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  retryButtonText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
  },

  // ─── Empty State ───
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    fontWeight: '700',
    color: colors.onSurface,
    marginTop: 16,
  },
  emptyMessage: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  scanNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  scanNowButtonText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
  },

  // ─── List ───
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  columnWrapper: {
    gap: 12,
  },

  // ─── Scan Card ───
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImageContainer: {
    width: '100%',
    height: 140,
    backgroundColor: colors.surfaceContainer,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  categoryBadgeText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },

  // ─── Card Body ───
  cardBody: {
    padding: 14,
  },
  cardDiseaseName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  cardCropType: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  confidenceLabel: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  confidenceValue: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  dateText: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  symptomsPreview: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 8,
    lineHeight: 17,
  },

  // ─── Download Button ───
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 12,
  },
  downloadBtnText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});
