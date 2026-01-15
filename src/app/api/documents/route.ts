import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { Document } from '@/types/document';
import { createNotificationInServer } from '../notifications/helper';

// Firebase Admin SDKの初期化
let adminDb: ReturnType<typeof getFirestore> | null = null;
let adminStorage: ReturnType<typeof getStorage> | null = null;

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
        adminStorage = getStorage();
      } catch (error) {
        console.error('Firebase Admin SDK初期化エラー:', error);
      }
    } else {
      console.warn('Firebase Admin SDKの環境変数が設定されていません');
    }
  } else {
    adminDb = getFirestore();
    adminStorage = getStorage();
  }
  return { db: adminDb, storage: adminStorage };
};

const getDb = () => {
  const { db } = initAdmin();
  if (!db) {
    throw new Error('Firebase Admin SDKが初期化されていません');
  }
  return db;
};

// 認証トークンを検証する関数
async function verifyToken(authHeader: string | null): Promise<string> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証トークンが提供されていません');
  }

  initAdmin();

  const token = authHeader.substring(7);
  const decodedToken = await getAuth().verifyIdToken(token);
  return decodedToken.uid;
}

// ドキュメント一覧取得
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const userId = await verifyToken(authHeader);

    const db = getDb();

    // ユーザー情報を取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';

    let query: any = db.collection('documents');

    // 会社名でフィルタリング
    if (companyName) {
      query = query.where('companyName', '==', companyName);
    } else {
      query = query.where('userId', '==', userId);
    }

    const snapshot = await query.get();
    const documents: Document[] = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Document;
    });

    // 作成日時でソート（新しい順）
    documents.sort((a: Document, b: Document) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });

    return NextResponse.json({ documents });
  } catch (error: any) {
    console.error('ドキュメント取得エラー:', error);
    return NextResponse.json(
      { error: 'ドキュメントの取得に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

// ドキュメント作成（ファイルアップロードは別エンドポイントで処理）
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const userId = await verifyToken(authHeader);

    const body = await request.json();
    const {
      title,
      fileName,
      fileUrl,
      fileSize,
      fileType,
      description,
      tags = [],
    } = body;

    if (!title || !fileName || !fileUrl) {
      return NextResponse.json(
        { error: 'タイトル、ファイル名、ファイルURLは必須です' },
        { status: 400 }
      );
    }

    const db = getDb();

    // ユーザー情報を取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';
    const displayName = userData?.displayName || '';

    const documentData = {
      title,
      fileName,
      fileUrl,
      fileSize: fileSize || 0,
      fileType: fileType || 'application/pdf',
      description: description || '',
      tags: Array.isArray(tags) ? tags : [],
      userId,
      companyName,
      createdBy: userId,
      createdByName: displayName,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      downloadCount: 0,
      isFavorite: false,
    };

    const docRef = await db.collection('documents').add(documentData);

    // 通知を作成
    await createNotificationInServer(db, userId, companyName, {
      type: 'create',
      pageName: 'ドキュメント',
      pageUrl: `/documents?id=${docRef.id}`,
      title: title,
      action: 'created',
    });

    return NextResponse.json({
      id: docRef.id,
      ...documentData,
      createdAt: documentData.createdAt.toDate(),
      updatedAt: documentData.updatedAt.toDate(),
    });
  } catch (error: any) {
    console.error('ドキュメント作成エラー:', error);
    return NextResponse.json(
      { error: 'ドキュメントの作成に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

// ドキュメント削除
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const userId = await verifyToken(authHeader);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ドキュメントIDが必要です' },
        { status: 400 }
      );
    }

    const db = getDb();

    // ドキュメントの所有者を確認
    const docDoc = await db.collection('documents').doc(id).get();
    if (!docDoc.exists) {
      return NextResponse.json(
        { error: 'ドキュメントが見つかりません' },
        { status: 404 }
      );
    }

    const docData = docDoc.data();
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';

    // 会社名が一致するか、作成者本人か確認
    if (docData?.companyName !== companyName && docData?.createdBy !== userId) {
      return NextResponse.json(
        { error: 'このドキュメントを削除する権限がありません' },
        { status: 403 }
      );
    }

    // ストレージからファイルを削除（オプション）
    // TODO: Firebase Storageからファイルを削除する処理を追加

    await db.collection('documents').doc(id).delete();

    // 通知を作成
    await createNotificationInServer(db, userId, companyName, {
      type: 'delete',
      pageName: 'ドキュメント',
      pageUrl: `/documents`,
      title: docData?.title || 'ドキュメント',
      action: 'deleted',
    });

    return NextResponse.json({
      message: 'ドキュメントが削除されました',
    });
  } catch (error: any) {
    console.error('ドキュメント削除エラー:', error);
    return NextResponse.json(
      { error: 'ドキュメントの削除に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

