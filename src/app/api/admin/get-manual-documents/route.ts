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

export async function GET(request: NextRequest) {
  try {
    const uid = await verifyAuthToken(request);
    if (!uid) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

    // ユーザーのcompanyNameを取得
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    let documents: any[] = [];

    if (targetUserId) {
      // 特定ユーザーの文書を取得（同じ会社内のみ）
      const snapshot = await adminDb.collection('manualDocuments')
        .where('userId', '==', targetUserId)
        .where('companyName', '==', userCompanyName)
        .get();
      
      documents = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ?? null,
          lastUpdated: data.lastUpdated?.toDate?.() ?? null,
        };
      });
    } else {
      // 同じ会社の全ユーザーの文書を取得
      const snapshotWithCompany = await adminDb.collection('manualDocuments')
        .where('companyName', '==', userCompanyName)
        .get();
      
      documents = snapshotWithCompany.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ?? null,
          lastUpdated: data.lastUpdated?.toDate?.() ?? null,
        };
      });

      // companyNameが設定されていない既存の契約書も取得（現在のユーザーの会社のメンバーが作成したもの）
      if (userCompanyName) {
        // 同じ会社のユーザーIDを取得
        const companyUsersSnapshot = await adminDb.collection('users')
          .where('companyName', '==', userCompanyName)
          .get();
        
        const companyUserIds = companyUsersSnapshot.docs.map(doc => doc.id);
        
        // 同じ会社のユーザーが作成した契約書を取得（companyNameフィールドの有無に関わらず）
        // Firestoreではnullチェックができないため、各ユーザーIDでクエリを実行
        const documentsWithoutCompany: any[] = [];
        const updatePromises: Promise<void>[] = [];
        
        for (const userId of companyUserIds) {
          const userDocsSnapshot = await adminDb.collection('manualDocuments')
            .where('userId', '==', userId)
            .get();
          
          userDocsSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            // companyNameが設定されていない、または空文字列の場合
            if (!data.companyName || data.companyName === '') {
              // companyNameを設定して更新
              const docRef = adminDb.collection('manualDocuments').doc(doc.id);
              updatePromises.push(
                docRef.update({
                  companyName: userCompanyName,
                  lastUpdated: Timestamp.now()
                }).then(() => {
                  console.log(`Updated companyName for document ${doc.id}`);
                }).catch(err => {
                  console.error(`Failed to update companyName for document ${doc.id}:`, err);
                })
              );
              
              documentsWithoutCompany.push({
                id: doc.id,
                ...data,
                companyName: userCompanyName, // レスポンスには更新後の値を含める
                createdAt: data.createdAt?.toDate?.() ?? null,
                lastUpdated: data.lastUpdated?.toDate?.() ?? null,
              });
            }
          });
        }
        
        // 更新処理を並列実行（結果を待たない）
        Promise.all(updatePromises).catch(err => {
          console.error('Error updating companyName for documents:', err);
        });
        
        // 既存の契約書をマージ
        documents = [...documents, ...documentsWithoutCompany];
      }
    }

    // 重複を除去（同じIDの契約書が複数ある場合）
    const uniqueDocuments = Array.from(
      new Map(documents.map(doc => [doc.id, doc])).values()
    );

    // 日付でソート（最新順）- Dateオブジェクトまたはnullを安全に処理
    uniqueDocuments.sort((a, b) => {
      const dateA = a.lastUpdated instanceof Date ? a.lastUpdated.getTime() : (a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0);
      const dateB = b.lastUpdated instanceof Date ? b.lastUpdated.getTime() : (b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0);
      return dateB - dateA;
    });

    return NextResponse.json({ success: true, documents: uniqueDocuments });
  } catch (error: any) {
    console.error('Manual document fetch error:', error);
    return NextResponse.json(
      { error: '文書の取得に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}
