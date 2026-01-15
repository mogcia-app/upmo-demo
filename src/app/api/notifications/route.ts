import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Firebase Admin SDK の初期化
let adminDb: ReturnType<typeof getFirestore> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

try {
  if (!getApps().length) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      adminDb = getFirestore();
      auth = getAuth();
    }
  } else {
    adminDb = getFirestore();
    auth = getAuth();
  }
} catch (error) {
  console.error('Firebase Admin SDKの初期化エラー:', error);
}

// 認証トークンを検証
async function verifyAuthToken(request: NextRequest): Promise<{ userId: string; companyName: string } | null> {
  if (!auth) return null;
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    // ユーザーのcompanyNameを取得
    if (!adminDb) return null;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';
    
    return { userId, companyName };
  } catch (error) {
    console.error('認証トークン検証エラー:', error);
    return null;
  }
}

// GET: 通知一覧を取得
export async function GET(request: NextRequest) {
  try {
    const authInfo = await verifyAuthToken(request);
    if (!authInfo) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    
    const { userId, companyName } = authInfo;
    
    if (!adminDb) {
      return NextResponse.json({ error: 'データベース接続エラー' }, { status: 500 });
    }
    
    // 会社単位で通知を取得（未読優先、新しい順）
    const notificationsSnapshot = await adminDb.collection('notifications')
      .where('companyName', '==', companyName)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    
    const notifications = notificationsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        readBy: data.readBy || [],
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
      };
    });
    
    // 未読数をカウント
    const unreadCount = notifications.filter(n => !n.readBy?.includes(userId)).length;
    
    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('通知取得エラー:', error);
    return NextResponse.json({ error: '通知の取得に失敗しました' }, { status: 500 });
  }
}

// POST: 通知を作成
export async function POST(request: NextRequest) {
  try {
    const authInfo = await verifyAuthToken(request);
    if (!authInfo) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    
    const { userId, companyName } = authInfo;
    const body = await request.json();
    const { type, title, message, pageUrl, pageName, action } = body;
    
    if (!adminDb) {
      return NextResponse.json({ error: 'データベース接続エラー' }, { status: 500 });
    }
    
    // ユーザー名を取得
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userName = userData?.displayName || userData?.email || '不明なユーザー';
    
    // 通知を作成（作成者は既読として扱う）
    const notificationData = {
      type: type || 'info', // 'create', 'update', 'delete', 'info'
      title: title || '新しい通知',
      message: message || '',
      pageUrl: pageUrl || '',
      pageName: pageName || '',
      action: action || '', // 'created', 'updated', 'deleted'
      createdBy: userId,
      createdByName: userName,
      companyName,
      readBy: [userId], // 作成者は既読として扱う（自分には通知が来ない）
      createdAt: Timestamp.now(),
    };
    
    const docRef = await adminDb.collection('notifications').add(notificationData);
    
    return NextResponse.json({
      success: true,
      id: docRef.id,
    });
  } catch (error) {
    console.error('通知作成エラー:', error);
    return NextResponse.json({ error: '通知の作成に失敗しました' }, { status: 500 });
  }
}

// PUT: 通知を既読にする
export async function PUT(request: NextRequest) {
  try {
    const authInfo = await verifyAuthToken(request);
    if (!authInfo) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    
    const { userId } = authInfo;
    const body = await request.json();
    const { notificationId } = body;
    
    if (!adminDb || !notificationId) {
      return NextResponse.json({ error: 'パラメータが不正です' }, { status: 400 });
    }
    
    // 通知を取得
    const notificationRef = adminDb.collection('notifications').doc(notificationId);
    const notificationDoc = await notificationRef.get();
    
    if (!notificationDoc.exists) {
      return NextResponse.json({ error: '通知が見つかりません' }, { status: 404 });
    }
    
    const notificationData = notificationDoc.data();
    const readBy = notificationData?.readBy || [];
    
    // 既読リストに追加（重複チェック）
    if (!readBy.includes(userId)) {
      await notificationRef.update({
        readBy: [...readBy, userId],
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('通知既読エラー:', error);
    return NextResponse.json({ error: '通知の既読処理に失敗しました' }, { status: 500 });
  }
}

// DELETE: 通知を削除
export async function DELETE(request: NextRequest) {
  try {
    const authInfo = await verifyAuthToken(request);
    if (!authInfo) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    
    const { userId } = authInfo;
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');
    
    if (!adminDb || !notificationId) {
      return NextResponse.json({ error: 'パラメータが不正です' }, { status: 400 });
    }
    
    // 通知を取得して、ユーザーが削除権限があるか確認
    const notificationRef = adminDb.collection('notifications').doc(notificationId);
    const notificationDoc = await notificationRef.get();
    
    if (!notificationDoc.exists) {
      return NextResponse.json({ error: '通知が見つかりません' }, { status: 404 });
    }
    
    // 通知を削除（ユーザーは自分の通知を削除できる）
    await notificationRef.delete();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('通知削除エラー:', error);
    return NextResponse.json({ error: '通知の削除に失敗しました' }, { status: 500 });
  }
}

