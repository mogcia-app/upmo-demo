import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, QueryDocumentSnapshot } from 'firebase-admin/firestore';

// Firebase Admin SDK の初期化
if (!getApps().length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    initializeApp({
      credential: cert(serviceAccount),
    });
  }
}

const auth = getApps().length > 0 ? getAuth() : null;
const db = getApps().length > 0 ? getFirestore() : null;

// 認証トークンを検証するヘルパー関数
async function verifyAuthToken(request: NextRequest): Promise<string | null> {
  if (!auth) return null;
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('認証トークン検証エラー:', error);
    return null;
  }
}

// 見積一覧取得
export async function GET(request: NextRequest) {
  try {
    if (!auth || !db) {
      return NextResponse.json({ 
        error: 'Firebase Admin SDK が初期化されていません。環境変数を設定してください。' 
      }, { status: 500 });
    }

    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 現在のユーザーのcompanyNameを取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';

    // 同じcompanyNameの見積を取得
    let queryRef: any = db.collection('quotes');
    if (companyName) {
      queryRef = queryRef.where('companyName', '==', companyName);
    } else {
      queryRef = queryRef.where('userId', '==', userId);
    }

    const quotesSnapshot = await queryRef.orderBy('createdAt', 'desc').get();
    
    const quotes = quotesSnapshot.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      
      let createdAt: Date;
      if (data.createdAt instanceof Timestamp) {
        createdAt = data.createdAt.toDate();
      } else if (data.createdAt?.toDate && typeof data.createdAt.toDate === 'function') {
        createdAt = data.createdAt.toDate();
      } else if (data.createdAt) {
        createdAt = new Date(data.createdAt);
      } else {
        createdAt = new Date();
      }

      let updatedAt: Date;
      if (data.updatedAt instanceof Timestamp) {
        updatedAt = data.updatedAt.toDate();
      } else if (data.updatedAt?.toDate && typeof data.updatedAt.toDate === 'function') {
        updatedAt = data.updatedAt.toDate();
      } else if (data.updatedAt) {
        updatedAt = new Date(data.updatedAt);
      } else {
        updatedAt = new Date();
      }
      
      return {
        id: doc.id,
        quoteNumber: data.quoteNumber || '',
        customerName: data.customerName || '',
        title: data.title || '',
        amount: data.amount || 0,
        status: data.status || 'draft',
        validUntil: data.validUntil || '',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        userId: data.userId || userId,
        companyName: data.companyName || companyName
      };
    });

    return NextResponse.json({ quotes });

  } catch (error) {
    console.error('見積取得エラー:', error);
    return NextResponse.json(
      { error: '見積一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 見積作成
export async function POST(request: NextRequest) {
  try {
    if (!auth || !db) {
      return NextResponse.json({ 
        error: 'Firebase Admin SDK が初期化されていません。環境変数を設定してください。' 
      }, { status: 500 });
    }

    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 現在のユーザーのcompanyNameを取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';

    const { quoteNumber, customerName, title, amount, status, validUntil } = await request.json();

    if (!quoteNumber || !customerName || !title) {
      return NextResponse.json(
        { error: '見積番号、顧客名、タイトルは必須です' },
        { status: 400 }
      );
    }

    const quoteData = {
      quoteNumber,
      customerName,
      title,
      amount: amount || 0,
      status: status || 'draft',
      validUntil: validUntil || '',
      userId,
      companyName,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('quotes').add(quoteData);

    return NextResponse.json({
      success: true,
      quote: {
        id: docRef.id,
        ...quoteData,
        createdAt: quoteData.createdAt.toISOString(),
        updatedAt: quoteData.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('見積作成エラー:', error);
    return NextResponse.json(
      { error: '見積の作成に失敗しました' },
      { status: 500 }
    );
  }
}

// 見積更新
export async function PUT(request: NextRequest) {
  try {
    if (!auth || !db) {
      return NextResponse.json({ 
        error: 'Firebase Admin SDK が初期化されていません。環境変数を設定してください。' 
      }, { status: 500 });
    }

    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const { id, ...updateData } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: '見積IDは必須です' },
        { status: 400 }
      );
    }

    // 見積の所有者を確認
    const quoteDoc = await db.collection('quotes').doc(id).get();
    if (!quoteDoc.exists) {
      return NextResponse.json(
        { error: '見積が見つかりません' },
        { status: 404 }
      );
    }

    const quoteData = quoteDoc.data();
    const companyName = quoteData?.companyName || '';

    // 同じcompanyNameのユーザーまたは所有者のみ更新可能
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (quoteData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json(
        { error: 'この見積を更新する権限がありません' },
        { status: 403 }
      );
    }

    updateData.updatedAt = new Date();

    await db.collection('quotes').doc(id).update(updateData);

    // 更新後のデータを取得
    const updatedDoc = await db.collection('quotes').doc(id).get();
    const data = updatedDoc.data();

    let createdAt: Date;
    if (data?.createdAt instanceof Timestamp) {
      createdAt = data.createdAt.toDate();
    } else if (data?.createdAt?.toDate && typeof data.createdAt.toDate === 'function') {
      createdAt = data.createdAt.toDate();
    } else if (data?.createdAt) {
      createdAt = new Date(data.createdAt);
    } else {
      createdAt = new Date();
    }

    return NextResponse.json({
      success: true,
      quote: {
        id: updatedDoc.id,
        ...data,
        createdAt: createdAt.toISOString(),
        updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('見積更新エラー:', error);
    return NextResponse.json(
      { error: '見積情報の更新に失敗しました' },
      { status: 500 }
    );
  }
}

// 見積削除
export async function DELETE(request: NextRequest) {
  try {
    if (!auth || !db) {
      return NextResponse.json({ 
        error: 'Firebase Admin SDK が初期化されていません。環境変数を設定してください。' 
      }, { status: 500 });
    }

    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '見積IDは必須です' },
        { status: 400 }
      );
    }

    // 見積の所有者を確認
    const quoteDoc = await db.collection('quotes').doc(id).get();
    if (!quoteDoc.exists) {
      return NextResponse.json(
        { error: '見積が見つかりません' },
        { status: 404 }
      );
    }

    const quoteData = quoteDoc.data();
    const companyName = quoteData?.companyName || '';

    // 同じcompanyNameのユーザーまたは所有者のみ削除可能
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (quoteData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json(
        { error: 'この見積を削除する権限がありません' },
        { status: 403 }
      );
    }

    await db.collection('quotes').doc(id).delete();

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('見積削除エラー:', error);
    return NextResponse.json(
      { error: '見積の削除に失敗しました' },
      { status: 500 }
    );
  }
}

