import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, DocumentData, onSnapshot, orderBy, query, QueryDocumentSnapshot, QuerySnapshot, Timestamp, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from "../src/constants/theme";
import { db } from "../src/lib/firebase";

// 1. Define the Interface
interface UserData {
  id: string;
  email?: string;
  fullName?: string;
  name?: string;
  routineName?: string;
  streak?: number;
  createdAt?: Timestamp;
}

interface UserLog {
  id: string;
  logDate: Timestamp;
  status: string;
}

export default function UserProgress() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userLogs, setUserLogs] = useState<UserLog[]>([]);

  // 1. Fetch Users
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot: QuerySnapshot<DocumentData>) => {
      const userList = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...(doc.data() as Omit<UserData, 'id'>) 
      }));
      setUsers(userList);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Logs for Selected User
  useEffect(() => {
    if (!selectedUser) {
      setUserLogs([]);
      return;
    }

    const q = query(
      collection(db, 'routineLogs'), 
      where('userId', '==', selectedUser.id),
      orderBy('logDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserLog[];
      setUserLogs(logs);
    });

    return () => unsubscribe();
  }, [selectedUser]);

  // Helper to format timestamps
  const formatDate = (ts?: Timestamp | null) => {
    if (!ts || typeof ts.toDate !== 'function') return 'N/A';
    return ts.toDate().toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            <Text style={styles.backButtonText}> Back</Text>
          </Pressable>
    
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.list}>
          {users.map((user) => (
            <Pressable 
              key={user.id} 
              style={styles.userCard}
              onPress={() => setSelectedUser(user)}
            >
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(user.email || "U").charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.userDetails}>
                    <Text style={styles.userName}>{user.fullName || user.name || user.email || "User"}</Text>
                    <Text style={styles.userEmail}>{user.routineName || "No Routine"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              </View>
              
              <View style={styles.statsDivider} />
              
              <View style={styles.userStats}>
                  <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Streak</Text>
                      <Text style={styles.statValue}>{user.streak || 0} days</Text>
                  </View>
                  <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Joined</Text>
                      <Text style={[styles.statValue, {color: COLORS.textSecondary}]}>
                          {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : "N/A"}
                      </Text>
                  </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* --- User Details Modal --- */}
        <Modal
          visible={!!selectedUser}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedUser(null)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Client Details</Text>
              <Pressable onPress={() => setSelectedUser(null)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>

            {selectedUser && (
              <ScrollView contentContainerStyle={styles.modalScroll}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                  <View style={styles.largeAvatar}>
                    <Text style={styles.largeAvatarText}>{(selectedUser.email || "U").charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.profileName}>{selectedUser.fullName || selectedUser.name || "Unnamed"}</Text>
                  <Text style={styles.profileEmail}>{selectedUser.email}</Text>
                  
                  <View style={styles.profileStatsRow}>
                    <View style={styles.profileStat}>
                      <Text style={styles.statValueLarge}>{selectedUser.streak || 0}</Text>
                      <Text style={styles.statLabel}>Day Streak</Text>
                    </View>
                    <View style={styles.profileStat}>
                      <Text style={styles.statValueLarge}>{userLogs.length}</Text>
                      <Text style={styles.statLabel}>Total Logs</Text>
                    </View>
                  </View>
                </View>

                {/* Logs History Section */}
                <Text style={styles.sectionHeader}>Activity History</Text>
                {userLogs.length === 0 ? (
                  <Text style={styles.emptyText}>No activity logs found for this client.</Text>
                ) : (
                  <View style={styles.logsList}>
                    {userLogs.map((log) => (
                      <View key={log.id} style={styles.logRow}>
                        <View style={styles.logIndicator} />
                        <View style={{ flex: 1 }}>
                           <Text style={styles.logDate}>{formatDate(log.logDate)}</Text>
                           <Text style={styles.logStatus}>Routine Completed</Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, gap: SPACING.lg },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.sm },
  backButton: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  backButtonText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: "600" },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: "700", color: COLORS.textPrimary },
  
  list: { gap: SPACING.md },
  userCard: { 
    backgroundColor: COLORS.card, 
    borderRadius: BORDER_RADIUS.md, 
    padding: SPACING.md, 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    gap: SPACING.md 
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: COLORS.border, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  avatarText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: "700" },
  userDetails: { flex: 1 },
  userName: { fontSize: FONT_SIZE.md, fontWeight: "700", color: COLORS.textPrimary },
  userEmail: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  statsDivider: { height: 1, backgroundColor: COLORS.border },
  userStats: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { gap: 4 },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: "600" },
  statValue: { fontSize: FONT_SIZE.sm, fontWeight: "700", color: COLORS.textPrimary },

  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: SPACING.lg, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border 
  },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: "bold", color: COLORS.textPrimary },
  closeButton: { padding: SPACING.xs },
  closeButtonText: { color: COLORS.primary, fontSize: FONT_SIZE.md, fontWeight: "600" },
  modalScroll: { padding: SPACING.lg },
  
  profileSection: { alignItems: 'center', marginBottom: SPACING.xl },
  largeAvatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: COLORS.border, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: SPACING.md
  },
  largeAvatarText: { fontSize: 32, fontWeight: 'bold', color: COLORS.textPrimary },
  profileName: { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 4 },
  profileEmail: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  
  profileStatsRow: { flexDirection: 'row', gap: SPACING.xl },
  profileStat: { alignItems: 'center' },
  statValueLarge: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary },
  
  sectionHeader: { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: SPACING.md },
  logsList: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  logRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: SPACING.md, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border,
    gap: SPACING.md
  },
  logIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  logDate: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, fontWeight: '600' },
  logStatus: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.lg }
});