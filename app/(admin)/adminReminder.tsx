import { router } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  DocumentData,
  onSnapshot,
  QuerySnapshot,
  Timestamp,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { db } from "../src/lib/firebase";

export default function AdminReminder() {
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  /* ---------------- Load Clients ---------------- */
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "clients"),
      (snapshot: QuerySnapshot<DocumentData>) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setClients(list);
      }
    );
    return () => unsub();
  }, []);

  /* ---------------- Load Templates ---------------- */
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "reminderTemplate"),
      (snapshot: QuerySnapshot<DocumentData>) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTemplates(list);
      }
    );
    return () => unsub();
  }, []);

  /* ---------------- Create Reminder ---------------- */
  const handleCreateReminder = async () => {
    if (!selectedClient || !selectedTemplate) {
      Alert.alert("Error", "Please select a client and a template.");
      return;
    }

    try {
      await addDoc(collection(db, "reminder"), {
        clientID: doc(db, "clients", selectedClient.id),
        templateID: doc(db, "reminderTemplate", selectedTemplate.id),
        date: Timestamp.now(),
        status: "pending",
      });

      Alert.alert("Success", "Reminder created successfully.");
      setSelectedClient(null);
      setSelectedTemplate(null);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backButtonText}>&larr; Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Create Reminder</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Select Client */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Client</Text>
          {clients.map((client) => (
            <Pressable
              key={client.id}
              style={[
                styles.card,
                selectedClient?.id === client.id && styles.cardSelected,
              ]}
              onPress={() => setSelectedClient(client)}
            >
              <Text style={styles.cardTitle}>
                {client.name || "Unnamed Client"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Select Template */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Reminder Template</Text>
          {templates.map((tpl) => (
            <Pressable
              key={tpl.id}
              style={[
                styles.card,
                selectedTemplate?.id === tpl.id && styles.cardSelected,
              ]}
              onPress={() => setSelectedTemplate(tpl)}
            >
              <Text style={styles.cardTitle}>{tpl.title}</Text>
              <Text style={styles.cardText}>{tpl.message}</Text>
            </Pressable>
          ))}
        </View>

        {/* Create Button */}
        <Pressable style={styles.createButton} onPress={handleCreateReminder}>
          <Text style={styles.createButtonText}>Create Reminder</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- Styles ---------------- */

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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButtonText: {
    color: "#e0e1dd",
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#e0e1dd",
    fontSize: 18,
    fontWeight: "700",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: "#e0e1dd",
    fontSize: 16,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#1b263b",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#415a77",
    gap: 6,
  },
  cardSelected: {
    borderColor: "#e0e1dd",
    backgroundColor: "#22334b",
  },
  cardTitle: {
    color: "#e0e1dd",
    fontWeight: "700",
    fontSize: 15,
  },
  cardText: {
    color: "#778da9",
    fontSize: 14,
  },
  createButton: {
    backgroundColor: "#415a77",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  createButtonText: {
    color: "#e0e1dd",
    fontWeight: "700",
    fontSize: 16,
  },
});
