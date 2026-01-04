import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { signOut } from 'firebase/auth';
import { Pressable, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { COLORS, FONT_SIZE } from '../src/constants/theme';
import { auth } from '../src/lib/firebase';

export default function AdminLayout() {
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.background,
          },
          headerTintColor: COLORS.textPrimary,

          drawerStyle: {
            backgroundColor: COLORS.background,
            width: 260,
          },

          drawerActiveTintColor: COLORS.textPrimary,
          drawerActiveBackgroundColor: COLORS.card,
          drawerInactiveTintColor: COLORS.textSecondary,

          drawerLabelStyle: {
            fontWeight: '600',
          },
        }}
      >
        {/* Admin Pages */}
        <Drawer.Screen
          name="homePage"
          options={{
            drawerLabel: 'Client List',
            title: 'Admin Dashboard',
          }}
        />

        <Drawer.Screen
          name="assignRoutine"
          options={{
            drawerLabel: 'Assign Routines',
            title: 'Assign Skincare Routine',
          }}
        />

        <Drawer.Screen
          name="monitorProgress"
          options={{
            drawerLabel: 'Monitor Adherence',
            title: 'Monitor Client Adherence',
          }}
        />

        <Drawer.Screen
          name="adminReminder"
          options={{
            drawerLabel: 'Send Reminders',
            title: 'Send Administrative Reminder',
          }}
        />

        {/* Logout Button */}
        <Drawer.Screen
          name="logout"
          options={{
            drawerLabel: () => (
              <Pressable
                onPress={handleLogout}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                }}
              >
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color={COLORS.textSecondary}
                />
                <Text
                  style={{
                    marginLeft: 12,
                    color: COLORS.textSecondary,
                    fontSize: FONT_SIZE.sm,
                    fontWeight: '600',
                  }}
                >
                  Logout
                </Text>
              </Pressable>
            ),
            title: '',
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
