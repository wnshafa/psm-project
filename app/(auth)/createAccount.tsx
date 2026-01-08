import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { auth, db } from "../src/lib/firebase";

export default function CreateAccount() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(""); // Added for Client profile

  const handleRegister = async () => {
    if (!email || !password || !fullName) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
  
      // 1. Create the User Profile
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        email: email,
        fullName: fullName,
        role: 'client',
        createdAt: serverTimestamp(),
        streak: 0,
      });
  
      // 2. Create the Client Record
      const clientRef = doc(db, 'clients', user.uid);
      await setDoc(clientRef, {
        // THIS LINE IS REQUIRED BY YOUR RULES
        userId: user.uid, 
        
        name: fullName,
        email: email,
        age: "",
        skinConcern: "",
        skinType: "",
        updatedAt: serverTimestamp(),
      });
  
      router.replace("/(tabs)/homePage");
    } catch (error: any) {
      Alert.alert("Registration Error", error.message);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}>
        <View style={styles.card}>
          <Text style={styles.logo}>PrestigeMy</Text>
          <Text style={styles.title}>Client Register</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#778da9"
            value={fullName}
            onChangeText={setFullName}
          />

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1b2a", padding: 24 },
  card: { backgroundColor: "#1b263b", padding: 24, borderRadius: 18, gap: 12, borderWidth: 1, borderColor: "#415a77" },
  logo: { textAlign: "center", color: "#e0e1dd", letterSpacing: 2, fontSize: 14, fontWeight: "700" },
  title: { textAlign: "center", fontSize: 24, fontWeight: "700", color: "#e0e1dd", marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#415a77", backgroundColor: "#22334b", borderRadius: 12, padding: 14, color: "#e0e1dd" },
  button: { marginTop: 10, backgroundColor: "#415a77", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#e0e1dd", fontWeight: "700", fontSize: 16 },
  link: { marginTop: 10, alignItems: "center" },
  linkText: { color: "#778da9", fontWeight: "600" },
});