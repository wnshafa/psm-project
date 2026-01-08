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

export default function DisplayRoutine() {
    const [routines, setRoutines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(collection(db, 'routines'), where('clientId', '==', user.uid));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setRoutines(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <SafeAreaView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.headerRow}>
                    <Text style={styles.headerTitle}>My Routines</Text>
                </View>

                {loading ? (
                    <ActivityIndicator color="#e0e1dd" size="large" />
                ) : (
                    <View style={styles.list}>
                        {routines.length === 0 ? (
                            <Text style={styles.cardHint}>No routines assigned yet.</Text>
                        ) : (
                            routines.map((routine) => (
                                <View key={routine.id} style={styles.card}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardTitle}>{routine.description || "Active Routine"}</Text>
                                        <Text style={styles.cardHint}>
                                            {routine.steps?.length || 0} Steps
                                        </Text>
                                    </View>
                                    
                                    <View style={styles.stepContainer}>
                                        {routine.steps?.map((step: any, index: number) => (
                                            <View key={index} style={styles.itemRow}>
                                                <View style={styles.stepInfo}>
                                                    <Text style={styles.itemTitle}>{step.title}</Text>
                                                    <Text style={styles.itemSubtitle}>{step.instructions}</Text>
                                                </View>
                                                <Ionicons name="medical-outline" size={20} color="#778da9" />
                                            </View>
                                        ))}
                                    </View>

                                    <Pressable 
                                        style={styles.primaryButton}
                                        onPress={() => router.push("/routinePage")}
                                    >
                                        <Text style={styles.primaryText}>Start Routine</Text>
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
    card: { backgroundColor: "#1b263b", borderRadius: 18, padding: 18, gap: 16, borderWidth: 1, borderColor: "#415a77", marginBottom: 15 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardTitle: { fontSize: 18, fontWeight: "700", color: "#e0e1dd" },
    cardHint: { fontSize: 12, color: "#778da9", textAlign: 'center' },
    list: { gap: 12 },
    stepContainer: { gap: 8 },
    itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#22334b", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#415a77" },
    stepInfo: { flex: 1 },
    itemTitle: { fontSize: 16, fontWeight: "700", color: "#e0e1dd" },
    itemSubtitle: { fontSize: 13, color: "#778da9", marginTop: 2 },
    primaryButton: { backgroundColor: "#415a77", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 10 },
    primaryText: { color: "#e0e1dd", fontWeight: "700", fontSize: 15 },
    backButton: { alignItems: 'center', padding: 10 },
    backButtonText: { color: "#778da9", fontWeight: "600" },
});