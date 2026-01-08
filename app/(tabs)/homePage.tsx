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
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setStats(prev => ({ ...prev, streak: snap.data().streak || 0 }));
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
      where('status', '==', 'pending'),
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

        {/* Progress Card */}
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Progress</Text>
            <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Streak</Text>
                <Text style={styles.progressValue}>{stats.streak} days</Text>
            </View>
        </View>

        {/* Routine Preview Section */}
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Routines</Text>
            <Pressable onPress={() => router.push("/routinePage")}><Text style={styles.viewAll}>View All</Text></Pressable>
        </View>
        {activeRoutines.map(r => (
            <Pressable key={r.id} style={styles.itemRow} onPress={() => router.push("/routinePage")}>
                <View>
                    <Text style={styles.itemTitle}>{r.description || "Skincare Routine"}</Text>
                    <Text style={styles.itemSubtitle}>{r.steps?.length || 0} steps assigned</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </Pressable>
        ))}

        {/* Reminders Preview Section */}
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reminders</Text>
            <Pressable onPress={() => router.push("/reminderPage")}><Text style={styles.viewAll}>View All</Text></Pressable>
        </View>
        {pendingReminders.length === 0 ? (
            <Text style={styles.emptyText}>No pending reminders</Text>
        ) : (
            pendingReminders.map(rem => (
                <View key={rem.id} style={[styles.itemRow, { borderLeftWidth: 4, borderLeftColor: COLORS.primary }]}>
                    <View>
                        <Text style={styles.itemTitle}>Routine Reminder</Text>
                        <Text style={styles.itemSubtitle}>Status: {rem.status}</Text>
                    </View>
                    <Ionicons name="notifications" size={20} color={COLORS.primary} />
                </View>
            ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1b2a" },
  scroll: { padding: 20, gap: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#0d1b2a" },
  header: { marginBottom: 10 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#e0e1dd" },
  headerSubtitle: { fontSize: 14, color: "#778da9" },
  card: { backgroundColor: "#1b263b", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "#415a77" },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#e0e1dd", marginBottom: 10 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: "#778da9" },
  progressValue: { color: "#e0e1dd", fontWeight: "700" },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#e0e1dd' },
  viewAll: { color: "#415a77", fontSize: 12, fontWeight: '700' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: "#1b263b", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#415a77" },
  itemTitle: { color: "#e0e1dd", fontWeight: '600', fontSize: 15 },
  itemSubtitle: { color: "#778da9", fontSize: 12, marginTop: 2 },
  emptyText: { color: "#778da9", fontStyle: 'italic', textAlign: 'center', marginTop: 10 }
});