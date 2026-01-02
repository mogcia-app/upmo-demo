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

export async function POST(request: NextRequest) {
  try {
    // Firebase Admin SDK が初期化されていない場合はエラーを返す
    if (!auth || !db) {
      console.error('Firebase Admin SDK が初期化されていません');
      console.error('環境変数チェック:', {
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? '設定済み' : '未設定',
        FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? '設定済み' : '未設定',
        FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? '設定済み' : '未設定',
      });
      return NextResponse.json({ 
        error: 'Firebase Admin SDK が初期化されていません。環境変数（FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY）を設定してください。' 
      }, { status: 500 });
    }

    // 認証チェック（ログイン済みユーザーなら誰でもユーザーを作成できる）
    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // ユーザー情報を取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (!userData) {
      return NextResponse.json(
        { error: 'ユーザー情報が見つかりません' },
        { status: 404 }
      );
    }

    const { email, password, displayName, role = 'user', department, position, companyName } = await request.json();
    
    // ログイン済みユーザーなら誰でも任意のroleを設定可能
    const finalRole = role;

    // バリデーション
    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードは必須です' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'パスワードは6文字以上である必要があります' },
        { status: 400 }
      );
    }

    // 作成者のcompanyNameを取得（companyNameが指定されていない場合）
    let finalCompanyName = companyName;
    if (!finalCompanyName) {
      finalCompanyName = userData?.companyName || '';
    }
    
    // 同じcompanyNameのユーザーのみ招待可能（セキュリティ対策）
    if (finalCompanyName && userData.companyName && finalCompanyName !== userData.companyName) {
      return NextResponse.json(
        { error: '同じ会社のユーザーのみ招待できます' },
        { status: 403 }
      );
    }

    // Firebase Auth でユーザーを作成
    let userRecord;
    try {
      console.log('Firebase Auth にユーザーを作成中:', { email, displayName: displayName || email.split('@')[0] });
      userRecord = await auth.createUser({
        email,
        password,
        displayName: displayName || email.split('@')[0],
        emailVerified: false,
      });
      console.log('Firebase Auth ユーザー作成成功:', { uid: userRecord.uid, email: userRecord.email });
    } catch (authError: any) {
      console.error('Firebase Auth ユーザー作成エラー:', authError);
      // Firebase Auth のエラーハンドリング
      if (authError.code === 'auth/email-already-exists') {
        return NextResponse.json(
          { error: 'このメールアドレスは既に使用されています' },
          { status: 400 }
        );
      }
      
      if (authError.code === 'auth/invalid-email') {
        return NextResponse.json(
          { error: '無効なメールアドレスです' },
          { status: 400 }
        );
      }

      if (authError.code === 'auth/weak-password') {
        return NextResponse.json(
          { error: 'パスワードが弱すぎます' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: `Firebase Auth ユーザー作成に失敗しました: ${authError.message || authError.code || '不明なエラー'}` },
        { status: 500 }
      );
    }
    
    // Firestore にユーザー情報を保存
    try {
      console.log('Firestore にユーザー情報を保存中:', { uid: userRecord.uid });
    await db.collection('users').doc(userRecord.uid).set({
      email,
      displayName: displayName || email.split('@')[0],
      role: finalRole,
      status: 'active',
      department: department || '',
      position: position || '',
      companyName: finalCompanyName,
        createdAt: Timestamp.now(),
      createdBy: userId, // 作成者のIDを記録
    });
      console.log('Firestore ユーザー情報保存成功');
    } catch (firestoreError: any) {
      console.error('Firestore ユーザー情報保存エラー:', firestoreError);
      // Firestore保存に失敗した場合、Firebase Authのユーザーは削除する
      try {
        await auth.deleteUser(userRecord.uid);
        console.log('Firebase Auth ユーザーを削除しました（Firestore保存失敗のため）');
      } catch (deleteError) {
        console.error('Firebase Auth ユーザー削除エラー:', deleteError);
      }
      return NextResponse.json(
        { error: `Firestore ユーザー情報保存に失敗しました: ${firestoreError.message || '不明なエラー'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: finalRole,
        status: 'active',
        department: department || '',
        position: position || '',
      },
    });

  } catch (error: any) {
    console.error('ユーザー作成エラー（予期しないエラー）:', error);
    console.error('エラー詳細:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    return NextResponse.json(
      { error: `ユーザー作成に失敗しました: ${error.message || '不明なエラー'}` },
      { status: 500 }
    );
  }
}

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

    // Firestore からユーザー一覧を取得
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => {
      const data = doc.data();
      
      // TimestampオブジェクトをDateオブジェクトに変換
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
      
      let lastLoginAt: Date | undefined;
      if (data.lastLoginAt) {
        if (data.lastLoginAt instanceof Timestamp) {
          lastLoginAt = data.lastLoginAt.toDate();
        } else if (data.lastLoginAt?.toDate && typeof data.lastLoginAt.toDate === 'function') {
          lastLoginAt = data.lastLoginAt.toDate();
        } else {
          lastLoginAt = new Date(data.lastLoginAt);
        }
      }
      
      return {
        id: doc.id,
        email: data.email || '',
        displayName: data.displayName || '',
        photoURL: data.photoURL || undefined,
        role: data.role || 'user',
        status: data.status || 'active',
        department: data.department || '',
        position: data.position || '',
        companyName: data.companyName || '',
        createdAt: createdAt.toISOString(),
        lastLoginAt: lastLoginAt?.toISOString()
      };
    });

    return NextResponse.json({ users });

  } catch (error) {
    console.error('ユーザー取得エラー:', error);
    return NextResponse.json(
      { error: 'ユーザー一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Firebase Admin SDK が初期化されていない場合はエラーを返す
    if (!auth || !db) {
      return NextResponse.json({ 
        error: 'Firebase Admin SDK が初期化されていません。環境変数を設定してください。' 
      }, { status: 500 });
    }

    // 認証チェック（ログイン済みユーザーなら誰でもユーザーを更新できる）
    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const { uid, role, status, department, position } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { error: 'ユーザーIDは必須です' },
        { status: 400 }
      );
    }

    // Firestore のユーザー情報を更新
    const updateData: any = {};
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (department !== undefined) updateData.department = department;
    if (position !== undefined) updateData.position = position;
    updateData.lastUpdated = new Date();

    await db.collection('users').doc(uid).update(updateData);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('ユーザー更新エラー:', error);
    return NextResponse.json(
      { error: 'ユーザー情報の更新に失敗しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Firebase Admin SDK が初期化されていない場合はエラーを返す
    if (!auth || !db) {
      return NextResponse.json({ 
        error: 'Firebase Admin SDK が初期化されていません。環境変数を設定してください。' 
      }, { status: 500 });
    }

    // 認証チェック（ログイン済みユーザーなら誰でもユーザーを削除できる）
    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { error: 'ユーザーIDは必須です' },
        { status: 400 }
      );
    }

    // Firebase Auth からユーザーを削除（存在する場合のみ）
    try {
      // ユーザーが存在するか確認
      await auth.getUser(uid);
      // ユーザーが存在する場合は削除
    await auth.deleteUser(uid);
      console.log('Firebase Auth からユーザーを削除しました:', uid);
    } catch (authError: any) {
      // ユーザーが存在しない場合はスキップ（既に削除されている）
      if (authError.code === 'auth/user-not-found') {
        console.log('Firebase Auth にユーザーが存在しないため、削除をスキップしました:', uid);
      } else {
        // その他のエラーはログに記録するが、Firestoreの削除は続行
        console.error('Firebase Auth ユーザー削除エラー:', authError);
      }
    }

    // Firestore からユーザー情報を削除
    try {
    await db.collection('users').doc(uid).delete();
      console.log('Firestore からユーザー情報を削除しました:', uid);
    } catch (firestoreError: any) {
      console.error('Firestore ユーザー削除エラー:', firestoreError);
      // Firestoreの削除に失敗した場合でも、Firebase Authの削除は成功している可能性があるため、
      // エラーを返す（ただし、Firebase Authの削除が既に成功している場合は、部分的に成功している）
      return NextResponse.json(
        { error: `Firestore からのユーザー情報削除に失敗しました: ${firestoreError.message || '不明なエラー'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('ユーザー削除エラー（予期しないエラー）:', error);
    return NextResponse.json(
      { error: `ユーザーの削除に失敗しました: ${error.message || '不明なエラー'}` },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Firebase Admin SDK が初期化されていない場合はエラーを返す
    if (!auth || !db) {
      return NextResponse.json({ 
        error: 'Firebase Admin SDK が初期化されていません。環境変数を設定してください。' 
      }, { status: 500 });
    }

    // 認証チェック（ログイン済みユーザーなら誰でもパスワードを変更できる）
    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const { uid, newPassword } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { error: 'ユーザーIDは必須です' },
        { status: 400 }
      );
    }

    if (!newPassword) {
      return NextResponse.json(
        { error: '新しいパスワードは必須です' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'パスワードは6文字以上である必要があります' },
        { status: 400 }
      );
    }

    // Firebase Auth でパスワードを更新
    await auth.updateUser(uid, {
      password: newPassword
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('パスワード変更エラー:', error);
    
    // Firebase Auth のエラーハンドリング
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    if (error.code === 'auth/weak-password') {
      return NextResponse.json(
        { error: 'パスワードが弱すぎます' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'パスワードの変更に失敗しました' },
      { status: 500 }
    );
  }
}
