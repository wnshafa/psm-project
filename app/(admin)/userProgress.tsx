import { router } from "expo-router";
import { collection, DocumentData, onSnapshot, QueryDocumentSnapshot, QuerySnapshot, Timestamp } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { db } from "../src/lib/firebase";

// 1. Define the Interface to solve "Object is of type unknown"
interface UserData {
  id: string;
  email?: string;
  routineName?: string;
  streak?: number;
  createdAt?: Timestamp;
}

export default function UserProgress() {
  const [users, setUsers] = useState<UserData[]>([]); // Apply the interface here

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot: QuerySnapshot<DocumentData>) => {
      const userList = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...(doc.data() as Omit<UserData, 'id'>) // Cast the data to our interface
      }));
      setUsers(userList);
    });
    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>&larr; Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>User Progress</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.list}>
          {users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(user.email || "U").charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.userDetails}>
                    <Text style={styles.userName}>{user.email || "User"}</Text>
                    <Text style={styles.userEmail}>{user.routineName || "No Routine"}</Text>
                </View>
              </View>
              
              <View style={styles.statsDivider} />
              
              <View style={styles.userStats}>
                  <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Streak</Text>
                      <Text style={styles.statValue}>{user.streak || 0} days</Text>
                  </View>
                  <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Since</Text>
                      <Text style={[styles.statValue, {color: "#778da9"}]}>
                          {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : "N/A"}
                      </Text>
                  </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1b2a" },
  scroll: { padding: 20, gap: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  // Added backButton to fix Property 'backButton' does not exist error
  backButton: { padding: 8 }, 
  backButtonText: { color: "#e0e1dd", fontSize: 16, fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#e0e1dd" },
  list: { gap: 16 },
  userCard: { backgroundColor: "#1b263b", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#415a77", gap: 16 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#415a77", alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: "#e0e1dd", fontSize: 20, fontWeight: "700" },
  userDetails: { flex: 1 },
  userName: { fontSize: 16, fontWeight: "700", color: "#e0e1dd" },
  userEmail: { fontSize: 13, color: "#778da9" },
  statsDivider: { height: 1, backgroundColor: "#415a77" },
  userStats: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { gap: 4 },
  statLabel: { fontSize: 12, color: "#778da9", textTransform: "uppercase", fontWeight: "600" },
  statValue: { fontSize: 15, fontWeight: "700", color: "#e0e1dd" }
});