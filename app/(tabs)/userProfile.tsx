import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, setDoc, Timestamp, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../src/constants/theme";
import { SKIN_METRICS } from '../../src/constants/metrics';
import { auth, db, storage } from "../../src/lib/firebase";

const SKIN_TYPES = ["Oily", "Dry", "Combination", "Normal", "Sensitive"];
const SKIN_CONCERNS = ["Acne", "Aging", "Hyperpigmentation", "Dryness", "Sensitivity", "Pores"];

const SKIN_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  oily:        { bg: '#fff3cd', text: '#856404' },
  dry:         { bg: '#cfe2ff', text: '#084298' },
  combination: { bg: '#d1e7dd', text: '#0a3622' },
  normal:      { bg: '#e2d9f3', text: '#432874' },
  sensitive:   { bg: '#f8d7da', text: '#842029' },
};

const CONCERN_COLORS: Record<string, { bg: string; text: string }> = {
  acne:             { bg: '#f8d7da', text: '#842029' },
  aging:            { bg: '#e2d9f3', text: '#432874' },
  hyperpigmentation:{ bg: '#fff3cd', text: '#856404' },
  dryness:          { bg: '#cfe2ff', text: '#084298' },
  sensitivity:      { bg: '#fde8d8', text: '#7a3200' },
  pores:            { bg: '#d1e7dd', text: '#0a3622' },
};

export default function UserProfile() {
  const [email, setEmail] = useState("");
  const [fullName, setName] = useState("");
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [skinType, setSkinType] = useState("");
  const [skinConcern, setSkinConcern] = useState("");
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSkinType, setEditSkinType] = useState("");
  const [editSkinConcern, setEditSkinConcern] = useState("");
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [concernModalVisible, setConcernModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Report data
  const [weeklyLogs, setWeeklyLogs] = useState<any[]>([]);
  const [skinMetrics, setSkinMetrics] = useState<{ label: string; value: number; color: string }[] | null>(null);
  const [skinDate, setSkinDate] = useState<string | null>(null);

  useEffect(() => {
    let unsubUser: (() => void) | undefined;
    let unsubClient: (() => void) | undefined;
    let unsubWeekly: (() => void) | undefined;
    let unsubSkin: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      setEmail(user.email || "");

      unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setName(data.fullName || data.name || "");
        }
      });

      unsubClient = onSnapshot(doc(db, "clients", user.uid), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setEditAge(d.age?.toString() || "");
          setEditPhone(d.phoneNumber || "");
          setSkinType(d.skinType || "");
          setSkinConcern(d.skinConcern || "");
          setEditSkinType(d.skinType || "");
          setEditSkinConcern(d.skinConcern || "");
          setStreak(d.streak || 0);
          setTotalCompleted(d.totalCompleted || 0);
          setPhotoURL(d.photoURL || null);
        }
      });

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      unsubWeekly = onSnapshot(
        query(collection(db, 'routineLogs'), where('clientId', '==', user.uid), where('logDate', '>=', Timestamp.fromDate(sevenDaysAgo))),
        (snap) => setWeeklyLogs(snap.docs.map(d => d.data()))
      );

      unsubSkin = onSnapshot(
        query(collection(db, 'skinLogs'), where('clientId', '==', user.uid), orderBy('date', 'desc')),
        (snap) => {
          if (!snap.empty) {
            const data = snap.docs[0].data();
            setSkinMetrics(SKIN_METRICS.map(m => ({ label: m.label, color: m.color, value: data[m.key] ?? 50 })));
            const d = data.date?.toDate();
            if (d) setSkinDate(d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));
          }
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubUser?.();
      unsubClient?.();
      unsubWeekly?.();
      unsubSkin?.();
    };
  }, []);

  const handlePickPhoto = () => {
    Alert.alert("Profile Photo", "Choose a photo source", [
      {
        text: "Camera", onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Camera access is required."); return; }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
          if (!result.canceled) await uploadPhoto(result.assets[0].uri);
        }
      },
      {
        text: "Photo Library", onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Photo library access is required."); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
          if (!result.canceled) await uploadPhoto(result.assets[0].uri);
        }
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const uploadPhoto = async (uri: string) => {
    const user = auth.currentUser;
    if (!user) return;
    setUploadingPhoto(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `profilePictures/${user.uid}/avatar.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      await setDoc(doc(db, "clients", user.uid), { photoURL: url }, { merge: true });
      setPhotoURL(url);
    } catch (e: any) {
      Alert.alert("Upload failed", e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openEditModal = () => {
    setEditName(fullName);
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'clients', user.uid), {
        fullName: editName,
        age: editAge,
        phoneNumber: editPhone,
        skinType: editSkinType,
        skinConcern: editSkinConcern,
        updatedAt: new Date(),
      }, { merge: true });
      setEditModalVisible(false);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout", style: "destructive",
        onPress: async () => {
          await signOut(auth);
          router.replace("/(auth)/login");
        }
      }
    ]);
  };

  const skinTypeStyle = SKIN_TYPE_COLORS[String(skinType ?? '').toLowerCase()] ?? { bg: COLORS.inputBackground, text: COLORS.textSecondary };
  const skinConcernStyle = CONCERN_COLORS[String(skinConcern ?? '').toLowerCase()] ?? { bg: COLORS.inputBackground, text: COLORS.textSecondary };

  const weeklyCompleted = weeklyLogs.filter(l => l.status === 'completed').length;
  const adherencePct = weeklyLogs.length > 0 ? Math.round((weeklyCompleted / weeklyLogs.length) * 100) : 0;

  const SelectionModal = ({ visible, data, selected, onSelect, onClose, title }: any) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={data}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <Pressable style={[styles.modalItem, selected === item && styles.modalItemSelected]} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={[styles.modalItemText, selected === item && styles.modalItemTextSelected]}>{item}</Text>
                {selected === item && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
              </Pressable>
            )}
          />
          <Pressable style={styles.modalCancelBtn} onPress={onClose}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          </Pressable>
        </View>

        {/* Avatar Card */}
        <View style={styles.avatarCard}>
          <Pressable style={styles.avatarWrapper} onPress={handlePickPhoto} disabled={uploadingPhoto}>
            <View style={styles.avatarCircle}>
              {uploadingPhoto ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{(fullName || email).charAt(0).toUpperCase()}</Text>
              )}
            </View>
            {!uploadingPhoto && (
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={13} color="#fff" />
              </View>
            )}
          </Pressable>
          <Text style={styles.nameText}>{fullName || "User"}</Text>
          <Text style={styles.emailText}>{email}</Text>

          {/* Skin Pills */}
          <View style={styles.pillsRow}>
            {skinType ? (
              <View style={[styles.pill, { backgroundColor: skinTypeStyle.bg }]}>
                <Ionicons name="water-outline" size={12} color={skinTypeStyle.text} />
                <Text style={[styles.pillText, { color: skinTypeStyle.text }]}>{skinType} Skin</Text>
              </View>
            ) : null}
            {skinConcern ? (
              <View style={[styles.pill, { backgroundColor: skinConcernStyle.bg }]}>
                <Ionicons name="alert-circle-outline" size={12} color={skinConcernStyle.text} />
                <Text style={[styles.pillText, { color: skinConcernStyle.text }]}>{skinConcern}</Text>
              </View>
            ) : null}
            {!skinType && !skinConcern && (
              <Pressable style={[styles.pill, { backgroundColor: COLORS.inputBackground }]} onPress={openEditModal}>
                <Text style={[styles.pillText, { color: COLORS.textSecondary }]}>Set skin profile →</Text>
              </Pressable>
            )}
          </View>

          <Pressable style={styles.editBtn} onPress={openEditModal}>
            <Ionicons name="create-outline" size={15} color={COLORS.primary} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="flame" size={20} color="#ff6b6b" />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={20} color="#51cf66" />
            <Text style={styles.statValue}>{totalCompleted}</Text>
            <Text style={styles.statLabel}>Total Done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
            <Text style={styles.statValue}>{weeklyCompleted}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
        </View>

        {/* My Report */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>My Report</Text>

          {/* Adherence */}
          <View style={styles.adherenceRow}>
            <Text style={styles.adherenceLabel}>7-Day Adherence</Text>
            <Text style={styles.adherencePct}>{weeklyLogs.length > 0 ? `${adherencePct}%` : '—'}</Text>
          </View>
          <View style={styles.adherenceTrack}>
            <View style={[styles.adherenceFill, { flex: weeklyLogs.length > 0 ? adherencePct / 100 : 0 }]} />
          </View>
          <Text style={styles.adherenceSub}>{weeklyCompleted} of {weeklyLogs.length} routines completed this week</Text>

          <View style={styles.divider} />

          {/* Skin Summary */}
          <View style={styles.skinHeader}>
            <Text style={styles.adherenceLabel}>Latest Skin Analysis</Text>
            {skinDate && <Text style={styles.skinDate}>{skinDate}</Text>}
          </View>
          {skinMetrics ? (
            <View style={styles.skinBars}>
              {skinMetrics.map((m) => (
                <View key={m.label} style={styles.skinRow}>
                  <Text style={styles.skinLabel}>{m.label}</Text>
                  <View style={styles.skinTrack}>
                    <View style={[styles.skinFill, { flex: m.value / 100, backgroundColor: m.color }]} />
                    <View style={{ flex: 1 - m.value / 100 }} />
                  </View>
                  <Text style={styles.skinValue}>{m.value}%</Text>
                </View>
              ))}
            </View>
          ) : (
            <Pressable style={styles.skinEmpty} onPress={() => router.push('/skinChartAnalysis')}>
              <Ionicons name="camera-outline" size={18} color={COLORS.border} />
              <Text style={styles.skinEmptyText}>No scan yet — tap to analyze</Text>
            </Pressable>
          )}
        </View>

      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.editSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.editHeader}>
              <Text style={styles.editSheetTitle}>Edit Profile</Text>
              <Pressable onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholderTextColor={COLORS.textSecondary} />

              <Text style={styles.inputLabel}>Age</Text>
              <TextInput style={styles.input} value={editAge} onChangeText={setEditAge} keyboardType="numeric" placeholderTextColor={COLORS.textSecondary} />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput style={styles.input} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" placeholder="+60 12-345 6789" placeholderTextColor={COLORS.textSecondary} />

              <Text style={styles.inputLabel}>Skin Type</Text>
              <Pressable style={styles.picker} onPress={() => setTypeModalVisible(true)}>
                <Text style={editSkinType ? styles.pickerText : styles.pickerPlaceholder}>{editSkinType || "Select Skin Type"}</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                      <SelectionModal visible={typeModalVisible} data={SKIN_TYPES} selected={editSkinType} title="Select Skin Type" onSelect={setEditSkinType} onClose={() => setTypeModalVisible(false)} />
              </Pressable>

              <Text style={styles.inputLabel}>Skin Concern</Text>
              <Pressable style={styles.picker} onPress={() => setConcernModalVisible(true)}>
                <Text style={editSkinConcern ? styles.pickerText : styles.pickerPlaceholder}>{editSkinConcern || "Select Concern"}</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                <SelectionModal visible={concernModalVisible} data={SKIN_CONCERNS} selected={editSkinConcern} title="Select Primary Concern" onSelect={setEditSkinConcern} onClose={() => setConcernModalVisible(false)} />
              </Pressable>

              <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  logoutBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(230,57,70,0.1)', alignItems: 'center', justifyContent: 'center' },

  // Avatar Card
  avatarCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border },
  avatarWrapper: { position: 'relative', marginBottom: 4 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.card },
  nameText: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  emailText: { fontSize: 13, color: COLORS.textSecondary },
  pillsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pillText: { fontSize: 12, fontWeight: '700' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary },
  editBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },

  // Stats
  statsRow: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, textTransform: 'uppercase', fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: COLORS.border },

  // Card
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  divider: { height: 1, backgroundColor: COLORS.border },

  // Adherence
  adherenceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  adherenceLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  adherencePct: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  adherenceTrack: { height: 8, backgroundColor: COLORS.inputBackground, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' },
  adherenceFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  adherenceSub: { fontSize: 11, color: COLORS.textSecondary },

  // Skin
  skinHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skinDate: { fontSize: 11, color: COLORS.textSecondary },
  skinBars: { gap: 8 },
  skinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skinLabel: { width: 72, fontSize: 11, color: COLORS.textSecondary },
  skinTrack: { flex: 1, flexDirection: 'row', height: 7, backgroundColor: COLORS.inputBackground, borderRadius: 4, overflow: 'hidden' },
  skinFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  skinValue: { width: 32, fontSize: 11, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'right' },
  skinEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  skinEmptyText: { fontSize: 12, color: COLORS.textSecondary },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '60%' },
  editSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 16 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalItemSelected: { backgroundColor: 'rgba(212,165,116,0.08)', paddingHorizontal: 8, borderRadius: 8 },
  modalItemText: { fontSize: 16, color: COLORS.textPrimary },
  modalItemTextSelected: { color: COLORS.primary, fontWeight: '700' },
  modalCancelBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  modalCancelText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },

  // Edit Sheet
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  editSheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  inputLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 13, color: COLORS.textPrimary, marginBottom: 14, fontSize: 15 },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, marginBottom: 14 },
  pickerText: { color: COLORS.textPrimary, fontSize: 15 },
  pickerPlaceholder: { color: COLORS.textSecondary, fontSize: 15 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 6, marginBottom: 20 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
