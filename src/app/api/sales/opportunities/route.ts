// 商談管理のCRUD操作API

import { NextRequest, NextResponse } from 'next/server';
import { SalesCase } from '@/types/sales';
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

// 商談一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const authHeader = request.headers.get('Authorization');
    const { userId, companyName } = await verifyAuthToken(authHeader);
    
    const db = initAdmin();
    
    // companyNameでフィルタリング（チーム共有）
    let queryRef: any = db.collection('salesOpportunities');
    
    if (companyName) {
      queryRef = queryRef.where('companyName', '==', companyName);
    } else {
      queryRef = queryRef.where('userId', '==', userId);
    }
    
    if (status && status !== 'all') {
      queryRef = queryRef.where('status', '==', status);
    }
    
    queryRef = queryRef.orderBy('updatedAt', 'desc');

    let querySnapshot;
    try {
      querySnapshot = await queryRef.get();
    } catch (queryError: any) {
      console.error('Firestoreクエリエラー:', queryError);
      if (queryError.code === 'failed-precondition') {
        console.warn('インデックスエラーが発生しました。フィルターなしで再試行します。');
        if (companyName) {
          queryRef = db.collection('salesOpportunities').where('companyName', '==', companyName).orderBy('updatedAt', 'desc');
        } else {
          queryRef = db.collection('salesOpportunities').where('userId', '==', userId).orderBy('updatedAt', 'desc');
        }
        querySnapshot = await queryRef.get();
      } else {
        throw queryError;
      }
    }

    const opportunities: SalesCase[] = [];

    querySnapshot.forEach((doc: any) => {
      const data = doc.data();
      opportunities.push({
        id: doc.id,
        title: data.title || '',
        customerName: data.customerName || '',
        customerCompany: data.customerCompany,
        status: data.status || 'prospecting',
        stage: data.stage,
        expectedCloseDate: data.expectedCloseDate?.toDate(),
        estimatedValue: data.estimatedValue,
        probability: data.probability,
        description: data.description,
        tags: data.tags || [],
        assignedTo: data.assignedTo,
        assignedToName: data.assignedToName,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        userId: data.userId || ''
      });
    });

    return NextResponse.json({
      success: true,
      opportunities
    });
  } catch (error: any) {
    console.error('商談取得エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '商談の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 商談作成
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const { userId, companyName } = await verifyAuthToken(authHeader);
    
    const body = await request.json();
    const {
      title,
      customerName,
      customerCompany,
      status = 'prospecting',
      stage,
      expectedCloseDate,
      estimatedValue,
      probability,
      description,
      tags = [],
      assignedTo,
      assignedToName
    } = body;

    if (!title || !customerName) {
      return NextResponse.json(
        { success: false, error: '案件名と顧客名は必須です' },
        { status: 400 }
      );
    }

    const db = initAdmin();
    
    // 担当者名を取得
    let finalAssignedToName = assignedToName;
    if (assignedTo && !assignedToName) {
      const assignedUserDoc = await db.collection('users').doc(assignedTo).get();
      if (assignedUserDoc.exists) {
        finalAssignedToName = assignedUserDoc.data()?.displayName || '';
      }
    }

    const opportunityData = {
      title,
      customerName,
      customerCompany: customerCompany || '',
      status,
      stage: stage || '',
      expectedCloseDate: expectedCloseDate ? Timestamp.fromDate(new Date(expectedCloseDate)) : null,
      estimatedValue: estimatedValue || null,
      probability: probability || null,
      description: description || '',
      tags: Array.isArray(tags) ? tags : [],
      assignedTo: assignedTo || '',
      assignedToName: finalAssignedToName || '',
      userId,
      companyName: companyName || '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await db.collection('salesOpportunities').add(opportunityData);

    // 通知を作成
    const { createNotificationInServer } = await import('../../notifications/helper');
    await createNotificationInServer(db, userId, companyName || '', {
      type: 'create',
      pageName: '営業案件',
      pageUrl: '/sales/opportunities',
      title: `営業案件「${title}」が追加されました`,
      action: 'created',
    });

    return NextResponse.json({
      success: true,
      opportunity: {
        id: docRef.id,
        ...opportunityData,
        expectedCloseDate: opportunityData.expectedCloseDate?.toDate(),
        createdAt: opportunityData.createdAt.toDate(),
        updatedAt: opportunityData.updatedAt.toDate()
      }
    });
  } catch (error: any) {
    console.error('商談作成エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '商談の作成に失敗しました' },
      { status: 500 }
    );
  }
}

// 商談更新
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const { userId, companyName } = await verifyAuthToken(authHeader);
    
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '商談IDは必須です' },
        { status: 400 }
      );
    }

    const db = initAdmin();
    
    // 商談の存在確認と権限チェック
    const opportunityDoc = await db.collection('salesOpportunities').doc(id).get();
    if (!opportunityDoc.exists) {
      return NextResponse.json(
        { success: false, error: '商談が見つかりません' },
        { status: 404 }
      );
    }

    const opportunityData = opportunityDoc.data();
    if (opportunityData && (opportunityData.userId !== userId && opportunityData.companyName !== companyName)) {
      return NextResponse.json(
        { success: false, error: 'アクセス権限がありません' },
        { status: 403 }
      );
    }

    // 担当者名を取得
    if (updates.assignedTo && !updates.assignedToName) {
      const assignedUserDoc = await db.collection('users').doc(updates.assignedTo).get();
      if (assignedUserDoc.exists) {
        updates.assignedToName = assignedUserDoc.data()?.displayName || '';
      }
    }

    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.now()
    };

    // 日付フィールドを変換
    if (updateData.expectedCloseDate) {
      updateData.expectedCloseDate = Timestamp.fromDate(new Date(updateData.expectedCloseDate));
    }

    await db.collection('salesOpportunities').doc(id).update(updateData);

    // 通知を作成
    const { createNotificationInServer } = await import('../../notifications/helper');
    await createNotificationInServer(db, userId, companyName || '', {
      type: 'update',
      pageName: '営業案件',
      pageUrl: '/sales/opportunities',
      title: `営業案件「${opportunityData?.title || updateData?.title || '（タイトルなし）'}」が編集されました`,
      action: 'updated',
    });

    const updatedDoc = await db.collection('salesOpportunities').doc(id).get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      opportunity: {
        id: updatedDoc.id,
        ...updatedData,
        expectedCloseDate: updatedData?.expectedCloseDate?.toDate(),
        createdAt: updatedData?.createdAt?.toDate(),
        updatedAt: updatedData?.updatedAt?.toDate()
      }
    });
  } catch (error: any) {
    console.error('商談更新エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '商談の更新に失敗しました' },
      { status: 500 }
    );
  }
}

// 商談削除
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const { userId, companyName } = await verifyAuthToken(authHeader);
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '商談IDは必須です' },
        { status: 400 }
      );
    }

    const db = initAdmin();
    
    // 商談の存在確認と権限チェック
    const opportunityDoc = await db.collection('salesOpportunities').doc(id).get();
    if (!opportunityDoc.exists) {
      return NextResponse.json(
        { success: false, error: '商談が見つかりません' },
        { status: 404 }
      );
    }

    const opportunityData = opportunityDoc.data();
    if (opportunityData && (opportunityData.userId !== userId && opportunityData.companyName !== companyName)) {
      return NextResponse.json(
        { success: false, error: 'アクセス権限がありません' },
        { status: 403 }
      );
    }

    await db.collection('salesOpportunities').doc(id).delete();

    return NextResponse.json({
      success: true
    });
  } catch (error: any) {
    console.error('商談削除エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '商談の削除に失敗しました' },
      { status: 500 }
    );
  }
}

