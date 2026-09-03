import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { marketService, type CropPrice } from '../services/marketService';
import { CROP_NAME_KEYS } from '../services/cropTranslations';

type BottomTab = 'home' | 'disease' | 'weather' | 'market' | 'helpline';

interface MarketRatesScreenProps {
  onNavigate?: (screen: string) => void;
}

const BOTTOM_TABS: { key: BottomTab; icon: string; labelKey: string }[] = [
  { key: 'home', icon: 'home', labelKey: 'common.nav.home' },
  { key: 'disease', icon: 'leaf', labelKey: 'common.nav.disease' },
  { key: 'weather', icon: 'weather-sunny', labelKey: 'common.nav.weather' },
  { key: 'market', icon: 'tag', labelKey: 'common.nav.market' },
  { key: 'helpline', icon: 'phone', labelKey: 'common.nav.helpline' },
];

const FILTER_CHIPS = [
  { label: 'market.all', value: 'All' },
  { label: 'market.grains', value: 'market.grains' },
  { label: 'market.vegetables', value: 'market.vegetables' },
  { label: 'market.fruits', value: 'market.fruits' },
];

// Categorize crop by name for filter chips — returns i18n key
function categorize(name: string): string {
  const n = name.toLowerCase();
  const fruits = ['apple', 'banana', 'guava', 'orange', 'kinnow', 'mango', 'melon', 'watermelon', 'lychee', 'strawberry', 'dates', 'lemon', 'peach', 'plum', 'pear', 'musambi', 'grapefruit', 'grapes', 'apricot', 'pomegranate', 'sweet musk', 'jujube', 'coconut', 'papaya', 'loquat', 'persimmon', 'jaman', 'feutral'];
  const grains = ['wheat', 'rice', 'maize', 'millet', 'sorghum', 'barley', 'sugar', 'jaggery', 'sugarcane', 'cotton', 'gram', 'moong', 'mash', 'masoor', 'rapeseed', 'canola', 'sunflower', 'sesame', 'mustard seed', 'groundnut', 'red chilli', 'banola', 'fodder', 'straw'];
  if (fruits.some(f => n.includes(f))) return 'market.fruits';
  if (grains.some(g => n.includes(g))) return 'market.grains';
  return 'market.vegetables';
}

// Map crop name to MaterialCommunityIcons icon
function cropIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('wheat') || n.includes('maize') || n.includes('rice') || n.includes('barley') || n.includes('millet') || n.includes('sorghum')) return 'grain';
  if (n.includes('tomato')) return 'food-apple';
  if (n.includes('onion')) return 'food-apple';
  if (n.includes('potato')) return 'food';
  if (n.includes('apple')) return 'food-apple';
  if (n.includes('banana')) return 'food';
  if (n.includes('mango')) return 'fruit-cherries';
  if (n.includes('grape')) return 'fruit-grapes';
  if (n.includes('sugar')) return 'cube-outline';
  if (n.includes('cotton')) return 'weather-snowy';
  if (n.includes('chilli')) return 'food-apple';
  if (n.includes('garlic') || n.includes('ginger')) return 'food';
  if (n.includes('lemon')) return 'food-apple';
  if (n.includes('melon') || n.includes('watermelon')) return 'food';
  if (n.includes('peach') || n.includes('pear')) return 'food-apple';
  if (n.includes('date')) return 'food';
  if (n.includes('gram') || n.includes('moong') || n.includes('mash') || n.includes('masoor')) return 'grain';
  return 'food-apple';
}

function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return '—';
  if (price < 1) return price.toFixed(2);
  return price.toFixed(0);
}

export default function MarketRatesScreen({ onNavigate }: MarketRatesScreenProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [bottomActive, setBottomActive] = useState<BottomTab>('market');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState('All');
  const [crops, setCrops] = useState<CropPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordedDate, setRecordedDate] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
  });

  const isWide = width > 600;
  const contentMaxWidth = isWide ? 672 : width;
  const cardGap = 12;
  const cardWidth = isWide
    ? (contentMaxWidth - 40 - cardGap) / 2
    : contentMaxWidth - 40;

  // Fetch rates from API
  useEffect(() => {
    let cancelled = false;
    const fetchRates = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await marketService.getAllRates();
        if (!cancelled) {
          setCrops(data.crops);
          setRecordedDate(data.recorded_date);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err && typeof err === 'object' && 'detail' in err
            ? (err as { detail: string }).detail
            : t('market.failedLoad');
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRates();
    return () => { cancelled = true; };
  }, []);

  // Filter cards based on search + chip
  const filteredCrops = useMemo(() => {
    let items = crops;
    if (activeChip !== 'All') {
      items = items.filter((c) => categorize(c.crop_name) === activeChip);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (c) =>
          c.crop_name.toLowerCase().includes(q) ||
          c.mandi_name.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q)
      );
    }
    return items;
  }, [crops, searchQuery, activeChip]);

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <Pressable style={styles.appBarBtn}>
          <MaterialCommunityIcons
            name="tractor-variant"
            size={24}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
        <Text style={styles.appBarTitle}>{t('common.appName')}</Text>
        <Pressable style={styles.appBarBtn}>
          <MaterialCommunityIcons
            name="account-circle"
            size={24}
            color={colors.onSurfaceVariant}
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
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Image */}
        <View style={styles.headerContainer}>
          <Image
            source={require('../../assets/market_header.jpg')}
            style={styles.headerImage}
            resizeMode="cover"
          />
          <View style={styles.headerGradient} />
          <Text style={styles.headerTitle}>{t('market.title')}</Text>
        </View>

        {/* Date badge */}
        {recordedDate && (
          <View style={styles.dateBadge}>
            <MaterialCommunityIcons name="calendar-today" size={14} color={colors.onSurfaceVariant} />
            <Text style={styles.dateText}>{t('market.ratesAsOf', { date: recordedDate })}</Text>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons
            name="magnify"
            size={24}
            color={colors.outline}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t('market.searchPlaceholder')}
            placeholderTextColor={colors.onSurfaceVariant}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeChip === chip.value;
            return (
              <Pressable
                key={chip.value}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setActiveChip(chip.value)}
              >
                <Text
                  style={[styles.chipText, isActive && styles.chipTextActive]}
                >
                  {t(chip.label)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Loading State */}
        {loading && (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.centerText}>{t('market.loadingRates')}</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.centerState}>
            <MaterialCommunityIcons name="alert-circle" size={48} color={colors.error} />
            <Text style={styles.centerText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => {}}>
              <Text style={styles.retryText}>{t('market.retry')}</Text>
            </Pressable>
          </View>
        )}

        {/* Rate Cards Grid */}
        {!loading && !error && (
          <>
            <Text style={styles.resultsCount}>
              {activeChip !== 'All'
                ? t('market.itemsInCategory', { count: filteredCrops.length, category: t(activeChip) })
                : t('market.itemsCount', { count: filteredCrops.length })
              }
            </Text>
            <View style={styles.cardsGrid}>
              {filteredCrops.map((item) => (
                <View
                  key={`${item.crop_name}-${item.mandi_name}`}
                  style={[styles.rateCard, { width: cardWidth }]}
                >
                  {/* Top section */}
                  <View style={styles.cardTop}>
                    <View style={styles.cardLeft}>
                      <View style={styles.cardIconCircle}>
                        <MaterialCommunityIcons
                          name={cropIcon(item.crop_name) as any}
                          size={24}
                          color={colors.onSecondaryContainer}
                        />
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName} numberOfLines={1}>{t(CROP_NAME_KEYS[item.crop_name] || '', { defaultValue: item.crop_name })}</Text>
                        <View style={styles.cardMandiRow}>
                          <MaterialCommunityIcons
                            name="map-marker"
                            size={14}
                            color={colors.onSurfaceVariant}
                          />
                          <Text style={styles.cardMandi}>{item.mandi_name}</Text>
                        </View>
                      </View>
                    </View>
                    {/* Category badge */}
                    <View style={[
                      styles.categoryBadge,
                      categorize(item.crop_name) === 'market.grains' && styles.catGrains,
                      categorize(item.crop_name) === 'market.vegetables' && styles.catVegetables,
                      categorize(item.crop_name) === 'market.fruits' && styles.catFruits,
                    ]}>
                      <Text style={styles.categoryText}>
                        {t(categorize(item.crop_name))}
                      </Text>
                    </View>
                  </View>

                  {/* Divider + Price */}
                  <View style={styles.cardBottom}>
                    <View>
                      <Text style={styles.cardUnit}>{t('market.fqpPrice')}</Text>
                      {item.min_price !== null && item.max_price !== null && (
                        <Text style={styles.cardRange}>
                          {t('market.minMax', { min: formatPrice(item.min_price), max: formatPrice(item.max_price) })}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.cardPrice}>
                      {formatPrice(item.fqp_price)} <Text style={styles.cardCurrency}>PKR</Text>
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Empty state */}
            {filteredCrops.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="magnify-close"
                  size={48}
                  color={colors.outline}
                />
                <Text style={styles.emptyText}>{t('market.noResults')}</Text>
              </View>
            )}
          </>
        )}
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
                if (tab.key === 'helpline' && onNavigate) onNavigate('helpline');
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
  container: { flex: 1, backgroundColor: colors.surface },
  appBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.surfaceContainer,
  },
  appBarBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  appBarTitle: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, fontWeight: '700',
    color: colors.primary, flex: 1, textAlign: 'center',
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingTop: 12, paddingBottom: 40, paddingHorizontal: 20,
    gap: 16, alignSelf: 'center' as const, width: '100%',
  },
  headerContainer: {
    height: 192, borderRadius: 12, overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLow,
    shadowColor: '#4A453C', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 24, elevation: 4,
  },
  headerImage: { width: '100%', height: '100%' },
  headerGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(234, 225, 213, 0.35)',
  },
  headerTitle: {
    position: 'absolute', bottom: 12, left: 16,
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26, fontWeight: '700', color: colors.primary,
  },
  dateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceContainer, paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start',
  },
  dateText: {
    fontFamily: 'BeVietnamPro_400Regular', fontSize: 13,
    fontWeight: '400', color: colors.onSurfaceVariant,
  },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceContainer, borderRadius: 9999,
    borderWidth: 1, borderColor: colors.outlineVariant, height: 56,
    paddingHorizontal: 16,
    shadowColor: '#4A453C', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1, fontFamily: 'BeVietnamPro_400Regular', fontSize: 16,
    fontWeight: '400', color: colors.onSurface, height: '100%', paddingVertical: 0,
  },
  chipsScroll: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 24, height: 40, borderRadius: 9999,
    borderWidth: 1, borderColor: colors.outlineVariant,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  chipText: {
    fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 14, fontWeight: '600',
    color: colors.onSurfaceVariant, letterSpacing: 0.14,
  },
  chipTextActive: { color: colors.onPrimaryContainer },
  resultsCount: {
    fontFamily: 'BeVietnamPro_500Medium', fontSize: 14,
    fontWeight: '500', color: colors.onSurfaceVariant,
  },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rateCard: {
    backgroundColor: colors.surfaceContainerLowest, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: colors.surfaceVariant,
    shadowColor: '#4A453C', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    justifyContent: 'space-between',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardInfo: { flex: 1, gap: 2 },
  cardName: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 18,
    fontWeight: '600', color: colors.onSurface,
  },
  cardMandiRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMandi: {
    fontFamily: 'BeVietnamPro_400Regular', fontSize: 14,
    fontWeight: '400', color: colors.onSurfaceVariant,
  },
  categoryBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: colors.surfaceVariant,
  },
  catGrains: { backgroundColor: 'rgba(139, 117, 51, 0.12)' },
  catVegetables: { backgroundColor: 'rgba(74, 107, 87, 0.12)' },
  catFruits: { backgroundColor: 'rgba(186, 100, 26, 0.12)' },
  categoryText: {
    fontFamily: 'BeVietnamPro_500Medium', fontSize: 11,
    fontWeight: '500', color: colors.onSurfaceVariant,
  },
  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderTopWidth: 1, borderTopColor: colors.surfaceVariant, paddingTop: 16, marginTop: 4,
  },
  cardUnit: {
    fontFamily: 'BeVietnamPro_500Medium', fontSize: 12,
    fontWeight: '500', color: colors.onSurfaceVariant,
  },
  cardRange: {
    fontFamily: 'BeVietnamPro_400Regular', fontSize: 11,
    fontWeight: '400', color: colors.outline, marginTop: 2,
  },
  cardPrice: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24,
    fontWeight: '700', color: colors.primary,
  },
  cardCurrency: {
    fontFamily: 'BeVietnamPro_500Medium', fontSize: 14,
    fontWeight: '500',
  },
  centerState: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12,
  },
  centerText: {
    fontFamily: 'BeVietnamPro_400Regular', fontSize: 16,
    fontWeight: '400', color: colors.onSurfaceVariant, textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8,
    backgroundColor: colors.primaryContainer, marginTop: 4,
  },
  retryText: {
    fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 14,
    fontWeight: '600', color: colors.onPrimaryContainer,
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  emptyText: {
    fontFamily: 'BeVietnamPro_400Regular', fontSize: 16,
    fontWeight: '400', color: colors.onSurfaceVariant,
  },
  bottomNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: colors.surfaceContainer, height: 80,
    paddingHorizontal: 8, paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderTopWidth: 1, borderTopColor: colors.surfaceDim,
    shadowColor: '#4A453C', shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 8,
  },
  navItem: {
    alignItems: 'center', justifyContent: 'center',
    minWidth: 56, paddingVertical: 4, paddingHorizontal: 16, borderRadius: 16,
  },
  navItemActive: { backgroundColor: colors.primaryContainer, borderRadius: 28 },
  navLabel: {
    fontFamily: 'BeVietnamPro_500Medium', fontSize: 12,
    fontWeight: '500', marginTop: 4,
  },
  navLabelActive: { color: colors.onPrimaryContainer },
  navLabelInactive: { color: colors.onSurfaceVariant },
});
