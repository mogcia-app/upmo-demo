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

    let queryRef: any = db.collection('purchases');
    if (companyName) {
      queryRef = queryRef.where('companyName', '==', companyName);
    } else {
      queryRef = queryRef.where('userId', '==', userId);
    }

    const purchasesSnapshot = await queryRef.orderBy('createdAt', 'desc').get();
    
    const purchases = purchasesSnapshot.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                       data.createdAt?.toDate ? data.createdAt.toDate() : 
                       data.createdAt ? new Date(data.createdAt) : new Date();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : 
                       data.updatedAt?.toDate ? data.updatedAt.toDate() : 
                       data.updatedAt ? new Date(data.updatedAt) : new Date();
      
      const quantity = data.quantity || 0;
      const unitPrice = data.unitPrice || 0;
      const totalAmount = quantity * unitPrice;
      
      return {
        id: doc.id,
        purchaseNumber: data.purchaseNumber || '',
        supplierName: data.supplierName || '',
        itemName: data.itemName || '',
        quantity,
        unit: data.unit || '個',
        unitPrice,
        totalAmount,
        status: data.status || 'draft',
        orderDate: data.orderDate || '',
        expectedDeliveryDate: data.expectedDeliveryDate || '',
        receivedDate: data.receivedDate || '',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        userId: data.userId || userId,
        companyName: data.companyName || companyName
      };
    });

    return NextResponse.json({ purchases });
  } catch (error) {
    console.error('発注取得エラー:', error);
    return NextResponse.json({ error: '発注一覧の取得に失敗しました' }, { status: 500 });
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

    const { purchaseNumber, supplierName, itemName, quantity, unit, unitPrice, status, orderDate, expectedDeliveryDate } = await request.json();

    if (!purchaseNumber || !supplierName || !itemName) {
      return NextResponse.json({ error: '発注番号、仕入先名、商品名は必須です' }, { status: 400 });
    }

    const purchaseQuantity = quantity || 0;
    const purchaseUnitPrice = unitPrice || 0;
    const totalAmount = purchaseQuantity * purchaseUnitPrice;

    const purchaseData = {
      purchaseNumber,
      supplierName,
      itemName,
      quantity: purchaseQuantity,
      unit: unit || '個',
      unitPrice: purchaseUnitPrice,
      totalAmount,
      status: status || 'draft',
      orderDate: orderDate || '',
      expectedDeliveryDate: expectedDeliveryDate || '',
      userId,
      companyName,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('purchases').add(purchaseData);

    return NextResponse.json({
      success: true,
      purchase: {
        id: docRef.id,
        ...purchaseData,
        createdAt: purchaseData.createdAt.toISOString(),
        updatedAt: purchaseData.updatedAt.toISOString()
      }
    });
  } catch (error) {
    console.error('発注作成エラー:', error);
    return NextResponse.json({ error: '発注の作成に失敗しました' }, { status: 500 });
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
      return NextResponse.json({ error: '発注IDは必須です' }, { status: 400 });
    }

    const purchaseDoc = await db.collection('purchases').doc(id).get();
    if (!purchaseDoc.exists) {
      return NextResponse.json({ error: '発注が見つかりません' }, { status: 404 });
    }

    const purchaseData = purchaseDoc.data();
    const companyName = purchaseData?.companyName || '';
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (purchaseData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json({ error: 'この発注を更新する権限がありません' }, { status: 403 });
    }

    // 数量または単価が更新された場合は合計を再計算
    if (updateData.quantity !== undefined || updateData.unitPrice !== undefined) {
      const quantity = updateData.quantity !== undefined ? updateData.quantity : purchaseData?.quantity || 0;
      const unitPrice = updateData.unitPrice !== undefined ? updateData.unitPrice : purchaseData?.unitPrice || 0;
      updateData.totalAmount = quantity * unitPrice;
    }

    updateData.updatedAt = new Date();
    await db.collection('purchases').doc(id).update(updateData);

    const updatedDoc = await db.collection('purchases').doc(id).get();
    const data = updatedDoc.data();
    const createdAt = data?.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                     data?.createdAt?.toDate ? data.createdAt.toDate() : 
                     data?.createdAt ? new Date(data.createdAt) : new Date();

    return NextResponse.json({
      success: true,
      purchase: {
        id: updatedDoc.id,
        ...data,
        createdAt: createdAt.toISOString(),
        updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('発注更新エラー:', error);
    return NextResponse.json({ error: '発注情報の更新に失敗しました' }, { status: 500 });
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
      return NextResponse.json({ error: '発注IDは必須です' }, { status: 400 });
    }

    const purchaseDoc = await db.collection('purchases').doc(id).get();
    if (!purchaseDoc.exists) {
      return NextResponse.json({ error: '発注が見つかりません' }, { status: 404 });
    }

    const purchaseData = purchaseDoc.data();
    const companyName = purchaseData?.companyName || '';
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (purchaseData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json({ error: 'この発注を削除する権限がありません' }, { status: 403 });
    }

    await db.collection('purchases').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('発注削除エラー:', error);
    return NextResponse.json({ error: '発注の削除に失敗しました' }, { status: 500 });
  }
}

