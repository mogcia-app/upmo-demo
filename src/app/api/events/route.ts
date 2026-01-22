import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createNotificationInServer } from '../notifications/helper';

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

// イベントを取得
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

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const userId = searchParams.get('userId');

    const authHeader = request.headers.get('Authorization');
    const decodedToken = await verifyAuthToken(authHeader);

    // 現在のユーザーのcompanyNameを取得
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    const currentCompanyName = userData?.companyName || '';

    // 同じcompanyNameのユーザーIDを取得
    let companyUserIds: string[] = [decodedToken.uid]; // 自分を含める
    
    if (currentCompanyName) {
      try {
        const companyUsersSnapshot = await adminDb.collection('users')
          .where('companyName', '==', currentCompanyName)
          .get();
        
        companyUserIds = companyUsersSnapshot.docs.map(doc => doc.id);
      } catch (error) {
        console.error('同じ会社のユーザー取得エラー:', error);
        // エラーが発生した場合は自分のIDのみを使用
      }
    }

    const events: any[] = [];

    // 同じcompanyNameのユーザー全員のイベントを取得
    try {
      // バッチクエリで取得（Firestoreの制限: where句は10個まで）
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < companyUserIds.length; i += batchSize) {
        const batch = companyUserIds.slice(i, i + batchSize);
        batches.push(batch);
      }

      // 各バッチでクエリを実行
      for (const batch of batches) {
        if (batch.length === 1) {
          // 1つのユーザーのイベントを取得
          const snapshot = await adminDb.collection('events')
            .where('userId', '==', batch[0])
            .get();
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            // 重複チェック
            if (!events.find(e => e.id === doc.id)) {
              events.push({
                id: doc.id,
                ...data,
                date: data.date,
                time: data.time || '',
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()),
                updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : (data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()),
              });
            }
          });
        } else {
          // 複数のユーザーのイベントを取得（in演算子を使用）
          const snapshot = await adminDb.collection('events')
            .where('userId', 'in', batch)
            .get();
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            // 重複チェック
            if (!events.find(e => e.id === doc.id)) {
              events.push({
                id: doc.id,
                ...data,
                date: data.date,
                time: data.time || '',
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()),
                updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : (data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()),
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('イベント取得エラー:', error);
      // エラーが発生した場合は自分のイベントのみを取得
      try {
    const myEventsSnapshot = await adminDb.collection('events')
      .where('userId', '==', decodedToken.uid)
      .get();

    myEventsSnapshot.forEach((doc) => {
      const data = doc.data();
          if (!events.find(e => e.id === doc.id)) {
      events.push({
        id: doc.id,
        ...data,
        date: data.date,
        time: data.time || '',
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : (data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()),
      });
          }
    });
      } catch (fallbackError) {
        console.error('フォールバックイベント取得エラー:', fallbackError);
      }
    }

    // 共有されているイベントも取得（sharedWithで明示的に共有されたもの）
    try {
      const sharedSnapshot = await adminDb.collection('events')
        .where('sharedWith', 'array-contains', decodedToken.uid)
        .get();
      
      sharedSnapshot.forEach((doc) => {
        const data = doc.data();
        // 重複チェック
        if (!events.find(e => e.id === doc.id)) {
          events.push({
            id: doc.id,
            ...data,
            date: data.date,
            time: data.time || '',
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : (data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()),
          });
        }
      });
    } catch (error) {
      console.error('共有イベント取得エラー:', error);
    }

    // 日付でフィルタ
    let filteredEvents = events;
    if (date) {
      filteredEvents = events.filter(e => e.date === date);
    }

    // 日付と時間でソート
    filteredEvents.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return (a.time || '').localeCompare(b.time || '');
    });

    return NextResponse.json({ success: true, events: filteredEvents });
  } catch (error: any) {
    console.error('イベント取得エラー:', error);
    console.error('エラー詳細:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return NextResponse.json(
      { 
        error: error.message || 'イベントの取得に失敗しました',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: error.message?.includes('認証') ? 401 : 500 }
    );
  }
}

// イベントを作成
export async function POST(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebaseが初期化されていません' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('Authorization');
    const decodedToken = await verifyAuthToken(authHeader);

    const body = await request.json();
    const { title, date, endDate, time, description, location, color, member, sharedWith, attendees, status, type } = body;

    if (!title || !date) {
      return NextResponse.json(
        { error: 'タイトルと日付は必須です' },
        { status: 400 }
      );
    }

    const eventData = {
      userId: decodedToken.uid,
      title,
      date,
      endDate: endDate || date, // 終了日が指定されていない場合は開始日と同じ
      time: time || '',
      description: description || '',
      location: location || '',
      color: color || '#3B82F6',
      member: member || decodedToken.name || decodedToken.email || '自分',
      sharedWith: sharedWith || [],
      attendees: attendees || [],
      status: status || 'todo',
      type: type || 'private',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await adminDb.collection('events').add(eventData);

    // ユーザーのcompanyNameを取得
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';

    // 通知を作成
    await createNotificationInServer(adminDb, decodedToken.uid, companyName, {
      type: 'create',
      pageName: 'カレンダー',
      pageUrl: `/calendar?id=${docRef.id}`,
      title: title,
      action: 'created',
    });

    return NextResponse.json({
      success: true,
      event: {
        id: docRef.id,
        ...eventData,
        createdAt: eventData.createdAt.toDate().toISOString(),
        updatedAt: eventData.updatedAt.toDate().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('イベント作成エラー:', error);
    return NextResponse.json(
      { error: error.message || 'イベントの作成に失敗しました' },
      { status: error.message?.includes('認証') ? 401 : 500 }
    );
  }
}

// イベントを更新
export async function PUT(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebaseが初期化されていません' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('Authorization');
    const decodedToken = await verifyAuthToken(authHeader);

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'イベントIDは必須です' },
        { status: 400 }
      );
    }

    // イベントの所有者を確認
    const eventDoc = await adminDb.collection('events').doc(id).get();
    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: 'イベントが見つかりません' },
        { status: 404 }
      );
    }

    const eventData = eventDoc.data();
    if (eventData?.userId !== decodedToken.uid && !(eventData?.sharedWith || []).includes(decodedToken.uid)) {
      return NextResponse.json(
        { error: 'このイベントを更新する権限がありません' },
        { status: 403 }
      );
    }

    // 更新データを準備
    const updatedData = {
      ...updateData,
      updatedAt: Timestamp.now(),
    };

    await adminDb.collection('events').doc(id).update(updatedData);

    // ユーザーのcompanyNameを取得
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';

    // 通知を作成
    await createNotificationInServer(adminDb, decodedToken.uid, companyName, {
      type: 'update',
      pageName: 'カレンダー',
      pageUrl: `/calendar?id=${id}`,
      title: updateData.title || eventData?.title || 'イベント',
      action: 'updated',
    });

    return NextResponse.json({
      success: true,
      message: 'イベントが更新されました',
    });
  } catch (error: any) {
    console.error('イベント更新エラー:', error);
    return NextResponse.json(
      { error: error.message || 'イベントの更新に失敗しました' },
      { status: error.message?.includes('認証') ? 401 : 500 }
    );
  }
}

// イベントを削除
export async function DELETE(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebaseが初期化されていません' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('Authorization');
    const decodedToken = await verifyAuthToken(authHeader);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'イベントIDは必須です' },
        { status: 400 }
      );
    }

    // イベントの所有者を確認
    const eventDoc = await adminDb.collection('events').doc(id).get();
    
    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: 'イベントが見つかりません' },
        { status: 404 }
      );
    }

    const eventData = eventDoc.data();
    if (eventData?.userId !== decodedToken.uid) {
      return NextResponse.json(
        { error: 'このイベントを削除する権限がありません' },
        { status: 403 }
      );
    }

    await adminDb.collection('events').doc(id).delete();

    // ユーザーのcompanyNameを取得
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';

    // 通知を作成
    await createNotificationInServer(adminDb, decodedToken.uid, companyName, {
      type: 'delete',
      pageName: 'カレンダー',
      pageUrl: `/calendar`,
      title: eventData?.title || 'イベント',
      action: 'deleted',
    });

    return NextResponse.json({
      success: true,
      message: 'イベントが削除されました',
    });
  } catch (error: any) {
    console.error('イベント削除エラー:', error);
    return NextResponse.json(
      { error: error.message || 'イベントの削除に失敗しました' },
      { status: error.message?.includes('認証') ? 401 : 500 }
    );
  }
}

