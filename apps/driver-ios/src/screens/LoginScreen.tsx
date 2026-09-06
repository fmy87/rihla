import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../contexts/AuthContext';
import { setAppLanguage } from '../lib/i18n';

const SECURE_STORE_KEY = 'driver_saved_credentials';
// NOTE: school selection is out of scope for a single-school deployment;
// SCHOOL_ID should come from app config once multi-school driver login is needed.
const SCHOOL_ID = process.env.EXPO_PUBLIC_SCHOOL_ID ?? '';

export default function LoginScreen() {
  const { t, i18n } = useTranslation(['auth', 'common']);
  const { signInWithEmployeeId } = useAuth();

  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const saved = await SecureStore.getItemAsync(SECURE_STORE_KEY);
      setBiometricsAvailable(hasHardware && isEnrolled && !!saved);
    })();
  }, []);

  async function attemptLogin(id: string, code: string, offerBiometricSave: boolean) {
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signInWithEmployeeId(SCHOOL_ID, id, code);
    setSubmitting(false);

    if (signInError) {
      setError(t('auth:driverLogin.invalidCredentials'));
      return;
    }

    if (offerBiometricSave) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        Alert.alert(t('auth:driverLogin.useBiometrics'), '', [
          { text: t('common:cancel'), style: 'cancel' },
          {
            text: t('common:confirm'),
            onPress: async () => {
              await SecureStore.setItemAsync(SECURE_STORE_KEY, JSON.stringify({ id, code }));
            },
          },
        ]);
      }
    }
  }

  async function handleBiometricLogin() {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t('auth:driverLogin.biometricsPrompt'),
    });
    if (!result.success) return;
    const saved = await SecureStore.getItemAsync(SECURE_STORE_KEY);
    if (!saved) return;
    const { id, code } = JSON.parse(saved) as { id: string; code: string };
    await attemptLogin(id, code, false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.langRow}>
        <Pressable onPress={() => setAppLanguage('en')} style={styles.langButton}>
          <Text style={i18n.language === 'en' ? styles.langActive : styles.langInactive}>English</Text>
        </Pressable>
        <Pressable onPress={() => setAppLanguage('ar')} style={styles.langButton}>
          <Text style={i18n.language === 'ar' ? styles.langActive : styles.langInactive}>العربية</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>{t('auth:driverLogin.title')}</Text>

      <Text style={styles.label}>{t('auth:driverLogin.employeeId')}</Text>
      <TextInput
        style={styles.input}
        value={employeeId}
        onChangeText={setEmployeeId}
        autoCapitalize="characters"
        placeholder="EMP-001"
      />

      <Text style={styles.label}>{t('auth:driverLogin.pin')}</Text>
      <TextInput
        style={styles.input}
        value={pin}
        onChangeText={setPin}
        secureTextEntry
        keyboardType="number-pad"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={styles.primaryButton}
        disabled={submitting || !employeeId || !pin}
        onPress={() => attemptLogin(employeeId, pin, true)}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>{t('auth:driverLogin.signIn')}</Text>
        )}
      </Pressable>

      {biometricsAvailable && (
        <Pressable style={styles.secondaryButton} onPress={handleBiometricLogin}>
          <Text style={styles.secondaryButtonText}>{t('auth:driverLogin.useBiometrics')}</Text>
        </Pressable>
      )}
    </View>
  );
}

// Large touch targets, high contrast, minimal fields — per driver-app UX requirements.
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0F172A' },
  langRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 32 },
  langButton: { paddingVertical: 6, paddingHorizontal: 12 },
  langActive: { color: '#fff', fontWeight: '700', fontSize: 15 },
  langInactive: { color: '#64748B', fontSize: 15 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 24, textAlign: 'center' },
  label: { color: '#CBD5E1', fontSize: 15, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
  },
  error: { color: '#F87171', marginTop: 12, fontSize: 15 },
  primaryButton: {
    marginTop: 28,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  secondaryButton: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  secondaryButtonText: { color: '#93C5FD', fontSize: 16, fontWeight: '600' },
});
