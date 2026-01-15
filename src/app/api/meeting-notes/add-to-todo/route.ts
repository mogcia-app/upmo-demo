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

// 既存の議事録のアクション項目をTODOに追加
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

    const { noteId } = await request.json();

    if (!noteId) {
      return NextResponse.json(
        { error: '議事録IDは必須です' },
        { status: 400 }
      );
    }

    // 議事録を取得
    const noteDoc = await db.collection('meetingNotes').doc(noteId).get();
    if (!noteDoc.exists) {
      return NextResponse.json(
        { error: '議事録が見つかりません' },
        { status: 404 }
      );
    }

    const noteData = noteDoc.data();
    const companyName = noteData?.companyName || '';
    const title = noteData?.title || '';
    const actionItems = noteData?.actionItems || [];

    // 同じcompanyNameのユーザーまたは所有者のみアクセス可能
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userCompanyName = userData?.companyName || '';

    if (noteData?.userId !== userId && companyName !== userCompanyName) {
      return NextResponse.json(
        { error: 'この議事録にアクセスする権限がありません' },
        { status: 403 }
      );
    }

    if (!Array.isArray(actionItems) || actionItems.length === 0) {
      return NextResponse.json(
        { error: 'アクション項目がありません' },
        { status: 400 }
      );
    }

    // チームメンバー情報を取得（担当者名からIDを取得するため）
    const usersSnapshot = await db.collection('users')
      .where('companyName', '==', userCompanyName)
      .get();
    const usersMapById = new Map();
    const usersMapByName = new Map();
    const usersMapByEmail = new Map();
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      usersMapById.set(doc.id, userData);
      // 名前で検索できるようにマップを作成
      if (userData.displayName) {
        usersMapByName.set(userData.displayName, { id: doc.id, ...userData });
      }
      if (userData.email) {
        usersMapByEmail.set(userData.email, { id: doc.id, ...userData });
      }
    });

    // 同じ会社の全ユーザーIDを取得（共有設定用）
    const companyUserIds = usersSnapshot.docs.map(doc => doc.id);

    const addedTodos: string[] = [];
    const skippedTodos: string[] = [];

    for (const actionItem of actionItems) {
      const { item, assignee, deadline } = actionItem;
      
      if (!item || !item.trim()) continue; // 項目が空の場合はスキップ
      
      console.log(`アクション項目処理開始: ${item}, assignee: ${assignee}, deadline: ${deadline}`);
      
      // 担当者IDからユーザー情報を取得
      let assigneeUserId: string | null = null;
      let assigneeName: string = '未指定';
      
      if (assignee && assignee.trim()) {
        // まずIDとして検索（通常はIDが保存されている）
        const assigneeUserById = usersMapById.get(assignee);
        console.log(`担当者ID検索: ${assignee}, 結果:`, assigneeUserById ? '見つかった' : '見つからない');
        
        if (assigneeUserById) {
          assigneeUserId = assignee;
          assigneeName = assigneeUserById.displayName || assigneeUserById.email || assignee;
          console.log(`担当者IDでマッチ: ${assigneeUserId}, 名前: ${assigneeName}`);
        } else {
          // IDで見つからない場合は名前として検索（既存データの互換性のため）
          const assigneeUserByName = usersMapByName.get(assignee);
          console.log(`担当者名検索: ${assignee}, 結果:`, assigneeUserByName ? '見つかった' : '見つからない');
          
          if (assigneeUserByName) {
            assigneeUserId = assigneeUserByName.id;
            assigneeName = assigneeUserByName.displayName || assigneeUserByName.email || assignee;
            console.log(`担当者名でマッチ: ${assigneeUserId}, 名前: ${assigneeName}`);
          } else {
            // 名前でも見つからない場合は、テキストとして扱う
            // ただし、担当者が指定されていてもIDが見つからない場合は、担当者未指定として扱う（作成者をデフォルトにしない）
            assigneeName = assignee;
            // 担当者が指定されていてもIDが見つからない場合は、nullのまま（後で全員に追加する）
            assigneeUserId = null;
            console.log(`担当者が特定できませんでした: ${assignee}, assigneeUserId: null`);
          }
        }
      } else {
        // 担当者が未指定の場合は、議事録作成者をデフォルトとする
        assigneeUserId = userId;
        const currentUser = usersMapById.get(userId);
        assigneeName = currentUser?.displayName || currentUser?.email || '未指定';
        console.log(`担当者未指定、作成者をデフォルト: ${assigneeUserId}, 名前: ${assigneeName}`);
      }

      if (deadline && deadline.trim()) {
        // 日付がある場合：カレンダーに追加
        try {
          const eventData = {
            title: item,
            date: deadline,
            time: '',
            description: `議事録「${title}」からのアクション項目`,
            location: '',
            color: '#3B82F6',
            member: assigneeName,
            userId: assigneeUserId || userId,
            attendees: assigneeUserId ? [assigneeUserId] : [],
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          };
          
          await db.collection('events').add(eventData);
          console.log(`カレンダーにイベントを追加: ${item} (${deadline}, 担当者: ${assigneeName})`);
          addedTodos.push(item);
        } catch (eventError) {
          console.error('カレンダーへの追加エラー:', eventError);
        }
      } else {
        // 日付がない場合：TODOに追加（担当者のTODOとして作成、担当者が未指定の場合は全員に作成）
        try {
          // 担当者IDが特定できた場合のみ、その担当者のTODOとして作成
          // 担当者IDが特定できない場合は、全員に作成（既存の動作を維持）
          const targetUserIds = assigneeUserId 
            ? [assigneeUserId] // 担当者が指定されている場合は担当者のみ
            : companyUserIds; // 担当者が未指定または特定できない場合は全員
          
          // 各ユーザーごとに重複チェック
          const usersToAdd: string[] = [];
          for (const targetUserId of targetUserIds) {
            // 該当ユーザーの既存TODOを確認
            const existingTodosSnapshot = await db.collection('todos')
              .where('userId', '==', targetUserId)
              .where('description', '==', `議事録「${title}」からのアクション項目`)
              .where('text', '==', item)
              .get();
            
            // 既存のTODOが存在しない場合のみ追加対象とする
            if (existingTodosSnapshot.empty) {
              usersToAdd.push(targetUserId);
            }
          }
          
          // 対象ユーザーに対して、それぞれのTODOを作成
          for (const targetUserId of usersToAdd) {
            // assigneeUserIdが特定できた場合はそのIDを使用、できない場合はtargetUserIdを使用
            const finalAssignee = assigneeUserId || targetUserId;
            
            const todoData = {
              text: item,
              completed: false,
              createdAt: Timestamp.now(),
              priority: 'medium' as const,
              status: 'shared' as const,
              assignee: finalAssignee, // 担当者のユーザーIDを設定
              description: `議事録「${title}」からのアクション項目`,
              userId: targetUserId, // 対象ユーザーのTODOとして作成
              sharedWith: [] // 個別のTODOなので共有は不要
            };
            
            await db.collection('todos').add(todoData);
            const assigneeUser = usersMapById.get(finalAssignee);
            const assigneeDisplayName = assigneeUser?.displayName || assigneeUser?.email || finalAssignee;
            console.log(`TODO作成: ${item} (userId: ${targetUserId}, assignee: ${finalAssignee} (${assigneeDisplayName}))`);
          }
          
          if (usersToAdd.length > 0) {
            console.log(`TODOに追加: ${item} (担当者: ${assigneeName || '未指定'}, ${usersToAdd.length}人分のTODOを作成)`);
            addedTodos.push(item);
          } else {
            console.log(`TODOスキップ: ${item} (担当者: ${assigneeName || '未指定'}, 既に全てのユーザーに存在)`);
            skippedTodos.push(item);
          }
        } catch (todoError) {
          console.error('TODOへの追加エラー:', todoError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${addedTodos.length}件のアクション項目をTODOに追加しました`,
      added: addedTodos,
      skipped: skippedTodos
    });

  } catch (error: any) {
    console.error('TODO追加エラー:', error);
    return NextResponse.json(
      { error: error.message || 'TODOへの追加に失敗しました' },
      { status: 500 }
    );
  }
}

