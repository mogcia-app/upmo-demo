/**
 * ユーザーデータ構造の統一マイグレーションスクリプト
 * 
 * 実行方法:
 *   npx ts-node scripts/migrate-user-schema.ts
 * 
 * または、Node.jsで直接実行:
 *   node -r ts-node/register scripts/migrate-user-schema.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数の読み込み
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Firebase Admin SDKの初期化
if (getApps().length === 0) {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('❌ Firebase環境変数が設定されていません');
    console.error('以下の環境変数を設定してください:');
    console.error('  - FIREBASE_PROJECT_ID');
    console.error('  - FIREBASE_CLIENT_EMAIL');
    console.error('  - FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

interface UserData {
  status?: string;
  updatedAt?: Timestamp | Date;
  createdBy?: string | null;
  department?: string;
  position?: string;
}

async function migrateUsers() {
  console.log('🔄 ユーザーデータのマイグレーションを開始します...\n');

  try {
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 総ユーザー数: ${usersSnapshot.size}件\n`);

    if (usersSnapshot.size === 0) {
      console.log('✅ マイグレーションが必要なユーザーはありませんでした');
      return;
    }

    let migratedCount = 0;
    let skippedCount = 0;
    const batch = db.batch();
    let batchCount = 0;
    const maxBatchSize = 500; // Firestoreのバッチ制限

    for (const doc of usersSnapshot.docs) {
      const data = doc.data() as UserData;
      const updates: Partial<UserData> = {};
      let needsUpdate = false;

      // statusフィールドがない場合は追加
      if (!data.status) {
        updates.status = 'active';
        needsUpdate = true;
      }

      // updatedAtフィールドがない場合は追加（createdAtと同じ値、または現在時刻）
      if (!data.updatedAt) {
        if (data.createdAt) {
          // createdAtがTimestampの場合はそのまま使用
          if (data.createdAt instanceof Timestamp) {
            updates.updatedAt = data.createdAt;
          } else {
            // Dateオブジェクトの場合はTimestampに変換
            updates.updatedAt = Timestamp.fromDate(
              data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt)
            );
          }
        } else {
          updates.updatedAt = Timestamp.now();
        }
        needsUpdate = true;
      }

      // createdByフィールドがない場合はnullを設定（admin側から作成された可能性）
      if (data.createdBy === undefined) {
        updates.createdBy = null;
        needsUpdate = true;
      }

      // departmentフィールドがない場合は空文字列
      if (data.department === undefined) {
        updates.department = '';
        needsUpdate = true;
      }

      // positionフィールドがない場合は空文字列
      if (data.position === undefined) {
        updates.position = '';
        needsUpdate = true;
      }

      // 更新がある場合のみバッチに追加
      if (needsUpdate) {
        batch.update(doc.ref, updates);
        batchCount++;
        migratedCount++;

        // バッチサイズが上限に達したらコミット
        if (batchCount >= maxBatchSize) {
          await batch.commit();
          console.log(`✅ ${batchCount}件のユーザーを更新しました（累計: ${migratedCount}件）`);
          batchCount = 0;
        }
      } else {
        skippedCount++;
      }
    }

    // 残りのバッチをコミット
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ 残り${batchCount}件のユーザーを更新しました（累計: ${migratedCount}件）`);
    }

    console.log('\n📊 マイグレーション結果:');
    console.log(`  ✅ 更新: ${migratedCount}件`);
    console.log(`  ⏭️  スキップ: ${skippedCount}件`);
    console.log(`  📦 合計: ${usersSnapshot.size}件`);

  } catch (error: any) {
    console.error('❌ マイグレーションエラー:', error);
    throw error;
  }
}

// メイン処理
async function main() {
  try {
    await migrateUsers();
    console.log('\n✅ マイグレーション完了');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ マイグレーション失敗:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  main();
}

export { migrateUsers };





