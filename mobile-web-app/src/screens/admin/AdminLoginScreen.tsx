import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import {
  useFonts,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_600SemiBold,
} from '@expo-google-fonts/be-vietnam-pro';
import { useTheme } from '../../theme/ThemeContext';
import { adminLogin } from '../../services/adminService';

interface Props {
  onLogin: () => void;
  onBack: () => void;
}

export default function AdminLoginScreen({ onLogin, onBack }: Props) {
  const { colors } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_600SemiBold,
  });

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await adminLogin(username.trim(), password);
      onLogin();
    } catch (e: any) {
      setError(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return <View style={[styles.container, { backgroundColor: colors.background }]} />;

  const styles_ = createStyles(colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles_.card}>
        {/* Header */}
        <View style={styles_.header}>
          <View style={styles_.logoWrap}>
            <Image source={require('../../../assets/logo.png')} style={styles_.logo} />
          </View>
          <Text style={styles_.title}>Admin Panel</Text>
          <Text style={styles_.subtitle}>Kissan Rehnuma Management</Text>
        </View>

        {/* Form */}
        <View style={styles_.form}>
          <View style={styles_.field}>
            <Text style={styles_.label}>Username</Text>
            <TextInput
              style={styles_.input}
              placeholder="admin"
              placeholderTextColor={colors.outlineVariant}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles_.field}>
            <Text style={styles_.label}>Password</Text>
            <TextInput
              style={styles_.input}
              placeholder="••••••••"
              placeholderTextColor={colors.outlineVariant}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {error ? <Text style={styles_.error}>{error}</Text> : null}

          <Pressable
            style={[styles_.button, { opacity: loading ? 0.7 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles_.buttonText}>Sign In</Text>
            )}
          </Pressable>

          <Pressable onPress={onBack} style={styles_.backBtn}>
            <Text style={styles_.backText}>← Back to App</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 32,
      maxWidth: 400,
      width: '100%',
      alignSelf: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 8,
    },
    header: { alignItems: 'center', marginBottom: 28, gap: 8 },
    logoWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 8,
      marginBottom: 8,
    },
    logo: { width: '100%', height: '100%', borderRadius: 24 },
    title: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
    },
    subtitle: {
      fontFamily: 'BeVietnamPro_400Regular',
      fontSize: 14,
      color: colors.onSurfaceVariant,
    },
    form: { gap: 16 },
    field: { gap: 4 },
    label: {
      fontFamily: 'BeVietnamPro_600SemiBold',
      fontSize: 13,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
      marginLeft: 4,
    },
    input: {
      height: 48,
      borderWidth: 2,
      borderColor: colors.outlineVariant,
      borderRadius: 8,
      paddingHorizontal: 14,
      fontFamily: 'BeVietnamPro_400Regular',
      fontSize: 16,
      color: colors.onSurface,
      backgroundColor: colors.surfaceContainerLowest || colors.surface,
    },
    error: {
      fontFamily: 'BeVietnamPro_400Regular',
      fontSize: 13,
      color: colors.error,
      textAlign: 'center',
    },
    button: {
      height: 48,
      backgroundColor: colors.primary,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    buttonText: {
      fontFamily: 'BeVietnamPro_600SemiBold',
      fontSize: 15,
      fontWeight: '600',
      color: colors.onPrimary,
    },
    backBtn: { alignItems: 'center', padding: 8 },
    backText: {
      fontFamily: 'BeVietnamPro_400Regular',
      fontSize: 13,
      color: colors.primary,
    },
  });

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
});
