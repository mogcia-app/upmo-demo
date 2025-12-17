import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, QueryDocumentSnapshot } from 'firebase-admin/firestore';

if (!getApps().length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
}

const auth = getApps().length > 0 ? getAuth() : null;
const db = getApps().length > 0 ? getFirestore() : null;

async function verifyAuthToken(request: NextRequest): Promise<string | null> {
  if (!auth) return null;
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('認証トークン検証エラー:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!auth || !db) {
      return NextResponse.json({ error: 'Firebase Admin SDK が初期化されていません。' }, { status: 500 });
    }

    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';

    let queryRef: any = db.collection('orders');
    if (companyName) {
      queryRef = queryRef.where('companyName', '==', companyName);
    } else {
      queryRef = queryRef.where('userId', '==', userId);
    }

    const ordersSnapshot = await queryRef.orderBy('createdAt', 'desc').get();
    
    const orders = ordersSnapshot.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                       data.createdAt?.toDate ? data.createdAt.toDate() : 
                       data.createdAt ? new Date(data.createdAt) : new Date();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : 
                       data.updatedAt?.toDate ? data.updatedAt.toDate() : 
                       data.updatedAt ? new Date(data.updatedAt) : new Date();
      
      return {
        id: doc.id,
        orderNumber: data.orderNumber || '',
        customerName: data.customerName || '',
        title: data.title || '',
        amount: data.amount || 0,
        status: data.status || 'pending',
        orderDate: data.orderDate || '',
        deliveryDate: data.deliveryDate || '',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        userId: data.userId || userId,
        companyName: data.companyName || companyName
      };
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('受注取得エラー:', error);
    return NextResponse.json({ error: '受注一覧の取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!auth || !db) {
      return NextResponse.json({ error: 'Firebase Admin SDK が初期化されていません。' }, { status: 500 });
    }

    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';

    const { orderNumber, customerName, title, amount, status, orderDate, deliveryDate } = await request.json();

    if (!orderNumber || !customerName || !title) {
      return NextResponse.json({ error: '受注番号、顧客名、タイトルは必須です' }, { status: 400 });
    }

    const orderData = {
      orderNumber,
      customerName,
      title,
      amount: amount || 0,
      status: status || 'pending',
      orderDate: orderDate || '',
      deliveryDate: deliveryDate || '',
      userId,
      companyName,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('orders').add(orderData);

    return NextResponse.json({
      success: true,
      order: {
        id: docRef.id,
        ...orderData,
        createdAt: orderData.createdAt.toISOString(),
        updatedAt: orderData.updatedAt.toISOString()
      }
    });
  } catch (error) {
    console.error('受注作成エラー:', error);
    return NextResponse.json({ error: '受注の作成に失敗しました' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!auth || !db) {
      return NextResponse.json({ error: 'Firebase Admin SDK が初期化されていません。' }, { status: 500 });
    }

    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id, ...updateData } = await request.json();
    if (!id) {
      return NextResponse.json({ error: '受注IDは必須です' }, { status: 400 });
    }

    const orderDoc = await db.collection('orders').doc(id).get();
    if (!orderDoc.exists) {
      return NextResponse.json({ error: '受注が見つかりません' }, { status: 404 });
    }

    const orderData = orderDoc.data();
    const companyName = orderData?.companyName || '';
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (orderData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json({ error: 'この受注を更新する権限がありません' }, { status: 403 });
    }

    updateData.updatedAt = new Date();
    await db.collection('orders').doc(id).update(updateData);

    const updatedDoc = await db.collection('orders').doc(id).get();
    const data = updatedDoc.data();
    const createdAt = data?.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                     data?.createdAt?.toDate ? data.createdAt.toDate() : 
                     data?.createdAt ? new Date(data.createdAt) : new Date();

    return NextResponse.json({
      success: true,
      order: {
        id: updatedDoc.id,
        ...data,
        createdAt: createdAt.toISOString(),
        updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('受注更新エラー:', error);
    return NextResponse.json({ error: '受注情報の更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!auth || !db) {
      return NextResponse.json({ error: 'Firebase Admin SDK が初期化されていません。' }, { status: 500 });
    }

    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '受注IDは必須です' }, { status: 400 });
    }

    const orderDoc = await db.collection('orders').doc(id).get();
    if (!orderDoc.exists) {
      return NextResponse.json({ error: '受注が見つかりません' }, { status: 404 });
    }

    const orderData = orderDoc.data();
    const companyName = orderData?.companyName || '';
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (orderData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json({ error: 'この受注を削除する権限がありません' }, { status: 403 });
    }

    await db.collection('orders').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('受注削除エラー:', error);
    return NextResponse.json({ error: '受注の削除に失敗しました' }, { status: 500 });
  }
}

