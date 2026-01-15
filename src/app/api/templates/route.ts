import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { Template } from '@/types/template';
import { createNotificationInServer } from '../notifications/helper';

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

// テンプレート一覧取得
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const userId = await verifyToken(authHeader);

    // クエリパラメータを取得
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const fromRSS = searchParams.get('fromRSS') === 'true';

    const db = getDb();

    // ユーザー情報を取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';

    let query: any = db.collection('templates');

    // 会社名でフィルタリング
    if (companyName) {
      query = query.where('companyName', '==', companyName);
    } else {
      query = query.where('userId', '==', userId);
    }

    // ステータスでフィルタリング
    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    // RSSフィルター
    if (fromRSS) {
      query = query.where('fromRSS', '==', true);
    }

    const snapshot = await query.get();
    let templates = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        scheduledStart: data.scheduledStart?.toDate(),
        scheduledEnd: data.scheduledEnd?.toDate(),
      };
    });

    // カテゴリでフィルタリング（クライアント側）
    if (category) {
      templates = templates.filter((t: Template) => t.category === category);
    }

    // 検索でフィルタリング（クライアント側）
    if (search) {
      const searchLower = search.toLowerCase();
      templates = templates.filter(
        (t: Template) =>
          t.title?.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower) ||
          t.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower))
      );
    }

    // 作成日時でソート（新しい順）
    templates.sort((a: Template, b: Template) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('テンプレート取得エラー:', error);
    return NextResponse.json(
      { error: 'テンプレートの取得に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

// テンプレート作成
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const userId = await verifyToken(authHeader);

    const body = await request.json();
    const {
      title,
      description,
      type,
      status = 'active',
      category,
      tags = [],
      content,
      fields = [],
      scheduledStart,
      scheduledEnd,
      fromRSS = false,
      tabId,
    } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'タイトルと内容は必須です' },
        { status: 400 }
      );
    }

    const db = getDb();

    // ユーザー情報を取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';
    const displayName = userData?.displayName || '';

    const templateData = {
      title,
      description: description || '',
      type: type || 'other',
      status,
      category: category || '',
      tags: Array.isArray(tags) ? tags : [],
      content,
      fields: Array.isArray(fields) ? fields : [],
      userId,
      companyName,
      createdBy: userId,
      createdByName: displayName,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      scheduledStart: scheduledStart ? Timestamp.fromDate(new Date(scheduledStart)) : null,
      scheduledEnd: scheduledEnd ? Timestamp.fromDate(new Date(scheduledEnd)) : null,
      views: 0,
      uses: 0,
      isFavorite: false,
      fromRSS: fromRSS || false,
      tabId: tabId || null,
    };

    const docRef = await db.collection('templates').add(templateData);

    // 通知を作成
    await createNotificationInServer(db, userId, companyName, {
      type: 'create',
      pageName: 'テンプレート管理',
      pageUrl: '/templates',
      title: `テンプレート「${title}」が追加されました`,
      action: 'created',
    });

    return NextResponse.json({
      id: docRef.id,
      ...templateData,
      createdAt: templateData.createdAt.toDate(),
      updatedAt: templateData.updatedAt.toDate(),
    });
  } catch (error: any) {
    console.error('テンプレート作成エラー:', error);
    return NextResponse.json(
      { error: 'テンプレートの作成に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

// テンプレート更新
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const userId = await verifyToken(authHeader);

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'テンプレートIDが必要です' },
        { status: 400 }
      );
    }

    // テンプレートの所有者を確認
    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { error: 'データベースに接続できません' },
        { status: 500 }
      );
    }
    const templateDoc = await db.collection('templates').doc(id).get();
    if (!templateDoc.exists) {
      return NextResponse.json(
        { error: 'テンプレートが見つかりません' },
        { status: 404 }
      );
    }

    const templateData = templateDoc.data();
    if (templateData?.userId !== userId && templateData?.createdBy !== userId) {
      return NextResponse.json(
        { error: 'このテンプレートを更新する権限がありません' },
        { status: 403 }
      );
    }

    // 日付フィールドを変換
    const updates: any = {
      ...updateData,
      updatedAt: Timestamp.now(),
    };

    if (updateData.scheduledStart) {
      updates.scheduledStart = Timestamp.fromDate(new Date(updateData.scheduledStart));
    }
    if (updateData.scheduledEnd) {
      updates.scheduledEnd = Timestamp.fromDate(new Date(updateData.scheduledEnd));
    }

    await db.collection('templates').doc(id).update(updates);

    // 通知を作成
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';
    await createNotificationInServer(db, userId, companyName, {
      type: 'update',
      pageName: 'テンプレート管理',
      pageUrl: '/templates',
      title: `テンプレート「${templateData.title || '（タイトルなし）'}」が編集されました`,
      action: 'updated',
    });

    return NextResponse.json({
      message: 'テンプレートが更新されました',
    });
  } catch (error: any) {
    console.error('テンプレート更新エラー:', error);
    return NextResponse.json(
      { error: 'テンプレートの更新に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

// テンプレート削除
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const userId = await verifyToken(authHeader);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'テンプレートIDが必要です' },
        { status: 400 }
      );
    }

    const db = getDb();

    // テンプレートの所有者を確認
    const templateDoc = await db.collection('templates').doc(id).get();
    if (!templateDoc.exists) {
      return NextResponse.json(
        { error: 'テンプレートが見つかりません' },
        { status: 404 }
      );
    }

    const templateData = templateDoc.data();
    if (templateData?.userId !== userId && templateData?.createdBy !== userId) {
      return NextResponse.json(
        { error: 'このテンプレートを削除する権限がありません' },
        { status: 403 }
      );
    }

    await db.collection('templates').doc(id).delete();

    return NextResponse.json({
      message: 'テンプレートが削除されました',
    });
  } catch (error: any) {
    console.error('テンプレート削除エラー:', error);
    return NextResponse.json(
      { error: 'テンプレートの削除に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}

