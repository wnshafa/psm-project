import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native'; // Added Platform
import { COLORS } from '../src/constants/theme';
import { auth, db } from '../src/lib/firebase';

export default function TabLayout() {
  const [isClient, setIsClient] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userData = userDoc.data();

          if (userData?.role === 'client' || !userData?.role) {
            setIsClient(true);
          } else if (userData?.role === 'admin') {
            setIsClient(false);
            router.replace('/(admin)/homePage');
          }
        } catch (error) {
          console.error("Session check error:", error);
          handleNavigationToLogin();
        }
      } else {
        handleNavigationToLogin();
      }
    });

    return () => unsubscribe();
  }, []);

  // Helper function to handle web vs mobile redirection
  const handleNavigationToLogin = () => {
    if (Platform.OS === 'web') {
      // Force refresh on web to clear memory
      window.location.href = '/(auth)/login';
    } else {
      router.replace('/(auth)/login');
    }
  };

  const getTabBarHeight = () => {
    if (Platform.OS === 'ios') {
      return 90; // iOS has safe area
    } else if (Platform.OS === 'android') {
      return 70; // Android standard
    }
    return 60; // Default/web
  };

  if (isClient === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.textPrimary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          height: getTabBarHeight(),
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        sceneContainerStyle: {
          paddingBottom: 20,
        },
      }}
    >
      <Tabs.Screen
        name="homePage"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="routinePage"
        options={{
          title: 'Routine',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reminderPage"
        options={{
          title: 'Reminders',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="productsPage"
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'cart' : 'cart-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="skinChartAnalysis"
        options={{
          title: 'Skin Analysis',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="userProfile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />

    </Tabs>
    
  );
}