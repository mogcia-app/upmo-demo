import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Firebase Admin SDK の初期化
if (!getApps().length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    initializeApp({
      credential: cert(serviceAccount),
    });
  }
}

const auth = getApps().length > 0 ? getAuth() : null;
const adminDb = getApps().length > 0 ? getFirestore() : null;

// 認証トークンを検証するヘルパー関数
async function verifyAuthToken(request: NextRequest): Promise<string | null> {
  if (!auth) return null;
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('認証トークン検証エラー:', error);
    return null;
  }
}

// 管理者権限をチェックするヘルパー関数
async function checkAdminRole(userId: string): Promise<boolean> {
  if (!adminDb) return false;
  
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    return userData?.role === 'admin';
  } catch (error) {
    console.error('管理者権限チェックエラー:', error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const authenticatedUserId = await verifyAuthToken(request);
    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 管理者権限チェック
    const isAdmin = await checkAdminRole(authenticatedUserId);
    if (!isAdmin) {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    // 管理者は全件取得可能、または特定ユーザーの文書を取得
    const targetUserId = userId || null;
    
    let q;
    
    if (targetUserId) {
      // userIdがある場合は、whereのみ（インデックス問題を回避）
      q = query(collection(db, 'manualDocuments'), where('userId', '==', targetUserId));
    } else {
      // userIdがない場合は、全件取得
      q = query(collection(db, 'manualDocuments'));
    }
    
    const querySnapshot = await getDocs(q);
    const documents = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate() : new Date(data.lastUpdated || Date.now())
      };
    });

    // クライアント側でソート（Firestoreのインデックス問題を回避）
    documents.sort((a, b) => {
      const dateA = a.lastUpdated instanceof Date ? a.lastUpdated : new Date(a.lastUpdated);
      const dateB = b.lastUpdated instanceof Date ? b.lastUpdated : new Date(b.lastUpdated);
      return dateB.getTime() - dateA.getTime();
    });

    return NextResponse.json({ 
      success: true, 
      documents 
    });

  } catch (error) {
    console.error('Manual document fetch error:', error);
    console.error('Error details:', error);
    return NextResponse.json({ 
      error: '文書の取得に失敗しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
