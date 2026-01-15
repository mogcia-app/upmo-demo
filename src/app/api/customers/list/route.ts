import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { CustomerListTab, Column, CustomerListRow, DuplicateCheckResult } from '@/types/customer-list';
import { createNotificationInServer } from '../../notifications/helper';

// Firebase Admin SDK の初期化
function initAdmin() {
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
}

function getDb() {
  initAdmin();
  return getApps().length > 0 ? getFirestore() : null;
}

// 認証トークンを検証するヘルパー関数
async function verifyAuthToken(request: NextRequest): Promise<{ userId: string; companyName: string } | null> {
  initAdmin();
  const auth = getApps().length > 0 ? getAuth() : null;
  if (!auth) return null;
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    // ユーザーのcompanyNameを取得
    const db = getDb();
    if (!db) return null;
    
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const companyName = userData?.companyName || '';
    
    return { userId, companyName };
  } catch (error) {
    console.error('認証トークン検証エラー:', error);
    return null;
  }
}

// 重複チェック関数
function checkDuplicates(rows: CustomerListRow[], columns: Column[]): DuplicateCheckResult {
  const duplicateRows: DuplicateCheckResult['duplicateRows'] = [];
  
  // 各行を比較
  for (let i = 0; i < rows.length; i++) {
    const row1 = rows[i];
    const duplicates: string[] = [];
    const duplicateFields: string[] = [];
    
    for (let j = i + 1; j < rows.length; j++) {
      const row2 = rows[j];
      const matchingFields: string[] = [];
      
      // すべての列をチェック
      for (const column of columns) {
        const value1 = row1[column.id];
        const value2 = row2[column.id];
        
        // 空の値は無視
        if (!value1 || !value2) continue;
        
        // 値が一致する場合
        if (String(value1).trim() === String(value2).trim()) {
          matchingFields.push(column.name);
        }
      }
      
      // すべての列が一致する場合、重複とみなす
      if (matchingFields.length === columns.length && columns.length > 0) {
        duplicates.push(row2.id);
        duplicateFields.push(...matchingFields);
      }
    }
    
    if (duplicates.length > 0) {
      duplicateRows.push({
        rowId: row1.id,
        duplicateWith: duplicates,
        fields: Array.from(new Set(duplicateFields))
      });
    }
  }
  
  return {
    hasDuplicates: duplicateRows.length > 0,
    duplicateRows
  };
}

// GET: タブ一覧とタブ内のデータを取得
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuthToken(request);
    if (!authResult) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    
    const { userId, companyName } = authResult;
    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: 'データベースに接続できません' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const tabId = searchParams.get('tabId');
    const searchCompanyName = searchParams.get('searchCompanyName');
    
    // 会社名で検索（すべてのタブから）
    if (searchCompanyName) {
      let tabsQuery: any;
      if (companyName) {
        tabsQuery = db.collection('customerListTabs')
          .where('companyName', '==', companyName);
      } else {
        tabsQuery = db.collection('customerListTabs')
          .where('userId', '==', userId);
      }
      
      const tabsSnapshot = await tabsQuery.get();
      const searchResults: Array<{ tabId: string; tabName: string; row: CustomerListRow; columns: Column[] }> = [];
      
      for (const tabDoc of tabsSnapshot.docs) {
        const tabData = tabDoc.data();
        const columns = tabData.columns || [];
        const rows = tabData.rows || [];
        
        // 会社名の列を探す
        const companyNameColumn = columns.find((col: Column) => 
          col.name === '会社名' || col.name === 'companyName' || col.name.toLowerCase().includes('会社')
        );
        
        if (companyNameColumn) {
          // 会社名で検索
          const matchingRows = rows.filter((row: CustomerListRow) => {
            const companyValue = String(row[companyNameColumn.id] || '').toLowerCase();
            return companyValue.includes(searchCompanyName.toLowerCase());
          });
          
          matchingRows.forEach((row: CustomerListRow) => {
            searchResults.push({
              tabId: tabDoc.id,
              tabName: tabData.name || '',
              row,
              columns
            });
          });
        }
      }
      
      return NextResponse.json({
        searchResults,
        query: searchCompanyName
      });
    }
    
    if (tabId) {
      // 特定のタブを取得
      const tabDoc = await db.collection('customerListTabs').doc(tabId).get();
      if (!tabDoc.exists) {
        return NextResponse.json({ error: 'タブが見つかりません' }, { status: 404 });
      }
      
      const tabData = tabDoc.data();
      if (tabData && (tabData.userId !== userId && tabData.companyName !== companyName)) {
        return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 });
      }
      
      return NextResponse.json({
        tab: {
          id: tabDoc.id,
          ...tabData,
          createdAt: tabData?.createdAt?.toDate(),
          updatedAt: tabData?.updatedAt?.toDate(),
        }
      });
    } else {
      // すべてのタブを取得（companyNameでフィルタリング）
      let tabsQuery: any;
      if (companyName) {
        tabsQuery = db.collection('customerListTabs')
          .where('companyName', '==', companyName)
          .orderBy('createdAt', 'desc');
      } else {
        tabsQuery = db.collection('customerListTabs')
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc');
      }
      
      const tabsSnapshot = await tabsQuery.get();
      const tabs = tabsSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        };
      });
      
      return NextResponse.json({ tabs });
    }
  } catch (error) {
    console.error('タブ取得エラー:', error);
    return NextResponse.json({ error: 'タブの取得に失敗しました' }, { status: 500 });
  }
}

// POST: 新しいタブを作成
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuthToken(request);
    if (!authResult) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    
    const { userId, companyName } = authResult;
    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: 'データベースに接続できません' }, { status: 500 });
    }
    
    const body = await request.json();
    const { name, columns, rows } = body;
    
    if (!name || !Array.isArray(columns)) {
      return NextResponse.json({ error: 'タブ名と列定義が必要です' }, { status: 400 });
    }
    
    // 重複チェック
    const duplicateCheck = checkDuplicates(rows || [], columns);
    if (duplicateCheck.hasDuplicates) {
      return NextResponse.json({
        error: '重複する行が見つかりました',
        duplicates: duplicateCheck.duplicateRows
      }, { status: 400 });
    }
    
    const now = Timestamp.now();
    const tabData: Omit<CustomerListTab, 'id'> = {
      name,
      columns,
      rows: rows || [],
      userId,
      companyName: companyName || '',
      createdAt: now as any,
      updatedAt: now as any,
    };
    
    const docRef = await db.collection('customerListTabs').add(tabData);
    
    // 通知を作成
    await createNotificationInServer(db, userId, companyName || '', {
      type: 'create',
      pageName: '顧客リスト',
      pageUrl: `/customers/list?tabId=${docRef.id}`,
      title: name,
      action: 'created',
    });
    
    return NextResponse.json({
      id: docRef.id,
      ...tabData,
      createdAt: now.toDate(),
      updatedAt: now.toDate(),
    });
  } catch (error) {
    console.error('タブ作成エラー:', error);
    return NextResponse.json({ error: 'タブの作成に失敗しました' }, { status: 500 });
  }
}

// PUT: タブを更新
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAuthToken(request);
    if (!authResult) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    
    const { userId, companyName } = authResult;
    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: 'データベースに接続できません' }, { status: 500 });
    }
    
    const body = await request.json();
    const { id, name, columns, rows } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'タブIDが必要です' }, { status: 400 });
    }
    
    // タブの存在確認と権限チェック
    const tabDoc = await db.collection('customerListTabs').doc(id).get();
    if (!tabDoc.exists) {
      return NextResponse.json({ error: 'タブが見つかりません' }, { status: 404 });
    }
    
    const tabData = tabDoc.data();
    if (tabData && (tabData.userId !== userId && tabData.companyName !== companyName)) {
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 });
    }
    
    // 重複チェック
    if (rows && columns) {
      const duplicateCheck = checkDuplicates(rows, columns);
      if (duplicateCheck.hasDuplicates) {
        return NextResponse.json({
          error: '重複する行が見つかりました',
          duplicates: duplicateCheck.duplicateRows
        }, { status: 400 });
      }
    }
    
    const updates: Partial<CustomerListTab> = {
      updatedAt: Timestamp.now() as any,
    };
    
    if (name !== undefined) updates.name = name;
    if (columns !== undefined) updates.columns = columns;
    if (rows !== undefined) updates.rows = rows;
    
    await db.collection('customerListTabs').doc(id).update(updates);
    
    const updatedDoc = await db.collection('customerListTabs').doc(id).get();
    const updatedData = updatedDoc.data();
    
    // 通知を作成
    await createNotificationInServer(db, userId, companyName || '', {
      type: 'update',
      pageName: '顧客リスト',
      pageUrl: `/customers/list?tabId=${id}`,
      title: name || tabData?.name || '顧客リスト',
      action: 'updated',
    });
    
    return NextResponse.json({
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData?.createdAt?.toDate(),
      updatedAt: updatedData?.updatedAt?.toDate(),
    });
  } catch (error) {
    console.error('タブ更新エラー:', error);
    return NextResponse.json({ error: 'タブの更新に失敗しました' }, { status: 500 });
  }
}

// DELETE: タブを削除
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuthToken(request);
    if (!authResult) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    
    const { userId, companyName } = authResult;
    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: 'データベースに接続できません' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const tabId = searchParams.get('tabId');
    
    if (!tabId) {
      return NextResponse.json({ error: 'タブIDが必要です' }, { status: 400 });
    }
    
    // タブの存在確認と権限チェック
    const tabDoc = await db.collection('customerListTabs').doc(tabId).get();
    if (!tabDoc.exists) {
      return NextResponse.json({ error: 'タブが見つかりません' }, { status: 404 });
    }
    
    const tabData = tabDoc.data();
    if (tabData && (tabData.userId !== userId && tabData.companyName !== companyName)) {
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 });
    }
    
    await db.collection('customerListTabs').doc(tabId).delete();
    
    // 通知を作成
    await createNotificationInServer(db, userId, companyName || '', {
      type: 'delete',
      pageName: '顧客リスト',
      pageUrl: `/customers/list`,
      title: tabData?.name || '顧客リスト',
      action: 'deleted',
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('タブ削除エラー:', error);
    return NextResponse.json({ error: 'タブの削除に失敗しました' }, { status: 500 });
  }
}

