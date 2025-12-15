// 営業案件のCRUD操作API

import { NextRequest, NextResponse } from 'next/server';
import { SalesCase } from '@/types/sales';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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
const verifyAuthToken = async (authHeader: string | null) => {
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
      return decodedToken;
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

// 案件一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    // 認証トークンを検証
    const authHeader = request.headers.get('Authorization');
    const decodedToken = await verifyAuthToken(authHeader);
    
    // Firebase Admin SDKのFirestoreを初期化
    const db = initAdmin();
    
    // userIdが指定されていない場合、認証されたユーザーのIDを使用
    const targetUserId = userId || decodedToken.uid;

    // Firebase Admin SDKのFirestoreでクエリを構築
    let queryRef: any = db.collection('salesCases');

    if (targetUserId && status) {
      // 両方のフィルターがある場合
      queryRef = queryRef.where('userId', '==', targetUserId).where('status', '==', status).orderBy('updatedAt', 'desc');
    } else if (targetUserId) {
      // userIdのみ
      queryRef = queryRef.where('userId', '==', targetUserId).orderBy('updatedAt', 'desc');
    } else if (status) {
      // statusのみ（自分のデータのみ）
      queryRef = queryRef.where('userId', '==', decodedToken.uid).where('status', '==', status).orderBy('updatedAt', 'desc');
    } else {
      // 自分のデータのみ
      queryRef = queryRef.where('userId', '==', decodedToken.uid).orderBy('updatedAt', 'desc');
    }

    let querySnapshot;
    try {
      querySnapshot = await queryRef.get();
    } catch (queryError: any) {
      console.error('Firestoreクエリエラー:', queryError);
      // インデックスエラーの場合、フィルターなしで再試行
      if (queryError.code === 'failed-precondition') {
        console.warn('インデックスエラーが発生しました。フィルターなしで再試行します。');
        queryRef = db.collection('salesCases').orderBy('updatedAt', 'desc');
        querySnapshot = await queryRef.get();
      } else {
        throw queryError;
      }
    }

    const cases: SalesCase[] = [];

    querySnapshot.forEach((doc: any) => {
      const data = doc.data();
      cases.push({
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
      cases
    });

  } catch (error) {
    console.error('案件取得エラー:', error);
    return NextResponse.json(
      { error: '案件の取得に失敗しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// 案件作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('案件作成リクエスト:', JSON.stringify(body, null, 2));
    
    // 認証トークンを検証
    const authHeader = request.headers.get('Authorization');
    const decodedToken = await verifyAuthToken(authHeader);
    
    const {
      title,
      customerName,
      customerCompany,
      status,
      stage,
      expectedCloseDate,
      estimatedValue,
      probability,
      description,
      tags,
      assignedTo,
      assignedToName,
      userId
    } = body;

    // userIdは認証トークンから取得（リクエストのuserIdは無視）
    const authenticatedUserId = decodedToken.uid;

    if (!title || !customerName) {
      console.error('バリデーションエラー: 必須フィールドが不足', { title, customerName });
      return NextResponse.json(
        { error: '案件名と顧客名は必須です' },
        { status: 400 }
      );
    }

    // Firebase Admin SDKのFirestoreを初期化
    const db = initAdmin();

    const caseData: any = {
      title,
      customerName,
      status: status || 'prospecting',
      description: description || '',
      tags: tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: authenticatedUserId
    };

    // オプションフィールドを追加（nullの場合はフィールドを追加しない）
    if (customerCompany) caseData.customerCompany = customerCompany;
    if (stage) caseData.stage = stage;
    if (expectedCloseDate) {
      try {
        caseData.expectedCloseDate = new Date(expectedCloseDate);
      } catch (e) {
        console.warn('日付変換エラー:', e);
      }
    }
    if (estimatedValue !== undefined && estimatedValue !== null) caseData.estimatedValue = Number(estimatedValue);
    if (probability !== undefined && probability !== null) caseData.probability = Number(probability);
    if (assignedTo) caseData.assignedTo = assignedTo;
    if (assignedToName) caseData.assignedToName = assignedToName;

    console.log('保存するデータ:', JSON.stringify(caseData, null, 2));

    const docRef = await db.collection('salesCases').add(caseData);
    console.log('案件作成成功:', docRef.id);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      case: {
        id: docRef.id,
        ...caseData
      }
    });

  } catch (error) {
    console.error('案件作成エラー詳細:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('エラースタック:', errorStack);
    
    return NextResponse.json(
      { 
        error: '案件の作成に失敗しました', 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

// 案件更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: '案件IDが必要です' },
        { status: 400 }
      );
    }

    // 認証トークンを検証
    const authHeader = request.headers.get('Authorization');
    const decodedToken = await verifyAuthToken(authHeader);
    
    // Firebase Admin SDKのFirestoreを初期化
    const db = initAdmin();
    
    // 案件の所有者を確認
    const caseDoc = await db.collection('salesCases').doc(id).get();
    if (!caseDoc.exists) {
      return NextResponse.json(
        { error: '案件が見つかりません' },
        { status: 404 }
      );
    }
    
    const caseData = caseDoc.data();
    if (caseData?.userId !== decodedToken.uid) {
      return NextResponse.json(
        { error: 'この案件を更新する権限がありません' },
        { status: 403 }
      );
    }

    // 日付フィールドを変換
    if (updateData.expectedCloseDate) {
      updateData.expectedCloseDate = new Date(updateData.expectedCloseDate);
    }

    updateData.updatedAt = new Date();

    await db.collection('salesCases').doc(id).update(updateData);

    // 更新後のデータを取得
    const updatedDoc = await db.collection('salesCases').doc(id).get();
    const data = updatedDoc.data();

    return NextResponse.json({
      success: true,
      case: {
        id: updatedDoc.id,
        ...data,
        expectedCloseDate: data?.expectedCloseDate?.toDate ? data.expectedCloseDate.toDate() : data?.expectedCloseDate,
        createdAt: data?.createdAt?.toDate ? data.createdAt.toDate() : data?.createdAt,
        updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate() : data?.updatedAt
      }
    });

  } catch (error) {
    console.error('案件更新エラー:', error);
    return NextResponse.json(
      { error: '案件の更新に失敗しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// 案件削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '案件IDが必要です' },
        { status: 400 }
      );
    }

    // 認証トークンを検証
    const authHeader = request.headers.get('Authorization');
    const decodedToken = await verifyAuthToken(authHeader);
    
    // Firebase Admin SDKのFirestoreを初期化
    const db = initAdmin();
    
    // 案件の所有者を確認
    const caseDoc = await db.collection('salesCases').doc(id).get();
    if (!caseDoc.exists) {
      return NextResponse.json(
        { error: '案件が見つかりません' },
        { status: 404 }
      );
    }
    
    const caseData = caseDoc.data();
    if (caseData?.userId !== decodedToken.uid) {
      return NextResponse.json(
        { error: 'この案件を削除する権限がありません' },
        { status: 403 }
      );
    }

    await db.collection('salesCases').doc(id).delete();

    return NextResponse.json({
      success: true,
      message: '案件が削除されました'
    });

  } catch (error) {
    console.error('案件削除エラー:', error);
    return NextResponse.json(
      { error: '案件の削除に失敗しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

