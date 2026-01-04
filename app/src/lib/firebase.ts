import { getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, browserLocalPersistence, getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyCNY2NOx3C6BeHoTmuNvl-F5hbAcRluc8E",
  authDomain: "skincare-app-2e777.firebaseapp.com",
  projectId: "skincare-app-2e777",
  storageBucket: "skincare-app-2e777.firebasestorage.app",
  messagingSenderId: "265253561470",
  appId: "1:265253561470:web:4c04bd9da051fe6a05642f",
  measurementId: "G-PR2GF1FP1K"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;

if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  auth = initializeAuth(app, {
    persistence: browserLocalPersistence,
  });
}

const db = getFirestore(app);

export { auth, db };
