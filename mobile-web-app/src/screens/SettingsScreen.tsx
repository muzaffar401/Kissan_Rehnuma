import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Animated,
  Image,
  Modal,
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
import { NotoNastaliqUrdu_400Regular } from '@expo-google-fonts/noto-nastaliq-urdu';
import { useTheme } from '../theme/ThemeContext';
import type { ColorPalette } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { tokenStorage } from '../services/tokenStorage';
import { authService } from '../services/authService';
import * as ImagePicker from 'expo-image-picker';
import { LANGUAGE_NAMES } from '../i18n';
import type { SupportedLanguage } from '../i18n';
import i18n from '../i18n';

// Storage keys for settings persistence
const KEYS = {
  SETTING_DARK_MODE: 'kissan_setting_dark_mode',
} as const;

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
  { id: 'darkmode', icon: 'brightness-6', titleKey: 'settings.darkMode', subtitleKey: 'settings.darkModeSubtitle', type: 'toggle' as const, defaultOn: false },
  { id: 'help', icon: 'help-circle', titleKey: 'settings.faqs', subtitleKey: 'settings.faqsSubtitle', type: 'link' as const },
  { id: 'about', icon: 'information', titleKey: 'settings.about', subtitleKey: 'settings.aboutSubtitle', type: 'link' as const },
];

// Custom toggle switch component
function ToggleSwitch({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
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
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const [bottomActive, setBottomActive] = useState<BottomTab>('home');
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    darkmode: false,
  });
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  // Edit profile modal state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    NotoNastaliqUrdu_400Regular,
  });

  // Load user profile: fetch from DB via API, fallback to localStorage
  const refreshProfile = useCallback(async () => {
    // Load settings from localStorage (always local)
    const [darkOn, avatar] = await Promise.all([
      tokenStorage.getSetting(KEYS.SETTING_DARK_MODE, false),
      tokenStorage.getAvatarUri(),
    ]);
    setToggles({ darkmode: isDark });
    setAvatarUri(avatar);

    // Try to fetch full profile from database
    try {
      const profile = await authService.getProfile();
      const fullName = `${profile.name} ${profile.lastname}`.trim();
      const location = [profile.city, profile.country].filter(Boolean).join(', ') || null;
      setUserName(fullName);
      setUserLocation(location);
      setUserEmail(profile.email);
      // Sync to localStorage for offline access
      await tokenStorage.saveUserInfo(
        String(profile.id), profile.email, fullName, profile.city, profile.country,
      );
    } catch {
      // API unavailable — use cached localStorage data
      const [name, location, email] = await Promise.all([
        tokenStorage.getUserName(),
        tokenStorage.getUserLocation(),
        tokenStorage.getUserEmail(),
      ]);
      setUserName(name);
      setUserLocation(location);
      setUserEmail(email);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const isWide = width > 600;
  const contentMaxWidth = isWide ? 672 : width;

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  const handleToggle = async (id: string) => {
    if (id === 'darkmode') {
      await toggleTheme();
      setToggles((prev) => ({ ...prev, darkmode: !isDark }));
      return;
    }
    const newVal = !toggles[id];
    setToggles((prev) => ({ ...prev, [id]: newVal }));
    const storageKey = id === 'darkmode'
      ? KEYS.SETTING_DARK_MODE
      : null;
    if (storageKey) {
      await tokenStorage.setSetting(storageKey, newVal);
    }
  };

  // ── Convert blob URL to persistent base64 data URI (web only) ──
  const toDataUri = async (uri: string): Promise<string> => {
    if (Platform.OS === 'web' && uri.startsWith('blob:')) {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    return uri; // native file URIs are already persistent
  };

  // ── Profile image picker ──
  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const dataUri = await toDataUri(result.assets[0].uri);
        setAvatarUri(dataUri);
        await tokenStorage.setAvatarUri(dataUri);
      }
    } catch {
      Alert.alert(t('common.error'), 'Could not pick image');
    }
  };

  // ── Edit Profile modal ──
  const handleOpenEditProfile = async () => {
    // Try to load fresh data from DB
    try {
      const profile = await authService.getProfile();
      setEditName(`${profile.name} ${profile.lastname}`.trim());
      setEditCity(profile.city || '');
      setEditCountry(profile.country || '');
    } catch {
      // Fallback to localStorage
      const [name, city, country] = await Promise.all([
        tokenStorage.getUserName(),
        tokenStorage.getUserCity(),
        tokenStorage.getUserCountry(),
      ]);
      setEditName(name || '');
      setEditCity(city || '');
      setEditCountry(country || '');
    }
    const avatar = await tokenStorage.getAvatarUri();
    setEditAvatarUri(avatar);
    setShowEditProfile(true);
  };

  const handleEditPickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const dataUri = await toDataUri(result.assets[0].uri);
        setEditAvatarUri(dataUri);
      }
    } catch {
      // ignore
    }
  };

  const handleSaveProfile = async () => {
    // Split full name into first + last for the DB
    const nameParts = editName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Save to database via API
    try {
      await authService.updateProfile({
        name: firstName || undefined,
        lastname: lastName || undefined,
        city: editCity.trim() || undefined,
        country: editCountry.trim() || undefined,
      });
    } catch {
      // API failed — still save locally as fallback
    }

    // Always sync localStorage
    await tokenStorage.updateProfile({
      name: editName.trim() || undefined,
      city: editCity.trim() || undefined,
      country: editCountry.trim() || undefined,
    });
    if (editAvatarUri) {
      await tokenStorage.setAvatarUri(editAvatarUri);
    }
    setShowEditProfile(false);
    await refreshProfile();
  };

  const handleRemoveAvatar = async () => {
    setEditAvatarUri(null);
    setAvatarUri(null);
    // Remove from storage by setting empty string
    await tokenStorage.setAvatarUri('');
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
        <Pressable style={styles.profileSection} onPress={handleOpenEditProfile}>
          <View style={styles.profileImageContainer}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileAvatarFallback}>
                <MaterialCommunityIcons name="account" size={44} color={colors.onPrimaryContainer} />
              </View>
            )}
            <Pressable style={styles.profileEditBtn} onPress={handlePickAvatar}>
              <MaterialCommunityIcons
                name="pencil"
                size={16}
                color={colors.onPrimary}
              />
            </Pressable>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName || t('settings.guestName')}</Text>
            {userLocation ? (
              <View style={styles.profileLocationRow}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={18}
                  color={colors.secondary}
                />
                <Text style={styles.profileLocation}>{userLocation}</Text>
              </View>
            ) : userEmail ? (
              <View style={styles.profileLocationRow}>
                <MaterialCommunityIcons
                  name="email"
                  size={18}
                  color={colors.secondary}
                />
                <Text style={styles.profileLocation}>{userEmail}</Text>
              </View>
            ) : null}
            <Text style={styles.profileEditHint}>{t('editProfile.title')}</Text>
          </View>
        </Pressable>

        {/* Settings List */}
        <View style={styles.settingsList}>
          {SETTINGS_ITEMS.map((item) => (
            <View key={item.id} style={styles.settingsCard}>
              {item.type === 'link' ? (
                <Pressable
                  style={styles.settingsRow}
                  onPress={
                    item.id === 'language'
                      ? () => setShowLangPicker(true)
                      : item.id === 'account'
                        ? handleOpenEditProfile
                        : item.id === 'help'
                          ? () => onNavigate?.('faq')
                          : item.id === 'about'
                            ? () => setShowAbout(true)
                            : undefined
                  }
                >
                  <View style={styles.settingsRowLeft}>
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={24}
                      color={colors.primary}
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
                      color={colors.primary}
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
              style={styles.navItem}
              onPress={() => {
                setBottomActive(tab.key);
                if (tab.key === 'home' && onNavigate) onNavigate('home');
                if (tab.key === 'disease' && onNavigate) onNavigate('disease');
                if (tab.key === 'weather' && onNavigate) onNavigate('weather');
                if (tab.key === 'market' && onNavigate) onNavigate('market');
                if (tab.key === 'helpline' && onNavigate) onNavigate('helpline');
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

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowEditProfile(false)}
        >
          <Pressable style={styles.editProfileContent}>
            <Text style={styles.modalTitle}>{t('editProfile.title')}</Text>

            {/* Avatar in edit modal */}
            <View style={styles.editAvatarRow}>
              <Pressable onPress={handleEditPickAvatar}>
                {editAvatarUri ? (
                  <Image source={{ uri: editAvatarUri }} style={styles.editAvatarImage} />
                ) : (
                  <View style={styles.editAvatarFallback}>
                    <MaterialCommunityIcons name="account" size={30} color={colors.onPrimaryContainer} />
                  </View>
                )}
                <View style={styles.editAvatarOverlay}>
                  <MaterialCommunityIcons name="camera" size={14} color={colors.onPrimary} />
                </View>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Pressable onPress={handleEditPickAvatar}>
                  <Text style={styles.editAvatarAction}>{t('editProfile.changePhoto')}</Text>
                </Pressable>
                {editAvatarUri ? (
                  <Pressable onPress={handleRemoveAvatar}>
                    <Text style={[styles.editAvatarAction, { color: colors.error }]}>
                      {t('editProfile.removePhoto')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* Name field */}
            <Text style={styles.editLabel}>{t('editProfile.name')}</Text>
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={setEditName}
              placeholder={t('editProfile.name')}
              placeholderTextColor={colors.onSurfaceVariant}
            />

            {/* City field */}
            <Text style={styles.editLabel}>{t('editProfile.city')}</Text>
            <TextInput
              style={styles.editInput}
              value={editCity}
              onChangeText={setEditCity}
              placeholder={t('editProfile.city')}
              placeholderTextColor={colors.onSurfaceVariant}
            />

            {/* Country field */}
            <Text style={styles.editLabel}>{t('editProfile.country')}</Text>
            <TextInput
              style={styles.editInput}
              value={editCountry}
              onChangeText={setEditCountry}
              placeholder={t('editProfile.country')}
              placeholderTextColor={colors.onSurfaceVariant}
            />

            {/* Buttons */}
            <View style={styles.editButtonRow}>
              <Pressable
                style={styles.editCancelBtn}
                onPress={() => setShowEditProfile(false)}
              >
                <Text style={styles.editCancelText}>{t('editProfile.cancel')}</Text>
              </Pressable>
              <Pressable style={styles.editSaveBtn} onPress={handleSaveProfile}>
                <Text style={styles.editSaveText}>{t('editProfile.save')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* About Modal */}
      <Modal visible={showAbout} transparent animationType="fade" onRequestClose={() => setShowAbout(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAbout(false)}
        >
          <Pressable style={styles.aboutCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.aboutLogoCircle}>
              <MaterialCommunityIcons name="leaf" size={48} color="#fff" />
            </View>
            <Text style={styles.aboutAppName}>Kissan Rehnuma</Text>
            <Text style={styles.aboutVersion}>v2.1.0</Text>
            <Text style={styles.aboutDesc}>{t('settings.aboutDescription')}</Text>
            <View style={styles.aboutDivider} />
            <Text style={styles.aboutDevelopedBy}>{t('settings.aboutDevelopedBy')}</Text>
            <Pressable style={styles.aboutCloseBtn} onPress={() => setShowAbout(false)}>
              <Text style={styles.aboutCloseText}>{t('common.ok')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  profileAvatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
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
  profileEditHint: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 12,
    color: colors.primary,
    marginTop: 8,
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
  // ─── Edit Profile Modal ───
  editProfileContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    gap: 12,
  },
  editAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 4,
  },
  editAvatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  editAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  editAvatarAction: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
    paddingVertical: 6,
  },
  editLabel: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 13,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  editInput: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 15,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surfaceContainerLowest,
  },
  editButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  editCancelText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  editSaveBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  editSaveText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  // ─── About Modal ───
  aboutCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    maxWidth: 360,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  aboutLogoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  aboutAppName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 4,
  },
  aboutVersion: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginBottom: 16,
  },
  aboutDesc: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  aboutDivider: {
    height: 1,
    width: '100%',
    backgroundColor: colors.surfaceContainer,
    marginBottom: 16,
  },
  aboutDevelopedBy: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  aboutCloseBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 20,
  },
  aboutCloseText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
