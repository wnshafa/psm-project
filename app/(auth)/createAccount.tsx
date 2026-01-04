import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
// Verify this path matches your image image_12fc3f.png
import { auth, db } from "../src/lib/firebase";

export default function CreateAccount() {
  // State variables MUST be inside the component
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    try {
      // Modular Auth call
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Modular Firestore call using the user's UID
      await setDoc(doc(db, 'users', user.uid), {
        email: email,
        createdAt: new Date(),
        streak: 1,
        routineName: "Morning glow routine",
        steps: [
          { title: "Cleanser", detail: "Gentle foam", duration: "1 min" },
          { title: "Serum", detail: "Vitamin C", duration: "2 min" },
          { title: "Moisturizer", detail: "Hydrating gel", duration: "1 min" },
          { title: "SPF", detail: "Broad spectrum", duration: "30 sec" }
        ]
      });

      router.replace("/(tabs)/homePage");
    } catch (error: any) {
      Alert.alert("Registration Error", error.message);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.logo}>PrestigeMy</Text>
        <Text style={styles.title}>Register</Text>
        <Text style={styles.subtitle}>Stay on top of your skincare routine.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#778da9"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#778da9"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable style={styles.button} onPress={handleRegister}>
          <Text style={styles.buttonText}>Create account</Text>
        </Pressable>

        <Pressable style={styles.link} onPress={() => router.back()}>
          <Text style={styles.linkText}>Back to Login</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0d1b2a",
    padding: 24,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#1b263b",
    padding: 24,
    borderRadius: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#415a77",
  },
  logo: {
    textAlign: "center",
    color: "#e0e1dd",
    letterSpacing: 2,
    fontSize: 16,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  title: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "700",
    color: "#e0e1dd",
  },
  subtitle: {
    textAlign: "center",
    fontSize: 14,
    color: "#778da9",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#415a77",
    backgroundColor: "#22334b",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#e0e1dd",
  },
  button: {
    marginTop: 6,
    backgroundColor: "#415a77",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#e0e1dd",
    fontWeight: "700",
    fontSize: 16,
  },
  link: {
    marginTop: 4,
    alignItems: "center",
  },
  linkText: {
    color: "#778da9",
    fontWeight: "600",
  },
});