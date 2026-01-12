import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Firebase Admin SDKの初期化
let adminDb: ReturnType<typeof getFirestore> | null = null;

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
        adminDb = getFirestore();
      } catch (error) {
        console.error('Firebase Admin SDK初期化エラー:', error);
      }
    } else {
      console.warn('Firebase Admin SDKの環境変数が設定されていません');
    }
  } else {
    adminDb = getFirestore();
  }
  return adminDb;
};

const getDb = () => {
  if (!adminDb) {
    adminDb = initAdmin();
  }
  if (!adminDb) {
    throw new Error('Firebase Admin SDKが初期化されていません');
  }
  return adminDb;
};

// 認証トークンを検証する関数
async function verifyToken(authHeader: string | null): Promise<string> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証トークンが提供されていません');
  }

  // Firebase Admin SDKを初期化
  initAdmin();

  const token = authHeader.substring(7);
  const decodedToken = await getAuth().verifyIdToken(token);
  return decodedToken.uid;
}

// カスタムタブ一覧取得
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const userId = await verifyToken(authHeader);

    const db = getDb();

    // ユーザー情報を取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';

    // カスタムタブを取得（会社名またはユーザーIDでフィルタリング）
    let query: any = db.collection('templateTabs');
    if (companyName) {
      query = query.where('companyName', '==', companyName);
    } else {
      query = query.where('userId', '==', userId);
    }

    const snapshot = await query.get();
    const tabs = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ tabs });
  } catch (error: any) {
    console.error('カスタムタブ取得エラー:', error);
    return NextResponse.json(
      { error: 'カスタムタブの取得に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

// カスタムタブ作成
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const userId = await verifyToken(authHeader);

    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'タブ名は必須です' },
        { status: 400 }
      );
    }

    const db = getDb();

    // ユーザー情報を取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';

    const tabData = {
      name: name.trim(),
      userId,
      companyName,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await db.collection('templateTabs').add(tabData);

    return NextResponse.json({
      id: docRef.id,
      ...tabData,
      createdAt: tabData.createdAt.toDate(),
      updatedAt: tabData.updatedAt.toDate(),
    });
  } catch (error: any) {
    console.error('カスタムタブ作成エラー:', error);
    return NextResponse.json(
      { error: 'カスタムタブの作成に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

// カスタムタブ削除
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const userId = await verifyToken(authHeader);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'タブIDが必要です' },
        { status: 400 }
      );
    }

    const db = getDb();

    // タブの所有者を確認
    const tabDoc = await db.collection('templateTabs').doc(id).get();
    if (!tabDoc.exists) {
      return NextResponse.json(
        { error: 'タブが見つかりません' },
        { status: 404 }
      );
    }

    const tabData = tabDoc.data();
    if (tabData?.userId !== userId) {
      return NextResponse.json(
        { error: 'このタブを削除する権限がありません' },
        { status: 403 }
      );
    }

    await db.collection('templateTabs').doc(id).delete();

    return NextResponse.json({
      message: 'タブが削除されました',
    });
  } catch (error: any) {
    console.error('カスタムタブ削除エラー:', error);
    return NextResponse.json(
      { error: 'カスタムタブの削除に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

