import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Badge, Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { COLORS } from '../../src/constants/theme';
import { auth, db } from '../../src/lib/firebase';

export default function TabLayout() {
  const [isClient, setIsClient] = useState<boolean | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      router.replace('/(admin)/homePage');
      return;
    }

    let unsubReminders: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userData = userDoc.data();
          if (userData?.role === 'client' || !userData?.role) {
            setIsClient(true);
            // Listen for unread reminders to show badge
            unsubReminders = onSnapshot(
              query(
                collection(db, 'reminder'),
                where('clientID', '==', `/clients/${user.uid}`),
                where('status', '==', 'unread')
              ),
              (snap) => setUnreadCount(snap.size)
            );
          } else if (userData?.role === 'admin') {
            setIsClient(false);
            router.replace('/(admin)/homePage');
          }
        } catch {
          router.replace('/(auth)/login');
        }
      } else {
        router.replace('/(auth)/login');
      }
    });

    return () => {
      unsubscribe();
      unsubReminders?.();
    };
  }, []);

  if (isClient === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NativeTabs>

      <NativeTabs.Trigger name="homePage">
        <Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="home-outline" />,
            selected: <VectorIcon family={Ionicons} name="home" />,
          }}
        />
        <Label>Home</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="routinePage">
        <Icon
          sf={{ default: 'clipboard', selected: 'clipboard.fill' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="clipboard-outline" />,
            selected: <VectorIcon family={Ionicons} name="clipboard" />,
          }}
        />
        <Label>Routine</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="skinChartAnalysis">
        <Icon
          sf={{ default: 'sparkles', selected: 'sparkles' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="sparkles-outline" />,
            selected: <VectorIcon family={Ionicons} name="sparkles" />,
          }}
        />
        <Label>Analysis</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="productsPage">
        <Icon
          sf={{ default: 'bag', selected: 'bag.fill' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="bag-outline" />,
            selected: <VectorIcon family={Ionicons} name="bag" />,
          }}
        />
        <Label>Products</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="userProfile">
        <Icon
          sf={{ default: 'person', selected: 'person.fill' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="person-outline" />,
            selected: <VectorIcon family={Ionicons} name="person" />,
          }}
        />
        <Label>Profile</Label>
      </NativeTabs.Trigger>

      {/* Hidden — reportPage not yet implemented */}
      <NativeTabs.Trigger name="reportPage" hidden />

    </NativeTabs>
  );
}
