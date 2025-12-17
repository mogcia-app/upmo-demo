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

    const plansSnapshot = await db.collection('pdcaPlan')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    const plans = plansSnapshot.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                       data.createdAt?.toDate ? data.createdAt.toDate() : 
                       data.createdAt ? new Date(data.createdAt) : new Date();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : 
                       data.updatedAt?.toDate ? data.updatedAt.toDate() : 
                       data.updatedAt ? new Date(data.updatedAt) : new Date();
      
      return {
        id: doc.id,
        planNumber: data.planNumber || '',
        title: data.title || '',
        description: data.description || '',
        target: data.target || '',
        deadline: data.deadline || '',
        status: data.status || 'draft',
        assignedTo: data.assignedTo || '',
        priority: data.priority || 'medium',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        userId: data.userId || userId
      };
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('計画取得エラー:', error);
    return NextResponse.json({ error: '計画一覧の取得に失敗しました' }, { status: 500 });
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

    const { planNumber, title, description, target, deadline, status, assignedTo, priority } = await request.json();

    if (!planNumber || !title) {
      return NextResponse.json({ error: '計画番号、タイトルは必須です' }, { status: 400 });
    }

    const planData = {
      planNumber,
      title,
      description: description || '',
      target: target || '',
      deadline: deadline || '',
      status: status || 'draft',
      assignedTo: assignedTo || '',
      priority: priority || 'medium',
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('pdcaPlan').add(planData);

    return NextResponse.json({
      success: true,
      plan: {
        id: docRef.id,
        ...planData,
        createdAt: planData.createdAt.toISOString(),
        updatedAt: planData.updatedAt.toISOString()
      }
    });
  } catch (error) {
    console.error('計画作成エラー:', error);
    return NextResponse.json({ error: '計画の作成に失敗しました' }, { status: 500 });
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
      return NextResponse.json({ error: '計画IDは必須です' }, { status: 400 });
    }

    const planDoc = await db.collection('pdcaPlan').doc(id).get();
    if (!planDoc.exists) {
      return NextResponse.json({ error: '計画が見つかりません' }, { status: 404 });
    }

    const planData = planDoc.data();
    if (planData?.userId !== userId) {
      return NextResponse.json({ error: 'この計画を更新する権限がありません' }, { status: 403 });
    }

    updateData.updatedAt = new Date();
    await db.collection('pdcaPlan').doc(id).update(updateData);

    const updatedDoc = await db.collection('pdcaPlan').doc(id).get();
    const data = updatedDoc.data();
    const createdAt = data?.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                     data?.createdAt?.toDate ? data.createdAt.toDate() : 
                     data?.createdAt ? new Date(data.createdAt) : new Date();

    return NextResponse.json({
      success: true,
      plan: {
        id: updatedDoc.id,
        ...data,
        createdAt: createdAt.toISOString(),
        updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('計画更新エラー:', error);
    return NextResponse.json({ error: '計画情報の更新に失敗しました' }, { status: 500 });
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
      return NextResponse.json({ error: '計画IDは必須です' }, { status: 400 });
    }

    const planDoc = await db.collection('pdcaPlan').doc(id).get();
    if (!planDoc.exists) {
      return NextResponse.json({ error: '計画が見つかりません' }, { status: 404 });
    }

    const planData = planDoc.data();
    if (planData?.userId !== userId) {
      return NextResponse.json({ error: 'この計画を削除する権限がありません' }, { status: 403 });
    }

    await db.collection('pdcaPlan').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('計画削除エラー:', error);
    return NextResponse.json({ error: '計画の削除に失敗しました' }, { status: 500 });
  }
}

