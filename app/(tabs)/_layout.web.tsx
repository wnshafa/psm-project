import { Ionicons } from '@expo/vector-icons';
import { Slot, router, usePathname } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../src/constants/theme';
import { clientPath } from '../../src/constants/firestore';
import { auth, db } from '../../src/lib/firebase';
import { canUseCurrentPlatform, getSessionProfile } from '../../src/lib/session';

const NAV_ITEMS = [
  { route: '/(tabs)/homePage',          path: '/homePage',          label: 'Home',     icon: 'home-outline'      as const, activeIcon: 'home'           as const },
  { route: '/(tabs)/routinePage',       path: '/routinePage',       label: 'Routine',  icon: 'clipboard-outline' as const, activeIcon: 'clipboard'      as const },
  { route: '/(tabs)/skinChartAnalysis', path: '/skinChartAnalysis', label: 'Analysis', icon: 'sparkles-outline'  as const, activeIcon: 'sparkles'       as const },
  { route: '/(tabs)/productsPage',      path: '/productsPage',      label: 'Products', icon: 'bag-outline'       as const, activeIcon: 'bag'            as const },
  { route: '/(tabs)/userProfile',       path: '/userProfile',       label: 'Profile',  icon: 'person-outline'    as const, activeIcon: 'person'         as const },
] as const;

export default function TabLayoutWeb() {
  const [isClient, setIsClient] = useState<boolean | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let unsubReminders: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const profile = await getSessionProfile(user);
          if (profile?.role === 'client' && canUseCurrentPlatform(profile.role)) {
            setIsClient(true);
            unsubReminders = onSnapshot(
              query(
                collection(db, 'reminder'),
                where('clientID', '==', clientPath(user.uid)),
                where('status', '==', 'unread')
              ),
              snap => setUnreadCount(snap.size)
            );
          } else if (profile?.role === 'admin') {
            router.replace('/(admin)/homePage');
          } else {
            await signOut(auth);
            setIsClient(false);
            router.replace('/(auth)/login');
          }
        } catch {
          await signOut(auth);
          router.replace('/(auth)/login');
        }
      } else {
        router.replace('/(auth)/login');
      }
    });

    return () => { unsubscribe(); unsubReminders?.(); };
  }, []);

  if (isClient === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Top navigation bar */}
      <View style={styles.navbar}>
        <Text style={styles.brand}>PrestigeMY</Text>

        <View style={styles.navItems}>
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.path || pathname.startsWith(item.path);
            return (
              <Pressable
                key={item.route}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => router.push(item.route as any)}
              >
                <View style={styles.navIconWrap}>
                  <Ionicons
                    name={isActive ? item.activeIcon : item.icon}
                    size={18}
                    color={isActive ? COLORS.primary : COLORS.textSecondary}
                  />
                  {item.label === 'Routine' && unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Page content */}
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'column', backgroundColor: COLORS.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  // Top nav
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    paddingHorizontal: 32,
    paddingVertical: 0,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    // Web shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  navItems: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: 'rgba(27,58,107,0.08)',
  },
  navIconWrap: {
    position: 'relative',
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  navLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
    backgroundColor: '#e63946',
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },

  content: { flex: 1, overflow: 'hidden' },
});
