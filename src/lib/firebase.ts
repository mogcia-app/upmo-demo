// Import the functions you need from the SDKs you need
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableNetwork, disableNetwork } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate Firebase configuration
const validateConfig = () => {
  const requiredEnvVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ];

  // デバッグ: 環境変数の状態を確認
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const envStatus = requiredEnvVars.map(varName => ({
      name: varName,
      exists: !!process.env[varName],
      length: process.env[varName]?.length || 0
    }));
    console.log('🔍 Firebase environment variables status:', envStatus);
  }

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName] || process.env[varName]?.trim() === ''
  );

  if (missingVars.length > 0) {
    // 開発環境では警告のみ表示し、エラーをスローしない
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '⚠️ Missing Firebase environment variables:',
        missingVars.join(', ')
      );
      console.warn(
        'Please create a .env.local file in the project root with the following variables:'
      );
      console.warn(
        requiredEnvVars.map(v => `${v}=your_value_here`).join('\n')
      );
      console.warn(
        'Note: After updating .env.local, you need to restart the Next.js development server.'
      );
      console.warn(
        'The app will continue to run, but Firebase features will not work until these are set.'
      );
      return false;
    } else {
      // 本番環境ではエラーをスロー
      console.error(
        'Missing Firebase environment variables:',
        missingVars.join(', ')
      );
      throw new Error('Firebase configuration is incomplete. Please check your environment variables.');
    }
  }

  return true;
};

// Check if Firebase is properly configured
export const isFirebaseConfigured = () => {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );
};

// Initialize Firebase only if not already initialized
let app: FirebaseApp | null = null;
if (getApps().length === 0) {
  // 環境変数の検証（警告のみ、エラーはスローしない）
  const isValid = validateConfig();
  
  // 環境変数が設定されている場合、または設定されていなくても初期化を試みる
  // （以前の動作を維持するため）
  try {
    // 環境変数がすべて設定されている場合のみ初期化
    if (isValid) {
      app = initializeApp(firebaseConfig);
    } else {
      // 開発環境で環境変数が設定されていない場合でも、設定値があれば初期化を試みる
      // （一部の環境変数が設定されている可能性があるため）
      const hasAnyConfig = Object.values(firebaseConfig).some(val => val && val !== '');
      if (hasAnyConfig && process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Some Firebase environment variables are missing, but attempting initialization with available values.');
        app = initializeApp(firebaseConfig);
      }
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    // 開発環境ではエラーをスローせず、nullのままにする
    if (process.env.NODE_ENV !== 'development') {
      throw error;
    }
  }
} else {
  app = getApps()[0];
}

// Initialize Firebase services (only if app is initialized)
// 環境変数が設定されていない場合、これらのサービスはnullになります
export const auth = app ? getAuth(app) : null as any;
export const db = app ? getFirestore(app) : null as any;
export const storage = app ? getStorage(app) : null as any;

// Handle network connectivity issues
if (typeof window !== 'undefined' && db) {
  // Monitor network status and handle offline/online transitions
  window.addEventListener('online', async () => {
    try {
      if (db) {
        await enableNetwork(db);
        console.log('Firestore network re-enabled');
      }
    } catch (error) {
      console.error('Error enabling Firestore network:', error);
    }
  });

  window.addEventListener('offline', async () => {
    try {
      if (db) {
        await disableNetwork(db);
        console.log('Firestore network disabled (offline mode)');
      }
    } catch (error) {
      console.error('Error disabling Firestore network:', error);
    }
  });
}

export default app;
