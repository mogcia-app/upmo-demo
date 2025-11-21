import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
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

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 管理者権限チェック
    const isAdmin = await checkAdminRole(userId);
    if (!isAdmin) {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const data = await request.json();
    const { title, description, type, sections, tags, priority } = data;
    
    if (!title) {
      return NextResponse.json({ error: 'タイトルが必要です' }, { status: 400 });
    }

    // Firestoreに保存
    const docRef = await addDoc(collection(db, 'manualDocuments'), {
      title,
      description: description || '',
      type: type || 'meeting',
      sections: sections || {
        overview: '',
        features: [],
        pricing: [],
        procedures: []
      },
      tags: tags || [],
      priority: priority || 'medium',
      userId, // 認証されたユーザーIDを使用
      createdAt: new Date(),
      lastUpdated: new Date()
    });

    return NextResponse.json({ 
      success: true, 
      documentId: docRef.id,
      message: '文書が正常に保存されました'
    });

  } catch (error) {
    console.error('Manual document save error:', error);
    return NextResponse.json({ error: '文書の保存に失敗しました' }, { status: 500 });
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
    
    let q = query(collection(db, 'manualDocuments'), orderBy('lastUpdated', 'desc'));
    
    if (targetUserId) {
      q = query(q, where('userId', '==', targetUserId));
    }
    
    const querySnapshot = await getDocs(q);
    const documents = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      lastUpdated: doc.data().lastUpdated?.toDate() || new Date()
    }));

    return NextResponse.json({ 
      success: true, 
      documents 
    });

  } catch (error) {
    console.error('Manual document fetch error:', error);
    return NextResponse.json({ error: '文書の取得に失敗しました' }, { status: 500 });
  }
}
