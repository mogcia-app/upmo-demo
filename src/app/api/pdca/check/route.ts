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

    const checksSnapshot = await db.collection('pdcaCheck')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    const checks = checksSnapshot.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                       data.createdAt?.toDate ? data.createdAt.toDate() : 
                       data.createdAt ? new Date(data.createdAt) : new Date();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : 
                       data.updatedAt?.toDate ? data.updatedAt.toDate() : 
                       data.updatedAt ? new Date(data.updatedAt) : new Date();
      
      const targetValue = data.targetValue || 0;
      const actualValue = data.actualValue || 0;
      const achievementRate = targetValue > 0 ? Math.round((actualValue / targetValue) * 100) : 0;
      
      return {
        id: doc.id,
        checkNumber: data.checkNumber || '',
        planId: data.planId || '',
        planTitle: data.planTitle || '',
        activityId: data.activityId || '',
        activityTitle: data.activityTitle || '',
        targetValue,
        actualValue,
        achievementRate,
        kpi: data.kpi || '',
        evaluation: data.evaluation || '',
        issues: data.issues || [],
        status: data.status || 'draft',
        evaluatedBy: data.evaluatedBy || '',
        evaluationDate: data.evaluationDate || '',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        userId: data.userId || userId
      };
    });

    return NextResponse.json({ checks });
  } catch (error) {
    console.error('評価取得エラー:', error);
    return NextResponse.json({ error: '評価一覧の取得に失敗しました' }, { status: 500 });
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

    const { checkNumber, planId, planTitle, activityId, activityTitle, targetValue, actualValue, kpi, evaluation, issues, status, evaluatedBy, evaluationDate } = await request.json();

    if (!checkNumber) {
      return NextResponse.json({ error: '評価番号は必須です' }, { status: 400 });
    }

    const target = targetValue || 0;
    const actual = actualValue || 0;
    const achievementRate = target > 0 ? Math.round((actual / target) * 100) : 0;

    const checkData = {
      checkNumber,
      planId: planId || '',
      planTitle: planTitle || '',
      activityId: activityId || '',
      activityTitle: activityTitle || '',
      targetValue: target,
      actualValue: actual,
      achievementRate,
      kpi: kpi || '',
      evaluation: evaluation || '',
      issues: issues || [],
      status: status || 'draft',
      evaluatedBy: evaluatedBy || '',
      evaluationDate: evaluationDate || '',
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('pdcaCheck').add(checkData);

    return NextResponse.json({
      success: true,
      check: {
        id: docRef.id,
        ...checkData,
        createdAt: checkData.createdAt.toISOString(),
        updatedAt: checkData.updatedAt.toISOString()
      }
    });
  } catch (error) {
    console.error('評価作成エラー:', error);
    return NextResponse.json({ error: '評価の作成に失敗しました' }, { status: 500 });
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
      return NextResponse.json({ error: '評価IDは必須です' }, { status: 400 });
    }

    const checkDoc = await db.collection('pdcaCheck').doc(id).get();
    if (!checkDoc.exists) {
      return NextResponse.json({ error: '評価が見つかりません' }, { status: 404 });
    }

    const checkData = checkDoc.data();
    if (checkData?.userId !== userId) {
      return NextResponse.json({ error: 'この評価を更新する権限がありません' }, { status: 403 });
    }

    // 目標値または実績値が更新された場合は達成率を再計算
    if (updateData.targetValue !== undefined || updateData.actualValue !== undefined) {
      const targetValue = updateData.targetValue !== undefined ? updateData.targetValue : checkData?.targetValue || 0;
      const actualValue = updateData.actualValue !== undefined ? updateData.actualValue : checkData?.actualValue || 0;
      updateData.achievementRate = targetValue > 0 ? Math.round((actualValue / targetValue) * 100) : 0;
    }

    updateData.updatedAt = new Date();
    await db.collection('pdcaCheck').doc(id).update(updateData);

    const updatedDoc = await db.collection('pdcaCheck').doc(id).get();
    const data = updatedDoc.data();
    const createdAt = data?.createdAt instanceof Timestamp ? data.createdAt.toDate() : 
                     data?.createdAt?.toDate ? data.createdAt.toDate() : 
                     data?.createdAt ? new Date(data.createdAt) : new Date();

    return NextResponse.json({
      success: true,
      check: {
        id: updatedDoc.id,
        ...data,
        createdAt: createdAt.toISOString(),
        updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('評価更新エラー:', error);
    return NextResponse.json({ error: '評価情報の更新に失敗しました' }, { status: 500 });
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
      return NextResponse.json({ error: '評価IDは必須です' }, { status: 400 });
    }

    const checkDoc = await db.collection('pdcaCheck').doc(id).get();
    if (!checkDoc.exists) {
      return NextResponse.json({ error: '評価が見つかりません' }, { status: 404 });
    }

    const checkData = checkDoc.data();
    if (checkData?.userId !== userId) {
      return NextResponse.json({ error: 'この評価を削除する権限がありません' }, { status: 403 });
    }

    await db.collection('pdcaCheck').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('評価削除エラー:', error);
    return NextResponse.json({ error: '評価の削除に失敗しました' }, { status: 500 });
  }
}

