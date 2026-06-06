import { Ionicons } from "@expo/vector-icons";
import { router } from 'expo-router';
import { collection, doc, limit, onSnapshot, orderBy, query, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/theme';
import { clientPath } from '../../src/constants/firestore';
import { SKIN_METRICS } from '../../src/constants/metrics';
import { auth, db } from '../../src/lib/firebase';
import { ReminderLog } from '../../src/types';

type SkinMetric = { label: string; value: number; color: string };

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function ClientDashboard() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [routines, setRoutines] = useState<any[]>([]);
  const [completedTodayIds, setCompletedTodayIds] = useState<string[]>([]);
  const [latestReminder, setLatestReminder] = useState<any | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [skinMetrics, setSkinMetrics] = useState<SkinMetric[] | null>(null);
  const [skinAnalysisDate, setSkinAnalysisDate] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderLog[]>([]);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [weeklyData, setWeeklyData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 1. Client profile
    const unsubClient = onSnapshot(doc(db, 'clients', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserName(data.fullName?.split(' ')[0] || '');
        setStreak(data.streak || 0);
        setTotalCompleted(data.totalCompleted || 0);
      }
    });

    // 2. Assigned routines
    const unsubRoutines = onSnapshot(
      query(collection(db, 'routines'), where('clientId', '==', user.uid)),
      (snap) => setRoutines(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    // 3. Today's completed logs
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const unsubLogs = onSnapshot(
      query(
        collection(db, 'routineLogs'),
        where('clientId', '==', user.uid),
        where('logDate', '>=', Timestamp.fromDate(today))
      ),
      (snap) => setCompletedTodayIds(snap.docs.map(d => d.data().routineID))
    );

    // 4. Latest unread reminder + count
    const unsubReminder = onSnapshot(
      query(
        collection(db, 'reminder'),
        where('clientID', '==', clientPath(user.uid)),
        where('status', '==', 'unread'),
      ),
      (snap) => {
        setUnreadCount(snap.size);
        setLatestReminder(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ReminderLog[];
        setReminders(list.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)));
        setLoading(false);
      }
    );

    // 5. Weekly routine logs (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const unsubWeekly = onSnapshot(
      query(
        collection(db, 'routineLogs'),
        where('clientId', '==', user.uid),
        where('logDate', '>=', Timestamp.fromDate(sevenDaysAgo))
      ),
      (snap) => {
        const counts: Record<string, number> = {};
        snap.docs.forEach(d => {
          const date = d.data().logDate?.toDate();
          if (date) counts[date.toDateString()] = (counts[date.toDateString()] || 0) + 1;
        });
        setWeeklyData(
          Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return counts[d.toDateString()] || 0;
          })
        );
      }
    );

    // 6. Latest skin analysis
    const unsubSkin = onSnapshot(
      query(
        collection(db, 'skinLogs'),
        where('clientId', '==', user.uid),
        orderBy('date', 'desc'),
        limit(1)
      ),
      (snap) => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setSkinMetrics(SKIN_METRICS.map(m => ({ label: m.label, color: m.color, value: data[m.key] ?? 50 })));
          const date = data.date?.toDate();
          if (date) {
            const diff = Math.floor((Date.now() - date.getTime()) / 86400000);
            setSkinAnalysisDate(diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${diff} days ago`);
          }
        } else {
          setSkinMetrics(null);
          setSkinAnalysisDate(null);
        }
      }
    );

    return () => {
      unsubClient();
      unsubRoutines();
      unsubLogs();
      unsubReminder();
      unsubWeekly();
      unsubSkin();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const markAsRead = async (reminderId: string) => {
    try {
      await updateDoc(doc(db, 'reminder', reminderId), { status: 'read' });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (reminders.length === 0) return;
    try {
      const batch = writeBatch(db);
      reminders.forEach((rem) => batch.update(doc(db, 'reminder', rem.id), { status: 'read' }));
      await batch.commit();
    } catch (error) {
      console.error("Error clearing all:", error);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return '';
    const date = ts.toDate();
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const morningRoutine = routines.find(r => r.type === 'Morning');
  const nightRoutine = routines.find(r => r.type === 'Night');
  const morningDone = morningRoutine ? completedTodayIds.includes(morningRoutine.id) : null;
  const nightDone = nightRoutine ? completedTodayIds.includes(nightRoutine.id) : null;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Greeting ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}{userName ? ',' : ''}</Text>
            <Text style={styles.headerTitle}>{userName || 'Welcome'} 👋</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.bellBtn} onPress={() => setReminderModalVisible(true)}>
              <Ionicons name="notifications-outline" size={22} color={COLORS.textPrimary} />
              {unreadCount > 0 && (
                <View style={styles.badgeDot}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={18} color={COLORS.primary} />
              <Text style={styles.streakValue}>{streak}</Text>
            </View>
          </View>
        </View>

        {/* ── Today's Routine ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today&apos;s Routine</Text>
          <View style={styles.routineRow}>
            <Pressable
              style={[styles.routineItem, morningDone === true && styles.routineDone, morningDone === null && styles.routineNA]}
              onPress={() => router.push('/routinePage')}
            >
              <Ionicons
                name={morningDone ? 'checkmark-circle' : morningDone === null ? 'remove-circle-outline' : 'sunny-outline'}
                size={28}
                color={morningDone ? '#4ade80' : morningDone === null ? COLORS.border : COLORS.primary}
              />
              <Text style={styles.routineLabel}>Morning</Text>
              <Text style={[styles.routineStatus, { color: morningDone ? '#4ade80' : morningDone === null ? COLORS.border : COLORS.textSecondary }]}>
                {morningDone ? 'Done' : morningDone === null ? 'Not set' : 'Pending'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.routineItem, nightDone === true && styles.routineDone, nightDone === null && styles.routineNA]}
              onPress={() => router.push('/routinePage')}
            >
              <Ionicons
                name={nightDone ? 'checkmark-circle' : nightDone === null ? 'remove-circle-outline' : 'moon-outline'}
                size={28}
                color={nightDone ? '#4ade80' : nightDone === null ? COLORS.border : COLORS.primary}
              />
              <Text style={styles.routineLabel}>Night</Text>
              <Text style={[styles.routineStatus, { color: nightDone ? '#4ade80' : nightDone === null ? COLORS.border : COLORS.textSecondary }]}>
                {nightDone ? 'Done' : nightDone === null ? 'Not set' : 'Pending'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={22} color="#ff6b6b" />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={22} color="#51cf66" />
            <Text style={styles.statValue}>{totalCompleted}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="today" size={22} color={COLORS.primary} />
            <Text style={styles.statValue}>{completedTodayIds.length}/{routines.length}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
        </View>

        {/* ── Weekly Progress ── */}
        {(() => {
          const chartWidth = Dimensions.get('window').width - 72;
          const weekLabels = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()];
          });
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly Progress</Text>
              <LineChart
                data={{ labels: weekLabels, datasets: [{ data: weeklyData }] }}
                width={chartWidth}
                height={140}
                fromZero
                chartConfig={{
                  backgroundColor: COLORS.card,
                  backgroundGradientFrom: COLORS.card,
                  backgroundGradientTo: COLORS.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(27, 58, 107, ${opacity})`,
                  labelColor: () => COLORS.textSecondary,
                  propsForDots: { r: '4', strokeWidth: '2', stroke: COLORS.primary },
                  propsForBackgroundLines: { stroke: COLORS.border, strokeDasharray: '' },
                }}
                bezier
                withInnerLines
                withOuterLines={false}
                style={styles.chart}
              />
            </View>
          );
        })()}

        {/* ── Latest Reminder ── */}
        {latestReminder && (
          <Pressable style={styles.reminderCard} onPress={() => setReminderModalVisible(true)}>
            <View style={styles.reminderIcon}>
              <Ionicons name="notifications" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reminderTitle}>{latestReminder.templateTitle || 'New Reminder'}</Text>
              <Text style={styles.reminderMsg} numberOfLines={1}>{latestReminder.message}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </Pressable>
        )}

        {/* ── Skin Summary ── */}
        <Pressable style={styles.card} onPress={() => router.push('/skinChartAnalysis')}>
          <View style={styles.skinHeader}>
            <Text style={styles.cardTitle}>Skin Analysis</Text>
            <Text style={styles.skinDate}>{skinAnalysisDate ?? 'Not scanned'}</Text>
          </View>
          {skinMetrics ? (
            <View style={styles.skinBars}>
              {skinMetrics.map((m) => (
                <View key={m.label} style={styles.skinBarRow}>
                  <Text style={styles.skinBarLabel}>{m.label}</Text>
                  <View style={styles.skinTrack}>
                    <View style={[styles.skinFill, { flex: m.value / 100, backgroundColor: m.color }]} />
                    <View style={{ flex: 1 - m.value / 100 }} />
                  </View>
                  <Text style={styles.skinBarValue}>{m.value}%</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.skinEmpty}>
              <Ionicons name="camera-outline" size={24} color={COLORS.border} />
              <Text style={styles.skinEmptyText}>Tap to scan your skin</Text>
            </View>
          )}
        </Pressable>

      </ScrollView>

      <Modal
        visible={reminderModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReminderModalVisible(false)}
      >
        <SafeAreaView style={styles.screen}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Notifications</Text>
                {reminders.length > 0 && (
                  <Text style={styles.modalSubtitle}>{reminders.length} unread</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {reminders.length > 0 && (
                  <Pressable style={styles.clearBtn} onPress={markAllAsRead}>
                    <Text style={styles.clearBtnText}>Clear all</Text>
                  </Pressable>
                )}
                <Pressable style={styles.closeBtn} onPress={() => setReminderModalVisible(false)}>
                  <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                </Pressable>
              </View>
            </View>

            {reminders.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="notifications-off-outline" size={32} color={COLORS.textSecondary} />
                </View>
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptyHint}>No new notifications from your consultant.</Text>
              </View>
            ) : (
              <View style={styles.notifList}>
                {reminders.map((reminder, index) => (
                  <View key={reminder.id}>
                    <View style={styles.notifItem}>
                      <View style={styles.notifIconWrap}>
                        <Ionicons name="notifications" size={16} color={COLORS.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.notifTitle}>{reminder.templateTitle || 'Routine Alert'}</Text>
                        <Text style={styles.notifMessage}>{reminder.message || 'Your consultant sent a new reminder.'}</Text>
                        <Text style={styles.notifDate}>{formatDate(reminder.date)}</Text>
                        <View style={styles.notifActions}>
                          <Pressable style={styles.notifPrimaryBtn} onPress={() => { setReminderModalVisible(false); router.push('/(tabs)/routinePage'); }}>
                            <Text style={styles.notifPrimaryText}>View Routine</Text>
                          </Pressable>
                          <Pressable style={styles.notifDismissBtn} onPress={() => markAsRead(reminder.id)}>
                            <Text style={styles.notifDismissText}>Dismiss</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                    {index < reminders.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  greeting: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  badgeDot: { position: 'absolute', top: -2, right: -2, backgroundColor: '#e63946', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary },
  streakValue: { fontSize: 16, fontWeight: '900', color: COLORS.primary },

  // Card
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Routine
  routineRow: { flexDirection: 'row', gap: 10 },
  routineItem: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  routineDone: { borderColor: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.05)' },
  routineNA: { opacity: 0.5 },
  routineLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  routineStatus: { fontSize: 11, fontWeight: '600' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.border },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, textTransform: 'uppercase', fontWeight: '600' },

  // Reminder
  reminderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212, 165, 116, 0.1)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.primary, gap: 12 },
  reminderIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(212, 165, 116, 0.2)', alignItems: 'center', justifyContent: 'center' },
  reminderTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  reminderMsg: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // Skin
  skinHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  skinDate: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  skinBars: { gap: 8 },
  skinBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skinBarLabel: { width: 72, fontSize: 11, color: COLORS.textSecondary },
  skinTrack: { flex: 1, flexDirection: 'row', height: 8, backgroundColor: COLORS.inputBackground, borderRadius: 4, overflow: 'hidden' },
  skinFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  skinBarValue: { width: 32, fontSize: 11, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'right' },
  skinEmpty: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  skinEmptyText: { fontSize: 12, color: COLORS.textSecondary },

  // Reminder modal
  modalScroll: { padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  modalSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  clearBtn: { backgroundColor: COLORS.inputBackground, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  clearBtnText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.inputBackground, alignItems: 'center', justifyContent: 'center' },
  notifList: { borderRadius: 18, overflow: 'hidden', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  notifItem: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  notifIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,139,167,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  notifMessage: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  notifDate: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '400' },
  notifActions: { flexDirection: 'row', gap: 8, marginTop: 6, alignSelf: 'stretch' },
  notifPrimaryBtn: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: 11, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifPrimaryText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  notifDismissBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  notifDismissText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: 64 },
  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.inputBackground, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  emptyHint: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
});
