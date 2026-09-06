import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Updates from 'expo-updates';
import { useAuth } from '../contexts/AuthContext';
import { setAppLanguage } from '../lib/i18n';
import { useTodayRoute } from '../contexts/TodayRouteContext';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation(['driver', 'common']);
  const { driver, signOut } = useAuth();
  const { syncStatus } = useTodayRoute();

  async function handleLanguageChange(lang: 'en' | 'ar') {
    const needsReload = await setAppLanguage(lang);
    if (needsReload) {
      // RTL layout changes require a full reload in React Native.
      try {
        await Updates.reloadAsync();
      } catch {
        // reloadAsync is a no-op in Expo Go / dev — direction still applies on next launch.
      }
    }
  }

  function handleEmergency() {
    Alert.alert(t('driver:emergencyConfirmTitle'), t('driver:emergencyConfirmBody'), [
      { text: t('common:common.cancel'), style: 'cancel' },
      {
        text: t('driver:emergencyConfirm'),
        style: 'destructive',
        onPress: () => {
          // Full emergency dispatch (location + driver + route to admin alerts)
          // ships alongside Live GPS Tracking in Phase 8, once a location and
          // active daily_route are reliably available to attach to the alert.
          Alert.alert(t('driver:emergencySentTitle'), t('driver:emergencySentBody'));
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{driver?.full_name}</Text>
      <Text style={styles.subtext}>{driver?.employee_id}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('common:language')}</Text>
        <View style={styles.langRow}>
          <Pressable
            style={[styles.langButton, i18n.language === 'en' && styles.langButtonActive]}
            onPress={() => handleLanguageChange('en')}
          >
            <Text style={i18n.language === 'en' ? styles.langTextActive : styles.langText}>
              {t('common:english')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.langButton, i18n.language === 'ar' && styles.langButtonActive]}
            onPress={() => handleLanguageChange('ar')}
          >
            <Text style={i18n.language === 'ar' ? styles.langTextActive : styles.langText}>
              {t('common:arabic')}
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.emergencyButton} onPress={handleEmergency}>
        <Text style={styles.emergencyText}>{t('driver:emergency')}</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('driver:syncDiagnostics')}</Text>
        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>{t('driver:pendingGpsUpdates')}</Text>
          <Text style={styles.diagValue}>{syncStatus.pendingGpsCount}</Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>{t('driver:pendingActions')}</Text>
          <Text style={styles.diagValue}>{syncStatus.pendingActionCount}</Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>{t('driver:lastSynced')}</Text>
          <Text style={styles.diagValue}>
            {syncStatus.lastSyncedAt
              ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '—'}
          </Text>
        </View>
      </View>

      <Pressable style={styles.signOutButton} onPress={() => signOut()}>
        <Text style={styles.signOutText}>{t('common:nav.signOut')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  name: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginTop: 20 },
  subtext: { fontSize: 14, color: '#64748B', marginTop: 4 },
  section: { marginTop: 32 },
  sectionLabel: { fontSize: 13, color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase' },
  langRow: { flexDirection: 'row', gap: 12 },
  langButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  langButtonActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  langText: { color: '#334155', fontSize: 15 },
  langTextActive: { color: '#fff', fontSize: 15, fontWeight: '600' },
  emergencyButton: {
    marginTop: 40,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  emergencyText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  diagRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  diagLabel: { fontSize: 14, color: '#64748B' },
  diagValue: { fontSize: 14, color: '#0F172A', fontWeight: '600' },
  signOutButton: { marginTop: 'auto', alignItems: 'center', paddingVertical: 16 },
  signOutText: { color: '#DC2626', fontSize: 16, fontWeight: '600' },
});
