// 進捗メモのCRUD操作API

import { NextRequest, NextResponse } from 'next/server';
import { ProgressNote } from '@/types/sales';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createNotificationInServer } from '../../notifications/helper';

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
  
  if (!adminDb) {
    throw new Error('Firebase Admin SDKが初期化されていません');
  }
  
  return adminDb;
};

// 認証トークンを検証
const verifyAuthToken = async (authHeader: string | null): Promise<{ userId: string; companyName: string; decodedToken: any }> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証が必要です');
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    
    // Firebase Admin SDKが利用可能か確認
    try {
      initAdmin();
      const auth = getAuth();
      const decodedToken = await auth.verifyIdToken(token);
      const userId = decodedToken.uid;
      
      // ユーザーのcompanyNameを取得
      const db = initAdmin();
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const companyName = userData?.companyName || '';
      
      return { userId, companyName, decodedToken };
    } catch (adminError: any) {
      // Firebase Admin SDKが初期化されていない場合
      if (adminError.message?.includes('getAuth') || adminError.message?.includes('not initialized')) {
        const errorMsg = 'Firebase Admin SDKが初期化されていません。.env.localファイルにFIREBASE_PROJECT_ID、FIREBASE_CLIENT_EMAIL、FIREBASE_PRIVATE_KEYを設定してください。';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      throw adminError;
    }
  } catch (error: any) {
    console.error('認証トークン検証エラー:', error);
    const errorMessage = error.message || '認証トークンの検証に失敗しました';
    throw new Error(errorMessage);
  }
};

// 進捗メモ一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    // 認証トークンを検証
    const authHeader = request.headers.get('Authorization');
    const { userId, companyName } = await verifyAuthToken(authHeader);
    
    // Firebase Admin SDKのFirestoreを初期化
    const db = initAdmin();
    
    // companyNameでフィルタリング（チーム共有）
    let queryRef: any = db.collection('progressNotes');
    
    if (companyName) {
      queryRef = queryRef.where('companyName', '==', companyName);
    } else {
      queryRef = queryRef.where('userId', '==', userId);
    }
    
    if (caseId) {
      queryRef = queryRef.where('caseId', '==', caseId);
    }
    
    queryRef = queryRef.orderBy('date', 'desc');

    let querySnapshot;
    try {
      querySnapshot = await queryRef.get();
    } catch (queryError: any) {
      console.error('Firestoreクエリエラー:', queryError);
      // インデックスエラーの場合、フィルターなしで再試行
      if (queryError.code === 'failed-precondition') {
        console.warn('インデックスエラーが発生しました。フィルターなしで再試行します。');
        if (companyName) {
          queryRef = db.collection('progressNotes').where('companyName', '==', companyName).orderBy('date', 'desc');
        } else {
          queryRef = db.collection('progressNotes').where('userId', '==', userId).orderBy('date', 'desc');
        }
        if (caseId) {
          queryRef = queryRef.where('caseId', '==', caseId);
        }
        querySnapshot = await queryRef.get();
      } else {
        throw queryError;
      }
    }

    const notes: ProgressNote[] = [];

    querySnapshot.forEach((doc: any) => {
      const data = doc.data();
      notes.push({
        id: doc.id,
        caseId: data.caseId,
        caseTitle: data.caseTitle,
        title: data.title || '',
        content: data.content || '',
        type: data.type || 'other',
        date: data.date?.toDate() || new Date(),
        participants: data.participants || [],
        nextActions: data.nextActions || [],
        risks: data.risks || [],
        tags: data.tags || [],
        priority: data.priority,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        userId: data.userId || '',
        isFavorite: data.isFavorite || false,
        sharedWith: data.sharedWith || []
      } as any);
    });

    return NextResponse.json({
      success: true,
      notes
    });

  } catch (error) {
    console.error('進捗メモ取得エラー:', error);
    return NextResponse.json(
      { error: '進捗メモの取得に失敗しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// 進捗メモ作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 認証トークンを検証
    const authHeader = request.headers.get('Authorization');
    const { userId, companyName } = await verifyAuthToken(authHeader);
    
    const {
      caseId,
      caseTitle,
      title,
      content,
      type,
      date,
      participants,
      nextActions,
      risks,
      tags,
      priority,
      isFavorite,
      sharedWith
    } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'タイトルと内容は必須です' },
        { status: 400 }
      );
    }

    // Firebase Admin SDKのFirestoreを初期化
    const db = initAdmin();

    const noteData = {
      caseId: caseId || null,
      caseTitle: caseTitle || null,
      title,
      content,
      type: type || 'other',
      date: date ? new Date(date) : new Date(),
      participants: participants || [],
      nextActions: nextActions || [],
      risks: risks || [],
      tags: tags || [],
      priority: priority || 'medium',
      isFavorite: isFavorite || false,
      sharedWith: sharedWith || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: userId,
      companyName: companyName || ''
    };

    const docRef = await db.collection('progressNotes').add(noteData);

    // 通知を作成
    await createNotificationInServer(db, userId, companyName || '', {
      type: 'create',
      pageName: '進捗メモ',
      pageUrl: `/sales/progress-notes?id=${docRef.id}`,
      title: title,
      action: 'created',
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
      note: {
        id: docRef.id,
        ...noteData
      }
    });

  } catch (error) {
    console.error('進捗メモ作成エラー:', error);
    return NextResponse.json(
      { error: '進捗メモの作成に失敗しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// 進捗メモ更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: '進捗メモIDが必要です' },
        { status: 400 }
      );
    }

    // 認証トークンを検証
    const authHeader = request.headers.get('Authorization');
    const { userId, companyName } = await verifyAuthToken(authHeader);
    
    // Firebase Admin SDKのFirestoreを初期化
    const db = initAdmin();
    
    // 進捗メモの所有者を確認
    const noteDoc = await db.collection('progressNotes').doc(id).get();
    if (!noteDoc.exists) {
      return NextResponse.json(
        { error: '進捗メモが見つかりません' },
        { status: 404 }
      );
    }
    
    const noteData = noteDoc.data();
    // 同じcompanyNameまたは所有者の場合のみ更新可能
    if (noteData?.userId !== userId && noteData?.companyName !== companyName) {
      return NextResponse.json(
        { error: 'この進捗メモを更新する権限がありません' },
        { status: 403 }
      );
    }

    // 日付フィールドを変換
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    updateData.updatedAt = new Date();

    await db.collection('progressNotes').doc(id).update(updateData);

    // 更新後のデータを取得
    const updatedDoc = await db.collection('progressNotes').doc(id).get();
    const data = updatedDoc.data();

    // 通知を作成
    await createNotificationInServer(db, userId, companyName || '', {
      type: 'update',
      pageName: '進捗メモ',
      pageUrl: `/sales/progress-notes?id=${id}`,
      title: updateData.title || noteData?.title || '進捗メモ',
      action: 'updated',
    });

    return NextResponse.json({
      success: true,
      note: {
        id: updatedDoc.id,
        ...data,
        date: data?.date?.toDate ? data.date.toDate() : data?.date,
        createdAt: data?.createdAt?.toDate ? data.createdAt.toDate() : data?.createdAt,
        updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate() : data?.updatedAt
      }
    });

  } catch (error) {
    console.error('進捗メモ更新エラー:', error);
    return NextResponse.json(
      { error: '進捗メモの更新に失敗しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// 進捗メモ削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '進捗メモIDが必要です' },
        { status: 400 }
      );
    }

    // 認証トークンを検証
    const authHeader = request.headers.get('Authorization');
    const { userId, companyName } = await verifyAuthToken(authHeader);
    
    // Firebase Admin SDKのFirestoreを初期化
    const db = initAdmin();
    
    // 進捗メモの所有者を確認
    const noteDoc = await db.collection('progressNotes').doc(id).get();
    if (!noteDoc.exists) {
      return NextResponse.json(
        { error: '進捗メモが見つかりません' },
        { status: 404 }
      );
    }
    
    const noteData = noteDoc.data();
    // 同じcompanyNameまたは所有者の場合のみ削除可能
    if (noteData?.userId !== userId && noteData?.companyName !== companyName) {
      return NextResponse.json(
        { error: 'この進捗メモを削除する権限がありません' },
        { status: 403 }
      );
    }

    await db.collection('progressNotes').doc(id).delete();

    // 通知を作成
    await createNotificationInServer(db, userId, companyName || '', {
      type: 'delete',
      pageName: '進捗メモ',
      pageUrl: `/sales/progress-notes`,
      title: noteData?.title || '進捗メモ',
      action: 'deleted',
    });

    return NextResponse.json({
      success: true,
      message: '進捗メモが削除されました'
    });

  } catch (error) {
    console.error('進捗メモ削除エラー:', error);
    return NextResponse.json(
      { error: '進捗メモの削除に失敗しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
