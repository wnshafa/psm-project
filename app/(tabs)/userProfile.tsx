import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { COLORS } from "../src/constants/theme";
import { auth, db } from "../src/lib/firebase";

const SKIN_TYPES = ["Oily", "Dry", "Combination", "Normal", "Sensitive"];
const SKIN_CONCERNS = ["Acne", "Aging", "Hyperpigmentation", "Dryness", "Sensitivity", "Pores"];

export default function UserProfile() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [streak, setStreak] = useState(0);
  
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [skinConcern, setSkinConcern] = useState("");
  const [skinType, setSkinType] = useState("");

  // UI State for Modals
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [concernModalVisible, setConcernModalVisible] = useState(false);

  useEffect(() => {
    let unsubUser: (() => void) | undefined;
    let unsubClient: (() => void) | undefined;
  
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setEmail("");
        setName("");
        setStreak(0);
        setAge("");
        setSkinConcern("");
        setSkinType("");
        return;
      }
  
      setEmail(user.email || "");
  
      unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name || "");
          setStreak(data.streak || 0);
        }
      });
  
      unsubClient = onSnapshot(doc(db, "clients", user.uid), (snap) => {
        if (snap.exists()) {
          const cData = snap.data();
          setAge(cData.age?.toString() || "");
          setSkinConcern(cData.skinConcern || "");
          setSkinType(cData.skinType || "");
        }
      });
    });
  
    return () => {
      unsubscribeAuth();
      unsubUser?.();
      unsubClient?.();
    };
  }, []);
  
  
  const handleUpdateProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
  
    try {
      // Update basic user info
      await setDoc(doc(db, 'users', user.uid), { 
        name 
      }, { merge: true });
  
      // Update detailed skin info
      await setDoc(doc(db, 'clients', user.uid), {
        userId: user.uid, // REQUIRED by your security rules
        age,
        skinConcern,
        skinType,
        updatedAt: new Date()
      }, { merge: true });
  
      Alert.alert("Success", "Profile updated!");
    } catch (error: any) {
      console.error("Save Error:", error);
      Alert.alert("Error", "Save failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Logout", 
        style: "destructive", 
        onPress: async () => {
          try {
            // Just sign out. The Root Layout will see this and redirect the user.
            await signOut(auth);
Alert.alert("Signed out", "Auth state cleared");

          } catch (error) {
            console.error("Logout error:", error);
            Alert.alert("Error", "Logout failed");
          }
        } 
      }
    ]);
  };
  // Reusable Selection Modal Component
  const SelectionModal = ({ visible, data, onSelect, onClose, title }: any) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={data}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <Pressable 
                style={styles.modalItem} 
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={styles.modalItemText}>{item}</Text>
              </Pressable>
            )}
          />
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header with Logout Button */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>User Profile</Text>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{email.charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.nameDisplay}>{name || "User"}</Text>
          <Text style={styles.emailDisplay}>{email}</Text>
          
          <View style={styles.streakBadge}>
             <Text style={styles.streakText}>🔥 {streak} Day Streak</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Details</Text>
          
          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />

          <Text style={styles.inputLabel}>Age</Text>
          <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="numeric" />

          {/* Skin Type Picker Trigger */}
          <Text style={styles.inputLabel}>Skin Type</Text>
          <Pressable style={styles.pickerTrigger} onPress={() => setTypeModalVisible(true)}>
            <Text style={skinType ? styles.pickerText : styles.pickerPlaceholder}>
              {skinType || "Select Skin Type"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
          </Pressable>

          {/* Skin Concern Picker Trigger */}
          <Text style={styles.inputLabel}>Skin Concern</Text>
          <Pressable style={styles.pickerTrigger} onPress={() => setConcernModalVisible(true)}>
            <Text style={skinConcern ? styles.pickerText : styles.pickerPlaceholder}>
              {skinConcern || "Select Concern"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
          </Pressable>

          <Pressable style={styles.primaryButton} onPress={handleUpdateProfile} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save Changes</Text>}
          </Pressable>
        </View>
      </ScrollView>

      {/* Selection Modals */}
      <SelectionModal 
        visible={typeModalVisible} 
        data={SKIN_TYPES} 
        title="Select Skin Type"
        onSelect={setSkinType} 
        onClose={() => setTypeModalVisible(false)} 
      />
      <SelectionModal 
        visible={concernModalVisible} 
        data={SKIN_CONCERNS} 
        title="Select Primary Concern"
        onSelect={setSkinConcern} 
        onClose={() => setConcernModalVisible(false)} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: "700" },
  logoutButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: "rgba(230, 57, 70, 0.1)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  logoutButtonText: { color: COLORS.danger, marginLeft: 6, fontWeight: '600', fontSize: 14 },
  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 10 },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 24 },
  nameDisplay: { textAlign: "center", color: COLORS.textPrimary, fontWeight: "700", fontSize: 20 },
  emailDisplay: { textAlign: "center", color: COLORS.textSecondary, fontSize: 14, marginBottom: 10 },
  streakBadge: { alignSelf: 'center', backgroundColor: COLORS.inputBackground, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  streakText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' },
  cardTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 15 },
  inputLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "600", marginBottom: 6, textTransform: "uppercase" },
  input: { backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, color: COLORS.textPrimary, marginBottom: 15 },
  
  // Picker Styles
  pickerTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, marginBottom: 15 },
  pickerText: { color: COLORS.textPrimary, fontSize: 15 },
  pickerPlaceholder: { color: COLORS.textSecondary, fontSize: 15 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '50%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 15, textAlign: 'center' },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalItemText: { fontSize: 16, color: COLORS.textPrimary, textAlign: 'center' },
  closeButton: { marginTop: 10, padding: 15, alignItems: 'center' },
  closeButtonText: { color: COLORS.primary, fontWeight: '700' },

  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 10 },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});