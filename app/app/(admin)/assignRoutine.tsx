import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { COLORS } from "../src/constants/theme";
import { db } from "../src/lib/firebase";

// --- Helper Component: Searchable Selection Modal ---
interface SearchableSelectProps {
  label: string;
  data: any[];
  selectedItem: any;
  onSelect: (item: any) => void;
  displayKey: string;
  placeholder: string;
}

const SearchableSelect = ({ label, data, selectedItem, onSelect, displayKey, placeholder }: SearchableSelectProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  // --- New States for Templates ---
 
  const filteredData = data.filter((item) => {
    const val = item[displayKey]?.toLowerCase() || "";
    return val.includes(searchText.toLowerCase());
  });

  return (
    <View style={styles.selectContainer}>
      <Text style={styles.selectLabel}>{label}</Text>
      <Pressable style={styles.selectButton} onPress={() => { setSearchText(""); setModalVisible(true); }}>
        <Text style={[styles.selectButtonText, !selectedItem && { color: COLORS.textSecondary }]}>
          {selectedItem ? selectedItem[displayKey] || "Unnamed" : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
      </Pressable>

      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select {label}</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
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
                  style={[styles.optionItem, selectedItem?.id === item.id && styles.optionSelected]}
                  onPress={() => { onSelect(item); setModalVisible(false); }}
                >
                  <Text style={[styles.optionText, selectedItem?.id === item.id && styles.optionTextSelected]}>
                    {item[displayKey] || "Unnamed"}
                  </Text>
                  {selectedItem?.id === item.id && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function AssignRoutine() {
   const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [existingRoutines, setExistingRoutines] = useState<any[]>([]);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  
  // Updated States
  const [routineType, setRoutineType] = useState<"Morning" | "Night">("Morning");
  const [duration, setDuration] = useState(""); // NEW: e.g., "4 Weeks"
  const [steps, setSteps] = useState([{ title: '', instructions: '' }]);

  useEffect(() => {
    // Fetch both collections and merge data
    let allClients: any[] = [];
    let allUsers: any[] = [];
    
    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      allClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mergeClientData();
    });
    
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mergeClientData();
    });
    
    const mergeClientData = () => {
      const clientsWithNames = allClients.map(client => {
        const userDoc = allUsers.find(u => u.id === client.id);
        return {
          id: client.id,
          fullName: userDoc?.fullName || userDoc?.name || client.fullName || client.name || client.email || "Unnamed Client",
          email: userDoc?.email || client.email || "",
          ...client
        };
      });
      setClients(clientsWithNames);
    };
    
    return () => { unsubClients(); unsubUsers(); };
  }, []);

  // Fetch Routine Templates
  useEffect(() => {
    const unsubTemplates = onSnapshot(collection(db, 'routineTemplates'), (snapshot) => {
      setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubTemplates();
  }, []);

  useEffect(() => {
    cancelEdit();
    if (!selectedClient) {
      setExistingRoutines([]);
      return;
    }
    const q = query(collection(db, "routines"), where("clientId", "==", selectedClient.id));
    return onSnapshot(q, (snapshot) => {
      setExistingRoutines(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
  }, [selectedClient]);

  const addStep = () => setSteps([...steps, { title: '', instructions: '' }]);
  const removeStep = (index: number) => {
    if (steps.length > 1) setSteps(steps.filter((_, i) => i !== index));
    else Alert.alert("Error", "At least one step is required.");
  };

  const updateStep = (index: number, key: 'title' | 'instructions', value: string) => {
    const newSteps = [...steps];
    newSteps[index][key] = value;
    setSteps(newSteps);
  };

  const loadRoutineForEditing = (routine: any) => {
    setEditingRoutineId(routine.id);
    setRoutineType(routine.type || "Morning");
    setDuration(routine.duration || "");
    setSteps(routine.steps || [{ title: '', instructions: '' }]);
  };

  const cancelEdit = () => {
    setEditingRoutineId(null);
    setRoutineType("Morning");
    setDuration("");
    setSteps([{ title: '', instructions: '' }]);
  };

const handleDelete = async (id?: string) => {
    const targetId = id || editingRoutineId;
    if (!targetId) return;

    const performDelete = async () => {
      try {
        // 1. Initialize a Firebase Batch
        const batch = writeBatch(db);

        // 2. Queue the Routine for deletion
        const routineRef = doc(db, "routines", targetId);
        batch.delete(routineRef);

        // 3. Find all logs tied to this routine
        const logsQuery = query(
          collection(db, "routineLogs"),
          where("routineID", "==", targetId)
        );
        const logsSnapshot = await getDocs(logsQuery);

        // 4. Queue each log for deletion
        logsSnapshot.forEach((logDoc) => {
          batch.delete(logDoc.ref);
        });

        // 5. Execute all deletions at exactly the same time
        await batch.commit();

        if (targetId === editingRoutineId) cancelEdit();
        if (Platform.OS !== 'web') Alert.alert("Success", "Routine and associated history deleted.");
      } catch (error: any) {
        Alert.alert("Error", error.message);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Delete this routine and all its history?")) performDelete();
      return;
    }

    Alert.alert("Confirm Delete", "Are you sure? This will also remove all logs associated with this routine.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: performDelete }
    ]);
  };
  const handleLoadTemplate = (template: any) => {
    setSelectedTemplate(template);
    setRoutineType(template.type || "Morning");
    setDuration(template.duration || "");
    setSteps(template.steps || [{ title: '', instructions: '' }]);
  };

  const handleSaveTemplate = async () => {
    if (!duration.trim() || steps.length === 0 || !steps[0].title.trim()) {
      return Alert.alert("Error", "Please fill out the routine duration and at least one step.");
    }
    try {
      await addDoc(collection(db, 'routineTemplates'), {
        type: routineType,
        duration: duration.trim(),
        description: `${routineType} Routine (${duration})`,
        steps: steps.map(s => ({ title: s.title.trim(), instructions: s.instructions.trim() })),
        createdAt: Timestamp.now()
      });
      if (Platform.OS !== 'web') Alert.alert("Success", "Saved to Template Library!");
      else alert("Saved to Template Library!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleAssign = async () => {
    if (!selectedClient) return Alert.alert("Error", "Select a client.");
    
    try {
      const routineData = {
        clientId: selectedClient.id,
        type: routineType,
        duration: duration.trim(), // Save Duration
        assignedDate: Timestamp.now(),
        description: `${routineType} Routine ${duration ? `(${duration})` : ''}`,
        steps: steps.map(s => ({ title: s.title.trim(), instructions: s.instructions.trim() }))
      };

      if (editingRoutineId) {
        await updateDoc(doc(db, "routines", editingRoutineId), routineData);
        Alert.alert("Success", "Updated successfully.");
        cancelEdit();
      } else {
        // Check for duplicate type (Prevent 2 Morning routines for same client)
        const exists = existingRoutines.find(r => r.type === routineType);
        if (exists) return Alert.alert("Conflict", `A ${routineType} routine already exists.`);
        
        await addDoc(collection(db, 'routines'), routineData);
        Alert.alert("Success", "Assigned successfully.");
        setSteps([{ title: '', instructions: '' }]);
        setDuration("");
      }
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
        </View>

        <View style={styles.content}>
          <SearchableSelect label="1. Select Client" placeholder="Choose a client..." data={clients} selectedItem={selectedClient} onSelect={setSelectedClient} displayKey="fullName" />

          {selectedClient && existingRoutines.length > 0 && (
            <View style={styles.existingRoutinesSection}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="list" size={20} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Assigned Routines</Text>
                <View style={styles.routineCountBadge}>
                  <Text style={styles.routineCountText}>{existingRoutines.length}</Text>
                </View>
              </View>
              {existingRoutines.map((routine, index) => (
                <View key={routine.id} style={[styles.existingRoutineCard, editingRoutineId === routine.id && styles.activeEditingCard]}>
                  {/* Routine Status Badge */}
                  <View style={styles.routineCardTop}>
                    <View style={styles.routineTypeBadge}>
                      <Ionicons 
                        name={routine.type === 'Morning' ? 'sunny' : 'moon'} 
                        size={16} 
                        color={COLORS.white} 
                      />
                      <Text style={styles.routineTypeText}>{routine.type}</Text>
                    </View>
                    <Text style={styles.routineNumber}>#{index + 1}</Text>
                  </View>

                  {/* Routine Details */}
                  <View style={styles.routineDetails}>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Description</Text>
                        <Text style={styles.routineTitleText}>{routine.description || `${routine.type} Routine`}</Text>
                      </View>
                    </View>

                    <View style={styles.detailsGrid}>
                      <View style={styles.detailItem}>
                        <Ionicons name="calendar" size={14} color={COLORS.primary} />
                        <Text style={styles.detailLabel}>Assigned</Text>
                        <Text style={styles.detailValue}>
                          {routine.assignedDate?.toDate().toLocaleDateString()}
                        </Text>
                      </View>

                      {routine.duration && (
                        <View style={styles.detailItem}>
                          <Ionicons name="timer" size={14} color={COLORS.primary} />
                          <Text style={styles.detailLabel}>Duration</Text>
                          <Text style={styles.detailValue}>{routine.duration}</Text>
                        </View>
                      )}

                      <View style={styles.detailItem}>
                        <Ionicons name="checkmark-done" size={14} color={COLORS.primary} />
                        <Text style={styles.detailLabel}>Steps</Text>
                        <Text style={styles.detailValue}>{routine.steps?.length || 0}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.cardActions}>
                    <Pressable 
                      onPress={() => loadRoutineForEditing(routine)} 
                      style={[styles.cardActionBtn, styles.editBtn]}
                    >
                      <Ionicons name="create-outline" size={16} color={COLORS.white} />
                      <Text style={styles.actionBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable 
                      onPress={() => handleDelete(routine.id)} 
                      style={[styles.cardActionBtn, styles.deleteBtn]}
                    >
                      <Ionicons name="trash-outline" size={16} color={COLORS.white} />
                      <Text style={styles.actionBtnText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.selectContainer}>
            <Text style={styles.selectLabel}>2. Routine Schedule & Duration</Text>
            <View style={styles.typeToggleContainer}>
              {(["Morning", "Night"] as const).map((type) => (
                <Pressable
                  key={type}
                  style={[styles.typeOption, routineType === type && styles.typeOptionActive]}
                  onPress={() => setRoutineType(type)}
                >
                  <Ionicons name={type === "Morning" ? "sunny" : "moon"} size={18} color={routineType === type ? COLORS.white : COLORS.textSecondary} />
                  <Text style={[styles.typeText, routineType === type && styles.typeTextActive]}>{type}</Text>
                </Pressable>
              ))}
            </View>
            
            {/* NEW Duration Input */}
            <TextInput
              style={[styles.input, {marginTop: 10}]}
              placeholder="Duration (e.g. 4 Weeks or Continuous)"
              placeholderTextColor={COLORS.textSecondary}
              value={duration}
              onChangeText={setDuration}
            />
          </View>

         {/* --- NEW TEMPLATE SECTION --- */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <Text style={styles.sectionTitle}>3. Define Steps</Text>
            <Pressable onPress={handleSaveTemplate}>
              <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 12 }}>+ Save as Template</Text>
            </Pressable>
          </View>

          {templates.length > 0 && (
            <SearchableSelect 
              label="Load from Library (Optional)" 
              placeholder="Select a saved template..." 
              data={templates} 
              selectedItem={selectedTemplate} 
              onSelect={handleLoadTemplate} 
              displayKey="description" 
            />
          )}
          {/* ---------------------------- */}
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
              <TextInput style={styles.input} placeholder="Step Title" placeholderTextColor={COLORS.textSecondary} value={step.title} onChangeText={(text) => updateStep(index, 'title', text)} />
              <TextInput style={[styles.input, styles.textArea]} placeholder="Instructions..." placeholderTextColor={COLORS.textSecondary} multiline value={step.instructions} onChangeText={(text) => updateStep(index, 'instructions', text)} />
            </View>
          ))}

          <Pressable style={styles.addStepBtn} onPress={addStep}>
            <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.addStepText}>Add Another Step</Text>
          </Pressable>

          <View style={styles.actionButtons}>
            <Pressable style={editingRoutineId ? styles.updateBtn : styles.assignBtn} onPress={handleAssign}>
              <Text style={styles.assignBtnText}>{editingRoutineId ? "Update Routine" : "Assign Routine"}</Text>
            </Pressable>
            {editingRoutineId && <Pressable style={styles.cancelBtn} onPress={cancelEdit}><Text style={styles.cancelBtnText}>Cancel Edit</Text></Pressable>}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40 },
  headerRow: { marginBottom: 20 },
  backButtonText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: "600" },
  content: { gap: 20 },
  selectContainer: { gap: 8 },
  selectLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "700", textTransform: 'uppercase' },
  selectButton: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.card, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  selectButtonText: { color: COLORS.textPrimary, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "70%", padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "bold" },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.inputBackground, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 15 },
  searchInput: { flex: 1, paddingVertical: 12, color: COLORS.textPrimary, fontSize: 16 },
  listContent: { paddingBottom: 20 },
  optionItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  optionSelected: { backgroundColor: COLORS.inputBackground },
  optionText: { color: COLORS.textPrimary, fontSize: 16 },
  optionTextSelected: { color: COLORS.primary, fontWeight: "bold" },
  emptyText: { color: COLORS.textSecondary, textAlign: "center", marginTop: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 1 },
  typeToggleContainer: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: COLORS.border },
  typeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 8 },
  typeOptionActive: { backgroundColor: COLORS.primary },
  typeText: { color: COLORS.textSecondary, fontWeight: '700' },
  typeTextActive: { color: COLORS.white },
  stepCard: { padding: 15, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 15 },
  stepCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  stepLabel: { fontSize: 11, color: COLORS.border, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: COLORS.border, padding: 14, borderRadius: 10, backgroundColor: COLORS.inputBackground, color: COLORS.textPrimary },
  textArea: { height: 80, textAlignVertical: 'top', marginTop: 10 },
  addStepBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10 },
  addStepText: { color: COLORS.primary, fontWeight: '700', marginLeft: 6 },
  actionButtons: { gap: 10 },
  assignBtn: { backgroundColor: COLORS.border, padding: 16, borderRadius: 12, alignItems: "center" },
  updateBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: "center" },
  assignBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { padding: 12, alignItems: "center" },
  cancelBtnText: { color: "#ff4d4d", fontWeight: "600" },
  existingRoutinesSection: { gap: 12, marginBottom: 20, marginTop: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  routineCountBadge: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 'auto' },
  routineCountText: { color: COLORS.white, fontWeight: '800', fontSize: 12 },
  existingRoutineCard: { 
    backgroundColor: COLORS.card, 
    padding: 14, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    gap: 12
  },
  activeEditingCard: { borderColor: COLORS.primary, backgroundColor: 'rgba(212, 165, 116, 0.05)' },
  routineCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routineTypeBadge: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6
  },
  routineTypeText: { color: COLORS.white, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  routineNumber: { color: COLORS.primary, fontWeight: '800', fontSize: 16 },
  routineDetails: { gap: 10 },
  detailRow: { gap: 8 },
  detailsGrid: { 
    flexDirection: 'row', 
    gap: 10,
    justifyContent: 'space-between'
  },
  detailItem: { 
    flex: 1,
    gap: 4,
    backgroundColor: COLORS.inputBackground,
    padding: 10,
    borderRadius: 10,
    alignItems: 'flex-start'
  },
  detailLabel: { 
    fontSize: 10, 
    color: COLORS.textSecondary, 
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  detailValue: { 
    fontSize: 13, 
    color: COLORS.textPrimary, 
    fontWeight: '700'
  },
  routineTitleText: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 14 },
  infoText: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  durationText: { color: COLORS.primary, fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cardActionBtn: { 
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 6
  },
  editBtn: { backgroundColor: COLORS.primary },
  deleteBtn: { backgroundColor: '#E53935' },
  actionBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 12 }
});