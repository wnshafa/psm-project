import { router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";
import { db } from "../src/lib/firebase";

export default function AddRoutine() {
  const [reminders, setReminders] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'system_reminders'), where('active', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        enabled: true // Default to enabled if it comes from admin
      }));
      setReminders(list);
    });
    return () => unsubscribe();
  }, []);

  const toggleSwitch = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Reminders</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>System Reminders</Text>
            <Text style={styles.cardHint}>Admin Alerts</Text>
          </View>
          <View style={styles.list}>
            {reminders.length === 0 ? (
                <Text style={{color: "#778da9", padding: 10}}>No active reminders.</Text>
            ) : (
                reminders.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                    <View>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemSubtitle}>{item.time}</Text>
                    </View>
                    <Switch
                    trackColor={{ false: "#415a77", true: "#778da9" }}
                    thumbColor={item.enabled ? "#e0e1dd" : "#f4f3f4"}
                    onValueChange={() => toggleSwitch(item.id)}
                    value={item.enabled}
                    />
                </View>
                ))
            )}
          </View>
        </View>

        <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.back()}
        >
            <Text style={styles.backButtonText}>Back to Home</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0d1b2a",
  },
  scroll: {
    padding: 20,
    gap: 20,
  },
  headerRow: {
    marginTop: 10,
    marginBottom: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#e0e1dd",
  },
  card: {
    backgroundColor: "#1b263b",
    borderRadius: 18,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: "#415a77",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e0e1dd",
  },
  cardHint: {
    fontSize: 12,
    color: "#778da9",
  },
  list: {
    gap: 12,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#22334b",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#415a77",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e0e1dd",
  },
  itemSubtitle: {
    fontSize: 13,
    color: "#778da9",
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: "#22334b",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#415a77",
  },
  infoText: {
    color: "#e0e1dd",
    lineHeight: 20,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#415a77",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#415a77",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#1b263b",
  },
  backButton: {
      alignItems: 'center',
      padding: 10
  },
  backButtonText: {
      color: "#778da9",
      fontWeight: "600"
  },
  buttonPressed: {
    opacity: 0.85,
  },
  primaryText: {
    color: "#e0e1dd",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryText: {
    color: "#e0e1dd",
    fontWeight: "700",
    fontSize: 15,
  },
});
