import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from './firebase';

export type SessionRole = 'admin' | 'client';

export type SessionProfile = {
  role: SessionRole;
  fullName?: string;
  email?: string;
};

export const getSessionProfile = async (user: User): Promise<SessionProfile | null> => {
  const adminDoc = await getDoc(doc(db, 'admin', user.uid));
  if (adminDoc.exists()) {
    const data = adminDoc.data();
    return {
      role: 'admin',
      fullName: data.fullName || data.name || 'Admin',
      email: user.email || data.email || '',
    };
  }

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists()) return null;

  const data = userDoc.data();
  const role = data.role === 'admin' ? 'admin' : 'client';

  return {
    role,
    fullName: data.fullName || data.name || (role === 'admin' ? 'Admin' : 'Client'),
    email: user.email || data.email || '',
  };
};

export const getSessionHome = (role: SessionRole) => {
  if (role === 'admin') return '/(admin)/homePage' as const;
  return '/(tabs)/homePage' as const;
};

export const canUseCurrentPlatform = (role: SessionRole) => {
  // Admins: web only. Clients: web + mobile.
  if (role === 'admin') return Platform.OS === 'web';
  return true;
};

export const getPlatformAccessMessage = (role: SessionRole) => {
  if (role === 'admin') return 'Admin access is web-only. Please visit the admin portal in your browser.';
  return 'Please log in to continue.';
};
