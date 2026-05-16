import { Ionicons } from "@expo/vector-icons";
import { router } from 'expo-router';
import { collection, doc, limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/theme';
import { auth, db } from '../../src/lib/firebase';

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
        where('clientID', '==', `/clients/${user.uid}`),
        where('status', '==', 'unread'),
      ),
      (snap) => {
        setUnreadCount(snap.size);
        setLatestReminder(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
        setLoading(false);
      }
    );

    // 5. Latest skin analysis
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
          setSkinMetrics([
            { label: 'Hydration',   value: data.hydration   ?? 50, color: '#4ecdc4' },
            { label: 'Oiliness',    value: data.oiliness    ?? 50, color: '#ff6b6b' },
            { label: 'Sensitivity', value: data.sensitivity ?? 50, color: '#f7b731' },
            { label: 'Brightness',  value: data.brightness  ?? 50, color: '#a29bfe' },
          ]);
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
            <Pressable style={styles.bellBtn} onPress={() => router.push('/reminderPage')}>
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
          <Text style={styles.cardTitle}>Today's Routine</Text>
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

        {/* ── Latest Reminder ── */}
        {latestReminder && (
          <Pressable style={styles.reminderCard} onPress={() => router.push('/reminderPage')}>
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
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  streakValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary },

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
});
