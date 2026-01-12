/**
 * TODOのassigneeフィールドを名前からユーザーIDに変換するマイグレーションスクリプト
 * 
 * 使用方法:
 * npx ts-node scripts/migrate-todo-assignee.ts
 * 
 * 注意: 実行前にFirestoreのバックアップを取得してください
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を読み込み
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Firebase Admin SDKの初期化
if (!getApps().length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin SDK initialized');
  } else {
    console.error('❌ Firebase環境変数が設定されていません');
    process.exit(1);
  }
}

const db = getFirestore();

async function migrateTodoAssignee() {
  try {
    console.log('📋 TODOのassigneeフィールドをマイグレーション開始...\n');

    // 全てのTODOを取得
    const todosSnapshot = await db.collection('todos').get();
    console.log(`📊 合計 ${todosSnapshot.size} 件のTODOを取得しました\n`);

    // 全てのユーザーを取得してマッピングを作成
    const usersSnapshot = await db.collection('users').get();
    const usersMapById = new Map();
    const usersMapByName = new Map();
    const usersMapByEmail = new Map();

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      usersMapById.set(doc.id, { id: doc.id, ...userData });
      if (userData.displayName) {
        usersMapByName.set(userData.displayName, { id: doc.id, ...userData });
      }
      if (userData.email) {
        usersMapByEmail.set(userData.email, { id: doc.id, ...userData });
      }
    });

    console.log(`👥 ${usersSnapshot.size} 件のユーザー情報を取得しました\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestoreのバッチ制限

    for (const doc of todosSnapshot.docs) {
      const todoData = doc.data();
      const assignee = todoData.assignee;

      // assigneeが空または既にID形式（UUIDのような形式）の場合はスキップ
      if (!assignee || typeof assignee !== 'string') {
        skippedCount++;
        continue;
      }

      // 既にユーザーIDとして存在するかチェック
      if (usersMapById.has(assignee)) {
        skippedCount++;
        continue;
      }

      // assigneeが空文字列の場合はスキップ
      if (assignee.trim() === '') {
        skippedCount++;
        continue;
      }

      // 名前またはメールアドレスとして検索
      let assigneeUserId: string | null = null;

      // 名前で検索
      if (usersMapByName.has(assignee)) {
        assigneeUserId = usersMapByName.get(assignee).id;
      }
      // メールアドレスで検索
      else if (usersMapByEmail.has(assignee)) {
        assigneeUserId = usersMapByEmail.get(assignee).id;
      }

      if (assigneeUserId) {
        // バッチに更新を追加
        batch.update(doc.ref, {
          assignee: assigneeUserId
        });
        batchCount++;
        updatedCount++;

        const assigneeUser = usersMapById.get(assigneeUserId);
        const assigneeName = assigneeUser?.displayName || assigneeUserId;
        console.log(`✅ ${doc.id}: "${assignee}" → ${assigneeName} (${assigneeUserId})`);

        // バッチサイズに達したらコミット
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`💾 ${batchCount}件の更新をコミットしました\n`);
          // 新しいバッチを作成
          batch = db.batch();
          batchCount = 0;
        }
      } else {
        // ユーザーが見つからない場合
        console.log(`⚠️  ${doc.id}: "${assignee}" に対応するユーザーが見つかりませんでした`);
        skippedCount++;
      }
    }

    // 残りのバッチをコミット
    if (batchCount > 0) {
      await batch.commit();
      console.log(`💾 残り ${batchCount}件の更新をコミットしました\n`);
    }

    console.log('\n📊 マイグレーション結果:');
    console.log(`  ✅ 更新: ${updatedCount} 件`);
    console.log(`  ⏭️  スキップ: ${skippedCount} 件`);
    console.log(`  ❌ エラー: ${errorCount} 件`);
    console.log('\n✅ マイグレーション完了！');

  } catch (error) {
    console.error('❌ マイグレーションエラー:', error);
    throw error;
  }
}

// スクリプト実行
migrateTodoAssignee()
  .then(() => {
    console.log('\n✅ 処理が正常に完了しました');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  });

