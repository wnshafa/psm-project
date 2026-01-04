import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../src/lib/firebase';

export default function MonitorAdherence() {
  const [logs, setLogs] = useState<any[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    // 1. Fetch total clients for the summary box
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setTotalUsers(snap.size);
    });

    // 2. Fetch real-time adherence logs
    const q = query(collection(db, 'routineLogs'), orderBy('logDate', 'desc'));
    const unsubLogs = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubUsers();
      unsubLogs();
    };
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>Monitor Client Adherence</Text>

      {/* Summary Boxes */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Total Clients</Text>
          <Text style={styles.summaryValue}>{totalUsers}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Avg Adherence Rate</Text>
          <Text style={styles.summaryValue}>78%</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Low Adherence</Text>
          <Text style={[styles.summaryValue, { color: '#d9534f' }]}>6</Text>
        </View>
      </View>

      {/* Logs Table */}
      <View style={styles.tableCard}>
        <Text style={styles.tableTitle}>Client Adherence Logs</Text>
        
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, { flex: 2 }]}>Client Name</Text>
          <Text style={[styles.headerCell, { flex: 2 }]}>Routine Type</Text>
          <Text style={[styles.headerCell, { flex: 2 }]}>Last Logged</Text>
          <Text style={[styles.headerCell, { flex: 1 }]}>Status</Text>
          <Text style={[styles.headerCell, { flex: 1 }]}>Actions</Text>
        </View>

        {logs.map((log) => (
          <View key={log.id} style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 2 }]}>User {log.id.substring(0, 4)}</Text>
            <Text style={[styles.cell, { flex: 2 }]}>Morning Routine</Text>
            <Text style={[styles.cell, { flex: 2 }]}>
              {log.logDate?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <View style={[styles.statusBadge, log.status === 'completed' ? styles.bgHigh : styles.bgLow]}>
              <Text style={styles.statusText}>{log.status === 'completed' ? 'High' : 'Low'}</Text>
            </View>
            <Pressable style={styles.detailsBtn}>
              <Text style={styles.detailsBtnText}>View Details</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9', padding: 20 },
  pageTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  
  // Summary Boxes
  summaryContainer: { flexDirection: 'row', gap: 15, marginBottom: 25 },
  summaryBox: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 4, borderWidth: 1, borderColor: '#eee' },
  summaryLabel: { fontSize: 11, color: '#888', marginBottom: 5 },
  summaryValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },

  // Table Styles
  tableCard: { backgroundColor: '#fff', borderRadius: 4, borderWidth: 1, borderColor: '#eee', padding: 15 },
  tableTitle: { fontSize: 16, fontWeight: '600', marginBottom: 15 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 10, marginBottom: 10 },
  headerCell: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f9f9f9' },
  cell: { fontSize: 13, color: '#444' },
  statusBadge: { flex: 1, paddingVertical: 4, alignItems: 'center', borderRadius: 2 },
  bgHigh: { backgroundColor: '#e6f4ea' },
  bgLow: { backgroundColor: '#fce8e6' },
  statusText: { fontSize: 11, fontWeight: '600' },
  detailsBtn: { flex: 1, marginLeft: 10 },
  detailsBtnText: { fontSize: 12, color: '#007bff', textDecorationLine: 'underline' }
});