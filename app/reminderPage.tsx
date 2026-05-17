import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
    collection,
    doc,
    onSnapshot,
    query,
    updateDoc,
    where,
    writeBatch
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../src/constants/theme";
import { auth, db } from "../src/lib/firebase";
import { ReminderLog } from '../src/types';

export default function DisplayReminders() {
    const [reminders, setReminders] = useState<ReminderLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchReminders = () => {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(
            collection(db, 'reminder'),
            where('clientID', '==', `/clients/${user.uid}`),
            where('status', '==', 'unread')
        );

        return onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as ReminderLog[];

            setReminders(list.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)));
            setLoading(false);
            setRefreshing(false);
        }, (error) => {
            console.error("Firestore Error:", error.message);
            setLoading(false);
            setRefreshing(false);
        });
    };

    useEffect(() => {
        const unsubscribe = fetchReminders();
        return () => unsubscribe?.();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchReminders();
    };

    const markAsRead = async (reminderId: string) => {
        try {
            const reminderRef = doc(db, 'reminder', reminderId);
            await updateDoc(reminderRef, {
                status: 'read'
            });
        } catch (error) {
            console.error("Error marking as read:", error);
        }
    };

    const markAllAsRead = async () => {
        if (reminders.length === 0) return;
        try {
            const batch = writeBatch(db);
            reminders.forEach((rem) => {
                const ref = doc(db, 'reminder', rem.id);
                batch.update(ref, { status: 'read' });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error clearing all:", error);
        }
    };

    const formatDate = (ts: any) => {
        if (!ts) return "N/A";
        const date = ts.toDate();
        return date.toLocaleDateString() + " at " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <SafeAreaView style={styles.screen}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
                }
            >
                <View style={styles.headerRow}>
                    <Pressable onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { flex: 1 }]}>Notifications</Text>
                    {reminders.length > 0 && (
                        <Pressable onPress={markAllAsRead}>
                            <Text style={styles.clearAllText}>Clear All</Text>
                        </Pressable>
                    )}
                </View>

                {loading ? (
                    <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 50 }} />
                ) : (
                    <View style={styles.list}>
                        {reminders.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="notifications-off-outline" size={48} color={COLORS.border} />
                                <Text style={styles.cardHint}>You're all caught up!</Text>
                            </View>
                        ) : (
                            reminders.map((reminder) => (
                                <View key={reminder.id} style={styles.card}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.statusRow}>
                                            <View style={styles.statusDot} />
                                            <Text style={styles.cardTitle}>
                                                {reminder.templateTitle || "Routine Alert"}
                                            </Text>
                                        </View>
                                        <Text style={styles.dateText}>{formatDate(reminder.date)}</Text>
                                    </View>

                                    <View style={styles.infoBox}>
                                        <Text style={styles.infoText}>
                                            {reminder.message || "Your consultant sent a new reminder."}
                                        </Text>
                                    </View>

                                    <View style={styles.buttonRow}>
                                        <Pressable style={styles.primaryButton} onPress={() => router.push("/(tabs)/routinePage")}>
                                            <Text style={styles.primaryText}>View Routine</Text>
                                        </Pressable>
                                        <Pressable style={styles.secondaryButton} onPress={() => markAsRead(reminder.id)}>
                                            <Text style={styles.secondaryText}>Dismiss</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    scroll: { padding: 20, paddingBottom: 40 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
    headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
    clearAllText: { color: COLORS.primary, fontWeight: '700' },
    list: { gap: 15 },
    card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: COLORS.border },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
    cardTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
    dateText: { fontSize: 11, color: COLORS.textSecondary },
    infoBox: { backgroundColor: COLORS.inputBackground, padding: 12, borderRadius: 12, marginVertical: 10 },
    infoText: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20 },
    buttonRow: { flexDirection: 'row', gap: 10 },
    primaryButton: { flex: 2, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
    primaryText: { color: COLORS.white, fontWeight: "700" },
    secondaryButton: { flex: 1, backgroundColor: COLORS.inputBackground, borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
    secondaryText: { color: COLORS.textSecondary, fontWeight: "700" },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    cardHint: { color: COLORS.textSecondary, marginTop: 10 }
});
