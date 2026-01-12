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
      
      const note: any = {
        id: doc.id,
        title: data.title || '',
        meetingDate: data.meetingDate || '',
        meetingTime: data.meetingTime || '',
        location: data.location || '',
        attendees: data.attendees || [],
        assignee: data.assignee || '',
        actionItems: data.actionItems || [],
        notes: data.notes || '',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString()
      };

      // customerIdが存在する場合のみ追加
      if (data.customerId) {
        note.customerId = data.customerId;
      }

      // summaryが存在する場合のみ追加
      if (data.summary) {
        note.summary = data.summary;
      }

      return note;
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

    const { customerId, title, meetingDate, meetingTime, location, attendees, assignee, actionItems, notes, summary } = await request.json();

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

    const now = Timestamp.now();
    
    const noteData: any = {
      title,
      meetingDate: meetingDate || '',
      meetingTime: meetingTime || '',
      location: location || '',
      attendees: attendees || [],
      assignee: assignee || '',
      actionItems: actionItems || [],
      notes: notes || '',
      userId,
      companyName: userCompanyName,
      createdAt: now,
      updatedAt: now
    };

    // customerIdが存在する場合のみ追加（undefinedの場合はフィールドを含めない）
    if (customerId) {
      noteData.customerId = customerId;
    }

    // summaryが存在する場合のみ追加（undefinedの場合はフィールドを含めない）
    if (summary) {
      noteData.summary = summary;
    }

    const docRef = await db.collection('meetingNotes').add(noteData);

    // アクション項目を処理：TODOまたはカレンダーに自動追加
    if (actionItems && Array.isArray(actionItems) && actionItems.length > 0) {
      try {
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

        for (const actionItem of actionItems) {
          const { item, assignee, deadline } = actionItem;
          
          if (!item || !item.trim()) continue; // 項目が空の場合はスキップ
          
          // 担当者名またはIDからユーザー情報を取得
          let assigneeUserId: string | null = null;
          let assigneeName: string = '未指定';
          
          if (assignee && assignee.trim()) {
            // まずIDとして検索
            const assigneeUserById = usersMapById.get(assignee);
            if (assigneeUserById) {
              assigneeUserId = assignee;
              assigneeName = assigneeUserById.displayName || assigneeUserById.email || assignee;
            } else {
              // IDで見つからない場合は名前として検索
              const assigneeUserByName = usersMapByName.get(assignee);
              if (assigneeUserByName) {
                assigneeUserId = assigneeUserByName.id;
                assigneeName = assigneeUserByName.displayName || assigneeUserByName.email || assignee;
              } else {
                // 名前でも見つからない場合は、テキストとして扱う
                assigneeName = assignee;
                // 担当者が指定されていてもIDが見つからない場合は、議事録作成者をデフォルトとする
                assigneeUserId = userId;
              }
            }
          } else {
            // 担当者が未指定の場合は、議事録作成者をデフォルトとする
            assigneeUserId = userId;
            const currentUser = usersMapById.get(userId);
            assigneeName = currentUser?.displayName || currentUser?.email || '未指定';
          }

          if (deadline && deadline.trim()) {
            // 日付がある場合：カレンダーに追加
            try {
              // イベントを作成（内部でFirestoreに直接保存）
              const eventData = {
                title: item,
                date: deadline, // YYYY-MM-DD形式
                time: '', // 時間は指定なし
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
            } catch (eventError) {
              console.error('カレンダーへの追加エラー:', eventError);
              // エラーが発生しても議事録の保存は続行
            }
          } else {
            // 日付がない場合：TODOに追加（担当者のTODOとして作成、担当者が未指定の場合は全員に作成）
            try {
              const targetUserIds = assigneeUserId 
                ? [assigneeUserId] // 担当者が指定されている場合は担当者のみ
                : companyUserIds; // 担当者が未指定の場合は全員
              
              // 対象ユーザーに対して、それぞれのTODOを作成
              for (const targetUserId of targetUserIds) {
                const todoData = {
                  text: item,
                  completed: false,
                  createdAt: Timestamp.now(),
                  priority: 'medium' as const,
                  status: 'shared' as const,
                  assignee: assigneeUserId || targetUserId, // 担当者のユーザーIDを設定
                  description: `議事録「${title}」からのアクション項目`,
                  userId: targetUserId, // 担当者のTODOとして作成
                  sharedWith: [] // 個別のTODOなので共有は不要
                };
                
                await db.collection('todos').add(todoData);
              }
              console.log(`TODOに追加: ${item} (担当者: ${assigneeName}, ${targetUserIds.length}人分のTODOを作成)`);
            } catch (todoError) {
              console.error('TODOへの追加エラー:', todoError);
              // エラーが発生しても議事録の保存は続行
            }
          }
        }
      } catch (actionItemsError) {
        console.error('アクション項目処理エラー:', actionItemsError);
        // エラーが発生しても議事録の保存は続行
      }
    }

    return NextResponse.json({
      success: true,
      note: {
        id: docRef.id,
        ...noteData,
        createdAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString()
      }
    });

  } catch (error: any) {
    console.error('議事録作成エラー:', error);
    console.error('エラー詳細:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return NextResponse.json(
      { error: error.message || '議事録の作成に失敗しました' },
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

    // undefinedの値をフィルタリング（Firestoreはundefinedを保存できない）
    const cleanedUpdateData: any = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        cleanedUpdateData[key] = value;
      }
    }

    cleanedUpdateData.updatedAt = Timestamp.now();

    await db.collection('meetingNotes').doc(id).update(cleanedUpdateData);

    // アクション項目が更新された場合、TODOに追加
    if (cleanedUpdateData.actionItems && Array.isArray(cleanedUpdateData.actionItems)) {
      try {
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
        const title = cleanedUpdateData.title || noteData?.title || '';

        // 既存のTODOを確認（重複を避けるため）
        const existingTodosSnapshot = await db.collection('todos')
          .where('description', '==', `議事録「${title}」からのアクション項目`)
          .get();
        const existingTodoTexts = new Set(existingTodosSnapshot.docs.map(doc => doc.data().text));

        for (const actionItem of cleanedUpdateData.actionItems) {
          const { item, assignee, deadline } = actionItem;
          
          if (!item || !item.trim()) continue; // 項目が空の場合はスキップ
          
          // 既にTODOに追加されている場合はスキップ
          if (existingTodoTexts.has(item)) continue;
          
          // 担当者名またはIDからユーザー情報を取得
          let assigneeUserId: string | null = null;
          let assigneeName: string = '未指定';
          
          if (assignee && assignee.trim()) {
            // まずIDとして検索
            const assigneeUserById = usersMapById.get(assignee);
            if (assigneeUserById) {
              assigneeUserId = assignee;
              assigneeName = assigneeUserById.displayName || assigneeUserById.email || assignee;
            } else {
              // IDで見つからない場合は名前として検索
              const assigneeUserByName = usersMapByName.get(assignee);
              if (assigneeUserByName) {
                assigneeUserId = assigneeUserByName.id;
                assigneeName = assigneeUserByName.displayName || assigneeUserByName.email || assignee;
              } else {
                // 名前でも見つからない場合は、テキストとして扱う
                assigneeName = assignee;
                // 担当者が指定されていてもIDが見つからない場合は、議事録作成者をデフォルトとする
                assigneeUserId = userId;
              }
            }
          } else {
            // 担当者が未指定の場合は、議事録作成者をデフォルトとする
            assigneeUserId = userId;
            const currentUser = usersMapById.get(userId);
            assigneeName = currentUser?.displayName || currentUser?.email || '未指定';
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
            } catch (eventError) {
              console.error('カレンダーへの追加エラー:', eventError);
            }
          } else {
            // 日付がない場合：TODOに追加（担当者のTODOとして作成、担当者が未指定の場合は全員に作成）
            try {
              const targetUserIds = assigneeUserId 
                ? [assigneeUserId] // 担当者が指定されている場合は担当者のみ
                : companyUserIds; // 担当者が未指定の場合は全員
              
              // 対象ユーザーに対して、それぞれのTODOを作成
              for (const targetUserId of targetUserIds) {
                const todoData = {
                  text: item,
                  completed: false,
                  createdAt: Timestamp.now(),
                  priority: 'medium' as const,
                  status: 'shared' as const,
                  assignee: assigneeUserId || targetUserId, // 担当者のユーザーIDを設定
                  description: `議事録「${title}」からのアクション項目`,
                  userId: targetUserId, // 担当者のTODOとして作成
                  sharedWith: [] // 個別のTODOなので共有は不要
                };
                
                await db.collection('todos').add(todoData);
              }
              console.log(`TODOに追加: ${item} (担当者: ${assigneeName}, ${targetUserIds.length}人分のTODOを作成)`);
            } catch (todoError) {
              console.error('TODOへの追加エラー:', todoError);
            }
          }
        }
      } catch (actionItemsError) {
        console.error('アクション項目処理エラー:', actionItemsError);
      }
    }

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
    const noteTitle = noteData?.title || '';

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

    // 議事録から作成されたTODOを削除
    try {
      const todoDescriptionPattern = `議事録「${noteTitle}」からのアクション項目`;
      const todosSnapshot = await db.collection('todos')
        .where('description', '==', todoDescriptionPattern)
        .get();
      
      const deletePromises = todosSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      
      if (todosSnapshot.docs.length > 0) {
        console.log(`議事録「${noteTitle}」から作成されたTODO ${todosSnapshot.docs.length}件を削除しました`);
      }
    } catch (todoDeleteError) {
      console.error('関連TODOの削除エラー:', todoDeleteError);
      // TODO削除に失敗しても議事録の削除は続行
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

