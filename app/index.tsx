import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { auth, db } from "./src/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, DocumentSnapshot, DocumentData } from "firebase/firestore";
import { COLORS } from "./src/constants/theme";

export default function Index() {
  useEffect(() => {
    // Check auth state
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, check role
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc: DocumentSnapshot<DocumentData> = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const role = userDoc.data()?.role;
          if (role === 'admin') {
            router.replace("/(admin)/homePage");
          } else {
            router.replace("/(tabs)/homePage");
          }
        } else {
           // Default to user home if doc doesn't exist
           router.replace("/(tabs)/homePage");
        }
      } else {
        // No user is signed in, wait for splash delay
        setTimeout(() => {
          router.replace("/(auth)/login");
        }, 2000);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
            <View style={styles.logoCircle}>
                <Text style={styles.logoText}>P</Text>
            </View>
            <Text style={styles.title}>PrestigeMy</Text>
            <Text style={styles.subtitle}>Elevate your skincare</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    gap: 12,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10
  },
  logoText: {
    color: COLORS.textPrimary,
    fontSize: 40,
    fontWeight: "800",
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    letterSpacing: 1,
  },
});