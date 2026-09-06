import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useTodayRoute } from '../contexts/TodayRouteContext';
import type { TodayStop } from '../lib/queries/todayRoute';
import { skipStop, completeRoute } from '../lib/queries/pickup';
import { distanceMeters } from '../lib/location/geofence';
import { stopProgressState, findCurrentStop } from '../lib/routeProgress';
import SyncStatusBadge from '../components/SyncStatusBadge';

const DEFAULT_GEOFENCE_METERS = 100;
const PROXIMITY_CHECK_INTERVAL_MS = 12_000;

function stopState(stop: TodayStop, allStops: TodayStop[]): 'completed' | 'current' | 'upcoming' {
  return stopProgressState(stop, allStops);
}

const STATE_COLOR: Record<string, string> = {
  completed: '#16A34A',
  current: '#2563EB',
  upcoming: '#94A3B8',
};

export default function RouteScreen() {
  const { t } = useTranslation(['driver', 'common']);
  const { todayRoute, stops, loading, refresh, syncStatus, isTracking } = useTodayRoute();
  const [completing, setCompleting] = useState(false);
  const [nearCurrentStop, setNearCurrentStop] = useState(false);

  // Purely a UI affordance ("you're near your next stop") — does NOT write
  // to the database or mark anything complete on its own. The driver still
  // confirms every pickup/drop-off explicitly on the Students tab, per the
  // "never auto-mark students" requirement.
  useEffect(() => {
    if (!todayRoute || todayRoute.status !== 'on_route') {
      setNearCurrentStop(false);
      return;
    }
    const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
    const currentStop = findCurrentStop(ordered);
    if (!currentStop) {
      setNearCurrentStop(false);
      return;
    }

    let cancelled = false;
    async function checkProximity() {
      try {
        const pos = await Location.getLastKnownPositionAsync();
        if (!pos || cancelled || !currentStop) return;
        const distance = distanceMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          currentStop.latitude,
          currentStop.longitude
        );
        setNearCurrentStop(distance <= DEFAULT_GEOFENCE_METERS);
      } catch {
        // no last-known fix yet — fine, just skip this tick
      }
    }

    checkProximity();
    const interval = setInterval(checkProximity, PROXIMITY_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [todayRoute?.status, stops.map((s) => `${s.id}:${s.arrivedAt}`).join('|')]);

  async function handleSkip(stop: TodayStop) {
    Alert.alert(
      t('driver:skipStopTitle'),
      t('driver:skipStopBody', { name: stop.nameEn }),
      [
        { text: t('common:common.cancel'), style: 'cancel' },
        {
          text: t('driver:skipStopConfirm'),
          style: 'destructive',
          onPress: async () => {
            await skipStop(stop.id, 'driver_skipped');
            await refresh();
          },
        },
      ]
    );
  }

  async function handleCompleteRoute() {
    if (!todayRoute) return;
    setCompleting(true);
    const { error, summary } = await completeRoute(todayRoute.dailyRouteId);
    setCompleting(false);

    if (error === 'pending_students') {
      Alert.alert(
        t('driver:cannotCompleteTitle'),
        t('driver:cannotCompleteBody', { count: summary.pending })
      );
      return;
    }
    if (error) {
      Alert.alert(t('common:common.error'));
      return;
    }
    Alert.alert(
      t('driver:routeCompleteTitle'),
      t('driver:routeCompleteBody', { pickedUp: summary.pickedUp, droppedOff: summary.droppedOff })
    );
    await refresh();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('common:loading')}</Text>
      </View>
    );
  }

  if (!todayRoute || stops.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('driver:noStopsYet')}</Text>
      </View>
    );
  }

  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  const initialRegion = {
    latitude: ordered[0].latitude,
    longitude: ordered[0].longitude,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} provider={PROVIDER_GOOGLE} initialRegion={initialRegion}>
        {ordered.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={`${stop.sequence}. ${stop.nameEn}`}
            pinColor={STATE_COLOR[stopState(stop, ordered)]}
          />
        ))}
        <Polyline
          coordinates={ordered.map((s) => ({ latitude: s.latitude, longitude: s.longitude }))}
          strokeColor="#2563EB"
          strokeWidth={3}
        />
      </MapView>

      <ScrollView style={styles.stopList} contentContainerStyle={{ padding: 16 }}>
        <SyncStatusBadge status={syncStatus} isTracking={isTracking} />
        {nearCurrentStop && (
          <View style={styles.arrivedBanner}>
            <Text style={styles.arrivedBannerText}>{t('driver:arrivedBanner')}</Text>
          </View>
        )}

        {ordered.map((stop) => {
          const state = stopState(stop, ordered);
          return (
            <View key={stop.id} style={styles.stopRow}>
              <View style={[styles.stopDot, { backgroundColor: STATE_COLOR[state] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stopName}>
                  {stop.sequence}. {stop.nameEn}
                </Text>
                <Text style={styles.stopMeta}>
                  {stop.estimatedArrivalTime ?? '—'} ·{' '}
                  {stop.isSkipped ? t('driver:stopState.skipped') : t(`driver:stopState.${state}`)}
                </Text>
              </View>
              {state !== 'completed' && !stop.isSkipped && (
                <Pressable onPress={() => handleSkip(stop)} style={styles.skipButton}>
                  <Text style={styles.skipButtonText}>{t('driver:skip')}</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {todayRoute.status === 'on_route' && (
          <Pressable style={styles.completeButton} disabled={completing} onPress={handleCompleteRoute}>
            {completing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.completeButtonText}>{t('driver:completeRoute')}</Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#94A3B8', fontSize: 15, textAlign: 'center' },
  map: { width: '100%', height: '45%' },
  stopList: { flex: 1, backgroundColor: '#fff' },
  stopRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  stopDot: { width: 10, height: 10, borderRadius: 5, marginEnd: 12 },
  stopName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  stopMeta: { fontSize: 13, color: '#64748B', marginTop: 2 },
  skipButton: { paddingHorizontal: 10, paddingVertical: 6 },
  skipButtonText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  completeButton: {
    marginTop: 20,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  completeButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  arrivedBanner: {
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  arrivedBannerText: { color: '#1D4ED8', fontSize: 14, fontWeight: '600' },
});
