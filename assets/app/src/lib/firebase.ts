import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth // Import the Auth type from firebase
  ,




  getAuth,
  initializeAuth
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

// --- THE FIX: Manual Persistence Polyfill ---
import * as firebaseAuth from 'firebase/auth';
const { getReactNativePersistence } = firebaseAuth as any;

const firebaseConfig = {
  apiKey: "AIzaSyCNY2NOx3C6BeHoTmuNvl-F5hbAcRluc8E",
  authDomain: "skincare-app-2e777.firebaseapp.com",
  projectId: "skincare-app-2e777",
  storageBucket: "skincare-app-2e777.appspot.com",
  messagingSenderId: "1084644234567",
  appId: "1:1084644234567:web:1234567890abcdef",
  measurementId: "G-1234567890"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export default app;
// 1. EXPLICITLY TYPE THE AUTH VARIABLE
let auth: Auth; 

if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  // 2. USE INITIALIZEAUTH FOR NATIVE
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

const db = getFirestore(app);

export { auth, db };

