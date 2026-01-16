import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Firebase Admin SDK の初期化
if (!getApps().length) {
  // 環境変数が設定されていない場合はスキップ
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

// Firebase Admin SDK が初期化されていない場合は null を返す
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

// 会社情報を取得
export async function GET(request: NextRequest) {
  try {
    // Firebase Admin SDK が初期化されていない場合はエラーを返す
    if (!auth || !db) {
      return NextResponse.json({ 
        error: 'Firebase Admin SDK が初期化されていません。環境変数を設定してください。' 
      }, { status: 500 });
    }

    // 認証チェック
    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // ユーザー情報を取得してcompanyNameを取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData || !userData.companyName) {
      return NextResponse.json(
        { error: 'ユーザー情報または会社名が見つかりません' },
        { status: 404 }
      );
    }

    const companyName = userData.companyName;
    
    console.log('会社情報取得:', { userId, companyName });

    // 会社情報を取得（companyNameをドキュメントIDとして使用）
    const companyDoc = await db.collection('companies').doc(companyName).get();
    
    console.log('会社情報ドキュメント存在確認:', { 
      exists: companyDoc.exists,
      docId: companyName 
    });
    
    if (!companyDoc.exists) {
      // 会社情報が存在しない場合は、基本情報のみを返す
      console.log('会社情報が存在しないため、デフォルト値を返します');
      return NextResponse.json({
        success: true,
        companyInfo: {
          name: companyName,
          nameKana: '',
          postalCode: '',
          address: '',
          phone: '',
          fax: '',
          email: '',
          website: '',
          representative: '',
          establishedDate: '',
          businessDescription: '',
          customItems: [],
          customGroups: [],
        }
      });
    }

    const companyData = companyDoc.data();
    
    // TimestampをDateに変換
    const convertTimestamp = (ts: any) => {
      if (!ts) return undefined;
      if (ts instanceof Timestamp) {
        return ts.toDate().toISOString();
      }
      if (ts?.toDate && typeof ts.toDate === 'function') {
        return ts.toDate().toISOString();
      }
      return ts;
    };

    return NextResponse.json({
      success: true,
      companyInfo: {
        name: companyData?.name || companyName,
        nameKana: companyData?.nameKana || '',
        postalCode: companyData?.postalCode || '',
        address: companyData?.address || '',
        phone: companyData?.phone || '',
        fax: companyData?.fax || '',
        email: companyData?.email || '',
        website: companyData?.website || '',
        representative: companyData?.representative || '',
        establishedDate: companyData?.establishedDate || '',
        businessDescription: companyData?.businessDescription || '',
        customItems: companyData?.customItems || [],
        customGroups: companyData?.customGroups || [],
      }
    });

  } catch (error: any) {
    console.error('会社情報取得エラー:', error);
    return NextResponse.json(
      { error: `会社情報の取得に失敗しました: ${error.message || '不明なエラー'}` },
      { status: 500 }
    );
  }
}

// 会社情報を保存・更新
export async function POST(request: NextRequest) {
  try {
    // Firebase Admin SDK が初期化されていない場合はエラーを返す
    if (!auth || !db) {
      return NextResponse.json({ 
        error: 'Firebase Admin SDK が初期化されていません。環境変数を設定してください。' 
      }, { status: 500 });
    }

    // 認証チェック
    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // ユーザー情報を取得してcompanyNameを取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData || !userData.companyName) {
      return NextResponse.json(
        { error: 'ユーザー情報または会社名が見つかりません' },
        { status: 404 }
      );
    }

    const companyName = userData.companyName;
    
    console.log('会社情報保存:', { userId, companyName });

    // リクエストボディから会社情報を取得
    const companyInfo = await request.json();

    // 会社情報を保存（companyNameをドキュメントIDとして使用）
    // 同じ会社のユーザーが編集できるように、companyNameをキーとして使用
    const companyData = {
      name: companyInfo.name || companyName,
      nameKana: companyInfo.nameKana || '',
      postalCode: companyInfo.postalCode || '',
      address: companyInfo.address || '',
      phone: companyInfo.phone || '',
      fax: companyInfo.fax || '',
      email: companyInfo.email || '',
      website: companyInfo.website || '',
      representative: companyInfo.representative || '',
      establishedDate: companyInfo.establishedDate || '',
      businessDescription: companyInfo.businessDescription || '',
      customItems: companyInfo.customItems || [],
      customGroups: companyInfo.customGroups || [],
      updatedAt: Timestamp.now(),
      updatedBy: userId, // 最終更新者のIDを記録
    };
    
    console.log('会社情報保存データ:', { docId: companyName, data: companyData });
    
    await db.collection('companies').doc(companyName).set(companyData, { merge: true });
    
    console.log('会社情報保存成功:', { docId: companyName });

    return NextResponse.json({
      success: true,
      message: '会社情報を保存しました'
    });

  } catch (error: any) {
    console.error('会社情報保存エラー:', error);
    return NextResponse.json(
      { error: `会社情報の保存に失敗しました: ${error.message || '不明なエラー'}` },
      { status: 500 }
    );
  }
}

