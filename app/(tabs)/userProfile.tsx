import { router } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

export default function UserProfile() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [streak, setStreak] = useState(0);
  
  // New State for Editable Fields
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [skinConcern, setSkinConcern] = useState("");
  const [skinType, setSkinType] = useState("");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setEmail(user.email || "");
        
        // 1. Listen to 'users' collection for name and streak
        const unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setName(data.name || "");
            setStreak(data.streak || 0);
          }
        });

        // 2. Fetch 'clients' collection for skin details
        const clientSnap = await getDoc(doc(db, 'clients', user.uid));
        if (clientSnap.exists()) {
          const cData = clientSnap.data();
          setAge(cData.age || "");
          setSkinConcern(cData.skinConcern || "");
          setSkinType(cData.skinType || "");
        }

        return () => unsubUser();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleUpdateProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      // Update 'users' collection (Name)
      await updateDoc(doc(db, 'users', user.uid), {
        name: name,
      });

      // Update 'clients' collection (Age, Skin Concern, Skin Type)
      await updateDoc(doc(db, 'clients', user.uid), {
        age: age,
        skinConcern: skinConcern,
        skinType: skinType
      });

      Alert.alert("Success", "Profile updated successfully!");
    } catch (error: any) {
      Alert.alert("Update Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch (error: any) {
      Alert.alert("Logout Error", error.message);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.logo}>PrestigeMy</Text>
          <Pressable onPress={handleLogout} style={styles.linkButton}>
            <Text style={styles.linkButtonText}>Log out</Text>
          </Pressable>
        </View>

        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{email.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.nameDisplay}>{name || "Prestige Member"}</Text>
          <Text style={styles.emailDisplay}>{email}</Text>

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{streak}</Text>
              <Text style={styles.statLabel}>Day streak</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>Active</Text>
              <Text style={styles.statLabel}>Status</Text>
            </View>
          </View>
        </View>

        {/* Editable Fields Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Edit Personal Details</Text>
          
          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput 
            style={styles.input} 
            value={name} 
            onChangeText={setName} 
            placeholder="Enter your name"
          />

          <Text style={styles.inputLabel}>Age</Text>
          <TextInput 
            style={styles.input} 
            value={age} 
            onChangeText={setAge} 
            keyboardType="numeric"
            placeholder="e.g. 25"
          />

          <Text style={styles.inputLabel}>Skin Concern</Text>
          <TextInput 
            style={styles.input} 
            value={skinConcern} 
            onChangeText={setSkinConcern} 
            placeholder="e.g. Acne, Dryness"
          />

          <Text style={styles.inputLabel}>Skin Type</Text>
          <TextInput 
            style={styles.input} 
            value={skinType} 
            onChangeText={setSkinType} 
            placeholder="e.g. Oily, Sensitive"
          />

          <Pressable 
            style={styles.primaryButton} 
            onPress={handleUpdateProfile}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save Changes</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { color: COLORS.textPrimary, letterSpacing: 2, fontSize: 16, fontWeight: "700", textTransform: "uppercase" },
  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 18, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", alignSelf: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 24 },
  nameDisplay: { textAlign: "center", color: COLORS.textPrimary, fontWeight: "700", fontSize: 20 },
  emailDisplay: { textAlign: "center", color: COLORS.textSecondary, fontSize: 14, marginBottom: 10 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 20, justifyContent: "center" },
  stat: { alignItems: "center" },
  statValue: { color: COLORS.textPrimary, fontWeight: "800", fontSize: 18 },
  statLabel: { color: COLORS.textSecondary, fontSize: 12 },
  divider: { width: 1, height: 30, backgroundColor: COLORS.border },
  cardTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 10 },
  inputLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 4, textTransform: "uppercase" },
  input: { backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, color: COLORS.textPrimary, marginBottom: 15 },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 10 },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.inputBackground },
  linkButtonText: { color: COLORS.textPrimary, fontWeight: "700", fontSize: 13 },
});