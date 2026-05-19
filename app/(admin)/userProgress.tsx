import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection,
  doc,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  QuerySnapshot,
  Timestamp,
  updateDoc,
  where
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING } from '../../src/constants/theme';
import { db } from "../../src/lib/firebase";
import { SkinPhoto, UserData, UserLog } from "../../src/types";

export default function UserProgress() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userLogs, setUserLogs] = useState<UserLog[]>([]);
  const [userPhotos, setUserPhotos] = useState<SkinPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  // --- New States for Feedback Feature ---
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<SkinPhoto | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // 1. Fetch Clients (Real-time)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'clients'), (snapshot: QuerySnapshot<DocumentData>) => {
      const clientList = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...(doc.data() as Omit<UserData, 'id'>) 
      }));
      setUsers(clientList);
      filterUsers(clientList, searchQuery);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Fetch Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter users based on search query
  const filterUsers = (userList: UserData[], query: string) => {
    if (!query.trim()) {
      setFilteredUsers(userList);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = userList.filter(user => {
      const fullName = (user.fullName || user.name || "").toLowerCase();
      const email = (user.email || "").toLowerCase();
      
      return fullName.includes(lowerQuery) || email.includes(lowerQuery);
    });

    setFilteredUsers(filtered);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    filterUsers(users, text);
  };

  // 2. Fetch Logs and Photos for Selected User
  useEffect(() => {
    if (!selectedUser) {
      setUserLogs([]);
      setUserPhotos([]);
      return;
    }

    // Fetch Text Logs
    const logQuery = query(
      collection(db, 'routineLogs'),
      where('clientId', '==', selectedUser.id),
      orderBy('logDate', 'desc')
    );

    const unsubLogs = onSnapshot(logQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserLog[];
      setUserLogs(logs);
    });

    // Fetch Skin Photos
    const photoQuery = query(
      collection(db, 'skinLogs'),
      where('clientId', '==', selectedUser.id),
      orderBy('date', 'desc')
    );

    const unsubPhotos = onSnapshot(photoQuery, (snapshot) => {
      const photos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SkinPhoto[];
      setUserPhotos(photos);
    });

    return () => {
      unsubLogs();
      unsubPhotos();
    };
  }, [selectedUser]);

  // Helper to format timestamps
  const formatDate = (ts?: Timestamp | null) => {
    if (!ts || typeof ts.toDate !== 'function') return 'N/A';
    return ts.toDate().toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const handleSubmitFeedback = async () => {
    if (!selectedPhoto || !feedbackText.trim()) {
      Alert.alert("Error", "Please enter some feedback.");
      return;
    }

    setSubmittingFeedback(true);
    try {
      const photoRef = doc(db, 'skinLogs', selectedPhoto.id);
      await updateDoc(photoRef, {
        consultantFeedback: feedbackText.trim(),
        feedbackDate: Timestamp.now()
      });

      Alert.alert("Success", "Feedback saved successfully!");
      setFeedbackModalVisible(false);
      setFeedbackText("");
      setSelectedPhoto(null);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            <Text style={styles.backButtonText}> Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Monitor Progress</Text>
          <View style={{ width: 40 }} /> 
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} style={{ marginRight: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery ? (
            <Pressable onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <View style={styles.list}>
            {filteredUsers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={COLORS.border} />
                <Text style={styles.emptyText}>
                  {searchQuery ? "No clients found matching your search." : "No clients found."}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.resultsCount}>{filteredUsers.length} client{filteredUsers.length !== 1 ? 's' : ''} found</Text>
                {filteredUsers.map((user) => (
                  <Pressable 
                    key={user.id} 
                    style={styles.userCard}
                    onPress={() => setSelectedUser(user)}
                  >
                    <View style={styles.userInfo}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{(user.fullName || user.email || "U").charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.userDetails}>
                        <Text style={styles.userName}>{user.fullName || user.name || "Unnamed Client"}</Text>
                        <Text style={styles.userEmail}>{user.email || "No Email"}</Text>
                        <Text style={styles.routineSub}>{user.routineName || "No Routine"}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                    </View>
                    
                    <View style={styles.statsDivider} />
                    
                    <View style={styles.userStats}>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Streak</Text>
                        <Text style={styles.statValue}>🔥 {user.streak || 0} days</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Last Active</Text>
                        <Text style={[styles.statValue, {color: COLORS.textSecondary}]}>
                          {user.updatedAt?.toDate ? user.updatedAt.toDate().toLocaleDateString() : "N/A"}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        )}

        {/* --- User Details Modal --- */}
        <Modal
          visible={!!selectedUser}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedUser(null)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Consultant View</Text>
              <Pressable onPress={() => setSelectedUser(null)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>

            {selectedUser && (
              <ScrollView contentContainerStyle={styles.modalScroll}>
                <View style={styles.profileSection}>
                  <View style={styles.largeAvatar}>
                    <Text style={styles.largeAvatarText}>{(selectedUser.fullName || selectedUser.email || "U").charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.profileName}>{selectedUser.fullName || selectedUser.name}</Text>
                  <Text style={styles.profileEmail}>{selectedUser.email}</Text>
                  
                  <View style={styles.profileStatsRow}>
                    <View style={styles.profileStat}>
                      <Text style={styles.statValueLarge}>{selectedUser.streak || 0}</Text>
                      <Text style={styles.statLabel}>Days</Text>
                    </View>
                    <View style={styles.profileStat}>
                      <Text style={styles.statValueLarge}>{userLogs.length}</Text>
                      <Text style={styles.statLabel}>Logs</Text>
                    </View>
                  </View>
                </View>

                {/* Face Progress Gallery */}
                <Text style={styles.sectionHeader}>Skin Progress Photos</Text>
                {userPhotos.length === 0 ? (
                  <Text style={styles.emptyGalleryText}>No skin progress photos found.</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                    {userPhotos.map((photo) => (
                      <View key={photo.id} style={styles.photoCard}>
    <Image source={{ uri: photo.imageUrl }} style={styles.skinImage} />
    <Text style={styles.photoDate}>
      {photo.date?.toDate ? photo.date.toDate().toLocaleDateString() : 'N/A'}
    </Text>
    
    {/* Display existing feedback if it exists */}
    {photo.consultantFeedback && (
      <View style={styles.existingFeedbackContainer}>
        <Text style={styles.feedbackLabel}>Your Note:</Text>
        <Text style={styles.feedbackText} numberOfLines={3}>{photo.consultantFeedback}</Text>
      </View>
    )}

    {/* Feedback Button */}
    <Pressable 
      style={styles.feedbackBtn}
      onPress={() => {
        setSelectedPhoto(photo);
        setFeedbackText(photo.consultantFeedback || "");
        setFeedbackModalVisible(true);
      }}
    >
      <Text style={styles.feedbackBtnText}>
        {photo.consultantFeedback ? "Edit Feedback" : "+ Add Feedback"}
      </Text>
    </Pressable>
  </View>
                    ))}
                  </ScrollView>
                )}

                {/* Activity History */}
                <Text style={styles.sectionHeader}>Activity History</Text>
                {userLogs.length === 0 ? (
                  <Text style={styles.emptyText}>No logs recorded.</Text>
                ) : (
                  <View style={styles.logsList}>
                    {userLogs.map((log) => (
                      <View key={log.id} style={styles.logRow}>
                        <View style={styles.logIndicator} />
                        <View style={{ flex: 1 }}>
                           <Text style={styles.logDate}>{formatDate(log.logDate)}</Text>
                           <Text style={styles.logStatus}>Routine Completed</Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </Modal>
      </ScrollView>
      {/* --- Feedback Modal --- */}
        <Modal
          visible={feedbackModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setFeedbackModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
            <View style={{ backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
                <Text style={{ fontSize: FONT_SIZE.lg, fontWeight: "bold", color: COLORS.textPrimary }}>Consultant Feedback</Text>
                <Pressable onPress={() => setFeedbackModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </Pressable>
              </View>

              <TextInput
                style={{ backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, height: 100, textAlignVertical: 'top', color: COLORS.textPrimary }}
                multiline
                placeholder="Write your advice or observations here (e.g., 'Redness has reduced significantly!')..."
                placeholderTextColor={COLORS.textSecondary}
                value={feedbackText}
                onChangeText={setFeedbackText}
              />

              <Pressable
                style={{ backgroundColor: COLORS.primary, padding: 15, borderRadius: BORDER_RADIUS.md, marginTop: 20, alignItems: 'center' }}
                onPress={handleSubmitFeedback}
                disabled={submittingFeedback}
              >
                {submittingFeedback ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save Feedback</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, gap: SPACING.lg },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.sm },
  backButton: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  backButtonText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: "600" },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: "700", color: COLORS.textPrimary },
  
  feedbackBtn: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(212, 165, 116, 0.15)', borderRadius: 8, width: 140 },
  feedbackBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  existingFeedbackContainer: { marginTop: 8, padding: 8, backgroundColor: COLORS.inputBackground, borderRadius: 8, width: 140 },
  feedbackLabel: { fontSize: 10, fontWeight: 'bold', color: COLORS.textSecondary, marginBottom: 2 },
  feedbackText: { fontSize: 11, color: COLORS.textPrimary, fontStyle: 'italic' },
  // Search Bar
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.card, 
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.md, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    marginBottom: SPACING.md
  },
  searchInput: { 
    flex: 1, 
    fontSize: FONT_SIZE.md, 
    color: COLORS.textPrimary,
    paddingVertical: 0
  },
  resultsCount: { 
    fontSize: FONT_SIZE.sm, 
    color: COLORS.textSecondary, 
    fontWeight: '600',
    marginBottom: SPACING.md,
    textTransform: 'uppercase'
  },
  
  list: { gap: SPACING.md },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12
  },
  userCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.white, fontSize: FONT_SIZE.lg, fontWeight: "700" },
  userDetails: { flex: 1 },
  userName: { fontSize: FONT_SIZE.md, fontWeight: "700", color: COLORS.textPrimary },
  userEmail: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  routineSub: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  statsDivider: { height: 1, backgroundColor: COLORS.border },
  userStats: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { gap: 4 },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: "600" },
  statValue: { fontSize: FONT_SIZE.sm, fontWeight: "700", color: COLORS.textPrimary },
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: "bold", color: COLORS.textPrimary },
  closeButton: { padding: SPACING.xs },
  closeButtonText: { color: COLORS.primary, fontSize: FONT_SIZE.md, fontWeight: "600" },
  modalScroll: { padding: SPACING.lg },
  profileSection: { alignItems: 'center', marginBottom: SPACING.xl },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  largeAvatarText: { fontSize: 32, fontWeight: 'bold', color: COLORS.white },
  profileName: { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 4 },
  profileEmail: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  profileStatsRow: { flexDirection: 'row', gap: SPACING.xl },
  profileStat: { alignItems: 'center' },
  statValueLarge: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary },
  sectionHeader: { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: SPACING.md, marginTop: SPACING.md },
  photoList: { flexDirection: 'row', marginBottom: SPACING.xl },
  photoCard: { marginRight: SPACING.md, alignItems: 'center' },
  skinImage: { width: 140, height: 180, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  photoDate: { fontSize: 10, color: COLORS.textSecondary, marginTop: 6, fontWeight: '700' },
  emptyGalleryText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontStyle: 'italic', marginBottom: SPACING.xl, textAlign: 'center' },
  logsList: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  logRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.md },
  logIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  logDate: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, fontWeight: '600' },
  logStatus: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', fontSize: FONT_SIZE.md, fontWeight: '500' }
});