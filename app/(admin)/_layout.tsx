import { Ionicons } from '@expo/vector-icons';
import { Slot, router, usePathname } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../src/constants/theme';
import { auth } from '../../src/lib/firebase';
import { canUseCurrentPlatform, getSessionProfile } from '../../src/lib/session';

const SIDEBAR_FULL = 240;
const SIDEBAR_COLLAPSED = 64;

const NAV_ITEMS = [
  { route: '/(admin)/homePage', path: '/homePage', label: 'Dashboard', icon: 'stats-chart-outline' },
  { route: '/(admin)/assignRoutine', path: '/assignRoutine', label: 'Assign Routines', icon: 'flask-outline' },
  { route: '/(admin)/adminReminder', path: '/adminReminder', label: 'Send Reminders', icon: 'notifications-outline' },
  { route: '/(admin)/manageUsers', path: '/manageUsers', label: 'Client Management', icon: 'people-outline' },
  { route: '/(admin)/manageProducts', path: '/manageProducts', label: 'Manage Products', icon: 'bag-outline' },
] as const;

export default function AdminLayout() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminProfile, setAdminProfile] = useState<{ fullName: string; email: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const sidebarWidth = useState(new Animated.Value(SIDEBAR_FULL))[0];

  const toggleSidebar = () => {
    const toValue = collapsed ? SIDEBAR_FULL : SIDEBAR_COLLAPSED;
    Animated.timing(sidebarWidth, {
      toValue,
      duration: 220,
      useNativeDriver: false,
    }).start();
    setCollapsed(!collapsed);
  };

  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace('/(tabs)/homePage');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const profile = await getSessionProfile(user);
          if (profile?.role === 'admin' && canUseCurrentPlatform(profile.role)) {
            setAdminProfile({
              fullName: profile.fullName || 'Admin',
              email: profile.email || user.email || '',
            });
            setIsAdmin(true);
          } else {
            await signOut(auth);
            setIsAdmin(false);
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

    return () => unsubscribe();
  }, []);

  if (isAdmin === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <View style={styles.root}>
      {/* Sidebar */}
      <Animated.View style={[styles.sidebar, { width: sidebarWidth }]}>
        {/* Logo + Toggle */}
        <View style={[styles.sidebarHeader, collapsed && styles.sidebarHeaderCollapsed]}>
          {!collapsed && (
            <Text style={styles.logoText}>PrestigeMY</Text>
          )}
          <Pressable onPress={toggleSidebar} style={styles.toggleBtn}>
            <Ionicons name="menu" size={22} color={COLORS.white} />
          </Pressable>
        </View>

        {/* Nav Items */}
        <View style={styles.navList}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path);
            return (
              <Pressable
                key={item.route}
                style={[styles.navItem, collapsed && styles.navItemCollapsed, isActive && styles.navItemActive]}
                onPress={() => router.push(item.route as any)}
              >
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={isActive ? COLORS.white : 'rgba(255,255,255,0.65)'}
                />
                {!collapsed && (
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Profile + Logout */}
        <View style={[styles.profileSection, collapsed && styles.profileSectionCollapsed]}>
          {adminProfile && (
            <View style={[styles.profileRow, collapsed && styles.profileRowCollapsed]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {adminProfile.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
              {!collapsed && (
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName} numberOfLines={1}>{adminProfile.fullName}</Text>
                  <Text style={styles.profileEmail} numberOfLines={1}>{adminProfile.email}</Text>
                </View>
              )}
            </View>
          )}
          <Pressable style={[styles.logoutBtn, collapsed && styles.logoutBtnCollapsed]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ff6b6b" />
            {!collapsed && (
              <Text style={styles.logoutText}>Logout</Text>
            )}
          </Pressable>
        </View>
      </Animated.View>

      {/* Main content */}
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.background,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  sidebar: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
    minHeight: 36,
  },
  sidebarHeaderCollapsed: {
    justifyContent: 'center',
  },
  logoText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
    letterSpacing: 0.5,
    flex: 1,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  profileSection: {
    gap: SPACING.sm,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  profileSectionCollapsed: {
    alignItems: 'center',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  profileRowCollapsed: {
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
  },
  profileInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  profileName: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  profileEmail: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginTop: 1,
  },
  navList: {
    flex: 1,
    gap: SPACING.sm,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    width: 44,
    height: 44,
    alignSelf: 'center',
  },
  navItemActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  navLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    flexShrink: 1,
  },
  navLabelActive: {
    color: COLORS.white,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255,107,107,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.2)',
  },
  logoutBtnCollapsed: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    width: 44,
    height: 44,
    alignSelf: 'center',
  },
  logoutText: {
    color: '#ff6b6b',
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
});
