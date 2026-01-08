import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { auth, db } from "../src/lib/firebase";

export default function DisplayReminders() {
    const [reminders, setReminders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        // Query: pull from 'reminder' collection
        // Filter: only reminders for this client that are 'pending'
        // Note: Field name 'clientID' matches your Firestore screenshot
        const q = query(
            collection(db, 'reminder'), 
            where('clientID', '==', `/clients/${user.uid}`),
            where('status', '==', 'pending')
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            // Optional: Sort by date locally if Firestore index isn't ready
            setReminders(list.sort((a, b) => b.date?.seconds - a.date?.seconds));
            setLoading(false);
        }, (error) => {
            console.error("Reminder Query Error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const formatDate = (ts: any) => {
        if (!ts) return "N/A";
        const date = ts.toDate();
        return date.toLocaleDateString() + " at " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <SafeAreaView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.headerRow}>
                    <Text style={styles.headerTitle}>Notifications</Text>
                </View>

                {loading ? (
                    <ActivityIndicator color="#e0e1dd" size="large" />
                ) : (
                    <View style={styles.list}>
                        {reminders.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="notifications-off-outline" size={48} color="#415a77" />
                                <Text style={styles.cardHint}>You're all caught up!</Text>
                            </View>
                        ) : (
                            reminders.map((reminder) => (
                                <View key={reminder.id} style={styles.card}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.statusRow}>
                                            <View style={styles.statusDot} />
                                            <Text style={styles.cardTitle}>Routine Alert</Text>
                                        </View>
                                        <Text style={styles.dateText}>{formatDate(reminder.date)}</Text>
                                    </View>
                                    
                                    <View style={styles.infoBox}>
                                        <Text style={styles.infoText}>
                                            An admin has scheduled a reminder for your skin routine. 
                                            Check your routines page to start your next session.
                                        </Text>
                                    </View>

                                    <Pressable 
                                        style={styles.primaryButton}
                                        onPress={() => router.push("/routinePage")}
                                    >
                                        <Text style={styles.primaryText}>View My Routine</Text>
                                    </Pressable>
                                </View>
                            ))
                        )}
                    </View>
                )}

                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Back to Dashboard</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#0d1b2a" },
    scroll: { padding: 20, gap: 20 },
    headerRow: { marginTop: 10, marginBottom: 5 },
    headerTitle: { fontSize: 24, fontWeight: "700", color: "#e0e1dd" },
    card: { backgroundColor: "#1b263b", borderRadius: 18, padding: 18, gap: 12, borderWidth: 1, borderColor: "#415a77", marginBottom: 15 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#778da9' },
    cardTitle: { fontSize: 16, fontWeight: "700", color: "#e0e1dd" },
    dateText: { fontSize: 12, color: "#778da9" },
    infoBox: { backgroundColor: "#22334b", padding: 12, borderRadius: 12, marginTop: 4 },
    infoText: { color: "#e0e1dd", fontSize: 14, lineHeight: 20 },
    primaryButton: { backgroundColor: "#415a77", borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 8 },
    primaryText: { color: "#e0e1dd", fontWeight: "700", fontSize: 14 },
    backButton: { alignItems: 'center', padding: 10, marginTop: 10 },
    backButtonText: { color: "#778da9", fontWeight: "600" },
    emptyContainer: { alignItems: 'center', marginTop: 50, gap: 12 },
    cardHint: { fontSize: 14, color: "#778da9", textAlign: 'center' },
    list: { gap: 15 },
});