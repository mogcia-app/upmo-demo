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

    let queryRef: any = db.collection('invoices');
    if (companyName) {
      queryRef = queryRef.where('companyName', '==', companyName);
    } else {
      queryRef = queryRef.where('userId', '==', userId);
    }

    const invoicesSnapshot = await queryRef.orderBy('createdAt', 'desc').get();
    
    const invoices = invoicesSnapshot.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                       data.createdAt?.toDate ? data.createdAt.toDate() : 
                       data.createdAt ? new Date(data.createdAt) : new Date();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : 
                       data.updatedAt?.toDate ? data.updatedAt.toDate() : 
                       data.updatedAt ? new Date(data.updatedAt) : new Date();
      
      const amount = data.amount || 0;
      const tax = Math.floor(amount * 0.1);
      const totalAmount = amount + tax;
      
      return {
        id: doc.id,
        invoiceNumber: data.invoiceNumber || '',
        customerName: data.customerName || '',
        customerCompany: data.customerCompany || '',
        amount,
        tax,
        totalAmount,
        status: data.status || 'draft',
        issueDate: data.issueDate || '',
        dueDate: data.dueDate || '',
        paidDate: data.paidDate || '',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        userId: data.userId || userId,
        companyName: data.companyName || companyName
      };
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('請求取得エラー:', error);
    return NextResponse.json({ error: '請求一覧の取得に失敗しました' }, { status: 500 });
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

    const { invoiceNumber, customerName, customerCompany, amount, status, issueDate, dueDate } = await request.json();

    if (!invoiceNumber || !customerName) {
      return NextResponse.json({ error: '請求書番号、顧客名は必須です' }, { status: 400 });
    }

    const invoiceAmount = amount || 0;
    const tax = Math.floor(invoiceAmount * 0.1);
    const totalAmount = invoiceAmount + tax;

    const invoiceData = {
      invoiceNumber,
      customerName,
      customerCompany: customerCompany || '',
      amount: invoiceAmount,
      tax,
      totalAmount,
      status: status || 'draft',
      issueDate: issueDate || '',
      dueDate: dueDate || '',
      userId,
      companyName,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('invoices').add(invoiceData);

    return NextResponse.json({
      success: true,
      invoice: {
        id: docRef.id,
        ...invoiceData,
        createdAt: invoiceData.createdAt.toISOString(),
        updatedAt: invoiceData.updatedAt.toISOString()
      }
    });
  } catch (error) {
    console.error('請求作成エラー:', error);
    return NextResponse.json({ error: '請求の作成に失敗しました' }, { status: 500 });
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
      return NextResponse.json({ error: '請求IDは必須です' }, { status: 400 });
    }

    const invoiceDoc = await db.collection('invoices').doc(id).get();
    if (!invoiceDoc.exists) {
      return NextResponse.json({ error: '請求が見つかりません' }, { status: 404 });
    }

    const invoiceData = invoiceDoc.data();
    const companyName = invoiceData?.companyName || '';
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (invoiceData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json({ error: 'この請求を更新する権限がありません' }, { status: 403 });
    }

    // 金額が更新された場合は税額と合計を再計算
    if (updateData.amount !== undefined) {
      updateData.tax = Math.floor(updateData.amount * 0.1);
      updateData.totalAmount = updateData.amount + updateData.tax;
    }

    updateData.updatedAt = new Date();
    await db.collection('invoices').doc(id).update(updateData);

    const updatedDoc = await db.collection('invoices').doc(id).get();
    const data = updatedDoc.data();
    const createdAt = data?.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                     data?.createdAt?.toDate ? data.createdAt.toDate() : 
                     data?.createdAt ? new Date(data.createdAt) : new Date();

    return NextResponse.json({
      success: true,
      invoice: {
        id: updatedDoc.id,
        ...data,
        createdAt: createdAt.toISOString(),
        updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('請求更新エラー:', error);
    return NextResponse.json({ error: '請求情報の更新に失敗しました' }, { status: 500 });
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
      return NextResponse.json({ error: '請求IDは必須です' }, { status: 400 });
    }

    const invoiceDoc = await db.collection('invoices').doc(id).get();
    if (!invoiceDoc.exists) {
      return NextResponse.json({ error: '請求が見つかりません' }, { status: 404 });
    }

    const invoiceData = invoiceDoc.data();
    const companyName = invoiceData?.companyName || '';
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (invoiceData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json({ error: 'この請求を削除する権限がありません' }, { status: 403 });
    }

    await db.collection('invoices').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('請求削除エラー:', error);
    return NextResponse.json({ error: '請求の削除に失敗しました' }, { status: 500 });
  }
}

