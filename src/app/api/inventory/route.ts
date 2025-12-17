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

    let queryRef: any = db.collection('inventory');
    if (companyName) {
      queryRef = queryRef.where('companyName', '==', companyName);
    } else {
      queryRef = queryRef.where('userId', '==', userId);
    }

    const itemsSnapshot = await queryRef.orderBy('createdAt', 'desc').get();
    
    const items = itemsSnapshot.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                       data.createdAt?.toDate ? data.createdAt.toDate() : 
                       data.createdAt ? new Date(data.createdAt) : new Date();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : 
                       data.updatedAt?.toDate ? data.updatedAt.toDate() : 
                       data.updatedAt ? new Date(data.updatedAt) : new Date();
      
      return {
        id: doc.id,
        itemCode: data.itemCode || '',
        itemName: data.itemName || '',
        category: data.category || '',
        quantity: data.quantity || 0,
        unit: data.unit || '個',
        unitPrice: data.unitPrice || 0,
        location: data.location || '',
        minStock: data.minStock || 0,
        maxStock: data.maxStock || 0,
        supplier: data.supplier || '',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        userId: data.userId || userId,
        companyName: data.companyName || companyName
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('在庫取得エラー:', error);
    return NextResponse.json({ error: '在庫一覧の取得に失敗しました' }, { status: 500 });
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

    const { itemCode, itemName, category, quantity, unit, unitPrice, location, minStock, maxStock, supplier } = await request.json();

    if (!itemCode || !itemName) {
      return NextResponse.json({ error: '商品コード、商品名は必須です' }, { status: 400 });
    }

    const itemData = {
      itemCode,
      itemName,
      category: category || '',
      quantity: quantity || 0,
      unit: unit || '個',
      unitPrice: unitPrice || 0,
      location: location || '',
      minStock: minStock || 0,
      maxStock: maxStock || 0,
      supplier: supplier || '',
      userId,
      companyName,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('inventory').add(itemData);

    return NextResponse.json({
      success: true,
      item: {
        id: docRef.id,
        ...itemData,
        createdAt: itemData.createdAt.toISOString(),
        updatedAt: itemData.updatedAt.toISOString()
      }
    });
  } catch (error) {
    console.error('在庫作成エラー:', error);
    return NextResponse.json({ error: '在庫の作成に失敗しました' }, { status: 500 });
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
      return NextResponse.json({ error: '在庫IDは必須です' }, { status: 400 });
    }

    const itemDoc = await db.collection('inventory').doc(id).get();
    if (!itemDoc.exists) {
      return NextResponse.json({ error: '在庫が見つかりません' }, { status: 404 });
    }

    const itemData = itemDoc.data();
    const companyName = itemData?.companyName || '';
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (itemData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json({ error: 'この在庫を更新する権限がありません' }, { status: 403 });
    }

    updateData.updatedAt = new Date();
    await db.collection('inventory').doc(id).update(updateData);

    const updatedDoc = await db.collection('inventory').doc(id).get();
    const data = updatedDoc.data();
    const createdAt = data?.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                     data?.createdAt?.toDate ? data.createdAt.toDate() : 
                     data?.createdAt ? new Date(data.createdAt) : new Date();

    return NextResponse.json({
      success: true,
      item: {
        id: updatedDoc.id,
        ...data,
        createdAt: createdAt.toISOString(),
        updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('在庫更新エラー:', error);
    return NextResponse.json({ error: '在庫情報の更新に失敗しました' }, { status: 500 });
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
      return NextResponse.json({ error: '在庫IDは必須です' }, { status: 400 });
    }

    const itemDoc = await db.collection('inventory').doc(id).get();
    if (!itemDoc.exists) {
      return NextResponse.json({ error: '在庫が見つかりません' }, { status: 404 });
    }

    const itemData = itemDoc.data();
    const companyName = itemData?.companyName || '';
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (itemData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json({ error: 'この在庫を削除する権限がありません' }, { status: 403 });
    }

    await db.collection('inventory').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('在庫削除エラー:', error);
    return NextResponse.json({ error: '在庫の削除に失敗しました' }, { status: 500 });
  }
}

