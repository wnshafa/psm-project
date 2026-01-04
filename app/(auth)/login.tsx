import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { auth, db } from "../src/lib/firebase";
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE } from "../src/constants/theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
  // ... (previous validation code)
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user?.uid;

    if (uid) {
      // 1. Check the 'admin' collection first as per your screenshot
      const adminDoc = await getDoc(doc(db, 'admin', uid));
      
      if (adminDoc.exists()) {
        router.replace("../(admin)/homePage");
        return;
      }

      // 2. Fallback to check the standard 'users' collection
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
    const userData = userDoc.data();
    // Ensure this matches 'role' exactly as it appears in Firestore
    if (userData?.role === 'admin') { 
      router.replace("../(admin)/homePage");
    } else {
      router.replace("../(tabs)/homePage");
    }
  }
   
    }
  } catch (error: any) {
    Alert.alert("Login Error", error.message);
  }
};

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.logo}>PrestigeMy</Text>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>
          Stay on top of your skincare routine.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={COLORS.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <Text style={styles.buttonText}>Log in</Text>
          )}
        </Pressable>

        <Pressable style={styles.link} onPress={() => router.push("/(auth)/createAccount")}>
          <Text style={styles.linkText}>Create account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.xxl,
    justifyContent: "center",
  },
  card: {
    backgroundColor: COLORS.card,
    padding: SPACING.xxl,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logo: {
    textAlign: "center",
    color: COLORS.textPrimary,
    letterSpacing: 2,
    fontSize: FONT_SIZE.md,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  title: {
    textAlign: "center",
    fontSize: 28, // Custom large size
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  subtitle: {
    textAlign: "center",
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: SPACING.md,
    color: COLORS.textPrimary,
  },
  button: {
    marginTop: 6,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontWeight: "700",
    fontSize: FONT_SIZE.md,
  },
  link: {
    marginTop: 4,
    alignItems: "center",
  },
  linkText: {
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
});
