import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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

// 認証トークンを検証
const verifyAuthToken = async (authHeader: string | null) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証が必要です');
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    initAdmin();
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error: any) {
    console.error('認証トークン検証エラー:', error);
    if (error.message?.includes('Firebase Admin SDK')) {
      throw new Error('認証サービスの初期化に失敗しました');
    }
    throw new Error('認証トークンの検証に失敗しました');
  }
};

// ダッシュボード統計情報を取得
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Firebaseが初期化されていません' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('Authorization');
    const decodedToken = await verifyAuthToken(authHeader);

    // 今日の日付を取得
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // タスク統計を取得
    const todosQuery = query(
      collection(db, 'todos'),
      where('userId', '==', decodedToken.uid)
    );
    const todosSnapshot = await getDocs(todosQuery);

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
        const dueDate = data.dueDate?.toDate?.() || new Date(data.dueDate);
        const dueDateString = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
        if (dueDateString === todayString && data.status !== 'completed') {
          todayCount++;
        }
      } else if (data.createdAt) {
        const createdDate = data.createdAt?.toDate?.() || new Date(data.createdAt);
        const createdDateString = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}-${String(createdDate.getDate()).padStart(2, '0')}`;
        if (createdDateString === todayString && data.status !== 'completed') {
          todayCount++;
        }
      }
    });

    // 共有されているタスクもカウント
    try {
      const sharedTodosQuery = query(
        collection(db, 'todos'),
        where('sharedWith', 'array-contains', decodedToken.uid)
      );
      const sharedTodosSnapshot = await getDocs(sharedTodosQuery);
      
      sharedTodosSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'completed') {
          completedCount++;
        } else {
          pendingCount++;
        }

        // 今日のタスクをカウント
        if (data.dueDate) {
          const dueDate = data.dueDate?.toDate?.() || new Date(data.dueDate);
          const dueDateString = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
          if (dueDateString === todayString && data.status !== 'completed') {
            todayCount++;
          }
        }
      });
    } catch (error) {
      console.error('共有タスク取得エラー:', error);
    }

    // 契約書件数を取得（管理者のみ）
    let contractCount = 0;
    try {
      // ユーザーのロールを確認
      const userDoc = await getDoc(doc(db, 'users', decodedToken.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === 'admin') {
          // 管理者の場合は全件数を取得
          const contractsSnapshot = await getDocs(collection(db, 'manualDocuments'));
          contractCount = contractsSnapshot.size;
        } else {
          // 一般ユーザーの場合は自分の契約書のみ
          const userContractsQuery = query(
            collection(db, 'manualDocuments'),
            where('userId', '==', decodedToken.uid)
          );
          const userContractsSnapshot = await getDocs(userContractsQuery);
          contractCount = userContractsSnapshot.size;
        }
      }
    } catch (error) {
      console.error('契約書件数取得エラー:', error);
    }

    // チーム利用者数を取得
    let teamMembersCount = 0;
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'user') {
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
    return NextResponse.json(
      { error: error.message || '統計情報の取得に失敗しました' },
      { status: error.message?.includes('認証') ? 401 : 500 }
    );
  }
}

