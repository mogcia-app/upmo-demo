/**
 * companyNameが空のユーザーを修正するマイグレーションスクリプト
 * 
 * 実行方法:
 *   npx ts-node scripts/fix-company-name.ts
 * 
 * または、Node.jsで直接実行:
 *   node -r ts-node/register scripts/fix-company-name.ts
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
  companyName?: string;
  email?: string;
  displayName?: string;
  role?: string;
}

interface DocumentData {
  companyName?: string;
  userId?: string;
  title?: string;
}

async function fixCompanyName() {
  console.log('🔄 companyNameの修正を開始します...\n');

  try {
    // 1. companyNameが空のユーザーを検索
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 総ユーザー数: ${usersSnapshot.size}件\n`);

    const usersWithoutCompanyName: Array<{ id: string; data: UserData }> = [];
    const usersWithCompanyName: Map<string, string> = new Map(); // email -> companyName

    for (const doc of usersSnapshot.docs) {
      const data = doc.data() as UserData;
      if (!data.companyName || data.companyName.trim() === '') {
        usersWithoutCompanyName.push({ id: doc.id, data });
      } else {
        // companyNameが設定されているユーザーの情報を保存
        if (data.email) {
          usersWithCompanyName.set(data.email, data.companyName);
        }
      }
    }

    console.log(`⚠️  companyNameが空のユーザー: ${usersWithoutCompanyName.length}件\n`);

    if (usersWithoutCompanyName.length === 0) {
      console.log('✅ 修正が必要なユーザーはありませんでした');
      return;
    }

    // 2. ドキュメントからcompanyNameを推測
    const documentsSnapshot = await db.collection('manualDocuments').get();
    const userIdToCompanyName: Map<string, string> = new Map();

    for (const doc of documentsSnapshot.docs) {
      const data = doc.data() as DocumentData;
      if (data.companyName && data.userId) {
        userIdToCompanyName.set(data.userId, data.companyName);
      }
    }

    console.log(`📄 ドキュメントから取得したcompanyName: ${userIdToCompanyName.size}件\n`);

    // 3. 修正処理
    let fixedCount = 0;
    let skippedCount = 0;
    const batch = db.batch();
    let batchCount = 0;
    const maxBatchSize = 500;

    for (const { id, data } of usersWithoutCompanyName) {
      let companyName: string | null = null;

      // 方法1: 同じユーザーIDのドキュメントから取得
      if (userIdToCompanyName.has(id)) {
        companyName = userIdToCompanyName.get(id)!;
      }
      // 方法2: 同じメールアドレスのドメインから推測（最後の手段）
      else if (data.email) {
        const domain = data.email.split('@')[1];
        // ドメインから会社名を推測（例: example.com -> Example）
        companyName = domain.split('.')[0]
          .split('')
          .map((char, index) => index === 0 ? char.toUpperCase() : char)
          .join('');
      }

      if (companyName) {
        batch.update(db.collection('users').doc(id), {
          companyName: companyName,
          updatedAt: Timestamp.now()
        });
        batchCount++;
        fixedCount++;

        console.log(`✅ ユーザー ${data.email || id} のcompanyNameを "${companyName}" に設定`);

        // バッチサイズが上限に達したらコミット
        if (batchCount >= maxBatchSize) {
          await batch.commit();
          console.log(`✅ ${batchCount}件のユーザーを更新しました（累計: ${fixedCount}件）`);
          batchCount = 0;
        }
      } else {
        skippedCount++;
        console.log(`⏭️  ユーザー ${data.email || id} のcompanyNameを推測できませんでした（手動設定が必要）`);
      }
    }

    // 残りのバッチをコミット
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ 残り${batchCount}件のユーザーを更新しました（累計: ${fixedCount}件）`);
    }

    console.log('\n📊 修正結果:');
    console.log(`  ✅ 修正: ${fixedCount}件`);
    console.log(`  ⏭️  スキップ: ${skippedCount}件`);
    console.log(`  📦 合計: ${usersWithoutCompanyName.length}件`);

    if (skippedCount > 0) {
      console.log('\n⚠️  以下のユーザーは手動でcompanyNameを設定する必要があります:');
      for (const { id, data } of usersWithoutCompanyName) {
        if (!userIdToCompanyName.has(id) && !data.email) {
          console.log(`  - ${id} (${data.displayName || '名前なし'})`);
        }
      }
    }

  } catch (error: any) {
    console.error('❌ 修正エラー:', error);
    throw error;
  }
}

// メイン処理
async function main() {
  try {
    await fixCompanyName();
    console.log('\n✅ 修正完了');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 修正失敗:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  main();
}

export { fixCompanyName };


