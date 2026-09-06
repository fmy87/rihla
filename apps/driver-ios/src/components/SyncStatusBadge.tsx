import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SyncStatus } from '../contexts/TodayRouteContext';

export default function SyncStatusBadge({ status, isTracking }: { status: SyncStatus; isTracking: boolean }) {
  const { t } = useTranslation('driver');
  const pendingTotal = status.pendingGpsCount + status.pendingActionCount;

  if (!isTracking && pendingTotal === 0 && !status.usingCachedData) return null;

  const label = status.usingCachedData
    ? t('offlineShowingCached')
    : !status.isOnline
      ? t('gpsOffline')
      : pendingTotal > 0
        ? t('gpsSyncing', { count: pendingTotal })
        : t('gpsOnline');

  const isWarning = status.usingCachedData || !status.isOnline;

  return (
    <View style={[styles.container, isWarning && styles.offline]}>
      <View style={[styles.dot, { backgroundColor: isWarning ? '#DC2626' : '#16A34A' }]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  offline: { backgroundColor: '#FEE2E2' },
  dot: { width: 6, height: 6, borderRadius: 3, marginEnd: 6 },
  text: { fontSize: 12, color: '#475569', fontWeight: '600' },
});
