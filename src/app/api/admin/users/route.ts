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
      return NextResponse.json({ 
        error: 'Firebase Admin SDK が初期化されていません。環境変数を設定してください。' 
      }, { status: 500 });
    }

    // 認証チェック（管理者のみがユーザーを作成できる）
    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 管理者権限チェック
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (!userData || userData.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const { email, password, displayName, role = 'user', department, position } = await request.json();

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

    // Firebase Auth でユーザーを作成
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0],
      emailVerified: false,
    });

    // Firestore にユーザー情報を保存
    await db.collection('users').doc(userRecord.uid).set({
      email,
      displayName: displayName || email.split('@')[0],
      role,
      status: 'active',
      department: department || '',
      position: position || '',
      createdAt: new Date(),
      createdBy: 'admin', // 管理者が作成したことを記録
    });

    return NextResponse.json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role,
        status: 'active',
        department: department || '',
        position: position || '',
      },
    });

  } catch (error: any) {
    console.error('ユーザー作成エラー:', error);
    
    // Firebase Auth のエラーハンドリング
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json(
        { error: 'このメールアドレスは既に使用されています' },
        { status: 400 }
      );
    }
    
    if (error.code === 'auth/invalid-email') {
      return NextResponse.json(
        { error: '無効なメールアドレスです' },
        { status: 400 }
      );
    }

    if (error.code === 'auth/weak-password') {
      return NextResponse.json(
        { error: 'パスワードが弱すぎます' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'ユーザー作成に失敗しました' },
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

    // 認証チェック（管理者のみがユーザーを更新できる）
    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 管理者権限チェック
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (!userData || userData.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
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

    // 認証チェック（管理者のみがユーザーを削除できる）
    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 管理者権限チェック
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (!userData || userData.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { error: 'ユーザーIDは必須です' },
        { status: 400 }
      );
    }

    // Firebase Auth からユーザーを削除
    await auth.deleteUser(uid);

    // Firestore からユーザー情報を削除
    await db.collection('users').doc(uid).delete();

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('ユーザー削除エラー:', error);
    return NextResponse.json(
      { error: 'ユーザーの削除に失敗しました' },
      { status: 500 }
    );
  }
}
