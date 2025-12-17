import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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

export async function POST(request: NextRequest) {
  try {
    const uid = await verifyAuthToken(request);
    if (!uid) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

    const data = await request.json();
    const { id, title, description, type, sections, tags, priority } = data;
    
    if (!title) {
      return NextResponse.json({ error: 'タイトルが必要です' }, { status: 400 });
    }

    // 編集モード（idがある場合）
    if (id) {
      const docRef = adminDb.collection('manualDocuments').doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return NextResponse.json({ error: '文書が見つかりません' }, { status: 404 });
      }

      // 既存の文書を更新
      await docRef.update({
        title,
        description: description || '',
        type: type || 'meeting',
        sections: sections || {
          overview: '',
          features: [],
          pricing: [],
          procedures: []
        },
        tags: tags || [],
        priority: priority || 'medium',
        lastUpdated: Timestamp.now()
      });

      return NextResponse.json({ 
        success: true, 
        documentId: id,
        message: '文書が正常に更新されました'
      });
    }

    // 新規作成モード
    const docRef = await adminDb.collection('manualDocuments').add({
      title,
      description: description || '',
      type: type || 'meeting',
      sections: sections || {
        overview: '',
        features: [],
        pricing: [],
        procedures: []
      },
      tags: tags || [],
      priority: priority || 'medium',
      userId: uid,
      createdAt: Timestamp.now(),
      lastUpdated: Timestamp.now()
    });

    return NextResponse.json({ 
      success: true, 
      documentId: docRef.id,
      message: '文書が正常に保存されました'
    });

  } catch (error: any) {
    console.error('Manual document save error:', error);
    return NextResponse.json(
      { error: '文書の保存に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}
