
import { router, Stack } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { COLORS } from "../../src/constants/theme";
import { auth } from "../../src/lib/firebase";
import { canUseCurrentPlatform, getSessionHome, getSessionProfile } from "../../src/lib/session";

export default function AuthLayout() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setChecking(false);
        return;
      }

      try {
        const profile = await getSessionProfile(user);
        if (profile && canUseCurrentPlatform(profile.role)) {
          router.replace(getSessionHome(profile.role));
        } else {
          await signOut(auth);
          setChecking(false);
        }
      } catch {
        await signOut(auth);
        setChecking(false);
      }
    });

    return unsubscribe;
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="createAccount" />
    </Stack>
  );
}
