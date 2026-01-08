import { collection, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../src/constants/theme';
import { db } from '../src/lib/firebase';

interface RoutineLog {
  id: string;
  clientId?: string; // Standardized field name
  userId?: string;   // Fallback field name
  logDate: Timestamp | null;
  status: 'completed' | 'missed';
  userName?: string;
}

export default function AdminHomePage() {
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<{ [key: string]: string }>({});
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // 1. Listen to Users (to build the name map for the table)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setTotalUsers(snap.size);
      const newMap: { [key: string]: string } = {};
      snap.docs.forEach(doc => {
        const d = doc.data();
        // Uses fullName or name, whichever is available
        newMap[doc.id] = d.fullName || d.name || 'Unknown User';
      });
      setUserMap(newMap);
    }, (error) => {
      console.error("Error fetching users:", error);
    });

    // 2. Listen to RoutineLogs
    // Ordering by logDate to show most recent activity at the top
    const q = query(collection(db, 'routineLogs'), orderBy('logDate', 'desc'));
    const unsubLogs = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRawLogs(fetched);
      setLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error("Error fetching logs:", error);
      setLoading(false);
      setRefreshing(false);
    });

    return () => {
      unsubUsers();
      unsubLogs();
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    // Real-time listeners update automatically, but this provides UI feedback
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatLogTime = (logDate: Timestamp | null) => {
    if (!logDate || typeof logDate.toDate !== 'function') return 'N/A';
    try {
      const date = logDate.toDate();
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  // Compute final logs with mapped names
  const logs: RoutineLog[] = rawLogs.map(log => {
    // Check both potential ID fields
    const targetId = log.clientId || log.userId;
    return {
      ...log,
      userName: userMap[targetId] || `ID: ${targetId ? targetId.substring(0, 5) : 'Unknown'}`
    };
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <Text style={styles.pageTitle}>Activity Monitor</Text>

        {/* Summary Dashboard */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Clients</Text>
            <Text style={styles.summaryValue}>{totalUsers}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Today's Logs</Text>
            <Text style={styles.summaryValue}>
              {logs.filter(l => {
                if (!l.logDate) return false;
                const date = l.logDate.toDate();
                return date.toDateString() === new Date().toDateString();
              }).length}
            </Text>
          </View>
        </View>

        {/* Recent Activity Feed */}
        <View style={styles.tableCard}>
          <Text style={styles.tableTitle}>Recent Routine Logs</Text>
          
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, { flex: 2 }]}>Client</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>Date/Time</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>Status</Text>
          </View>

          {logs.length === 0 ? (
            <Text style={styles.emptyText}>No activity logs yet.</Text>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.tableRow}>
                <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>{log.userName}</Text>
                <Text style={[styles.cell, { flex: 2, fontSize: 11, color: COLORS.textSecondary }]}>
                  {formatLogTime(log.logDate)}
                </Text>
                
                <View style={[
                  styles.statusBadge, 
                  log.status === 'completed' ? styles.bgHigh : styles.bgLow
                ]}>
                  <Text style={[
                    styles.statusText, 
                    log.status === 'completed' ? styles.statusTextHigh : styles.statusTextLow
                  ]}>
                    {log.status === 'completed' ? 'Done' : 'Missed'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.md },
  pageTitle: { fontSize: FONT_SIZE.xl, fontWeight: 'bold', marginBottom: SPACING.xl, color: COLORS.textPrimary },
  summaryContainer: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.xl },
  summaryBox: { flex: 1, backgroundColor: COLORS.card, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  summaryLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: SPACING.xs, textTransform: 'uppercase' },
  summaryValue: { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: COLORS.textPrimary },
  tableCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: 40 },
  tableTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', marginBottom: SPACING.lg, color: COLORS.textPrimary },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: COLORS.border, paddingBottom: SPACING.sm, marginBottom: SPACING.sm },
  headerCell: { fontSize: FONT_SIZE.xs, fontWeight: 'bold', color: COLORS.textSecondary, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderColor: COLORS.border },
  cell: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  statusBadge: { flex: 1, paddingVertical: 4, alignItems: 'center', borderRadius: BORDER_RADIUS.sm },
  bgHigh: { backgroundColor: 'rgba(76, 175, 80, 0.1)' },
  bgLow: { backgroundColor: 'rgba(230, 57, 70, 0.1)' },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statusTextHigh: { color: '#4CAF50' },
  statusTextLow: { color: COLORS.danger },
  emptyText: { textAlign: 'center', padding: SPACING.xl, color: COLORS.textSecondary }
});