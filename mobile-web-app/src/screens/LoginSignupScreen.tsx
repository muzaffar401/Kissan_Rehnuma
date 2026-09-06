import { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
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
import { authService } from '../services/authService';
import { adminLogin } from '../services/adminService';
import { weatherService } from '../services/weatherService';
import { tokenStorage } from '../services/tokenStorage';
import * as Location from 'expo-location';
import { Eye, EyeOff } from 'lucide-react-native';
import {
  validateEmail,
  validatePassword,
  validateCNIC,
  validatePhone,
  validateOTP,
  validateRequired,
} from '../utils/validation';

/**
 * Get device location using expo-location (works on native + web).
 * Requests permission first, falls back to { 0, 0 } if denied or unavailable.
 */
async function getDeviceLocation(): Promise<{ latitude: number; longitude: number }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { latitude: 0, longitude: 0 };
    }
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch {
    return { latitude: 0, longitude: 0 };
  }
}

interface LoginSignupScreenProps {
  onComplete: (mode: 'login' | 'signup' | 'admin-login') => void;
}

function FormInput({
  label,
  placeholder,
  secureTextEntry,
  keyboardType,
  value,
  onChangeText,
}: {
  label: string;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  value: string;
  onChangeText: (text: string) => void;
}) {
  const { colors } = useTheme();
  const inpStyles = createInputStyles(colors);
  const borderColor = useRef(new Animated.Value(0)).current;
  const [hidden, setHidden] = useState(true);
  const isPassword = !!secureTextEntry;
  const actualSecure = isPassword ? hidden : false;

  const animateFocus = (isFocused: boolean) => {
    Animated.timing(borderColor, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  };

  const interpolatedBorder = borderColor.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.outline, colors.primary],
  });

  return (
    <View style={inpStyles.container}>
      <Text style={inpStyles.label}>{label}</Text>
      <Animated.View style={[inpStyles.inputWrapper, { borderColor: interpolatedBorder }]}>
        <TextInput
          style={[inpStyles.input, isPassword && { paddingRight: 48 }]}
          placeholder={placeholder}
          placeholderTextColor={colors.outlineVariant}
          secureTextEntry={actualSecure}
          keyboardType={keyboardType || 'default'}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => animateFocus(true)}
          onBlur={() => animateFocus(false)}
          autoCapitalize="none"
        />
        {isPassword && (
          <Pressable
            onPress={() => setHidden((v) => !v)}
            hitSlop={8}
            style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}
          >
            {hidden
              ? <Eye size={20} color={colors.outlineVariant} />
              : <EyeOff size={20} color={colors.outlineVariant} />
            }
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

// ── OTP Verification Step ────────────────────────────────────────────────────

function OtpStep({
  email,
  gpsCoords,
  name,
  city,
  country,
  onVerified,
  onBack,
}: {
  email: string;
  gpsCoords: { latitude: number; longitude: number } | null;
  name?: string;
  city?: string;
  country?: string;
  onVerified: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    const otpError = validateOTP(otp);
    if (otpError) { setError(otpError); return; }
    setLoading(true);
    setError('');
    try {
      const response = await authService.verifySignupOtp({ email, otp });

      // Auto-login: save JWT token
      if (response.access_token) {
        await tokenStorage.saveAccessToken(response.access_token);
        await tokenStorage.saveUserInfo(String(response.farmer_id), response.email, name, city, country);
      }

      // Register farmer location for weather alerts (non-blocking)
      if (gpsCoords && response.farmer_id) {
        try {
          await weatherService.registerLocation(response.farmer_id, {
            latitude: gpsCoords.latitude,
            longitude: gpsCoords.longitude,
          });
        } catch {
          // Location registration failed — user can still use the app,
          // weather just won't work until location is set
        }
      }

      onVerified();
    } catch (e: any) {
      setError(e?.detail || t('auth.invalidOtp'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.formContainer}>
      <Text style={styles.otpInfo}>
        {t('auth.otpInfo', { email })}
      </Text>
      <FormInput label={t('auth.otpCodeLabel')} placeholder={t('auth.otpCodePlaceholder')} value={otp} onChangeText={setOtp} keyboardType="phone-pad" />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Pressable style={styles.submitButton} onPress={handleVerify} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.onPrimary} /> : (
          <>
            <Text style={styles.submitButtonText}>{t('auth.verifyEmail')}</Text>
            <Text style={styles.submitButtonArrow}>→</Text>
          </>
        )}
      </Pressable>
      <Pressable style={styles.skipButton} onPress={onBack}>
        <Text style={styles.skipButtonText}>{t('auth.backToSignup')}</Text>
      </Pressable>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function LoginSignupScreen({ onComplete }: LoginSignupScreenProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password flow
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | null>(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
  });

  // GPS coords stored during signup for location registration after OTP
  const gpsCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [cnic, setCnic] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const tabPosition = useRef(new Animated.Value(0)).current;

  const switchTab = (tab: 'login' | 'signup') => {
    setActiveTab(tab);
    setError('');
    setForgotStep(null);
    Animated.timing(tabPosition, {
      toValue: tab === 'login' ? 0 : 1,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  // ── Forgot Password handlers ──

  const handleForgotSendOtp = async () => {
    const emailError = validateEmail(forgotEmail);
    if (emailError) { setError(emailError); return; }
    setLoading(true);
    setError('');
    try {
      await authService.forgotPassword({ email: forgotEmail.trim() });
      setForgotStep('otp');
    } catch (e: any) {
      setError(e?.detail || t('auth.forgotOtpFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const otpError = validateOTP(resetOtp);
    if (otpError) { setError(otpError); return; }
    const pwError = validatePassword(newPassword);
    if (pwError) { setError(pwError); return; }
    if (newPassword !== confirmPassword) { setError(t('auth.passwordsNotMatch')); return; }
    setLoading(true);
    setError('');
    try {
      await authService.resetPassword({
        email: forgotEmail.trim(),
        otp: resetOtp.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setForgotStep(null);
      setLoginEmail(forgotEmail.trim());
      setLoginPassword('');
      setError('');
      Alert.alert(t('auth.resetSuccessTitle'), t('auth.resetSuccessMessage'));
    } catch (e: any) {
      setError(e?.detail || t('auth.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const emailError = validateEmail(loginEmail);
    if (emailError) { setError(emailError); return; }
    const pwError = validatePassword(loginPassword);
    if (pwError) { setError(pwError); return; }
    setLoading(true);
    setError('');
    try {
      // First try admin login — if credentials match admin, open admin panel
      try {
        await adminLogin(loginEmail.trim(), loginPassword);
        onComplete('admin-login');
        return;
      } catch {
        // Not admin credentials — fall through to normal farmer login
      }

      await authService.login({ email: loginEmail.trim(), password: loginPassword });
      onComplete('login');
    } catch (e: any) {
      setError(e?.detail || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    // Validate all fields in order
    const checks = [
      validateRequired(firstName, 'First name'),
      validateRequired(lastName, 'Last name'),
      validateEmail(signupEmail),
      validatePassword(signupPassword),
      validateCNIC(cnic),
      validatePhone(phone),
      validateRequired(address, 'Address'),
      validateRequired(city, 'City'),
      validateRequired(country, 'Country'),
    ];
    const firstError = checks.find(msg => msg !== '');
    if (firstError) { setError(firstError); return; }
    setLoading(true);
    setError('');
    try {
      // Get device location for farmer registration
      const coords = await getDeviceLocation();
      gpsCoordsRef.current = coords;

      await authService.signup({
        name: firstName.trim(),
        lastname: lastName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        cnic: cnic.trim(),
        Mobile_Number: phone.trim(),
        Address: address.trim(),
        City: city.trim(),
        country: country.trim(),
        latitude: String(coords.latitude),
        longitude: String(coords.longitude),
      });
      setShowOtp(true);
    } catch (e: any) {
      setError(e?.detail || t('auth.signupFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <View style={styles.bgBlobTopLeft} />
      <View style={styles.bgBlobBottomRight} />

      <View style={styles.appBar}>
        <Image source={require('../../assets/logo.png')} style={styles.appBarLogo} />
        <Text style={styles.appBarTitle}>{t('common.appName')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.glassPanel}>
          <View style={styles.cardHeader}>
            <Text style={styles.welcomeText}>{t('auth.welcome')}</Text>
            <Text style={styles.subtitleText}>{t('auth.subtitle')}</Text>
          </View>

          {/* Tab Bar — hidden during OTP or forgot password */}
          {!showOtp && !forgotStep && (
            <View style={styles.tabContainer}>
              <Pressable style={styles.tabButton} onPress={() => switchTab('login')}>
                <Text style={[styles.tabText, activeTab === 'login' ? styles.tabTextActive : styles.tabTextInactive]}>
                  {t('auth.login')}
                </Text>
                {activeTab === 'login' && <View style={styles.tabIndicator} />}
              </Pressable>
              <Pressable style={styles.tabButton} onPress={() => switchTab('signup')}>
                <Text style={[styles.tabText, activeTab === 'signup' ? styles.tabTextActive : styles.tabTextInactive]}>
                  {t('auth.signup')}
                </Text>
                {activeTab === 'signup' && <View style={styles.tabIndicator} />}
              </Pressable>
            </View>
          )}

          {/* OTP Step */}
          {showOtp && (
            <OtpStep
              email={signupEmail}
              gpsCoords={gpsCoordsRef.current}
              name={`${firstName.trim()} ${lastName.trim()}`.trim() || undefined}
              city={city}
              country={country}
              onVerified={() => {
                setShowOtp(false);
                onComplete('signup');
              }}
              onBack={() => setShowOtp(false)}
            />
          )}

          {/* Login Form */}
          {!showOtp && !forgotStep && activeTab === 'login' && (
            <View style={styles.formContainer}>
              <FormInput label={t('auth.emailLabel')} placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" value={loginEmail} onChangeText={setLoginEmail} />
              <FormInput label={t('auth.passwordLabel')} placeholder={t('auth.passwordPlaceholder')} secureTextEntry value={loginPassword} onChangeText={setLoginPassword} />
              <Pressable onPress={() => { setForgotStep('email'); setError(''); setForgotEmail(loginEmail); }}>
                <Text style={styles.forgotLink}>{t('auth.forgotPassword')}</Text>
              </Pressable>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable style={styles.submitButton} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.onPrimary} /> : (
                  <>
                    <Text style={styles.submitButtonText}>{t('auth.loginButton')}</Text>
                    <Text style={styles.submitButtonArrow}>→</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Forgot Password — Step 1: Enter Email */}
          {forgotStep === 'email' && (
            <View style={styles.formContainer}>
              <Text style={styles.otpInfo}>
                {t('auth.forgotEmailInfo')}
              </Text>
              <FormInput label={t('auth.emailLabel')} placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" value={forgotEmail} onChangeText={setForgotEmail} />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable style={styles.submitButton} onPress={handleForgotSendOtp} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.onPrimary} /> : (
                  <>
                    <Text style={styles.submitButtonText}>{t('auth.sendOtp')}</Text>
                    <Text style={styles.submitButtonArrow}>→</Text>
                  </>
                )}
              </Pressable>
              <Pressable style={styles.skipButton} onPress={() => { setForgotStep(null); setError(''); }}>
                <Text style={styles.skipButtonText}>{t('auth.backToLogin')}</Text>
              </Pressable>
            </View>
          )}

          {/* Forgot Password — Step 2: OTP + New Password */}
          {forgotStep === 'otp' && (
            <View style={styles.formContainer}>
              <Text style={styles.otpInfo}>
                {t('auth.forgotOtpInfo', { email: forgotEmail })}
              </Text>
              <FormInput label={t('auth.otpCodeLabel')} placeholder={t('auth.otpCodePlaceholder')} value={resetOtp} onChangeText={setResetOtp} keyboardType="phone-pad" />
              <FormInput label={t('auth.newPasswordLabel')} placeholder={t('auth.newPasswordPlaceholder')} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
              <FormInput label={t('auth.confirmPasswordLabel')} placeholder={t('auth.confirmPasswordPlaceholder')} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable style={styles.submitButton} onPress={handleResetPassword} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.onPrimary} /> : (
                  <>
                    <Text style={styles.submitButtonText}>{t('auth.resetPassword')}</Text>
                    <Text style={styles.submitButtonArrow}>→</Text>
                  </>
                )}
              </Pressable>
              <Pressable style={styles.skipButton} onPress={() => { setForgotStep('email'); setError(''); }}>
                <Text style={styles.skipButtonText}>{t('auth.back')}</Text>
              </Pressable>
            </View>
          )}

          {/* Sign Up Form */}
          {!showOtp && activeTab === 'signup' && (
            <View style={styles.formContainer}>
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <FormInput label={t('auth.firstNameLabel')} placeholder={t('auth.firstNamePlaceholder')} value={firstName} onChangeText={setFirstName} />
                </View>
                <View style={styles.rowItem}>
                  <FormInput label={t('auth.lastNameLabel')} placeholder={t('auth.lastNamePlaceholder')} value={lastName} onChangeText={setLastName} />
                </View>
              </View>
              <FormInput label={t('auth.emailLabel')} placeholder={t('auth.emailAddressPlaceholder')} keyboardType="email-address" value={signupEmail} onChangeText={setSignupEmail} />
              <FormInput label={t('auth.passwordLabel')} placeholder={t('auth.createPasswordPlaceholder')} secureTextEntry value={signupPassword} onChangeText={setSignupPassword} />
              <FormInput label={t('auth.cnicLabel')} placeholder={t('auth.cnicPlaceholder')} value={cnic} onChangeText={setCnic} />
              <FormInput label={t('auth.phoneLabel')} placeholder={t('auth.phonePlaceholder')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
              <FormInput label={t('auth.addressLabel')} placeholder={t('auth.addressPlaceholder')} value={address} onChangeText={setAddress} />
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <FormInput label={t('auth.cityLabel')} placeholder={t('auth.cityPlaceholder')} value={city} onChangeText={setCity} />
                </View>
                <View style={styles.rowItem}>
                  <FormInput label={t('auth.countryLabel')} placeholder={t('auth.countryPlaceholder')} value={country} onChangeText={setCountry} />
                </View>
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable style={styles.submitButton} onPress={handleSignup} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.onPrimary} /> : (
                  <>
                    <Text style={styles.submitButtonText}>{t('auth.signupButton')}</Text>
                    <Text style={styles.submitButtonArrow}>→</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

const createInputStyles = (colors: ColorPalette) => StyleSheet.create({
  container: { gap: 4 },
  label: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginLeft: 4,
    letterSpacing: 0.14,
  },
  inputWrapper: { borderWidth: 2, borderRadius: 8, backgroundColor: colors.surfaceContainerLowest, overflow: 'hidden' },
  input: {
    height: 56,
    paddingHorizontal: 16,
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 18,
    fontWeight: '400',
    color: colors.onBackground,
  },
});

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  bgBlobTopLeft: {
    position: 'absolute', top: -80, left: -80, width: 300, height: 300,
    borderRadius: 150, backgroundColor: colors.onPrimaryContainer, opacity: 0.3,
  },
  bgBlobBottomRight: {
    position: 'absolute', bottom: -100, right: -100, width: 360, height: 360,
    borderRadius: 180, backgroundColor: colors.secondaryContainer, opacity: 0.3,
  },
  appBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    height: 56, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.surfaceContainer,
  },
  appBarLogo: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  appBarTitle: {
    flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20,
    fontWeight: '700', color: colors.primary, textAlign: 'center',
  },
  scrollContent: { flex: 1 },
  scrollContentContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  glassPanel: {
    backgroundColor: colors.surface === '#fff8f2' ? 'rgba(255, 248, 242, 0.92)' : 'rgba(30, 31, 26, 0.92)',
    borderRadius: 12, padding: 24, gap: 24,
    shadowColor: '#4A453C', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 24, elevation: 8,
    borderWidth: 1, borderColor: colors.surface === '#fff8f2' ? 'rgba(234, 225, 213, 0.5)' : 'rgba(65, 73, 65, 0.5)',
    maxWidth: 448, width: '100%', alignSelf: 'center',
  },
  cardHeader: { alignItems: 'center', gap: 8 },
  welcomeText: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26,
    fontWeight: '700', color: colors.onBackground, textAlign: 'center',
  },
  subtitleText: {
    fontFamily: 'BeVietnamPro_400Regular', fontSize: 16,
    fontWeight: '400', color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 24,
  },
  tabContainer: {
    flexDirection: 'row', backgroundColor: colors.surfaceContainer,
    borderRadius: 8, padding: 4, gap: 4,
  },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabText: { fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 14, fontWeight: '600', letterSpacing: 0.14 },
  tabTextActive: { color: colors.primary },
  tabTextInactive: { color: colors.onSurfaceVariant },
  tabIndicator: {
    position: 'absolute', bottom: 0, width: '60%',
    height: 2, backgroundColor: colors.primary, borderRadius: 1,
  },
  formContainer: { gap: 12 },
  row: { flexDirection: 'row', gap: 16 },
  rowItem: { flex: 1 },
  errorText: {
    fontFamily: 'BeVietnamPro_400Regular', fontSize: 14,
    color: colors.error, textAlign: 'center',
  },
  otpInfo: {
    fontFamily: 'BeVietnamPro_400Regular', fontSize: 14,
    color: colors.onSurfaceVariant, lineHeight: 22, textAlign: 'center',
  },
  submitButton: {
    height: 56, backgroundColor: colors.primary, borderRadius: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 4,
    shadowColor: '#4A453C', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  submitButtonText: {
    fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 14,
    fontWeight: '600', color: colors.onPrimary, letterSpacing: 0.14,
  },
  submitButtonArrow: { fontSize: 20, color: colors.onPrimary },
  skipButton: { alignItems: 'center', padding: 8, marginTop: -8 },
  skipButtonText: {
    fontFamily: 'BeVietnamPro_500Medium', fontSize: 12,
    fontWeight: '500', color: colors.secondary, letterSpacing: 0.12,
  },
  forgotLink: {
    fontFamily: 'BeVietnamPro_500Medium', fontSize: 13,
    fontWeight: '500', color: colors.primary, textAlign: 'right',
    marginTop: -4,
  },
});
