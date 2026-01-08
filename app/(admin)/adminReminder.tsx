import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  addDoc,
  collection,
  DocumentData,
  onSnapshot,
  QuerySnapshot,
  Timestamp
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from "../src/constants/theme";
// Added auth import
import { auth, db } from "../src/lib/firebase";

// --- Helper Component: Searchable Selection Modal ---
interface SearchableSelectProps {
  label: string;
  data: any[];
  selectedItem: any;
  onSelect: (item: any) => void;
  displayKey: string;
  placeholder: string;
}

const SearchableSelect = ({
  label,
  data,
  selectedItem,
  onSelect,
  displayKey,
  placeholder,
}: SearchableSelectProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");

  const filteredData = data.filter((item) => {
    const val = item[displayKey]?.toLowerCase() || "";
    return val.includes(searchText.toLowerCase());
  });

  return (
    <View style={styles.selectContainer}>
      <Text style={styles.selectLabel}>{label}</Text>
      <Pressable
        style={styles.selectButton}
        onPress={() => {
          setSearchText("");
          setModalVisible(true);
        }}
      >
        <Text
          style={[
            styles.selectButtonText,
            !selectedItem && { color: COLORS.textSecondary },
          ]}
        >
          {selectedItem
            ? selectedItem[displayKey] || "Unnamed"
            : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select {label}</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color={COLORS.textSecondary}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                placeholderTextColor={COLORS.textSecondary}
                value={searchText}
                onChangeText={setSearchText}
                autoFocus
              />
            </View>

            <FlatList
              data={filteredData}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.optionItem,
                    selectedItem?.id === item.id && styles.optionSelected,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedItem?.id === item.id && styles.optionTextSelected,
                    ]}
                  >
                    {item[displayKey] || "Unnamed"}
                  </Text>
                  {selectedItem?.id === item.id && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={COLORS.primary}
                    />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No results found.</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function AdminReminder() {
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  const [createTemplateVisible, setCreateTemplateVisible] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [newTemplateMessage, setNewTemplateMessage] = useState("");

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

  const handleCreateReminder = async () => {
    if (!selectedClient || !selectedTemplate) {
      Alert.alert("Error", "Please select a client and a template.");
      return;
    }

    try {
      const adminUser = auth.currentUser;

      await addDoc(collection(db, "reminder"), {
        // Fix 1: Store as path string to match your Dashboard query and screenshot
        clientID: `/clients/${selectedClient.id}`,
        templateID: `/reminderTemplate/${selectedTemplate.id}`,
        
        // Fix 2: Add Admin Ownership for Security Rules
        userId: adminUser?.uid, 
        
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

  const handleCreateTemplate = async () => {
    if (!newTemplateTitle.trim() || !newTemplateMessage.trim()) {
      Alert.alert("Error", "Please provide both a title and a message.");
      return;
    }

    try {
      const adminUser = auth.currentUser;
      const docRef = await addDoc(collection(db, "reminderTemplate"), {
        title: newTemplateTitle.trim(),
        message: newTemplateMessage.trim(),
        userId: adminUser?.uid, // Added ownership
        createdAt: Timestamp.now(),
      });
      
      Alert.alert("Success", "Template created successfully.");
      
      setSelectedTemplate({
        id: docRef.id,
        title: newTemplateTitle.trim(),
        message: newTemplateMessage.trim()
      });

      setNewTemplateTitle("");
      setNewTemplateMessage("");
      setCreateTemplateVisible(false);

    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            <Text style={styles.backButtonText}> Back</Text>
          </Pressable>

          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <SearchableSelect
            label="Select Client"
            placeholder="Choose a client..."
            data={clients}
            selectedItem={selectedClient}
            onSelect={setSelectedClient}
            displayKey="name"
          />

          <View style={styles.templateSectionHeader}>
             <SearchableSelect
              label="Select Template"
              placeholder="Choose a template..."
              data={templates}
              selectedItem={selectedTemplate}
              onSelect={setSelectedTemplate}
              displayKey="title"
            />
            
            <Pressable onPress={() => setCreateTemplateVisible(true)} style={styles.addTemplateLink}>
              <Text style={styles.addTemplateText}>+ Create New Template</Text>
            </Pressable>
          </View>

          {selectedTemplate && (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Message Preview:</Text>
              <Text style={styles.previewText}>{selectedTemplate.message}</Text>
            </View>
          )}
        </View>

        <Pressable style={styles.createButton} onPress={handleCreateReminder}>
          <Text style={styles.createButtonText}>Create Reminder</Text>
        </Pressable>

        <Modal
          visible={createTemplateVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setCreateTemplateVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: 'auto', paddingBottom: SPACING.xxl }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create New Template</Text>
                <Pressable onPress={() => setCreateTemplateVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </Pressable>
              </View>

              <View style={{ gap: SPACING.md }}>
                <View>
                  <Text style={styles.inputLabel}>Template Title</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Weekly Follow-up"
                    placeholderTextColor={COLORS.textSecondary}
                    value={newTemplateTitle}
                    onChangeText={setNewTemplateTitle}
                  />
                </View>

                <View>
                  <Text style={styles.inputLabel}>Message Body</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Enter the reminder message..."
                    placeholderTextColor={COLORS.textSecondary}
                    multiline
                    value={newTemplateMessage}
                    onChangeText={setNewTemplateMessage}
                  />
                </View>

                <Pressable style={styles.createButton} onPress={handleCreateTemplate}>
                  <Text style={styles.createButtonText}>Save Template</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.xl },
  backButtonText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: "600" },
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: "700" },
  content: { gap: SPACING.xl },
  selectContainer: { gap: SPACING.sm, flex: 1 },
  selectLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: "600" },
  selectButton: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.inputBackground, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  selectButtonText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md },
  templateSectionHeader: { gap: SPACING.sm },
  addTemplateLink: { alignSelf: 'flex-end', paddingVertical: 4 },
  addTemplateText: { color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: BORDER_RADIUS.lg, borderTopRightRadius: BORDER_RADIUS.lg, height: "70%", padding: SPACING.lg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md },
  modalTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: "bold" },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.inputBackground, paddingHorizontal: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  searchInput: { flex: 1, paddingVertical: SPACING.md, color: COLORS.textPrimary, fontSize: FONT_SIZE.md },
  listContent: { paddingBottom: SPACING.xl },
  optionItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  optionSelected: { backgroundColor: COLORS.inputBackground, paddingHorizontal: SPACING.sm, borderRadius: BORDER_RADIUS.sm, borderBottomWidth: 0 },
  optionText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md },
  optionTextSelected: { color: COLORS.primary, fontWeight: "bold" },
  emptyText: { color: COLORS.textSecondary, textAlign: "center", marginTop: SPACING.xl },
  previewCard: { backgroundColor: COLORS.inputBackground, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginTop: SPACING.sm },
  previewLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, marginBottom: 4 },
  previewText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.sm, fontStyle: 'italic' },
  inputLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
  input: { borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.inputBackground, color: COLORS.textPrimary, fontSize: FONT_SIZE.sm },
  textArea: { height: 100, textAlignVertical: 'top' },
  createButton: { backgroundColor: COLORS.primary, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md, alignItems: "center", marginTop: SPACING.lg },
  createButtonText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZE.md },
});