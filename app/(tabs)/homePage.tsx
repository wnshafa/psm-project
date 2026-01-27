import { Ionicons } from "@expo/vector-icons";
import { router } from 'expo-router';
import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../src/constants/theme';
import { auth, db } from '../src/lib/firebase';

export default function ClientDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalCompleted: 0, streak: 0, lastRoutine: 'Never' });
  const [activeRoutines, setActiveRoutines] = useState<any[]>([]);
  const [pendingReminders, setPendingReminders] = useState<any[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 1. Fetch Progress Stats
    const unsubUser = onSnapshot(doc(db, 'clients', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStats(prev => ({ 
          ...prev, 
          streak: data.streak || 0,
          totalCompleted: data.totalCompleted || 0
        }));
      }
    });

    // 2. Fetch Active Routines
    const routineQuery = query(collection(db, 'routines'), where('clientId', '==', user.uid), limit(2));
    const unsubRoutines = onSnapshot(routineQuery, (snap) => {
      setActiveRoutines(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Fetch Pending Reminders
    const reminderQuery = query(
      collection(db, 'reminder'), 
      where('clientID', '==', `/clients/${user.uid}`),
      where('status', '==', 'unread'),
      limit(2)
    );
    const unsubReminders = onSnapshot(reminderQuery, (snap) => {
      setPendingReminders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubUser(); unsubRoutines(); unsubReminders(); };
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Track your skincare progress</Text>
        </View>

        {/* Progress Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIconBg}>
              <Ionicons name="flame" size={24} color="#ff6b6b" />
            </View>
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconBg}>
              <Ionicons name="checkmark-circle" size={24} color="#51cf66" />
            </View>
            <Text style={styles.statValue}>{stats.totalCompleted}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconBg}>
              <Ionicons name="notifications-circle" size={24} color="#4ecdc4" />
            </View>
            <Text style={styles.statValue}>{pendingReminders.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        {/* Routine Preview Section */}
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Routines</Text>
            <Pressable onPress={() => router.push("/routinePage")}><Text style={styles.viewAll}>View All →</Text></Pressable>
        </View>
        {activeRoutines.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-outline" size={40} color={COLORS.border} />
              <Text style={styles.emptyText}>No routines assigned yet</Text>
            </View>
        ) : (
            activeRoutines.map(r => (
                <Pressable key={r.id} style={styles.itemRow} onPress={() => router.push("/routinePage")}>
                    <View style={styles.itemContent}>
                        <View style={styles.itemIconBg}>
                          <Ionicons name="leaf" size={20} color={COLORS.primary} />
                        </View>
                        <View>
                            <Text style={styles.itemTitle}>{r.description || "Skincare Routine"}</Text>
                            <Text style={styles.itemSubtitle}>{r.steps?.length || 0} steps assigned</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </Pressable>
            ))
        )}

        {/* Reminders Preview Section */}
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reminders</Text>
            <Pressable onPress={() => router.push("/reminderPage")}><Text style={styles.viewAll}>View All →</Text></Pressable>
        </View>
        {pendingReminders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={40} color={COLORS.border} />
              <Text style={styles.emptyText}>No pending reminders</Text>
            </View>
        ) : (
            pendingReminders.map(rem => (
                <View key={rem.id} style={styles.reminderRow}>
                    <View style={styles.reminderIconBg}>
                      <Ionicons name="notifications" size={20} color="#ff6b6b" />
                    </View>
                    <View style={styles.reminderContent}>
                        <Text style={styles.itemTitle}>Routine Reminder</Text>
                        <Text style={styles.itemSubtitle}>Status: <Text style={styles.statusBadge}>{rem.status}</Text></Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </View>
            ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 15, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: { marginBottom: 5 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: COLORS.textPrimary },
  headerSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  
  // Stats Container
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginVertical: 10 },
  statCard: { 
    flex: 1, 
    backgroundColor: COLORS.card, 
    borderRadius: 16, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statIconBg: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: "rgba(255, 107, 107, 0.1)", 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 10
  },
  statValue: { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 4 },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  viewAll: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  
  itemRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: COLORS.card, 
    padding: 14, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    marginBottom: 10
  },
  itemContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  itemIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(78, 205, 196, 0.1)",
    justifyContent: 'center',
    alignItems: 'center'
  },
  itemTitle: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 15 },
  itemSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  statusBadge: { color: "#ff6b6b", fontWeight: '700' },
  
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    gap: 12
  },
  reminderIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    justifyContent: 'center',
    alignItems: 'center'
  },
  reminderContent: { flex: 1 },
  
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10
  },
  emptyText: { color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 10, fontSize: 14 }
});