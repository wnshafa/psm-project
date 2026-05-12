import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { COLORS } from "../src/constants/theme";
import { auth, db } from "../src/lib/firebase";

export default function CreateAccount() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // --- States ---
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // --- Brand Colors ---
  const PRESTIGE_NAVY = COLORS.background;
  const PRESTIGE_GOLD = COLORS.primary;
  const SOFT_BACKGROUND = COLORS.card;

  const handleRegister = async () => {
    setErrorText(null);

    // 1. Validation
    if (!name.trim() || !email.trim() || !password.trim()) {
      const msg = "Please fill in all fields.";
      if (Platform.OS === 'web') setErrorText(msg);
      else Alert.alert("Required Fields", msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = "Passwords do not match.";
      if (Platform.OS === 'web') setErrorText(msg);
      else Alert.alert("Error", msg);
      return;
    }

    setLoading(true);
    try {
      // 2. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // 3. Create Firestore Records
      // We create a doc in 'users' for role-checking and 'clients' for data tracking
      const userData = {
        uid,
        fullName: name,
        email,
        role: 'client',
        createdAt: Timestamp.now(),
      };

      await setDoc(doc(db, "users", uid), userData);
      await setDoc(doc(db, "clients", uid), {
        ...userData,
        streak: 0,
        totalCompleted: 0,
      });

      router.replace("../(tabs)/homePage");
    } catch (error: any) {
      let errorMessage = "Registration failed. Please try again.";
      if (error.code === 'auth/email-already-in-use') errorMessage = "That email is already registered.";
      if (error.code === 'auth/weak-password') errorMessage = "Password should be at least 6 characters.";
      
      if (Platform.OS === 'web') setErrorText(errorMessage);
      else Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: SOFT_BACKGROUND }]}>
      <ScrollView contentContainerStyle={isDesktop ? styles.desktopScroll : styles.mobileScroll}>
        <View style={[styles.mainContainer, isDesktop ? styles.row : styles.column]}>
          
          {/* LEFT SIDE: BRANDING */}
          <View style={[styles.brandingSection, { backgroundColor: PRESTIGE_NAVY }, isDesktop ? styles.halfWidth : styles.fullWidth]}>
            <Image 
 
              style={isDesktop ? styles.logoWeb : styles.logoMobile}
              resizeMode="contain"
            />
            <Text style={styles.brandTagline}>Your journey to radiant skin starts here.</Text>
          </View>

          {/* RIGHT SIDE: REGISTRATION FORM */}
          <View style={[styles.formSection, isDesktop ? styles.halfWidth : styles.fullWidth]}>
            <View style={styles.card}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join Prestige Medispa today</Text>

              <View style={styles.formGrid}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor={COLORS.textSecondary}
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="name@example.com"
                    placeholderTextColor={COLORS.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textSecondary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>
              </View>

              {errorText && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#e63946" />
                  <Text style={styles.errorLabel}>{errorText}</Text>
                </View>
              )}

              <Pressable 
                style={[styles.button, { backgroundColor: PRESTIGE_GOLD }, loading && styles.buttonDisabled]} 
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Register Now</Text>}
              </Pressable>

              <Pressable 
  onPress={() => router.push("/(auth)/login")} // Change router.back() to router.push()
  style={styles.link}
>
  <Text style={styles.linkText}>
    Already have an account? <Text style={{ color: PRESTIGE_NAVY, fontWeight: '700' }}>Log in</Text>
  </Text>
</Pressable>
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  desktopScroll: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  mobileScroll: { padding: 20 },
  mainContainer: { 
    width: '100%', 
    maxWidth: 1100, 
    backgroundColor: COLORS.card, 
    borderRadius: 24, 
    overflow: 'hidden', 
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 
  },
  row: { flexDirection: 'row', minHeight: 700 },
  column: { flexDirection: 'column' },
  halfWidth: { width: '50%' },
  fullWidth: { width: '100%' },
  brandingSection: { justifyContent: 'center', alignItems: 'center', padding: 40 },
  logoWeb: { width: '80%', height: 180 },
  logoMobile: { width: '70%', height: 100, marginTop: 20 },
  brandTagline: { color: "rgba(255,255,255,0.8)", fontSize: 16, marginTop: 20, textAlign: 'center' },
  formSection: { padding: 40, justifyContent: 'center', backgroundColor: COLORS.card },
  card: { width: '100%', maxWidth: 450, alignSelf: 'center', gap: 15 },
  title: { fontSize: 34, fontWeight: "800", color: COLORS.textPrimary },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, marginBottom: 10 },
  formGrid: { gap: 12 },
  inputGroup: { gap: 6 },
  label: { color: COLORS.textSecondary, fontSize: 14, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.inputBackground, borderRadius: 12, padding: 15, color: COLORS.textPrimary },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(230, 57, 70, 0.1)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(230, 57, 70, 0.3)', gap: 8 },
  errorLabel: { color: '#e63946', fontSize: 13, fontWeight: '600', flex: 1 },
  button: { marginTop: 15, borderRadius: 12, paddingVertical: 18, alignItems: "center" },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: COLORS.white, fontWeight: "800", fontSize: 16 },
  link: { marginTop: 10, alignItems: "center" },
  linkText: { color: COLORS.textSecondary, fontWeight: "600" },
});