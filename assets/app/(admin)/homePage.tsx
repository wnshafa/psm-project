import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl, // Add this
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { BORDER_RADIUS, COLORS, SPACING } from '../src/constants/theme';
import { db } from '../src/lib/firebase';

export default function AdminHomePage() {
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<{ [key: string]: string }>({});
  const [totalClients, setTotalClients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Fetch both collections and merge data
    let allClients: any[] = [];
    let allUsers: any[] = [];
    
    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      setTotalClients(snap.size);
      allClients = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mergeClientData();
    });

    // Fetch names from users collection
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      allUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mergeClientData();
    });
    
    const mergeClientData = () => {
      const newMap: { [key: string]: string } = {};
      allClients.forEach(client => {
        const userDoc = allUsers.find(u => u.id === client.id);
        newMap[client.id] = userDoc?.fullName || userDoc?.name || client.fullName || client.name || client.email || 'Unknown Client';
      });
      setUserMap(newMap);
    };

  // 1. Calculate the exact timestamp for 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 2. Add the 'where' clause to your query
    const q = query(
      collection(db, 'routineLogs'), 
      where('logDate', '>=', Timestamp.fromDate(sevenDaysAgo)), // Only fetch recent logs
      orderBy('logDate', 'desc')
    );

    const unsubLogs = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRawLogs(fetched);
      setLoading(false); 
      setRefreshing(false);
    });

    return () => { unsubClients(); unsubUsers(); unsubLogs(); };
  }, []);

  const todayLogs = rawLogs.filter(l => {
    if (!l.logDate) return false;
    return l.logDate.toDate().toDateString() === new Date().toDateString();
  });

  const completedToday = todayLogs.filter(l => l.status === 'completed').length;
  const completionRate = totalClients > 0 ? Math.round((completedToday / totalClients) * 100) : 0;

  // Calculate adherence rate (completed logs / total logs in last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
// rawLogs is already filtered to the last 7 days by our Firestore query!
  const logsLastSevenDays = rawLogs;
  
  const completedLastSevenDays = logsLastSevenDays.filter(l => l.status === 'completed').length;
  const adherenceRate = logsLastSevenDays.length > 0 
    ? Math.round((completedLastSevenDays / logsLastSevenDays.length) * 100) 
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Dashboard</Text>
            <Text style={styles.pageSubtitle}>Client Activity & Performance</Text>
          </View>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar" size={14} color={COLORS.primary} />
            <Text style={styles.dateText}>{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
          </View>
        </View>

        {/* Main Stats Grid */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <View style={[styles.iconBg, { backgroundColor: 'rgba(212, 165, 116, 0.15)' }]}>
              <Ionicons name="people" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.summaryValue}>{totalClients}</Text>
            <Text style={styles.summaryLabel}>Total Clients</Text>
          </View>

          <View style={styles.summaryBox}>
            <View style={[styles.iconBg, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.summaryValue}>{completedToday}</Text>
            <Text style={styles.summaryLabel}>Completed Today</Text>
          </View>

          <View style={styles.summaryBox}>
            <View style={[styles.iconBg, { backgroundColor: 'rgba(255, 152, 0, 0.15)' }]}>
              <Ionicons name="trending-up" size={24} color="#FF9800" />
            </View>
            <Text style={styles.summaryValue}>{completionRate}%</Text>
            <Text style={styles.summaryLabel}>Today's Rate</Text>
          </View>
        </View>

        {/* Adherence Rate Highlight Card */}
        <View style={styles.adherenceCard}>
          <View style={styles.adherenceHeader}>
            <View style={styles.adherenceTitleContainer}>
              <Ionicons name="medal" size={28} color={COLORS.primary} />
              <View>
                <Text style={styles.adherenceTitle}>7-Day Adherence</Text>
                <Text style={styles.adherenceSubtitle}>{logsLastSevenDays.length} total activities</Text>
              </View>
            </View>
            <View style={styles.adherencePercentage}>
              <Text style={styles.adherenceValue}>{adherenceRate}%</Text>
            </View>
          </View>
          
          <View style={styles.adherenceProgressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${adherenceRate}%`,
                  backgroundColor: adherenceRate >= 80 ? '#4CAF50' : adherenceRate >= 60 ? '#FF9800' : '#E53935'
                }
              ]} 
            />
          </View>
          
          <View style={styles.adherenceStats}>
            <View style={styles.adherenceStat}>
              <Text style={styles.adherenceStatLabel}>Completed</Text>
              <Text style={styles.adherenceStatValue}>{completedLastSevenDays}</Text>
            </View>
            <View style={styles.adherenceDivider} />
            <View style={styles.adherenceStat}>
              <Text style={styles.adherenceStatLabel}>Missed</Text>
              <Text style={styles.adherenceStatValue}>{logsLastSevenDays.length - completedLastSevenDays}</Text>
            </View>
          </View>
        </View>

        {/* Activity Feed */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <View style={styles.activityTitleRow}>
              <Ionicons name="pulse" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Recent Activity</Text>
            </View>
            {rawLogs.length > 0 && (
              <View style={styles.activityCountBadge}>
                <Text style={styles.activityCountText}>{rawLogs.length}</Text>
              </View>
            )}
          </View>

          {rawLogs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>No activity recorded yet</Text>
            </View>
          ) : (
            <View style={styles.feedContainer}>
              {rawLogs.slice(0, 5).map((log, index) => {
                const uName = userMap[log.clientId || log.userId] || 'User';
                const isCompleted = log.status === 'completed';
                return (
                  <View key={log.id} style={styles.activityCard}>
                    {/* Timeline dot */}
                    <View style={styles.timelineContainer}>
                      <View style={[styles.timelineDot, { backgroundColor: isCompleted ? '#4CAF50' : '#E53935' }]}>
                        <Ionicons 
                          name={isCompleted ? 'checkmark-sharp' : 'close-sharp'} 
                          size={12} 
                          color={COLORS.white} 
                        />
                      </View>
                      {index < 4 && <View style={styles.timelineConnector} />}
                    </View>

                    {/* Activity Details */}
                    <View style={styles.activityContent}>
                      <View style={styles.activityTop}>
                        <View style={styles.clientInfo}>
                          <Text style={styles.clientName}>{uName}</Text>
                          <Text style={styles.activityType}>
                            {isCompleted ? 'Completed routine' : 'Missed routine'}
                          </Text>
                        </View>
                        <View style={[
                          styles.statusBadge, 
                          { backgroundColor: isCompleted ? 'rgba(76, 175, 80, 0.15)' : 'rgba(229, 57, 53, 0.15)' }
                        ]}>
                          <Text style={[
                            styles.statusBadgeText, 
                            { color: isCompleted ? '#4CAF50' : '#E53935' }
                          ]}>
                            {isCompleted ? 'Done' : 'Missed'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.timestamp}>
                        <Ionicons name="time" size={12} color={COLORS.textSecondary} /> {log.logDate?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {log.logDate?.toDate().toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          
          {rawLogs.length > 5 && (
            <Pressable style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>View All Activity</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: SPACING.lg, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.xl, gap: 16 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  pageSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, fontWeight: '500' },
  dateBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  dateText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  
  // Summary Stats
  summaryContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: SPACING.xl },
  summaryBox: { 
    flex: 1, 
    backgroundColor: COLORS.card, 
    padding: 16, 
    borderRadius: BORDER_RADIUS.lg, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 8
  },
  iconBg: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  summaryValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', fontWeight: '600' },

  // Adherence Card
  adherenceCard: { 
    backgroundColor: COLORS.card, 
    padding: 20, 
    borderRadius: BORDER_RADIUS.lg, 
    borderWidth: 2, 
    borderColor: COLORS.primary,
    marginBottom: SPACING.xl,
    gap: 16
  },
  adherenceHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  adherenceTitleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
    flex: 1
  },
  adherenceTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: COLORS.textPrimary 
  },
  adherenceSubtitle: { 
    fontSize: 12, 
    color: COLORS.textSecondary, 
    marginTop: 2,
    fontWeight: '500'
  },
  adherencePercentage: { 
    backgroundColor: 'rgba(212, 165, 116, 0.15)', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 16,
    minWidth: 70,
    alignItems: 'center'
  },
  adherenceValue: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: COLORS.primary 
  },
  adherenceProgressBar: { 
    height: 8, 
    backgroundColor: COLORS.inputBackground, 
    borderRadius: 4, 
    overflow: 'hidden' 
  },
  progressFill: { 
    height: '100%', 
    borderRadius: 4,

  },
  adherenceStats: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  adherenceStat: { 
    alignItems: 'center', 
    flex: 1 
  },
  adherenceStatLabel: { 
    fontSize: 11, 
    color: COLORS.textSecondary, 
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4
  },
  adherenceStatValue: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: COLORS.textPrimary 
  },
  adherenceDivider: { 
    width: 1, 
    height: 30, 
    backgroundColor: COLORS.border 
  },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  
  // Activity Section
  activitySection: { gap: 12 },
  activityHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 8
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  activityCountBadge: { 
    backgroundColor: COLORS.primary, 
    borderRadius: 12, 
    paddingHorizontal: 12, 
    paddingVertical: 4 
  },
  activityCountText: { 
    color: COLORS.white, 
    fontWeight: '800', 
    fontSize: 12 
  },
  
  feedContainer: { gap: 0 },
  emptyContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 40,
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  emptyText: { 
    textAlign: 'center', 
    color: COLORS.textSecondary, 
    fontSize: 14,
    fontWeight: '500'
  },
  
  // Timeline Activity Cards
  activityCard: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12
  },
  timelineContainer: { 
    alignItems: 'center', 
    gap: 6 
  },
  timelineDot: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#4CAF50'
  },
  timelineConnector: {
    width: 2,
    height: 36,
    backgroundColor: COLORS.border
  },
  activityContent: { 
    flex: 1,
    gap: 6
  },
  activityTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10
  },
  clientInfo: {
    flex: 1
  },
  clientName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  activityType: { 
    fontSize: 12, 
    color: COLORS.textSecondary, 
    marginTop: 2,
    fontWeight: '500'
  },
  statusBadge: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  statusBadgeText: { 
    fontSize: 11, 
    fontWeight: '700' 
  },
  timestamp: { 
    fontSize: 11, 
    color: COLORS.textSecondary, 
    fontWeight: '500' 
  },
  
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 6
  },
  viewAllText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13
  }
});