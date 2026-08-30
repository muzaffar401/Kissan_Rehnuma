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

interface LoginSignupScreenProps {
  onComplete: (mode: 'login' | 'signup' | 'skip') => void;
}

// Reusable text input with focus border animation
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
  const [focused, setFocused] = useState(false);

  const animateFocus = (isFocused: boolean) => {
    setFocused(isFocused);
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
      <Animated.View
        style={[
          inputStyles.inputWrapper,
          { borderColor: interpolatedBorder },
        ]}
      >
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

export default function LoginSignupScreen({ onComplete }: LoginSignupScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
  });

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [cnic, setCnic] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  // Tab indicator animation
  const tabPosition = useRef(new Animated.Value(0)).current;

  const switchTab = (tab: 'login' | 'signup') => {
    setActiveTab(tab);
    Animated.timing(tabPosition, {
      toValue: tab === 'login' ? 0 : 1,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {/* Background decorative blobs */}
      <View style={styles.bgBlobTopLeft} />
      <View style={styles.bgBlobBottomRight} />

      {/* Top App Bar */}
      <View style={styles.appBar}>
        <Image
          source={require('../../assets/logo.jpg')}
          style={styles.appBarLogo}
        />
        <Text style={styles.appBarTitle}>Kissan Rehnuma</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Glass Panel Card */}
        <View style={styles.glassPanel}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <Text style={styles.welcomeText}>Welcome</Text>
            <Text style={styles.subtitleText}>
              Please login or sign up to continue.
            </Text>
          </View>

          {/* Tab Bar */}
          <View style={styles.tabContainer}>
            <Pressable
              style={styles.tabButton}
              onPress={() => switchTab('login')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'login'
                    ? styles.tabTextActive
                    : styles.tabTextInactive,
                ]}
              >
                Login
              </Text>
              {activeTab === 'login' && <View style={styles.tabIndicator} />}
            </Pressable>
            <Pressable
              style={styles.tabButton}
              onPress={() => switchTab('signup')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'signup'
                    ? styles.tabTextActive
                    : styles.tabTextInactive,
                ]}
              >
                Sign Up
              </Text>
              {activeTab === 'signup' && <View style={styles.tabIndicator} />}
            </Pressable>
          </View>

          {/* Login Form */}
          {activeTab === 'login' && (
            <View style={styles.formContainer}>
              <FormInput
                label="Email"
                placeholder="Enter your email"
                keyboardType="email-address"
                value={loginEmail}
                onChangeText={setLoginEmail}
              />
              <FormInput
                label="Password"
                placeholder="Enter your password"
                secureTextEntry
                value={loginPassword}
                onChangeText={setLoginPassword}
              />
              <Pressable
                style={styles.submitButton}
                onPress={() => onComplete('login')}
              >
                <Text style={styles.submitButtonText}>Login</Text>
                <Text style={styles.submitButtonArrow}>→</Text>
              </Pressable>
            </View>
          )}

          {/* Sign Up Form */}
          {activeTab === 'signup' && (
            <View style={styles.formContainer}>
              {/* First Name + Last Name row */}
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <FormInput
                    label="First Name"
                    placeholder="First Name"
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
                <View style={styles.rowItem}>
                  <FormInput
                    label="Last Name"
                    placeholder="Last Name"
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>

              <FormInput
                label="Email"
                placeholder="Email Address"
                keyboardType="email-address"
                value={signupEmail}
                onChangeText={setSignupEmail}
              />
              <FormInput
                label="CNIC"
                placeholder="XXXXX-XXXXXXX-X"
                value={cnic}
                onChangeText={setCnic}
              />
              <FormInput
                label="Phone"
                placeholder="Phone Number"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              <FormInput
                label="Address"
                placeholder="Street Address"
                value={address}
                onChangeText={setAddress}
              />

              {/* City + Country row */}
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <FormInput
                    label="City"
                    placeholder="City"
                    value={city}
                    onChangeText={setCity}
                  />
                </View>
                <View style={styles.rowItem}>
                  <FormInput
                    label="Country"
                    placeholder="Country"
                    value={country}
                    onChangeText={setCountry}
                  />
                </View>
              </View>

              <Pressable
                style={styles.submitButton}
                onPress={() => onComplete('signup')}
              >
                <Text style={styles.submitButtonText}>Sign Up</Text>
                <Text style={styles.submitButtonArrow}>→</Text>
              </Pressable>
            </View>
          )}

          {/* Skip for now */}
          <Pressable
            style={styles.skipButton}
            onPress={() => onComplete('skip')}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// Input component styles
const inputStyles = StyleSheet.create({
  container: {
    gap: 4,
  },
  label: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginLeft: 4,
    letterSpacing: 0.14,
  },
  inputWrapper: {
    borderWidth: 2,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  input: {
    height: 56,
    paddingHorizontal: 16,
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 18,
    fontWeight: '400',
    color: colors.onBackground,
  },
});

// Screen styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Background decorative blobs
  bgBlobTopLeft: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.onPrimaryContainer,
    opacity: 0.3,
  },
  bgBlobBottomRight: {
    position: 'absolute',
    bottom: -100,
    right: -100,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: colors.secondaryContainer,
    opacity: 0.3,
  },
  // Top App Bar
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainer,
  },
  appBarLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  appBarTitle: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  // Scroll content
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  // Glass panel card
  glassPanel: {
    backgroundColor: 'rgba(255, 248, 242, 0.92)',
    borderRadius: 12,
    padding: 24,
    gap: 24,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(234, 225, 213, 0.5)',
    maxWidth: 448,
    width: '100%',
    alignSelf: 'center',
  },
  // Card header
  cardHeader: {
    alignItems: 'center',
    gap: 8,
  },
  welcomeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    fontWeight: '700',
    color: colors.onBackground,
    textAlign: 'center',
  },
  subtitleText: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Tab bar
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.14,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabTextInactive: {
    color: colors.onSurfaceVariant,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '60%',
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  // Forms
  formContainer: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  rowItem: {
    flex: 1,
  },
  // Submit button
  submitButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    shadowColor: '#4A453C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
    letterSpacing: 0.14,
  },
  submitButtonArrow: {
    fontSize: 20,
    color: colors.onPrimary,
  },
  // Skip button
  skipButton: {
    alignItems: 'center',
    padding: 8,
    marginTop: -8,
  },
  skipButtonText: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 12,
    fontWeight: '500',
    color: colors.secondary,
    letterSpacing: 0.12,
  },
});
