import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, orderBy, getDoc } from 'firebase/firestore';
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

// イベントを取得
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Firebaseが初期化されていません' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const userId = searchParams.get('userId');

    const authHeader = request.headers.get('Authorization');
    const decodedToken = await verifyAuthToken(authHeader);

    // 自分のイベントを取得
    const q = query(
      collection(db, 'events'),
      where('userId', '==', decodedToken.uid)
    );
    
    const querySnapshot = await getDocs(q);
    const events: any[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      events.push({
        id: doc.id,
        ...data,
        date: data.date,
        time: data.time || '',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      });
    });

    // 共有されているイベントも取得
    try {
      const sharedQuery = query(
        collection(db, 'events'),
        where('sharedWith', 'array-contains', decodedToken.uid)
      );
      const sharedSnapshot = await getDocs(sharedQuery);
      sharedSnapshot.forEach((doc) => {
        const data = doc.data();
        // 重複チェック
        if (!events.find(e => e.id === doc.id)) {
          events.push({
            id: doc.id,
            ...data,
            date: data.date,
            time: data.time || '',
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
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
    return NextResponse.json(
      { error: error.message || 'イベントの取得に失敗しました' },
      { status: error.message?.includes('認証') ? 401 : 500 }
    );
  }
}

// イベントを作成
export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Firebaseが初期化されていません' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('Authorization');
    const decodedToken = await verifyAuthToken(authHeader);

    const body = await request.json();
    const { title, date, time, description, location, color, member, sharedWith } = body;

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
      time: time || '',
      description: description || '',
      location: location || '',
      color: color || '#3B82F6',
      member: member || decodedToken.name || decodedToken.email || '自分',
      sharedWith: sharedWith || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'events'), eventData);

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
    if (!db) {
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
    const eventDoc = await getDoc(doc(db, 'events', id));
    if (!eventDoc.exists()) {
      return NextResponse.json(
        { error: 'イベントが見つかりません' },
        { status: 404 }
      );
    }

    const eventData = eventDoc.data();
    if (eventData.userId !== decodedToken.uid && !(eventData.sharedWith || []).includes(decodedToken.uid)) {
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

    await updateDoc(doc(db, 'events', id), updatedData);

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
    if (!db) {
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
    const eventDoc = doc(db, 'events', id);
    const eventSnapshot = await getDoc(eventDoc);
    
    if (!eventSnapshot.exists()) {
      return NextResponse.json(
        { error: 'イベントが見つかりません' },
        { status: 404 }
      );
    }

    const eventData = eventSnapshot.data();
    if (eventData.userId !== decodedToken.uid) {
      return NextResponse.json(
        { error: 'このイベントを削除する権限がありません' },
        { status: 403 }
      );
    }

    await deleteDoc(eventDoc);

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

