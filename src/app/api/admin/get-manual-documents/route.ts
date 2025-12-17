import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Firebase Admin SDK の初期化
if (!getApps().length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
}

const auth = getAuth();
const adminDb = getFirestore();

// 認証トークン検証
async function verifyAuthToken(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch (e) {
    console.error('Token verify error:', e);
    return null;
  }
}

// 管理者権限チェック
async function checkAdminRole(uid: string) {
  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    return userDoc.data()?.role === 'admin';
  } catch (e) {
    console.error('Admin check error:', e);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const uid = await verifyAuthToken(request);
    if (!uid) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    let snapshot;
    if (targetUserId) {
      snapshot = await adminDb.collection('manualDocuments')
        .where('userId', '==', targetUserId)
        .get();
    } else {
      snapshot = await adminDb.collection('manualDocuments').get();
    }
    const documents = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ?? null,
        lastUpdated: data.lastUpdated?.toDate?.() ?? null,
      };
    });

    documents.sort((a, b) => (b.lastUpdated?.getTime?.() ?? 0) - (a.lastUpdated?.getTime?.() ?? 0));

    return NextResponse.json({ success: true, documents });
  } catch (error: any) {
    console.error('Manual document fetch error:', error);
    return NextResponse.json(
      { error: '文書の取得に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}
