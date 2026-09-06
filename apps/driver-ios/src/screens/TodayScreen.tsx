import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useTodayRoute } from '../contexts/TodayRouteContext';
import SyncStatusBadge from '../components/SyncStatusBadge';

const STATUS_LABEL_KEY: Record<string, string> = {
  not_started: 'driver:status.notStarted',
  on_route: 'driver:status.onRoute',
  delayed: 'driver:status.delayed',
  completed: 'driver:status.completed',
  cancelled: 'driver:status.cancelled',
};

export default function TodayScreen() {
  const { t } = useTranslation(['driver', 'common']);
  const { driver } = useAuth();
  const { todayRoute, loading, startRoute, syncStatus, isTracking } = useTodayRoute();
  const navigation = useNavigation<any>();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setStarting(true);
    setError(null);
    const { error: startError, locationDenied } = await startRoute();
    setStarting(false);
    if (startError === 'location_permission_denied') {
      setError(t('driver:locationPermissionDenied'));
      return;
    }
    if (startError) {
      setError(t('driver:startFailed'));
      return;
    }
    if (locationDenied) {
      // Route started fine — foreground tracking works — but background
      // permission wasn't granted, so tracking pauses if the iPad is locked.
      setError(t('driver:backgroundLocationWarning'));
    }
    navigation.navigate('Route');
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SyncStatusBadge status={syncStatus} isTracking={isTracking} />
      <Text style={styles.greeting}>{driver?.full_name}</Text>
      <Text style={styles.subtext}>
        {t('common:roles.driver')} · {driver?.employee_id}
      </Text>

      {!todayRoute ? (
        <View style={styles.noRouteCard}>
          <Text style={styles.noRouteText}>{t('driver:noRouteToday')}</Text>
        </View>
      ) : (
        <View style={styles.routeCard}>
          <Text style={styles.routeLabel}>{t('driver:todaysRoute')}</Text>
          <Text style={styles.routeName}>{todayRoute.routeNameEn}</Text>
          <Text style={styles.busNumber}>{todayRoute.busNumber}</Text>

          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{t(STATUS_LABEL_KEY[todayRoute.status])}</Text>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {todayRoute.status === 'not_started' ? (
            <Pressable style={styles.startButton} disabled={starting} onPress={handleStart}>
              {starting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.startButtonText}>{t('driver:startRoute')}</Text>
              )}
            </Pressable>
          ) : (
            <Pressable style={styles.continueButton} onPress={() => navigation.navigate('Route')}>
              <Text style={styles.continueButtonText}>{t('driver:viewRoute')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  greeting: { fontSize: 24, fontWeight: '700', color: '#0F172A', marginTop: 40 },
  subtext: { fontSize: 15, color: '#64748B', marginTop: 4 },
  noRouteCard: {
    marginTop: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    padding: 20,
  },
  noRouteText: { color: '#94A3B8', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  routeCard: {
    marginTop: 32,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    padding: 24,
  },
  routeLabel: { color: '#94A3B8', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  routeName: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: 6 },
  busNumber: { color: '#CBD5E1', fontSize: 17, marginTop: 4 },
  statusPill: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  error: { color: '#FCA5A5', marginTop: 12, fontSize: 14 },
  startButton: {
    marginTop: 24,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  continueButton: {
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
