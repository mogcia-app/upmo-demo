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

  // デバッグ: 環境変数の状態を確認（開発環境・本番環境ともに）
  if (typeof window !== 'undefined') {
    const envStatus = requiredEnvVars.map(varName => ({
      name: varName,
      exists: !!process.env[varName],
      length: process.env[varName]?.length || 0,
      value: process.env[varName] ? `${process.env[varName]?.substring(0, 10)}...` : 'undefined'
    }));
    console.log('🔍 Firebase environment variables status:', envStatus);
    console.log('🔍 Environment:', process.env.NODE_ENV);
  }

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName] || process.env[varName]?.trim() === ''
  );

  if (missingVars.length > 0) {
    // 開発環境・本番環境ともに警告のみ表示し、エラーをスローしない
    // （本番環境でも環境変数が設定されていない場合、アプリがクラッシュしないようにする）
    console.warn(
      '⚠️ Missing Firebase environment variables:',
      missingVars.join(', ')
    );
    
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        'Please create a .env.local file in the project root with the following variables:'
      );
      console.warn(
        requiredEnvVars.map(v => `${v}=your_value_here`).join('\n')
      );
      console.warn(
        'Note: After updating .env.local, you need to restart the Next.js development server.'
      );
    } else {
      console.warn(
        'Please set the following environment variables in your deployment platform (Vercel, etc.):'
      );
      console.warn(
        requiredEnvVars.map(v => `${v}=your_value_here`).join('\n')
      );
    }
    
    console.warn(
      'The app will continue to run, but Firebase features will not work until these are set.'
    );
    return false;
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
  
  // デバッグ: 実際の環境変数の値を確認（機密情報は一部のみ表示）
  if (typeof window !== 'undefined') {
    console.log('🔍 Firebase config values:', {
      apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'undefined',
      authDomain: firebaseConfig.authDomain || 'undefined',
      projectId: firebaseConfig.projectId || 'undefined',
      storageBucket: firebaseConfig.storageBucket || 'undefined',
      messagingSenderId: firebaseConfig.messagingSenderId || 'undefined',
      appId: firebaseConfig.appId ? `${firebaseConfig.appId.substring(0, 10)}...` : 'undefined',
      isValid: isValid
    });
  }
  
  // 環境変数が設定されている場合、または設定されていなくても初期化を試みる
  try {
    // 環境変数がすべて設定されている場合のみ初期化
    if (isValid) {
      console.log('✅ All Firebase environment variables are set. Initializing Firebase...');
      app = initializeApp(firebaseConfig);
      console.log('✅ Firebase initialized successfully');
    } else {
      // 環境変数が一部でも設定されている場合、初期化を試みる
      // （本番環境でも環境変数が正しく設定されていない場合に備える）
      const hasAnyConfig = Object.values(firebaseConfig).some(val => val && val !== '');
      if (hasAnyConfig) {
        console.warn('⚠️ Some Firebase environment variables are missing, but attempting initialization with available values.');
        console.warn('⚠️ Config:', firebaseConfig);
        try {
          app = initializeApp(firebaseConfig);
          console.log('⚠️ Firebase initialized with partial config');
        } catch (initError) {
          console.error('❌ Firebase initialization failed with partial config:', initError);
          // 初期化に失敗した場合はnullのまま（アプリはクラッシュしない）
        }
      } else {
        console.warn('⚠️ No Firebase environment variables found. Firebase features will not be available.');
      }
    }
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    // エラーをスローせず、nullのままにする（アプリはクラッシュしない）
    app = null;
  }
} else {
  app = getApps()[0];
  console.log('✅ Firebase app already initialized');
}

// Initialize Firebase services (only if app is initialized)
// 環境変数が設定されていない場合、これらのサービスはnullになります
export const auth = app ? getAuth(app) : null as any;
export const db = app ? getFirestore(app) : null as any;
export const storage = app ? getStorage(app) : null as any;

// デバッグ: サービスの初期化状態を確認
if (typeof window !== 'undefined') {
  console.log('🔍 Firebase services initialized:', {
    app: !!app,
    auth: !!auth,
    db: !!db,
    storage: !!storage
  });
}

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
