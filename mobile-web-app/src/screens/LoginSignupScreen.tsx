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
import { colors } from '../theme/colors';
import { authService } from '../services/authService';

interface LoginSignupScreenProps {
  onComplete: (mode: 'login' | 'signup' | 'skip') => void;
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
  const borderColor = useRef(new Animated.Value(0)).current;

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
    <View style={inputStyles.container}>
      <Text style={inputStyles.label}>{label}</Text>
      <Animated.View style={[inputStyles.inputWrapper, { borderColor: interpolatedBorder }]}>
        <TextInput
          style={inputStyles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.outlineVariant}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType || 'default'}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => animateFocus(true)}
          onBlur={() => animateFocus(false)}
          autoCapitalize="none"
        />
      </Animated.View>
    </View>
  );
}

// ── OTP Verification Step ────────────────────────────────────────────────────

function OtpStep({
  email,
  onVerified,
  onBack,
}: {
  email: string;
  onVerified: () => void;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!otp.trim()) { setError('Please enter the OTP'); return; }
    setLoading(true);
    setError('');
    try {
      await authService.verifySignupOtp({ email, otp });
      onVerified();
    } catch (e: any) {
      setError(e?.detail || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.formContainer}>
      <Text style={styles.otpInfo}>
        An OTP was sent to {email}. Enter it below to verify your account.
      </Text>
      <FormInput label="OTP Code" placeholder="6-digit code" value={otp} onChangeText={setOtp} keyboardType="phone-pad" />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Pressable style={styles.submitButton} onPress={handleVerify} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.onPrimary} /> : (
          <>
            <Text style={styles.submitButtonText}>Verify Email</Text>
            <Text style={styles.submitButtonArrow}>→</Text>
          </>
        )}
      </Pressable>
      <Pressable style={styles.skipButton} onPress={onBack}>
        <Text style={styles.skipButtonText}>← Back to Sign Up</Text>
      </Pressable>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function LoginSignupScreen({ onComplete }: LoginSignupScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
  });

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
    Animated.timing(tabPosition, {
      toValue: tab === 'login' ? 0 : 1,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('Please enter email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.login({ email: loginEmail.trim(), password: loginPassword });
      onComplete('login');
    } catch (e: any) {
      setError(e?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!firstName.trim() || !signupEmail.trim() || !signupPassword.trim() || !cnic.trim() || !phone.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
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
        latitude: '0',
      });
      setShowOtp(true);
    } catch (e: any) {
      setError(e?.detail || 'Signup failed. Please try again.');
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
        <Image source={require('../../assets/logo.jpg')} style={styles.appBarLogo} />
        <Text style={styles.appBarTitle}>Kissan Rehnuma</Text>
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
            <Text style={styles.welcomeText}>Welcome</Text>
            <Text style={styles.subtitleText}>Please login or sign up to continue.</Text>
          </View>

          {/* Tab Bar — hidden during OTP step */}
          {!showOtp && (
            <View style={styles.tabContainer}>
              <Pressable style={styles.tabButton} onPress={() => switchTab('login')}>
                <Text style={[styles.tabText, activeTab === 'login' ? styles.tabTextActive : styles.tabTextInactive]}>
                  Login
                </Text>
                {activeTab === 'login' && <View style={styles.tabIndicator} />}
              </Pressable>
              <Pressable style={styles.tabButton} onPress={() => switchTab('signup')}>
                <Text style={[styles.tabText, activeTab === 'signup' ? styles.tabTextActive : styles.tabTextInactive]}>
                  Sign Up
                </Text>
                {activeTab === 'signup' && <View style={styles.tabIndicator} />}
              </Pressable>
            </View>
          )}

          {/* OTP Step */}
          {showOtp && (
            <OtpStep
              email={signupEmail}
              onVerified={() => {
                setShowOtp(false);
                switchTab('login');
              }}
              onBack={() => setShowOtp(false)}
            />
          )}

          {/* Login Form */}
          {!showOtp && activeTab === 'login' && (
            <View style={styles.formContainer}>
              <FormInput label="Email" placeholder="Enter your email" keyboardType="email-address" value={loginEmail} onChangeText={setLoginEmail} />
              <FormInput label="Password" placeholder="Enter your password" secureTextEntry value={loginPassword} onChangeText={setLoginPassword} />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable style={styles.submitButton} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.onPrimary} /> : (
                  <>
                    <Text style={styles.submitButtonText}>Login</Text>
                    <Text style={styles.submitButtonArrow}>→</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Sign Up Form */}
          {!showOtp && activeTab === 'signup' && (
            <View style={styles.formContainer}>
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <FormInput label="First Name" placeholder="First Name" value={firstName} onChangeText={setFirstName} />
                </View>
                <View style={styles.rowItem}>
                  <FormInput label="Last Name" placeholder="Last Name" value={lastName} onChangeText={setLastName} />
                </View>
              </View>
              <FormInput label="Email" placeholder="Email Address" keyboardType="email-address" value={signupEmail} onChangeText={setSignupEmail} />
              <FormInput label="Password" placeholder="Create a password" secureTextEntry value={signupPassword} onChangeText={setSignupPassword} />
              <FormInput label="CNIC" placeholder="XXXXX-XXXXXXX-X" value={cnic} onChangeText={setCnic} />
              <FormInput label="Phone" placeholder="Phone Number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
              <FormInput label="Address" placeholder="Street Address" value={address} onChangeText={setAddress} />
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <FormInput label="City" placeholder="City" value={city} onChangeText={setCity} />
                </View>
                <View style={styles.rowItem}>
                  <FormInput label="Country" placeholder="Country" value={country} onChangeText={setCountry} />
                </View>
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable style={styles.submitButton} onPress={handleSignup} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.onPrimary} /> : (
                  <>
                    <Text style={styles.submitButtonText}>Sign Up</Text>
                    <Text style={styles.submitButtonArrow}>→</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {!showOtp && (
            <Pressable style={styles.skipButton} onPress={() => onComplete('skip')}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const inputStyles = StyleSheet.create({
  container: { gap: 4 },
  label: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginLeft: 4,
    letterSpacing: 0.14,
  },
  inputWrapper: { borderWidth: 2, borderRadius: 8, backgroundColor: '#ffffff', overflow: 'hidden' },
  input: {
    height: 56,
    paddingHorizontal: 16,
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 18,
    fontWeight: '400',
    color: colors.onBackground,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
    backgroundColor: 'rgba(255, 248, 242, 0.92)',
    borderRadius: 12, padding: 24, gap: 24,
    shadowColor: '#4A453C', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 24, elevation: 8,
    borderWidth: 1, borderColor: 'rgba(234, 225, 213, 0.5)',
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
});
