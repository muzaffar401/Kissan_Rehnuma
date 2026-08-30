import { useMemo, useState } from 'react';
import {
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

type BottomTab = 'home' | 'disease' | 'weather' | 'market' | 'helpline';
type TrendDirection = 'up' | 'down' | 'flat';

interface MarketRatesScreenProps {
  onNavigate?: (screen: string) => void;
}

interface RateCard {
  id: string;
  name: string;
  mandi: string;
  icon: string;
  price: string;
  unit: string;
  trend: TrendDirection;
  trendValue: string;
  category: string;
}

const bottomTabs: { key: BottomTab; icon: string; label: string }[] = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'disease', icon: 'leaf', label: 'Disease' },
  { key: 'weather', icon: 'weather-sunny', label: 'Weather' },
  { key: 'market', icon: 'tag', label: 'Market' },
  { key: 'helpline', icon: 'phone', label: 'Helpline' },
];

const filterChips = [
  'All Categories',
  'Grains',
  'Vegetables',
  'Fruits',
  'Fertilizers',
];

const rateCards: RateCard[] = [
  {
    id: '1',
    name: 'Wheat',
    mandi: 'Lahore Mandi',
    icon: 'barley',
    price: '3,200',
    unit: 'Price per 40kg',
    trend: 'up',
    trendValue: '+50',
    category: 'Grains',
  },
  {
    id: '2',
    name: 'Rice (Basmati)',
    mandi: 'Multan Mandi',
    icon: 'noodles',
    price: '8,500',
    unit: 'Price per 40kg',
    trend: 'down',
    trendValue: '-120',
    category: 'Grains',
  },
  {
    id: '3',
    name: 'Tomato',
    mandi: 'Faisalabad Mandi',
    icon: 'food-apple',
    price: '600',
    unit: 'Price per 5kg',
    trend: 'up',
    trendValue: '+15',
    category: 'Vegetables',
  },
  {
    id: '4',
    name: 'Sugarcane',
    mandi: 'Sargodha Mandi',
    icon: 'grass',
    price: '400',
    unit: 'Price per 40kg',
    trend: 'flat',
    trendValue: '0',
    category: 'Grains',
  },
];

export default function MarketRatesScreen({ onNavigate }: MarketRatesScreenProps) {
  const { width } = useWindowDimensions();
  const [bottomActive, setBottomActive] = useState<BottomTab>('market');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState('All Categories');
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
  });

  const isWide = width > 600;
  const contentMaxWidth = isWide ? 672 : width;

  // Responsive card width for 1 or 2 columns
  const cardGap = 12;
  const numColumns = isWide ? 2 : 1;
  const cardWidth = isWide
    ? (contentMaxWidth - 40 - cardGap) / 2
    : contentMaxWidth - 40;

  // Filter cards based on search + chip
  const filteredCards = useMemo(() => {
    let cards = rateCards;
    if (activeChip !== 'All Categories') {
      cards = cards.filter((c) => c.category === activeChip);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      cards = cards.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.mandi.toLowerCase().includes(q)
      );
    }
    return cards;
  }, [searchQuery, activeChip]);

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
        <Text style={styles.appBarTitle}>Kissan Rehnuma</Text>
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
          {/* Gradient overlay */}
          <View style={styles.headerGradient} />
          <Text style={styles.headerTitle}>Market Rates</Text>
        </View>

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
            placeholder="Search crops or markets..."
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
          {filterChips.map((chip) => {
            const isActive = activeChip === chip;
            return (
              <Pressable
                key={chip}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setActiveChip(chip)}
              >
                <Text
                  style={[styles.chipText, isActive && styles.chipTextActive]}
                >
                  {chip}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Rate Cards Grid */}
        <View style={styles.cardsGrid}>
          {filteredCards.map((card) => (
            <Pressable
              key={card.id}
              style={[styles.rateCard, { width: cardWidth }]}
            >
              {/* Top section */}
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <View style={styles.cardIconCircle}>
                    <MaterialCommunityIcons
                      name={card.icon as any}
                      size={24}
                      color={colors.onSecondaryContainer}
                    />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{card.name}</Text>
                    <View style={styles.cardMandiRow}>
                      <MaterialCommunityIcons
                        name="map-marker"
                        size={14}
                        color={colors.onSurfaceVariant}
                      />
                      <Text style={styles.cardMandi}>{card.mandi}</Text>
                    </View>
                  </View>
                </View>
                {/* Trend badge */}
                <View
                  style={[
                    styles.trendBadge,
                    card.trend === 'up' && styles.trendUp,
                    card.trend === 'down' && styles.trendDown,
                    card.trend === 'flat' && styles.trendFlat,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      card.trend === 'up'
                        ? 'arrow-up'
                        : card.trend === 'down'
                        ? 'arrow-down'
                        : 'minus'
                    }
                    size={14}
                    color={
                      card.trend === 'up'
                        ? colors.primary
                        : card.trend === 'down'
                        ? colors.error
                        : colors.outline
                    }
                  />
                  <Text
                    style={[
                      styles.trendText,
                      card.trend === 'up' && styles.trendTextUp,
                      card.trend === 'down' && styles.trendTextDown,
                      card.trend === 'flat' && styles.trendTextFlat,
                    ]}
                  >
                    {card.trendValue}
                  </Text>
                </View>
              </View>

              {/* Divider + Price */}
              <View style={styles.cardBottom}>
                <Text style={styles.cardUnit}>{card.unit}</Text>
                <Text
                  style={[
                    styles.cardPrice,
                    card.trend === 'flat' && styles.cardPriceFlat,
                  ]}
                >
                  {card.price} PKR
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Empty state */}
        {filteredCards.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="magnify-close"
              size={48}
              color={colors.outline}
            />
            <Text style={styles.emptyText}>No results found</Text>
          </View>
        )}
      </ScrollView>

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
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
    gap: 16,
    alignSelf: 'center' as const,
    width: '100%',
  },
  // ─── Header Image ───
  headerContainer: {
    height: 192,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLow,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(234, 225, 213, 0.35)',
  },
  headerTitle: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
  },
  // ─── Search Bar ───
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    height: 56,
    paddingHorizontal: 16,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurface,
    height: '100%',
    paddingVertical: 0,
  },
  // ─── Filter Chips ───
  chipsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 24,
    height: 40,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.14,
  },
  chipTextActive: {
    color: colors.onPrimaryContainer,
  },
  // ─── Rate Cards Grid ───
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  rateCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
  },
  cardMandiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMandi: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 14,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
  },
  // ─── Trend Badge ───
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  trendUp: {
    backgroundColor: 'rgba(74, 107, 87, 0.12)',
  },
  trendDown: {
    backgroundColor: 'rgba(186, 26, 26, 0.1)',
  },
  trendFlat: {
    backgroundColor: colors.surfaceVariant,
  },
  trendText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.14,
  },
  trendTextUp: {
    color: colors.primary,
  },
  trendTextDown: {
    color: colors.error,
  },
  trendTextFlat: {
    color: colors.outline,
  },
  // ─── Card Bottom (Price) ───
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceVariant,
    paddingTop: 16,
    marginTop: 4,
  },
  cardUnit: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 12,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  cardPrice: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  cardPriceFlat: {
    color: colors.onSurface,
  },
  // ─── Empty State ───
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
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
