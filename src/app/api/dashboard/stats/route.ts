import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Firebase Admin SDKの初期化
const initAdmin = () => {
  if (getApps().length === 0) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      try {
        const serviceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        };

        initializeApp({
          credential: cert(serviceAccount),
        });
      } catch (error) {
        console.error('Firebase Admin SDK初期化エラー:', error);
        throw new Error('Firebase Admin SDKの初期化に失敗しました');
      }
    } else {
      // 開発環境では警告のみ、本番環境ではエラー
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Firebase Admin SDK credentials not found');
      } else {
        console.warn('Firebase Admin SDK credentials not found. Some features may not work.');
      }
    }
  }
};

// Firebase Admin SDKのインスタンスを取得する関数
const getAdminDb = () => {
  initAdmin();
  return getApps().length > 0 ? getFirestore() : null;
};

const getAdminAuth = () => {
  initAdmin();
  return getApps().length > 0 ? getAuth() : null;
};

// 認証トークンを検証
const verifyAuthToken = async (authHeader: string | null) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証が必要です');
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    
    // Firebase Admin SDKを初期化
    initAdmin();
    
    // 初期化に失敗した場合のチェック
    if (getApps().length === 0) {
      console.error('Firebase Admin SDK initialization failed');
      throw new Error('Firebase Admin SDKが初期化されていません。環境変数を確認してください。');
    }
    
    const auth = getAdminAuth();
    if (!auth) {
      throw new Error('Firebase Authが取得できませんでした');
    }
    
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error: any) {
    console.error('認証トークン検証エラー:', error);
    console.error('エラー詳細:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    
    // より詳細なエラーメッセージを返す
    if (error.message?.includes('Firebase Admin SDK') || error.code === 'app/no-app') {
      throw new Error('Firebase Admin SDKの初期化に失敗しました。環境変数（FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY）を確認してください。');
    }
    if (error.code === 'auth/argument-error') {
      throw new Error('認証トークンの形式が正しくありません');
    }
    if (error.code === 'auth/id-token-expired') {
      throw new Error('認証トークンの有効期限が切れています');
    }
    if (error.code === 'auth/invalid-id-token') {
      throw new Error('無効な認証トークンです');
    }
    throw new Error(`認証トークンの検証に失敗しました: ${error.message || error.code || '不明なエラー'}`);
  }
};

// ダッシュボード統計情報を取得
export async function GET(request: NextRequest) {
  try {
    // Firebase Admin SDKの初期化を試みる
    const adminDb = getAdminDb();
    
    if (!adminDb) {
      const hasCredentials = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
      return NextResponse.json(
        { 
          error: 'Firebase Admin SDKが初期化されていません',
          details: hasCredentials 
            ? '環境変数は設定されていますが、初期化に失敗しました。環境変数の形式を確認してください。'
            : '環境変数（FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY）が設定されていません。'
        },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('Authorization');
    const decodedToken = await verifyAuthToken(authHeader);

    // 今日の日付を取得
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // タスク統計を取得（Firebase Admin SDKを使用）
    const todosSnapshot = await adminDb.collection('todos')
      .where('userId', '==', decodedToken.uid)
      .get();

    let completedCount = 0;
    let pendingCount = 0;
    let todayCount = 0;

    todosSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.status === 'completed') {
        completedCount++;
      } else {
        pendingCount++;
      }

      // 今日のタスクをカウント
      if (data.dueDate) {
        const dueDate = data.dueDate instanceof Timestamp ? data.dueDate.toDate() : (data.dueDate?.toDate?.() || new Date(data.dueDate));
        const dueDateString = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
        if (dueDateString === todayString && data.status !== 'completed') {
          todayCount++;
        }
      } else if (data.createdAt) {
        const createdDate = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt?.toDate?.() || new Date(data.createdAt));
        const createdDateString = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}-${String(createdDate.getDate()).padStart(2, '0')}`;
        if (createdDateString === todayString && data.status !== 'completed') {
          todayCount++;
        }
      }
    });

    // 共有されているタスクもカウント
    try {
      const sharedTodosSnapshot = await adminDb.collection('todos')
        .where('sharedWith', 'array-contains', decodedToken.uid)
        .get();
      
      sharedTodosSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'completed') {
          completedCount++;
        } else {
          pendingCount++;
        }

        // 今日のタスクをカウント
        if (data.dueDate) {
          const dueDate = data.dueDate instanceof Timestamp ? data.dueDate.toDate() : (data.dueDate?.toDate?.() || new Date(data.dueDate));
          const dueDateString = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
          if (dueDateString === todayString && data.status !== 'completed') {
            todayCount++;
          }
        }
      });
    } catch (error) {
      console.error('共有タスク取得エラー:', error);
    }

    // 契約書件数を取得（手動入力された文書のみ）
    let contractCount = 0;
    try {
      // ユーザーのロールを確認
      const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.role === 'admin') {
          // 管理者の場合はuserIdフィールドがある文書のみをカウント（手動入力された文書）
          // Firestoreでは!= nullが使えないため、全件取得してフィルタリング
          const contractsSnapshot = await adminDb.collection('manualDocuments').get();
          contractCount = contractsSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.userId != null && data.userId !== undefined;
          }).length;
        } else {
          // 一般ユーザーの場合は自分の契約書のみ
          const userContractsSnapshot = await adminDb.collection('manualDocuments')
            .where('userId', '==', decodedToken.uid)
            .get();
          contractCount = userContractsSnapshot.size;
        }
      }
    } catch (error) {
      console.error('契約書件数取得エラー:', error);
    }

    // チーム利用者数を取得（同じcompanyNameのユーザーのみ）
    let teamMembersCount = 0;
    try {
      // 現在のユーザーのcompanyNameを取得
      const currentUserDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
      const currentUserData = currentUserDoc.data();
      const currentCompanyName = currentUserData?.companyName || '';
      
      const usersSnapshot = await adminDb.collection('users').get();
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'user' && data.companyName === currentCompanyName && doc.id !== decodedToken.uid) {
          teamMembersCount++;
        }
      });
    } catch (error) {
      console.error('チーム利用者数取得エラー:', error);
    }

    return NextResponse.json({
      success: true,
      stats: {
        taskStats: {
          completed: completedCount,
          pending: pendingCount,
          today: todayCount,
        },
        contractCount,
        teamMembersCount,
      },
    });
  } catch (error: any) {
    console.error('統計情報取得エラー:', error);
    console.error('エラー詳細:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return NextResponse.json(
      { 
        error: error.message || '統計情報の取得に失敗しました',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: error.message?.includes('認証') ? 401 : 500 }
    );
  }
}

