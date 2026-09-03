import { useState } from 'react';
import {
  Animated,
  Image,
  Modal,
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
import { NotoNastaliqUrdu_400Regular } from '@expo-google-fonts/noto-nastaliq-urdu';
import { colors } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { tokenStorage } from '../services/tokenStorage';
import { LANGUAGE_NAMES } from '../i18n';
import type { SupportedLanguage } from '../i18n';
import i18n from '../i18n';

const LANGUAGE_OPTIONS: { id: SupportedLanguage; nativeName: string }[] = [
  { id: 'en', nativeName: 'English' },
  { id: 'ur', nativeName: 'اردو' },
  { id: 'sd', nativeName: 'سنڌي' },
];

type BottomTab = 'home' | 'disease' | 'weather' | 'market' | 'helpline';

interface SettingsScreenProps {
  onNavigate?: (screen: string) => void;
}

const BOTTOM_TABS: { key: BottomTab; icon: string; labelKey: string }[] = [
  { key: 'home', icon: 'home', labelKey: 'common.nav.home' },
  { key: 'disease', icon: 'leaf', labelKey: 'common.nav.disease' },
  { key: 'weather', icon: 'weather-sunny', labelKey: 'common.nav.weather' },
  { key: 'market', icon: 'tag', labelKey: 'common.nav.market' },
  { key: 'helpline', icon: 'phone', labelKey: 'common.nav.helpline' },
];

const SETTINGS_ITEMS = [
  { id: 'account', icon: 'account', titleKey: 'settings.accountInfo', subtitleKey: 'settings.accountSubtitle', type: 'link' as const },
  { id: 'language', icon: 'translate', titleKey: 'settings.language', subtitleKey: 'settings.languageSubtitle', type: 'link' as const, dynamic: true },
  { id: 'notifications', icon: 'bell', titleKey: 'settings.notifications', subtitleKey: 'settings.notificationsSubtitle', type: 'toggle' as const, defaultOn: true },
  { id: 'darkmode', icon: 'brightness-6', titleKey: 'settings.darkMode', subtitleKey: 'settings.darkModeSubtitle', type: 'toggle' as const, defaultOn: false },
  { id: 'help', icon: 'help-circle', titleKey: 'settings.helpSupport', subtitleKey: 'settings.helpSubtitle', type: 'link' as const },
  { id: 'about', icon: 'information', titleKey: 'settings.about', subtitleKey: 'settings.aboutSubtitle', type: 'link' as const },
];

// Custom toggle switch component
function ToggleSwitch({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  const translateX = value ? 24 : 0;
  const trackColor = value ? colors.primaryContainer : colors.surfaceVariant;
  const borderColor = value ? colors.primaryContainer : colors.outlineVariant;

  return (
    <Pressable
      style={[styles.toggleTrack, { backgroundColor: trackColor }]}
      onPress={onToggle}
    >
      <Animated.View
        style={[
          styles.toggleThumb,
          {
            borderColor,
            transform: [{ translateX }],
          },
        ]}
      />
    </Pressable>
  );
}

export default function SettingsScreen({ onNavigate }: SettingsScreenProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [bottomActive, setBottomActive] = useState<BottomTab>('home');
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    notifications: true,
    darkmode: false,
  });
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    NotoNastaliqUrdu_400Regular,
  });

  const isWide = width > 600;
  const contentMaxWidth = isWide ? 672 : width;

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  const handleToggle = (id: string) => {
    setToggles((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleChangeLanguage = async (langId: SupportedLanguage) => {
    await i18n.changeLanguage(langId);
    await tokenStorage.setOnboardingComplete(langId); // persist language
    setShowLangPicker(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <Pressable
          style={styles.appBarBackBtn}
          onPress={() => onNavigate?.('home')}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
        <Text style={styles.appBarTitle}>{t('settings.title')}</Text>
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
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <Image
              source={require('../../assets/profile_avatar.jpg')}
              style={styles.profileImage}
            />
            <Pressable style={styles.profileEditBtn}>
              <MaterialCommunityIcons
                name="pencil"
                size={16}
                color={colors.onPrimary}
              />
            </Pressable>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Ahmad Khan</Text>
            <View style={styles.profileLocationRow}>
              <MaterialCommunityIcons
                name="map-marker"
                size={18}
                color={colors.secondary}
              />
              <Text style={styles.profileLocation}>Multan, Pakistan</Text>
            </View>
          </View>
        </View>

        {/* Settings List */}
        <View style={styles.settingsList}>
          {SETTINGS_ITEMS.map((item) => (
            <View key={item.id} style={styles.settingsCard}>
              {item.type === 'link' ? (
                <Pressable
                  style={styles.settingsRow}
                  onPress={item.id === 'language' ? () => setShowLangPicker(true) : undefined}
                >
                  <View style={styles.settingsRowLeft}>
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={24}
                      color={colors.primaryContainer}
                    />
                    <View style={styles.settingsRowText}>
                      <Text style={styles.settingsRowTitle}>{t(item.titleKey)}</Text>
                      <Text style={styles.settingsRowSubtitle}>
                        {item.id === 'language'
                          ? t('settings.languageSubtitle', { language: LANGUAGE_NAMES[(i18n.language as keyof typeof LANGUAGE_NAMES) || 'en'] || 'English' })
                          : t(item.subtitleKey)
                        }
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color={colors.onSurfaceVariant}
                  />
                </Pressable>
              ) : (
                <View style={styles.settingsRow}>
                  <View style={styles.settingsRowLeft}>
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={24}
                      color={colors.primaryContainer}
                    />
                    <View style={styles.settingsRowText}>
                      <Text style={styles.settingsRowTitle}>{t(item.titleKey)}</Text>
                      <Text style={styles.settingsRowSubtitle}>
                        {t(item.subtitleKey)}
                      </Text>
                    </View>
                  </View>
                  <ToggleSwitch
                    value={toggles[item.id] ?? false}
                    onToggle={() => handleToggle(item.id)}
                  />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Logout */}
        <Pressable
          style={styles.logoutBtn}
          onPress={async () => {
            await tokenStorage.clearAll();
            onNavigate?.('login');
          }}
        >
          <Text style={styles.logoutText}>{t('settings.logout')}</Text>
        </Pressable>
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
                if (tab.key === 'market' && onNavigate) onNavigate('market');
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
      {/* Language Picker Modal */}
      <Modal
        visible={showLangPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLangPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLangPicker(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('language.title')}</Text>
            {LANGUAGE_OPTIONS.map((lang) => {
              const isActive = i18n.language === lang.id;
              return (
                <Pressable
                  key={lang.id}
                  style={[styles.langOption, isActive && styles.langOptionActive]}
                  onPress={() => handleChangeLanguage(lang.id)}
                >
                  <View>
                    <Text
                      style={[
                        styles.langNativeName,
                        lang.id === 'ur' && styles.langNativeNameUrdu,
                        isActive && styles.langNativeNameActive,
                      ]}
                    >
                      {lang.nativeName}
                    </Text>
                    <Text style={styles.langEnglishName}>
                      {LANGUAGE_NAMES[lang.id]}
                    </Text>
                  </View>
                  {isActive && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
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
    paddingVertical: 16,
    gap: 24,
    alignSelf: 'center' as const,
    width: '100%',
    paddingHorizontal: 20,
  },
  // ─── Profile Section ───
  profileSection: {
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
    gap: 12,
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: colors.surface,
  },
  profileEditBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  profileInfo: {
    alignItems: 'center',
    gap: 4,
  },
  profileName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 24,
    fontWeight: '600',
    color: colors.onSurface,
  },
  profileLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  profileLocation: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    lineHeight: 24,
  },
  // ─── Settings List ───
  settingsList: {
    gap: 12,
  },
  settingsCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    minHeight: 56,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  settingsRowText: {
    flex: 1,
    gap: 2,
  },
  settingsRowTitle: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
    lineHeight: 20,
    letterSpacing: 0.14,
  },
  settingsRowSubtitle: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 14,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
  },
  // ─── Toggle Switch ───
  toggleTrack: {
    width: 48,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 2,
  },
  // ─── Logout ───
  logoutBtn: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 40,
  },
  logoutText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
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
  // ─── Language Picker Modal ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    gap: 12,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  langOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer + '18',
  },
  langNativeName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
  },
  langNativeNameUrdu: {
    fontFamily: 'NotoNastaliqUrdu_400Regular',
    fontSize: 20,
    lineHeight: 36,
  },
  langNativeNameActive: {
    color: colors.primary,
  },
  langEnglishName: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
});
