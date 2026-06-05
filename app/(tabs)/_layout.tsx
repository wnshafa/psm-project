import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Badge, Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { COLORS } from '../../src/constants/theme';
import { auth, db } from '../../src/lib/firebase';

async function registerPushToken(uid: string) {
  if (Platform.OS === 'web') return;
  try {
    const Device = await import('expo-device');
    console.log('[Push] isDevice:', Device.isDevice);
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[Push] existing permission status:', existingStatus);
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    console.log('[Push] final permission status:', finalStatus);
    if (finalStatus !== 'granted') {
      console.warn('[Push] Permission not granted, skipping token registration');
      return;
    }
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: '9af900ef-ac88-4085-903e-e4ec5a424b02',
    })).data;
    console.log('[Push] Token registered:', token);
    await setDoc(doc(db, 'users', uid), { pushToken: token }, { merge: true });
    console.log('[Push] Token saved to Firestore');
  } catch (e) {
    console.warn('[Push] Token registration failed:', e);
  }
}

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
            registerPushToken(user.uid);
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
          {unreadCount > 0 && <Badge>{unreadCount > 9 ? '9+' : String(unreadCount)}</Badge>}
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
