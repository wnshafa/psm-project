import { Ionicons } from '@expo/vector-icons';
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList
} from '@react-navigation/drawer';
import { router } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { COLORS } from '../src/constants/theme';
import { auth, db } from '../src/lib/firebase';

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Root layout will handle redirect, but safe to call here too
      router.replace('/(auth)/login'); 
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <DrawerItemList {...props} />
      <DrawerItem
        label="Logout"
        labelStyle={{ fontWeight: '600', marginLeft: -16 }}
        inactiveTintColor={COLORS.textSecondary}
        icon={({ color, size }) => (
          <Ionicons name="log-out-outline" size={size} color={color} />
        )}
        onPress={handleLogout}
        style={{ marginTop: 'auto', marginBottom: 20 }}
      />
    </DrawerContentScrollView>
  );
}

export default function AdminLayout() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    // 1. Listen for Auth State
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 2. Check Firestore for admin role
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          } else {
            // Not an admin? Kick them out to the user side
            setIsAdmin(false);
            router.replace('/(tabs)/homePage');
          }
        } catch (error) {
          console.error("Role check failed:", error);
          router.replace('/(auth)/login');
        }
      } else {
        // Not logged in at all
        router.replace('/(auth)/login');
      }
    });

    return () => unsubscribe();
  }, []);

  // 3. Show loading spinner while checking role
  if (isAdmin === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.textPrimary,
          drawerStyle: { backgroundColor: COLORS.background, width: 260 },
          drawerActiveTintColor: COLORS.textPrimary,
          drawerActiveBackgroundColor: COLORS.card,
          drawerInactiveTintColor: COLORS.textSecondary,
          drawerLabelStyle: { fontWeight: '600' },
        }}
      >
        <Drawer.Screen
          name="homePage"
          options={{
            drawerLabel: 'Monitor Adherence',
            title: 'Admin Dashboard',
            drawerIcon: ({ color }) => <Ionicons name="stats-chart-outline" size={20} color={color} />,
          }}
        />

        <Drawer.Screen
          name="assignRoutine"
          options={{
            drawerLabel: 'Assign Routines',
            title: 'Assign Skincare Routine',
            drawerIcon: ({ color }) => <Ionicons name="flask-outline" size={20} color={color} />,
          }}
        />

        <Drawer.Screen
          name="adminReminder"
          options={{
            drawerLabel: 'Send Reminders',
            title: 'Send Administrative Reminder',
            drawerIcon: ({ color }) => <Ionicons name="notifications-outline" size={20} color={color} />,
          }}
        />

        <Drawer.Screen
          name="userProgress"
          options={{
            drawerLabel: 'View User Progress',
            title: 'User Progress',
            drawerIcon: ({ color }) => <Ionicons name="analytics-outline" size={20} color={color} />,
          }}
        />

        <Drawer.Screen
          name="logout"
          options={{ drawerItemStyle: { display: 'none' } }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}