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

    const activitiesSnapshot = await db.collection('pdcaDo')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    const activities = activitiesSnapshot.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                       data.createdAt?.toDate ? data.createdAt.toDate() : 
                       data.createdAt ? new Date(data.createdAt) : new Date();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : 
                       data.updatedAt?.toDate ? data.updatedAt.toDate() : 
                       data.updatedAt ? new Date(data.updatedAt) : new Date();
      
      return {
        id: doc.id,
        activityNumber: data.activityNumber || '',
        planId: data.planId || '',
        planTitle: data.planTitle || '',
        title: data.title || '',
        description: data.description || '',
        status: data.status || 'not_started',
        assignedTo: data.assignedTo || '',
        startDate: data.startDate || '',
        endDate: data.endDate || '',
        progress: data.progress || 0,
        notes: data.notes || '',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        userId: data.userId || userId
      };
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('実行取得エラー:', error);
    return NextResponse.json({ error: '実行一覧の取得に失敗しました' }, { status: 500 });
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

    const { activityNumber, planId, planTitle, title, description, status, assignedTo, startDate, endDate, progress, notes } = await request.json();

    if (!activityNumber || !title) {
      return NextResponse.json({ error: '活動番号、タイトルは必須です' }, { status: 400 });
    }

    const activityData = {
      activityNumber,
      planId: planId || '',
      planTitle: planTitle || '',
      title,
      description: description || '',
      status: status || 'not_started',
      assignedTo: assignedTo || '',
      startDate: startDate || '',
      endDate: endDate || '',
      progress: progress || 0,
      notes: notes || '',
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('pdcaDo').add(activityData);

    return NextResponse.json({
      success: true,
      activity: {
        id: docRef.id,
        ...activityData,
        createdAt: activityData.createdAt.toISOString(),
        updatedAt: activityData.updatedAt.toISOString()
      }
    });
  } catch (error) {
    console.error('実行作成エラー:', error);
    return NextResponse.json({ error: '実行の作成に失敗しました' }, { status: 500 });
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
      return NextResponse.json({ error: '実行IDは必須です' }, { status: 400 });
    }

    const activityDoc = await db.collection('pdcaDo').doc(id).get();
    if (!activityDoc.exists) {
      return NextResponse.json({ error: '実行が見つかりません' }, { status: 404 });
    }

    const activityData = activityDoc.data();
    if (activityData?.userId !== userId) {
      return NextResponse.json({ error: 'この実行を更新する権限がありません' }, { status: 403 });
    }

    updateData.updatedAt = new Date();
    await db.collection('pdcaDo').doc(id).update(updateData);

    const updatedDoc = await db.collection('pdcaDo').doc(id).get();
    const data = updatedDoc.data();
    const createdAt = data?.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                     data?.createdAt?.toDate ? data.createdAt.toDate() : 
                     data?.createdAt ? new Date(data.createdAt) : new Date();

    return NextResponse.json({
      success: true,
      activity: {
        id: updatedDoc.id,
        ...data,
        createdAt: createdAt.toISOString(),
        updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('実行更新エラー:', error);
    return NextResponse.json({ error: '実行情報の更新に失敗しました' }, { status: 500 });
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
      return NextResponse.json({ error: '実行IDは必須です' }, { status: 400 });
    }

    const activityDoc = await db.collection('pdcaDo').doc(id).get();
    if (!activityDoc.exists) {
      return NextResponse.json({ error: '実行が見つかりません' }, { status: 404 });
    }

    const activityData = activityDoc.data();
    if (activityData?.userId !== userId) {
      return NextResponse.json({ error: 'この実行を削除する権限がありません' }, { status: 403 });
    }

    await db.collection('pdcaDo').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('実行削除エラー:', error);
    return NextResponse.json({ error: '実行の削除に失敗しました' }, { status: 500 });
  }
}

