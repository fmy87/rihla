import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTodayRoute } from '../contexts/TodayRouteContext';
import { fetchStopStudents, type StopStudent } from '../lib/queries/students';
import { confirmEvent, fetchExistingEvent, markNotConfirmed, markStopArrivedIfResolved, type NotConfirmedReason } from '../lib/queries/pickup';
import { enqueueConfirmEvent, enqueueNotConfirmed, pendingAssignmentIds } from '../lib/offline/actionQueue';
import SyncStatusBadge from '../components/SyncStatusBadge';
import { findCurrentStop } from '../lib/routeProgress';

const NOT_CONFIRMED_REASONS: NotConfirmedReason[] = [
  'student_absent',
  'parent_cancelled',
  'student_not_ready',
  'wrong_location',
  'other',
];

export default function StudentsScreen() {
  const { t } = useTranslation(['driver', 'common']);
  const { driver } = useAuth();
  const { stops, todayRoute, refresh, syncStatus, isTracking } = useTodayRoute();
  const [students, setStudents] = useState<StopStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Assignments with a queued-but-not-yet-synced action — shown as
  // "Pending sync" rather than silently looking identical to a confirmed
  // server-side status, so the driver always knows what's actually saved.
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set());

  const currentStop = findCurrentStop(stops);
  const eventType = currentStop?.stopType ?? 'pickup';
  const confirmLabel = eventType === 'pickup' ? t('driver:pickedUp') : t('driver:droppedOff');

  const loadStudents = useCallback(async () => {
    if (!currentStop) {
      setStudents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [rows, pending] = await Promise.all([fetchStopStudents(currentStop.id), pendingAssignmentIds()]);
    setStudents(rows);
    setPendingSyncIds(pending);
    setLoading(false);
  }, [currentStop?.id]);

  useFocusEffect(
    useCallback(() => {
      loadStudents();
    }, [loadStudents])
  );

  async function handleConfirm(student: StopStudent) {
    if (!currentStop || !driver?.id) return;
    if (student.status !== 'pending' || pendingSyncIds.has(student.assignmentId)) {
      if (pendingSyncIds.has(student.assignmentId)) {
        Alert.alert(t('driver:pendingSync'), t('driver:alreadyConfirmedBody', { name: student.nameEn, time: '' }));
        return;
      }
      const existing = await fetchExistingEvent(student.assignmentId, eventType);
      const time = existing
        ? new Date(existing.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      Alert.alert(t('driver:alreadyConfirmedTitle'), t('driver:alreadyConfirmedBody', { name: student.nameEn, time }));
      return;
    }

    Alert.alert(
      t('driver:confirmPickupTitle', { action: confirmLabel.toLowerCase() }),
      t('driver:confirmPickupBody', { name: student.nameEn, action: confirmLabel.toLowerCase() }),
      [
        { text: t('common:common.cancel'), style: 'cancel' },
        { text: t('common:common.confirm'), onPress: () => doConfirm(student) },
      ]
    );
  }

  async function doConfirm(student: StopStudent) {
    if (!driver?.id || !currentStop) return;
    setBusyId(student.assignmentId);
    const { error } = await confirmEvent(student.assignmentId, driver.id, eventType);
    if (!error) {
      await markStopArrivedIfResolved(currentStop.id);
      await refresh();
    } else {
      // Assume the failure is connectivity — queue it rather than lose the
      // driver's action or block them from moving on. This is the "never
      // lose an attendance record because of poor connectivity" behavior.
      await enqueueConfirmEvent(student.assignmentId, driver.id, eventType, currentStop.id);
      setPendingSyncIds((prev) => new Set(prev).add(student.assignmentId));
    }
    setBusyId(null);
    loadStudents();
  }

  function handleNotConfirmed(student: StopStudent) {
    if (student.status !== 'pending' || pendingSyncIds.has(student.assignmentId)) {
      handleConfirm(student); // reuses the already-confirmed/pending-sync alert
      return;
    }
    Alert.alert(
      t('driver:reasonTitle'),
      undefined,
      NOT_CONFIRMED_REASONS.map((reason) => ({
        text: t(`driver:reason.${reason}`),
        onPress: () => doMarkNotConfirmed(student, reason),
      })).concat([{ text: t('common:common.cancel'), style: 'cancel', onPress: () => {} }] as any)
    );
  }

  async function doMarkNotConfirmed(student: StopStudent, reason: NotConfirmedReason) {
    if (!currentStop) return;
    setBusyId(student.assignmentId);
    const { error } = await markNotConfirmed(student.assignmentId, reason);
    if (!error) {
      await markStopArrivedIfResolved(currentStop.id);
      await refresh();
    } else {
      await enqueueNotConfirmed(student.assignmentId, reason, currentStop.id);
      setPendingSyncIds((prev) => new Set(prev).add(student.assignmentId));
    }
    setBusyId(null);
    loadStudents();
  }

  if (!todayRoute) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('driver:noRouteToday')}</Text>
      </View>
    );
  }

  if (!currentStop) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('driver:noCurrentStop')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SyncStatusBadge status={syncStatus} isTracking={isTracking} />
      <Text style={styles.stopName}>{currentStop.nameEn}</Text>
      <Text style={styles.subtext}>{t('driver:studentsAtStop')}</Text>

      <FlatList
        data={students}
        keyExtractor={(item) => item.assignmentId}
        contentContainerStyle={{ paddingVertical: 12 }}
        ListEmptyComponent={loading ? null : <Text style={styles.emptyText}>{t('driver:noStudentsAtStop')}</Text>}
        renderItem={({ item }) => {
          const pendingSync = pendingSyncIds.has(item.assignmentId);
          const resolved = item.status !== 'pending' || pendingSync;
          return (
            <View style={styles.studentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{item.nameEn}</Text>
                <Text style={[styles.studentStatus, resolved && !pendingSync && styles.studentStatusResolved, pendingSync && styles.studentStatusPending]}>
                  {pendingSync ? t('driver:pendingSync') : t(`driver:assignmentStatus.${item.status}`)}
                </Text>
              </View>
              {busyId === item.assignmentId ? (
                <ActivityIndicator />
              ) : (
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.confirmButton, resolved && styles.confirmButtonDisabled]}
                    onPress={() => handleConfirm(item)}
                  >
                    <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.declineButton, resolved && styles.confirmButtonDisabled]}
                    onPress={() => handleNotConfirmed(item)}
                  >
                    <Text style={styles.declineButtonText}>{t('driver:notConfirmed')}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#94A3B8', fontSize: 15, textAlign: 'center', marginTop: 24 },
  stopName: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginTop: 12 },
  subtext: { fontSize: 14, color: '#64748B', marginTop: 4 },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  studentName: { fontSize: 17, color: '#0F172A', fontWeight: '600' },
  studentStatus: { fontSize: 13, color: '#94A3B8', marginTop: 2, textTransform: 'capitalize' },
  studentStatusResolved: { color: '#16A34A', fontWeight: '600' },
  studentStatusPending: { color: '#D97706', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8 },
  confirmButton: { backgroundColor: '#16A34A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  confirmButtonDisabled: { opacity: 0.4 },
  confirmButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  declineButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  declineButtonText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
});
