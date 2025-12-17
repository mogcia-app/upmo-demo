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

// 顧客一覧取得
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

    // 同じcompanyNameの顧客を取得
    let queryRef: any = db.collection('customers');
    if (companyName) {
      queryRef = queryRef.where('companyName', '==', companyName);
    } else {
      // companyNameがない場合は自分のuserIdでフィルタ
      queryRef = queryRef.where('userId', '==', userId);
    }

    const customersSnapshot = await queryRef.orderBy('createdAt', 'desc').get();
    
    const customers = customersSnapshot.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      
      // TimestampをDateに変換
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

      let lastContact: Date;
      if (data.lastContact instanceof Timestamp) {
        lastContact = data.lastContact.toDate();
      } else if (data.lastContact?.toDate && typeof data.lastContact.toDate === 'function') {
        lastContact = data.lastContact.toDate();
      } else if (data.lastContact) {
        lastContact = new Date(data.lastContact);
      } else {
        lastContact = new Date();
      }
      
      return {
        id: doc.id,
        name: data.name || '',
        email: data.email || '',
        company: data.company || '',
        phone: data.phone || '',
        status: data.status || 'prospect',
        priority: data.priority || 'medium',
        lastContact: lastContact.toISOString(),
        notes: data.notes || '',
        createdAt: createdAt.toISOString(),
        userId: data.userId || userId,
        companyName: data.companyName || companyName
      };
    });

    return NextResponse.json({ customers });

  } catch (error) {
    console.error('顧客取得エラー:', error);
    return NextResponse.json(
      { error: '顧客一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 顧客作成
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

    const { name, email, company, phone, status, priority, notes } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: '顧客名は必須です' },
        { status: 400 }
      );
    }

    const customerData = {
      name,
      email: email || '',
      company: company || '',
      phone: phone || '',
      status: status || 'prospect',
      priority: priority || 'medium',
      lastContact: new Date(),
      notes: notes || '',
      userId,
      companyName,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('customers').add(customerData);

    return NextResponse.json({
      success: true,
      customer: {
        id: docRef.id,
        ...customerData,
        lastContact: customerData.lastContact.toISOString(),
        createdAt: customerData.createdAt.toISOString(),
        updatedAt: customerData.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('顧客作成エラー:', error);
    return NextResponse.json(
      { error: '顧客の作成に失敗しました' },
      { status: 500 }
    );
  }
}

// 顧客更新
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
        { error: '顧客IDは必須です' },
        { status: 400 }
      );
    }

    // 顧客の所有者を確認
    const customerDoc = await db.collection('customers').doc(id).get();
    if (!customerDoc.exists) {
      return NextResponse.json(
        { error: '顧客が見つかりません' },
        { status: 404 }
      );
    }

    const customerData = customerDoc.data();
    const companyName = customerData?.companyName || '';

    // 同じcompanyNameのユーザーまたは所有者のみ更新可能
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (customerData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json(
        { error: 'この顧客を更新する権限がありません' },
        { status: 403 }
      );
    }

    updateData.updatedAt = new Date();
    if (updateData.lastContact) {
      updateData.lastContact = new Date(updateData.lastContact);
    }

    await db.collection('customers').doc(id).update(updateData);

    // 更新後のデータを取得
    const updatedDoc = await db.collection('customers').doc(id).get();
    const data = updatedDoc.data();

    let lastContact: Date;
    if (data?.lastContact instanceof Timestamp) {
      lastContact = data.lastContact.toDate();
    } else if (data?.lastContact?.toDate && typeof data.lastContact.toDate === 'function') {
      lastContact = data.lastContact.toDate();
    } else if (data?.lastContact) {
      lastContact = new Date(data.lastContact);
    } else {
      lastContact = new Date();
    }

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
      customer: {
        id: updatedDoc.id,
        ...data,
        lastContact: lastContact.toISOString(),
        createdAt: createdAt.toISOString(),
        updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('顧客更新エラー:', error);
    return NextResponse.json(
      { error: '顧客情報の更新に失敗しました' },
      { status: 500 }
    );
  }
}

// 顧客削除
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
        { error: '顧客IDは必須です' },
        { status: 400 }
      );
    }

    // 顧客の所有者を確認
    const customerDoc = await db.collection('customers').doc(id).get();
    if (!customerDoc.exists) {
      return NextResponse.json(
        { error: '顧客が見つかりません' },
        { status: 404 }
      );
    }

    const customerData = customerDoc.data();
    const companyName = customerData?.companyName || '';

    // 同じcompanyNameのユーザーまたは所有者のみ削除可能
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (customerData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json(
        { error: 'この顧客を削除する権限がありません' },
        { status: 403 }
      );
    }

    // 関連する議事録も削除
    const meetingNotesSnapshot = await db.collection('meetingNotes')
      .where('customerId', '==', id)
      .get();
    
    const deletePromises = meetingNotesSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);

    // 顧客を削除
    await db.collection('customers').doc(id).delete();

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('顧客削除エラー:', error);
    return NextResponse.json(
      { error: '顧客の削除に失敗しました' },
      { status: 500 }
    );
  }
}

