import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/theme';
import { db } from '../../src/lib/firebase';

export default function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [routinesMap, setRoutinesMap] = useState<Record<string, boolean>>({});
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [sevenDayLogs, setSevenDayLogs] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const map: Record<string, any> = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      setUsersMap(map);
    });

    // Track which clients have a routine assigned
    const unsubRoutines = onSnapshot(collection(db, 'routines'), (snap) => {
      const map: Record<string, boolean> = {};
      snap.docs.forEach(d => { map[d.data().clientId] = true; });
      setRoutinesMap(map);
    });

    // Today's logs
    const unsubToday = onSnapshot(
      query(collection(db, 'routineLogs'), where('logDate', '>=', Timestamp.fromDate(today)), orderBy('logDate', 'desc')),
      (snap) => setTodayLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    // Last 7 days logs
    const unsubSeven = onSnapshot(
      query(collection(db, 'routineLogs'), where('logDate', '>=', Timestamp.fromDate(sevenDaysAgo)), orderBy('logDate', 'desc')),
      (snap) => {
        const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setSevenDayLogs(logs);
        setRecentLogs(logs.slice(0, 6));
        setLoading(false);
      }
    );

    return () => { unsubClients(); unsubUsers(); unsubRoutines(); unsubToday(); unsubSeven(); };
  }, []);

  const getName = (clientId: string) => {
    const u = usersMap[clientId];
    return u?.fullName ?? u?.name ?? clients.find(c => c.id === clientId)?.fullName ?? 'Unknown';
  };

  const totalClients = clients.length;
  const completedToday = new Set(todayLogs.filter(l => l.status === 'completed').map(l => l.clientId)).size;
  const adherenceRate = sevenDayLogs.length > 0
    ? Math.round((sevenDayLogs.filter(l => l.status === 'completed').length / sevenDayLogs.length) * 100)
    : 0;
  const todayRate = totalClients > 0 ? Math.round((completedToday / totalClients) * 100) : 0;

  // Alerts
  const completedTodayIds = new Set(todayLogs.filter(l => l.status === 'completed').map(l => l.clientId));
  const notLoggedToday = clients.filter(c => !completedTodayIds.has(c.id));
  const noRoutine = clients.filter(c => !routinesMap[c.id]);

  // Top performers — sorted by streak
  const topPerformers = [...clients]
    .sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0))
    .slice(0, 3);

  // At risk — clients whose dailyAdherence < 50
  const atRisk = clients.filter(c => (c.dailyAdherence ?? 100) < 50);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>Client Activity & Performance</Text>
          </View>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
            <Text style={styles.dateText}>{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(255,139,167,0.12)' }]}>
              <Ionicons name="people" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.statValue}>{totalClients}</Text>
            <Text style={styles.statLabel}>Total Clients</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(81,207,102,0.12)' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#51cf66" />
            </View>
            <Text style={styles.statValue}>{completedToday}</Text>
            <Text style={styles.statLabel}>Done Today</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(255,152,0,0.12)' }]}>
              <Ionicons name="trending-up" size={20} color="#FF9800" />
            </View>
            <Text style={styles.statValue}>{todayRate}%</Text>
            <Text style={styles.statLabel}>Today's Rate</Text>
          </View>
        </View>

        {/* 7-Day Adherence */}
        <View style={styles.adherenceCard}>
          <View style={styles.adherenceTop}>
            <View style={{ gap: 2 }}>
              <Text style={styles.adherenceTitle}>7-Day Adherence</Text>
              <Text style={styles.adherenceSub}>{sevenDayLogs.length} total activities</Text>
            </View>
            <Text style={styles.adherenceValue}>{adherenceRate}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${adherenceRate}%` as any,
              backgroundColor: adherenceRate >= 80 ? '#51cf66' : adherenceRate >= 60 ? '#FF9800' : '#ff6b6b'
            }]} />
          </View>
          <View style={styles.adherenceStats}>
            <View style={styles.adherenceStat}>
              <Text style={styles.adherenceStatVal}>{sevenDayLogs.filter(l => l.status === 'completed').length}</Text>
              <Text style={styles.adherenceStatLabel}>Completed</Text>
            </View>
            <View style={styles.adherenceDivider} />
            <View style={styles.adherenceStat}>
              <Text style={styles.adherenceStatVal}>{sevenDayLogs.filter(l => l.status !== 'completed').length}</Text>
              <Text style={styles.adherenceStatLabel}>Missed</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={() => router.push('/(admin)/assignRoutine')}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,139,167,0.12)' }]}>
              <Ionicons name="flask-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.actionLabel}>Assign Routine</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push('/(admin)/adminReminder')}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,152,0,0.12)' }]}>
              <Ionicons name="notifications-outline" size={22} color="#FF9800" />
            </View>
            <Text style={styles.actionLabel}>Send Reminder</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push('/(admin)/manageUsers')}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(81,207,102,0.12)' }]}>
              <Ionicons name="people-outline" size={22} color="#51cf66" />
            </View>
            <Text style={styles.actionLabel}>Manage Users</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push('/(admin)/userProgress')}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(162,155,254,0.12)' }]}>
              <Ionicons name="analytics-outline" size={22} color="#a29bfe" />
            </View>
            <Text style={styles.actionLabel}>View Progress</Text>
          </Pressable>
        </View>

        {/* Alerts */}
        {(notLoggedToday.length > 0 || noRoutine.length > 0) && (
          <>
            <Text style={styles.sectionTitle}>Needs Attention</Text>
            <View style={styles.alertsCard}>
              {notLoggedToday.length > 0 && (
                <View style={styles.alertItem}>
                  <View style={[styles.alertDot, { backgroundColor: '#FF9800' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle}>{notLoggedToday.length} client{notLoggedToday.length > 1 ? 's' : ''} haven't logged today</Text>
                    <Text style={styles.alertNames} numberOfLines={1}>
                      {notLoggedToday.slice(0, 3).map(c => getName(c.id)).join(', ')}{notLoggedToday.length > 3 ? ` +${notLoggedToday.length - 3} more` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => router.push('/(admin)/adminReminder')}>
                    <Text style={styles.alertAction}>Remind</Text>
                  </Pressable>
                </View>
              )}
              {notLoggedToday.length > 0 && noRoutine.length > 0 && <View style={styles.alertDivider} />}
              {noRoutine.length > 0 && (
                <View style={styles.alertItem}>
                  <View style={[styles.alertDot, { backgroundColor: '#ff6b6b' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle}>{noRoutine.length} client{noRoutine.length > 1 ? 's' : ''} have no routine</Text>
                    <Text style={styles.alertNames} numberOfLines={1}>
                      {noRoutine.slice(0, 3).map(c => getName(c.id)).join(', ')}{noRoutine.length > 3 ? ` +${noRoutine.length - 3} more` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => router.push('/(admin)/assignRoutine')}>
                    <Text style={styles.alertAction}>Assign</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        )}

        {/* Top Performers */}
        {topPerformers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Performers</Text>
            <View style={styles.listCard}>
              {topPerformers.map((c, index) => (
                <View key={c.id}>
                  <View style={styles.rankItem}>
                    <Text style={styles.rankNum}>#{index + 1}</Text>
                    <View style={styles.rankAvatar}>
                      <Text style={styles.rankAvatarText}>{getName(c.id).charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rankName}>{getName(c.id)}</Text>
                      <Text style={styles.rankSub}>{c.totalCompleted ?? 0} routines completed</Text>
                    </View>
                    <View style={styles.streakBadge}>
                      <Ionicons name="flame" size={13} color={COLORS.primary} />
                      <Text style={styles.streakText}>{c.streak ?? 0}</Text>
                    </View>
                  </View>
                  {index < topPerformers.length - 1 && <View style={styles.itemDivider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* At Risk */}
        {atRisk.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Clients At Risk</Text>
            <View style={styles.listCard}>
              {atRisk.slice(0, 4).map((c, index) => (
                <View key={c.id}>
                  <View style={styles.rankItem}>
                    <View style={[styles.rankAvatar, { backgroundColor: 'rgba(255,107,107,0.1)' }]}>
                      <Text style={[styles.rankAvatarText, { color: '#ff6b6b' }]}>{getName(c.id).charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rankName}>{getName(c.id)}</Text>
                      <Text style={styles.rankSub}>Adherence: {c.dailyAdherence ?? 0}%</Text>
                    </View>
                    <Pressable style={styles.remindBtn} onPress={() => router.push('/(admin)/adminReminder')}>
                      <Text style={styles.remindBtnText}>Remind</Text>
                    </Pressable>
                  </View>
                  {index < Math.min(atRisk.length, 4) - 1 && <View style={styles.itemDivider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {recentLogs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={36} color={COLORS.border} />
            <Text style={styles.emptyText}>No activity recorded yet</Text>
          </View>
        ) : (
          <View style={styles.activityCard}>
            {recentLogs.map((log, index) => {
              const done = log.status === 'completed';
              return (
                <View key={log.id}>
                  <View style={styles.activityItem}>
                    <View style={[styles.activityDot, { backgroundColor: done ? 'rgba(81,207,102,0.15)' : 'rgba(255,107,107,0.15)' }]}>
                      <Ionicons name={done ? 'checkmark' : 'close'} size={14} color={done ? '#51cf66' : '#ff6b6b'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityName}>{getName(log.clientId)}</Text>
                      <Text style={styles.activitySub}>{log.type ?? ''} routine · {done ? 'Completed' : 'Missed'}</Text>
                    </View>
                    <Text style={styles.activityTime}>
                      {log.logDate?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  {index < recentLogs.length - 1 && <View style={styles.activityDivider} />}
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },
  dateBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  dateText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 16, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' },

  adherenceCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.primary, gap: 14 },
  adherenceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  adherenceTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  adherenceSub: { fontSize: 12, color: COLORS.textSecondary },
  adherenceValue: { fontSize: 32, fontWeight: '900', color: COLORS.primary },
  progressTrack: { height: 8, backgroundColor: COLORS.inputBackground, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  adherenceStats: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  adherenceStat: { flex: 1, alignItems: 'center' },
  adherenceStatVal: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  adherenceStatLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  adherenceDivider: { width: 1, height: 30, backgroundColor: COLORS.border },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  alertsCard: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  alertItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  alertDot: { width: 10, height: 10, borderRadius: 5 },
  alertTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  alertNames: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  alertAction: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  alertDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: 36 },

  activityCard: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  activityItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  activityDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  activityName: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  activitySub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  activityTime: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  activityDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: 58 },

  emptyCard: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 40, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 13, color: COLORS.textSecondary },

  listCard: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  rankItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rankNum: { fontSize: 14, fontWeight: '800', color: COLORS.textSecondary, width: 24 },
  rankAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,139,167,0.12)', alignItems: 'center', justifyContent: 'center' },
  rankAvatarText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  rankName: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  rankSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,139,167,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  streakText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  itemDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: 62 },
  remindBtn: { backgroundColor: 'rgba(255,152,0,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  remindBtnText: { fontSize: 12, fontWeight: '700', color: '#FF9800' },
});
