import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  addDoc,
  collection,
  onSnapshot,
  Timestamp,
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
import { COLORS } from "../src/constants/theme";
// Added auth to the imports
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

export default function AssignRoutine() {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [routineTitle, setRoutineTitle] = useState("");
  const [steps, setSteps] = useState([{ title: '', instructions: '' }]);

  useEffect(() => {
    return onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const addStep = () => {
    setSteps([...steps, { title: '', instructions: '' }]);
  };

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index));
    } else {
      Alert.alert("Error", "You must have at least one step.");
    }
  };

  const updateStep = (index: number, key: 'title' | 'instructions', value: string) => {
    const newSteps = [...steps];
    newSteps[index][key] = value;
    setSteps(newSteps);
  };

  const handleAssign = async () => {
    if (!selectedClient) return Alert.alert("Error", "Please select a client.");
    if (!routineTitle.trim()) return Alert.alert("Error", "Please enter a routine title.");
    
    const isValid = steps.every(step => step.title.trim() !== '' && step.instructions.trim() !== '');
    if (!isValid) {
      return Alert.alert("Error", "Please fill in all step titles and instructions.");
    }

    try {
      const adminUser = auth.currentUser;

      await addDoc(collection(db, 'routines'), {
        // Fix 1: Use clientId (lowercase d) so Dashboard can find it
        clientId: selectedClient.id, 
        // Fix 2: Add userId (Admin UID) for Security Rules ownership
        userId: adminUser?.uid, 
        assignedDate: Timestamp.now(),
        description: routineTitle.trim(),
        steps: steps.map(s => ({
          title: s.title.trim(),
          instructions: s.instructions.trim()
        }))
      });

      Alert.alert("Success", "Routine assigned to client.");
      setSelectedClient(null);
      setRoutineTitle("");
      setSteps([{ title: '', instructions: '' }]);
      router.back();
    } catch (error: any) {
      console.error("Assign Error:", error);
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

          <View style={styles.selectContainer}>
            <Text style={styles.selectLabel}>Routine Title</Text>
            <TextInput
                style={styles.input}
                placeholder="e.g., Morning Glow Routine"
                placeholderTextColor={COLORS.textSecondary}
                value={routineTitle}
                onChangeText={setRoutineTitle}
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Routine Steps</Text>
          </View>
          
          {steps.map((step, index) => (
            <View key={index} style={styles.stepCard}>
              <View style={styles.stepCardHeader}>
                <Text style={styles.stepLabel}>Step {index + 1}</Text>
                {steps.length > 1 && (
                  <Pressable onPress={() => removeStep(index)}>
                    <Ionicons name="trash-outline" size={20} color="#ff4d4d" />
                  </Pressable>
                )}
              </View>

              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Cleanser"
                placeholderTextColor={COLORS.textSecondary}
                value={step.title}
                onChangeText={(text) => updateStep(index, 'title', text)}
              />

              <Text style={styles.inputLabel}>Instructions</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter instructions..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                value={step.instructions}
                onChangeText={(text) => updateStep(index, 'instructions', text)}
              />
            </View>
          ))}

          <Pressable style={styles.addStepBtn} onPress={addStep}>
            <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={styles.addStepText}>Add Another Step</Text>
          </Pressable>

          <Pressable style={styles.assignBtn} onPress={handleAssign}>
  
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1b2a" },
  scroll: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  backButtonText: { color: "#e0e1dd", fontSize: 16, fontWeight: "600" },
  headerTitle: { color: "#e0e1dd", fontSize: 18, fontWeight: "700" },
  content: { gap: 20 },
  selectContainer: { gap: 8 },
  selectLabel: { color: "#778da9", fontSize: 14, fontWeight: "600" },
  selectButton: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1b263b", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#415a77" },
  selectButtonText: { color: "#e0e1dd", fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#1b263b", borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "70%", padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  modalTitle: { color: "#e0e1dd", fontSize: 18, fontWeight: "bold" },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#22334b", paddingHorizontal: 15, borderRadius: 12, borderWidth: 1, borderColor: "#415a77", marginBottom: 15 },
  searchInput: { flex: 1, paddingVertical: 12, color: "#e0e1dd", fontSize: 16 },
  listContent: { paddingBottom: 20 },
  optionItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#415a77" },
  optionSelected: { backgroundColor: "#22334b", paddingHorizontal: 10, borderRadius: 8, borderBottomWidth: 0 },
  optionText: { color: "#e0e1dd", fontSize: 16 },
  optionTextSelected: { color: "#415a77", fontWeight: "bold" },
  emptyText: { color: "#778da9", textAlign: "center", marginTop: 20 },
  sectionHeader: { borderBottomWidth: 1, borderBottomColor: "#415a77", paddingBottom: 5, marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: "#e0e1dd" },
  stepCard: { padding: 15, backgroundColor: "#1b263b", borderWidth: 1, borderColor: "#415a77", borderRadius: 15, marginBottom: 10 },
  stepCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  stepLabel: { fontSize: 12, color: "#415a77", fontWeight: '700', textTransform: 'uppercase' },
  inputLabel: { fontSize: 10, color: "#778da9", marginBottom: 4, marginLeft: 2 },
  input: { borderWidth: 1, borderColor: "#415a77", padding: 12, borderRadius: 10, marginBottom: 10, backgroundColor: "#22334b", color: "#e0e1dd", fontSize: 14 },
  textArea: { height: 80, textAlignVertical: 'top', marginBottom: 0 },
  addStepBtn: { flexDirection: 'row', padding: 15, alignItems: 'center', justifyContent: 'center' },
  addStepText: { color: "#415a77", fontWeight: '700', fontSize: 14 },
  assignBtn: { backgroundColor: "#415a77", padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  assignBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});