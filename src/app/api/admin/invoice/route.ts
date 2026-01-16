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

// 請求書一覧を取得
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

    // 請求書一覧を取得（companyNameでフィルタリング）
    const invoicesSnapshot = await db.collection('invoices')
      .where('companyName', '==', companyName)
      .orderBy('issueDate', 'desc')
      .get();
    
    const invoices = invoicesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        invoiceNumber: data.invoiceNumber || '',
        issueDate: data.issueDate || '',
        dueDate: data.dueDate || '',
        customerName: data.customerName || '',
        customerAddress: data.customerAddress || '',
        customerPostalCode: data.customerPostalCode || '',
        items: data.items || [],
        subtotal: data.subtotal || 0,
        taxRate: data.taxRate || 0,
        taxAmount: data.taxAmount || 0,
        total: data.total || 0,
        notes: data.notes || '',
      };
    });

    return NextResponse.json({
      success: true,
      invoices
    });

  } catch (error: any) {
    console.error('請求書一覧取得エラー:', error);
    return NextResponse.json(
      { error: `請求書一覧の取得に失敗しました: ${error.message || '不明なエラー'}` },
      { status: 500 }
    );
  }
}

// 請求書を保存・更新
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

    // リクエストボディから請求書情報を取得
    const invoiceData = await request.json();

    // バリデーション
    if (!invoiceData.invoiceNumber || !invoiceData.customerName) {
      return NextResponse.json(
        { error: '請求書番号と顧客名は必須です' },
        { status: 400 }
      );
    }

    const invoicePayload: any = {
      invoiceNumber: invoiceData.invoiceNumber,
      issueDate: invoiceData.issueDate || '',
      dueDate: invoiceData.dueDate || '',
      customerName: invoiceData.customerName,
      customerAddress: invoiceData.customerAddress || '',
      customerPostalCode: invoiceData.customerPostalCode || '',
      items: invoiceData.items || [],
      subtotal: invoiceData.subtotal || 0,
      taxRate: invoiceData.taxRate || 0,
      taxAmount: invoiceData.taxAmount || 0,
      total: invoiceData.total || 0,
      notes: invoiceData.notes || '',
      companyName: companyName, // companyNameを追加
      updatedAt: Timestamp.now(),
      updatedBy: userId, // 最終更新者のIDを記録
    };

    if (invoiceData.id) {
      // 更新の場合
      await db.collection('invoices').doc(invoiceData.id).update(invoicePayload);
      return NextResponse.json({
        success: true,
        invoiceId: invoiceData.id,
        message: '請求書を更新しました'
      });
    } else {
      // 新規作成の場合
      invoicePayload.createdAt = Timestamp.now();
      invoicePayload.createdBy = userId;
      const docRef = await db.collection('invoices').add(invoicePayload);
      return NextResponse.json({
        success: true,
        invoiceId: docRef.id,
        message: '請求書を保存しました'
      });
    }

  } catch (error: any) {
    console.error('請求書保存エラー:', error);
    return NextResponse.json(
      { error: `請求書の保存に失敗しました: ${error.message || '不明なエラー'}` },
      { status: 500 }
    );
  }
}

// 請求書を削除
export async function DELETE(request: NextRequest) {
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

    // URLパラメータから請求書IDを取得
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('id');

    if (!invoiceId) {
      return NextResponse.json(
        { error: '請求書IDは必須です' },
        { status: 400 }
      );
    }

    // 請求書が存在し、同じ会社のものか確認
    const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
    
    if (!invoiceDoc.exists) {
      return NextResponse.json(
        { error: '請求書が見つかりません' },
        { status: 404 }
      );
    }

    const invoiceData = invoiceDoc.data();
    
    if (invoiceData?.companyName !== companyName) {
      return NextResponse.json(
        { error: 'この請求書を削除する権限がありません' },
        { status: 403 }
      );
    }

    // 請求書を削除
    await db.collection('invoices').doc(invoiceId).delete();

    return NextResponse.json({
      success: true,
      message: '請求書を削除しました'
    });

  } catch (error: any) {
    console.error('請求書削除エラー:', error);
    return NextResponse.json(
      { error: `請求書の削除に失敗しました: ${error.message || '不明なエラー'}` },
      { status: 500 }
    );
  }
}

