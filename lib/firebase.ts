import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let firebaseApp: any = null;
let firebaseAuth: any = null;

async function initFirebase() {
  if (!isFirebaseConfigured) return;

  const { initializeApp, getApps } = await import('firebase/app');
  const { getAuth, initializeAuth, getReactNativePersistence } = await import('firebase/auth');
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

  firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  if (Platform.OS === 'web') {
    firebaseAuth = getAuth(firebaseApp);
  } else {
    try {
      firebaseAuth = initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      firebaseAuth = getAuth(firebaseApp);
    }
  }
}

const firebaseReady = initFirebase();

export function getFirebaseAuth() {
  return firebaseAuth;
}

export { firebaseReady };
