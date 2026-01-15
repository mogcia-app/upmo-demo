// 進捗メモへの返信追加API

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createNotificationInServer } from '../../../notifications/helper';

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
    
    try {
      initAdmin();
      const auth = getAuth();
      const decodedToken = await auth.verifyIdToken(token);
      const userId = decodedToken.uid;
      
      const db = initAdmin();
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const companyName = userData?.companyName || '';
      
      return { userId, companyName, decodedToken };
    } catch (adminError: any) {
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

// 返信を追加
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { noteId, content, userName } = body;

    if (!noteId || !content || !userName) {
      return NextResponse.json(
        { error: 'noteId、content、userNameは必須です' },
        { status: 400 }
      );
    }

    // 認証トークンを検証
    const authHeader = request.headers.get('Authorization');
    const { userId, companyName } = await verifyAuthToken(authHeader);
    
    // Firebase Admin SDKのFirestoreを初期化
    const db = initAdmin();
    
    // 進捗メモを取得
    const noteDoc = await db.collection('progressNotes').doc(noteId).get();
    if (!noteDoc.exists) {
      return NextResponse.json(
        { error: '進捗メモが見つかりません' },
        { status: 404 }
      );
    }

    const noteData = noteDoc.data();
    const existingReplies = noteData?.replies || [];
    
    // 新しい返信を作成
    const newReply = {
      id: Date.now().toString(),
      content: content.trim(),
      userId: userId,
      userName: userName.trim(),
      createdAt: Timestamp.now()
    };

    // 返信を追加
    await db.collection('progressNotes').doc(noteId).update({
      replies: [...existingReplies, newReply],
      updatedAt: Timestamp.now()
    });

    // 通知を作成（メモ作成者と共有者に送信）
    const notifyUserIds = [noteData?.userId];
    if (noteData?.sharedWith && Array.isArray(noteData.sharedWith)) {
      noteData.sharedWith.forEach((sharedUserId: string) => {
        if (sharedUserId !== userId && !notifyUserIds.includes(sharedUserId)) {
          notifyUserIds.push(sharedUserId);
        }
      });
    }

    // 各ユーザーに通知を送信
    for (const notifyUserId of notifyUserIds) {
      if (notifyUserId !== userId) {
        try {
          const notifyUserDoc = await db.collection('users').doc(notifyUserId).get();
          const notifyUserData = notifyUserDoc.data();
          const notifyCompanyName = notifyUserData?.companyName || companyName;

          await createNotificationInServer(db, notifyUserId, notifyCompanyName, {
            type: 'reply',
            pageName: '進捗メモ',
            pageUrl: `/sales/progress-notes?id=${noteId}`,
            title: `${userName}さんが「${noteData?.title || 'メモ'}」に返信しました`,
            action: 'replied',
          });
        } catch (notifyError) {
          console.error(`通知送信エラー (userId: ${notifyUserId}):`, notifyError);
        }
      }
    }

    // 更新後のデータを取得
    const updatedDoc = await db.collection('progressNotes').doc(noteId).get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      reply: {
        ...newReply,
        createdAt: newReply.createdAt.toDate()
      },
      note: {
        id: updatedDoc.id,
        ...updatedData,
        date: updatedData?.date?.toDate ? updatedData.date.toDate() : updatedData?.date,
        createdAt: updatedData?.createdAt?.toDate ? updatedData.createdAt.toDate() : updatedData?.createdAt,
        updatedAt: updatedData?.updatedAt?.toDate ? updatedData.updatedAt.toDate() : updatedData?.updatedAt,
        replies: (updatedData?.replies || []).map((reply: any) => ({
          ...reply,
          createdAt: reply.createdAt?.toDate ? reply.createdAt.toDate() : reply.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('返信追加エラー:', error);
    return NextResponse.json(
      { error: '返信の追加に失敗しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

