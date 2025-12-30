import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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

// 議事録一覧取得
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

    // ユーザーのcompanyNameを取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    // 同じcompanyNameのユーザーの議事録を取得
    const notesSnapshot = await db.collection('meetingNotes')
      .where('companyName', '==', userCompanyName)
      .orderBy('meetingDate', 'desc')
      .get();

    const notes = notesSnapshot.docs.map(doc => {
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
        customerId: data.customerId || undefined,
        title: data.title || '',
        meetingDate: data.meetingDate || '',
        meetingTime: data.meetingTime || '',
        location: data.location || '',
        attendees: data.attendees || [],
        assignee: data.assignee || '',
        actionItems: data.actionItems || [],
        notes: data.notes || '',
        summary: data.summary || undefined,
        category: data.category || undefined,
        tags: data.tags || [],
        status: data.status || 'completed',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString()
      };
    });

    return NextResponse.json({ notes });

  } catch (error) {
    console.error('議事録取得エラー:', error);
    return NextResponse.json(
      { error: '議事録の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 議事録作成
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

    const { customerId, title, meetingDate, meetingTime, location, attendees, assignee, actionItems, notes, summary, category, tags, status } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: 'タイトルは必須です' },
        { status: 400 }
      );
    }

    // ユーザーのcompanyNameを取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    const noteData = {
      customerId: customerId || undefined,
      title,
      meetingDate: meetingDate || '',
      meetingTime: meetingTime || '',
      location: location || '',
      attendees: attendees || [],
      assignee: assignee || '',
      actionItems: actionItems || [],
      notes: notes || '',
      summary: summary || undefined,
      category: category || undefined,
      tags: tags || [],
      status: status || 'completed',
      userId,
      companyName: userCompanyName,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('meetingNotes').add(noteData);

    return NextResponse.json({
      success: true,
      note: {
        id: docRef.id,
        ...noteData,
        createdAt: noteData.createdAt.toISOString(),
        updatedAt: noteData.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('議事録作成エラー:', error);
    return NextResponse.json(
      { error: '議事録の作成に失敗しました' },
      { status: 500 }
    );
  }
}

// 議事録更新
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
        { error: '議事録IDは必須です' },
        { status: 400 }
      );
    }

    // 議事録の所有者を確認
    const noteDoc = await db.collection('meetingNotes').doc(id).get();
    if (!noteDoc.exists) {
      return NextResponse.json(
        { error: '議事録が見つかりません' },
        { status: 404 }
      );
    }

    const noteData = noteDoc.data();
    const companyName = noteData?.companyName || '';

    // 同じcompanyNameのユーザーまたは所有者のみ更新可能
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (noteData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json(
        { error: 'この議事録を更新する権限がありません' },
        { status: 403 }
      );
    }

    updateData.updatedAt = new Date();

    await db.collection('meetingNotes').doc(id).update(updateData);

    // 更新後のデータを取得
    const updatedDoc = await db.collection('meetingNotes').doc(id).get();
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

    let updatedAt: Date;
    if (data?.updatedAt instanceof Timestamp) {
      updatedAt = data.updatedAt.toDate();
    } else if (data?.updatedAt?.toDate && typeof data.updatedAt.toDate === 'function') {
      updatedAt = data.updatedAt.toDate();
    } else if (data?.updatedAt) {
      updatedAt = new Date(data.updatedAt);
    } else {
      updatedAt = new Date();
    }

    return NextResponse.json({
      success: true,
      note: {
        id: updatedDoc.id,
        ...data,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('議事録更新エラー:', error);
    return NextResponse.json(
      { error: '議事録の更新に失敗しました' },
      { status: 500 }
    );
  }
}

// 議事録削除
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
        { error: '議事録IDは必須です' },
        { status: 400 }
      );
    }

    // 議事録の所有者を確認
    const noteDoc = await db.collection('meetingNotes').doc(id).get();
    if (!noteDoc.exists) {
      return NextResponse.json(
        { error: '議事録が見つかりません' },
        { status: 404 }
      );
    }

    const noteData = noteDoc.data();
    const companyName = noteData?.companyName || '';

    // 同じcompanyNameのユーザーまたは所有者のみ削除可能
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (noteData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json(
        { error: 'この議事録を削除する権限がありません' },
        { status: 403 }
      );
    }

    await db.collection('meetingNotes').doc(id).delete();

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('議事録削除エラー:', error);
    return NextResponse.json(
      { error: '議事録の削除に失敗しました' },
      { status: 500 }
    );
  }
}

