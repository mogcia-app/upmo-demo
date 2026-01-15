// 営業活動管理のCRUD操作API

import { NextRequest, NextResponse } from 'next/server';
import { SalesActivity } from '@/types/sales';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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
const verifyAuthToken = async (authHeader: string | null): Promise<{ userId: string; companyName: string }> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証が必要です');
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    
    initAdmin();
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    // ユーザーのcompanyNameを取得
    const db = initAdmin();
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';
    
    return { userId, companyName };
  } catch (error: any) {
    console.error('認証トークン検証エラー:', error);
    throw new Error('認証トークンの検証に失敗しました');
  }
};

// 営業活動一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const opportunityId = searchParams.get('opportunityId');

    const authHeader = request.headers.get('Authorization');
    const { userId, companyName } = await verifyAuthToken(authHeader);
    
    const db = initAdmin();
    
    // companyNameでフィルタリング（チーム共有）
    let queryRef: any = db.collection('salesActivities');
    
    if (companyName) {
      queryRef = queryRef.where('companyName', '==', companyName);
    } else {
      queryRef = queryRef.where('userId', '==', userId);
    }
    
    if (type && type !== 'all') {
      queryRef = queryRef.where('type', '==', type);
    }
    
    if (opportunityId) {
      queryRef = queryRef.where('opportunityId', '==', opportunityId);
    }
    
    queryRef = queryRef.orderBy('activityDate', 'desc');

    let querySnapshot;
    try {
      querySnapshot = await queryRef.get();
    } catch (queryError: any) {
      console.error('Firestoreクエリエラー:', queryError);
      if (queryError.code === 'failed-precondition') {
        console.warn('インデックスエラーが発生しました。フィルターなしで再試行します。');
        if (companyName) {
          queryRef = db.collection('salesActivities').where('companyNameForSharing', '==', companyName).orderBy('activityDate', 'desc');
        } else {
          queryRef = db.collection('salesActivities').where('userId', '==', userId).orderBy('activityDate', 'desc');
        }
        querySnapshot = await queryRef.get();
      } else {
        throw queryError;
      }
    }

    const activities: SalesActivity[] = [];

    querySnapshot.forEach((doc: any) => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        title: data.title || '',
        type: data.type || 'other',
        companyName: data.companyName,
        companyData: data.companyData || {},
        activityDate: data.activityDate?.toDate() || new Date(),
        participants: data.participants || [],
        participantNames: data.participantNames || [],
        description: data.description,
        outcome: data.outcome,
        nextAction: data.nextAction,
        tags: data.tags || [],
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        userId: data.userId || '',
        companyNameForSharing: data.companyNameForSharing || data.companyName || ''
      });
    });

    return NextResponse.json({
      success: true,
      activities
    });
  } catch (error: any) {
    console.error('営業活動取得エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '営業活動の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 営業活動作成
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const { userId, companyName: userCompanyName } = await verifyAuthToken(authHeader);
    
    const body = await request.json();
    const {
      title,
      type = 'other',
      companyName,
      companyData,
      activityDate,
      participants = [],
      description,
      outcome,
      nextAction,
      tags = []
    } = body;

    if (!title || !companyName || !activityDate) {
      return NextResponse.json(
        { success: false, error: 'タイトル、会社名、活動日は必須です' },
        { status: 400 }
      );
    }

    const db = initAdmin();
    
    // 参加者名を取得
    const participantNames: string[] = [];
    for (const participantId of participants) {
      if (participantId) {
        const participantDoc = await db.collection('users').doc(participantId).get();
        if (participantDoc.exists) {
          participantNames.push(participantDoc.data()?.displayName || '');
        }
      }
    }

    const activityData = {
      title,
      type,
      companyName: companyName || '',
      companyData: companyData || {},
      activityDate: Timestamp.fromDate(new Date(activityDate)),
      participants: Array.isArray(participants) ? participants : [],
      participantNames,
      description: description || '',
      outcome: outcome || '',
      nextAction: nextAction || '',
      tags: Array.isArray(tags) ? tags : [],
      userId,
      companyNameForSharing: userCompanyName || '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await db.collection('salesActivities').add(activityData);

    // 通知を作成
    await createNotificationInServer(db, userId, userCompanyName || '', {
      type: 'create',
      pageName: '営業活動',
      pageUrl: `/sales/activities?id=${docRef.id}`,
      title: title,
      action: 'created',
    });

    return NextResponse.json({
      success: true,
      activity: {
        id: docRef.id,
        ...activityData,
        activityDate: activityData.activityDate.toDate(),
        createdAt: activityData.createdAt.toDate(),
        updatedAt: activityData.updatedAt.toDate()
      }
    });
  } catch (error: any) {
    console.error('営業活動作成エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '営業活動の作成に失敗しました' },
      { status: 500 }
    );
  }
}

// 営業活動更新
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const { userId, companyName } = await verifyAuthToken(authHeader);
    
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '営業活動IDは必須です' },
        { status: 400 }
      );
    }

    const db = initAdmin();
    
    // 営業活動の存在確認と権限チェック
    const activityDoc = await db.collection('salesActivities').doc(id).get();
    if (!activityDoc.exists) {
      return NextResponse.json(
        { success: false, error: '営業活動が見つかりません' },
        { status: 404 }
      );
    }

    const activityData = activityDoc.data();
    if (activityData && (activityData.userId !== userId && activityData.companyNameForSharing !== companyName)) {
      return NextResponse.json(
        { success: false, error: 'アクセス権限がありません' },
        { status: 403 }
      );
    }

    // 参加者名を更新
    if (updates.participants) {
      const participantNames: string[] = [];
      for (const participantId of updates.participants) {
        if (participantId) {
          const participantDoc = await db.collection('users').doc(participantId).get();
          if (participantDoc.exists) {
            participantNames.push(participantDoc.data()?.displayName || '');
          }
        }
      }
      updates.participantNames = participantNames;
    }

    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.now()
    };

    // 日付フィールドを変換
    if (updateData.activityDate) {
      updateData.activityDate = Timestamp.fromDate(new Date(updateData.activityDate));
    }
    
    // 参加者名を更新
    if (updates.participants) {
      const participantNames: string[] = [];
      for (const participantId of updates.participants) {
        if (participantId) {
          const participantDoc = await db.collection('users').doc(participantId).get();
          if (participantDoc.exists) {
            participantNames.push(participantDoc.data()?.displayName || '');
          }
        }
      }
      updateData.participantNames = participantNames;
    }

    await db.collection('salesActivities').doc(id).update(updateData);

    const updatedDoc = await db.collection('salesActivities').doc(id).get();
    const updatedData = updatedDoc.data();

    // 通知を作成
    await createNotificationInServer(db, userId, companyName || '', {
      type: 'update',
      pageName: '営業活動',
      pageUrl: `/sales/activities?id=${id}`,
      title: updates.title || activityData?.title || '営業活動',
      action: 'updated',
    });

    return NextResponse.json({
      success: true,
      activity: {
        id: updatedDoc.id,
        ...updatedData,
        activityDate: updatedData?.activityDate?.toDate(),
        createdAt: updatedData?.createdAt?.toDate(),
        updatedAt: updatedData?.updatedAt?.toDate()
      }
    });
  } catch (error: any) {
    console.error('営業活動更新エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '営業活動の更新に失敗しました' },
      { status: 500 }
    );
  }
}

// 営業活動削除
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const { userId, companyName } = await verifyAuthToken(authHeader);
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '営業活動IDは必須です' },
        { status: 400 }
      );
    }

    const db = initAdmin();
    
    // 営業活動の存在確認と権限チェック
    const activityDoc = await db.collection('salesActivities').doc(id).get();
    if (!activityDoc.exists) {
      return NextResponse.json(
        { success: false, error: '営業活動が見つかりません' },
        { status: 404 }
      );
    }

    const activityData = activityDoc.data();
    if (activityData && (activityData.userId !== userId && activityData.companyNameForSharing !== companyName)) {
      return NextResponse.json(
        { success: false, error: 'アクセス権限がありません' },
        { status: 403 }
      );
    }

    await db.collection('salesActivities').doc(id).delete();

    // 通知を作成
    await createNotificationInServer(db, userId, companyName || '', {
      type: 'delete',
      pageName: '営業活動',
      pageUrl: `/sales/activities`,
      title: activityData?.title || '営業活動',
      action: 'deleted',
    });

    return NextResponse.json({
      success: true
    });
  } catch (error: any) {
    console.error('営業活動削除エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '営業活動の削除に失敗しました' },
      { status: 500 }
    );
  }
}

