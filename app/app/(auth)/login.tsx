import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
  View,
  useWindowDimensions,
} from "react-native";
import { COLORS } from "../src/constants/theme";
import { auth, db } from "../src/lib/firebase";

export default function Login() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // --- States ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // --- Constants ---
  const PRESTIGE_NAVY = COLORS.background;
  const PRESTIGE_GOLD = COLORS.primary;
  const SOFT_BACKGROUND = COLORS.card;

  const handleLogin = async () => {
    setErrorText(null); // Reset error state

    // 1. Basic Front-end Validation
    if (!email.trim() || !password.trim()) {
      const msg = "Please enter both email and password.";
      if (Platform.OS === 'web') setErrorText(msg);
      else Alert.alert("Required Fields", msg);
      return;
    }

    setLoading(true);
    try {
      // 2. Attempt Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user?.uid;

      if (uid) {
        // 3. Role-Based Check
        const adminDoc = await getDoc(doc(db, 'admin', uid));
        if (adminDoc.exists()) {
          router.replace("../(admin)/homePage");
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData?.role === 'admin') {
            router.replace("../(admin)/homePage");
          } else {
            router.replace("../(tabs)/homePage");
          }
        } else {
          const msg = "User record not found. Please contact support.";
          if (Platform.OS === 'web') setErrorText(msg);
          else Alert.alert("Profile Error", msg);
        }
      }
    } catch (error: any) {
      // 4. Detailed Firebase Error Handling
      let errorMessage = "An unexpected error occurred. Please try again.";

      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = "The email address is not valid.";
          break;
        case 'auth/user-not-found':
          errorMessage = "No account found with this email.";
          break;
        case 'auth/wrong-password':
          errorMessage = "Incorrect password. Please try again.";
          break;
        case 'auth/network-request-failed':
          errorMessage = "Network error. Check your connection.";
          break;
        case 'auth/too-many-requests':
          errorMessage = "Too many failed attempts. Try again later.";
          break;
      }

      if (Platform.OS === 'web') {
        setErrorText(errorMessage);
      } else {
        Alert.alert("Login Failed", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: SOFT_BACKGROUND }]}>
      <ScrollView contentContainerStyle={isDesktop ? styles.desktopScroll : styles.mobileScroll}>
        <View style={[styles.mainContainer, isDesktop ? styles.row : styles.column]}>
          
          {/* LEFT SIDE: BRANDING SECTION */}
          <View style={[styles.brandingSection, { backgroundColor: PRESTIGE_NAVY }, isDesktop ? styles.halfWidth : styles.fullWidth]}>
            <Image 

              style={isDesktop ? styles.logoWeb : styles.logoMobile}
              resizeMode="contain"
            />
            <Text style={styles.brandTagline}>Science-backed glow, daily.</Text>
          </View>

          {/* RIGHT SIDE: FORM SECTION */}
          <View style={[styles.formSection, isDesktop ? styles.halfWidth : styles.fullWidth]}>
            <View style={styles.card}>
              <Text style={styles.title}>Sign in</Text>
              <Text style={styles.subtitle}>Welcome back to your skincare portal</Text>

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
                  editable={!loading}
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
                  editable={!loading}
                />
              </View>

              {/* ERROR MESSAGE (Visible on Web and Mobile) */}
              {errorText && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#e63946" />
                  <Text style={styles.errorLabel}>{errorText}</Text>
                </View>
              )}

              <Pressable 
                style={[styles.button, { backgroundColor: PRESTIGE_GOLD }, loading && styles.buttonDisabled]} 
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.buttonText}>Log in</Text>
                )}
              </Pressable>

              <Pressable 
                style={styles.link} 
                onPress={() => router.push("/(auth)/createAccount")}
                disabled={loading}
              >
                <Text style={styles.linkText}>
                  Don't have an account? <Text style={{ color: PRESTIGE_NAVY, fontWeight: '700' }}>Create one</Text>
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
  screen: { flex: 1, backgroundColor: COLORS.background },
  desktopScroll: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  mobileScroll: { padding: 20 },
  mainContainer: { 
    width: '100%', 
    maxWidth: 1000, 
    backgroundColor: COLORS.card, 
    borderRadius: 24, 
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5 
  },
  row: { flexDirection: 'row', minHeight: 600 },
  column: { flexDirection: 'column' },
  halfWidth: { width: '50%' },
  fullWidth: { width: '100%' },
  brandingSection: { justifyContent: 'center', alignItems: 'center', padding: 40 },
  logoWeb: { width: '90%', height: 180 },
  logoMobile: { width: '70%', height: 100, marginTop: 20 },
  brandTagline: { color: "rgba(255,255,255,0.8)", fontSize: 16, marginTop: 20, fontWeight: '400', letterSpacing: 1 },
  formSection: { padding: 40, justifyContent: 'center', backgroundColor: COLORS.card },
  card: { width: '100%', maxWidth: 380, alignSelf: 'center', gap: 20 },
  title: { fontSize: 34, fontWeight: "800", color: COLORS.textPrimary },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, marginBottom: 10 },
  inputGroup: { gap: 8 },
  label: { color: COLORS.textSecondary, fontSize: 14, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.inputBackground, borderRadius: 12, padding: 18, color: COLORS.textPrimary },
  
  // --- Error Styles ---
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(230, 57, 70, 0.1)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(230, 57, 70, 0.3)',
    gap: 8,
  },
  errorLabel: {
    color: '#e63946',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },

  button: { marginTop: 10, borderRadius: 12, paddingVertical: 18, alignItems: "center" },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: COLORS.white, fontWeight: "800", fontSize: 16 },
  link: { marginTop: 10, alignItems: "center" },
  linkText: { color: COLORS.textSecondary, fontWeight: "600" },
});