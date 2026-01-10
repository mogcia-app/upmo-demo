# ユーザーデータ構造の統一案

## 現状の問題

現在、admin側から追加したユーザーと、ツール内の「利用者招待」から追加したユーザーで、データ構造が異なっています。

### admin側から追加したユーザー
```typescript
{
  companyName: string,
  createdAt: Timestamp,
  displayName: string,
  email: string,
  role: string,
  subscriptionType: string,  // admin側で設定
  updatedAt: Timestamp
}
```

### 利用者招待から追加したユーザー
```typescript
{
  companyName: string,
  createdAt: Timestamp,
  createdBy: string,         // 作成者のID
  department: string,
  displayName: string,
  email: string,
  position: string,
  role: string,
  status: string             // 'active' | 'inactive' | 'suspended'
}
```

## 問題点

1. **データ構造の不統一**: 同じユーザーコレクションなのに、フィールドが異なる
2. **ツール内共有の限界**: データ構造の違いにより、一部の機能が正しく動作しない可能性
3. **クエリの複雑化**: フィールドの有無をチェックする必要があり、クエリが複雑になる
4. **保守性の低下**: 2つの異なるデータ構造を管理する必要がある

## 提案: 統一されたユーザースキーマ

### 必須フィールド（全ユーザーに存在）

```typescript
interface User {
  // 基本情報
  id: string;                    // ドキュメントID（Firebase Auth UID）
  email: string;                  // メールアドレス（必須）
  displayName: string;            // 表示名（必須）
  
  // 会社・組織情報
  companyName: string;           // 会社名（必須）
  
  // 権限・ステータス
  role: string;                  // 'admin' | 'manager' | 'user'（必須、デフォルト: 'user'）
  status: string;                // 'active' | 'inactive' | 'suspended'（必須、デフォルト: 'active'）
  
  // 作成・更新情報
  createdAt: Timestamp;          // 作成日時（必須）
  createdBy?: string;            // 作成者のUID（オプション、admin側から作成した場合は空でも可）
  updatedAt?: Timestamp;         // 更新日時（オプション、更新時に設定）
  
  // オプションフィールド
  department?: string;           // 部署（オプション）
  position?: string;             // 役職（オプション）
  photoURL?: string;             // プロフィール画像URL（オプション）
  subscriptionType?: string;     // サブスクリプションタイプ（オプション、admin側で設定）
  lastLoginAt?: Timestamp;       // 最終ログイン日時（オプション）
}
```

### デフォルト値

```typescript
const DEFAULT_USER_VALUES = {
  role: 'user',
  status: 'active',
  department: '',
  position: '',
  createdBy: null,  // admin側から作成した場合はnullでも可
};
```

## 実装案

### 1. 利用者招待APIの修正（`/api/admin/users/route.ts`）

現在の実装を修正して、すべてのフィールドを設定するようにします。

```typescript
// POST /api/admin/users
await db.collection('users').doc(userRecord.uid).set({
  email,
  displayName: displayName || email.split('@')[0],
  companyName: finalCompanyName,
  role: finalRole,
  status: 'active',                    // 追加
  department: department || '',
  position: position || '',
  createdAt: Timestamp.now(),
  createdBy: userId,                   // 既に設定済み
  updatedAt: Timestamp.now(),           // 追加
  // subscriptionTypeはadmin側で後から設定される想定
});
```

### 2. admin側のユーザー作成APIの修正（upmo-admin側で実装）

admin側でも同じスキーマを使用するように修正します。

```typescript
// admin側のユーザー作成API（upmo-admin側で実装）
await db.collection('users').doc(userRecord.uid).set({
  email,
  displayName: displayName || email.split('@')[0],
  companyName: companyName,
  role: role || 'user',
  status: 'active',                    // 追加
  department: department || '',        // 追加（オプション）
  position: position || '',            // 追加（オプション）
  createdAt: Timestamp.now(),
  createdBy: null,                     // admin側から作成した場合はnull
  updatedAt: Timestamp.now(),          // 追加
  subscriptionType: subscriptionType || null,  // admin側で設定
});
```

### 3. 既存データのマイグレーション

既存のユーザーデータを統一スキーマに移行するスクリプトを作成します。

```typescript
// scripts/migrate-user-schema.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Firebase Admin SDKの初期化
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

async function migrateUsers() {
  const usersSnapshot = await db.collection('users').get();
  const batch = db.batch();
  let count = 0;

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const updates: any = {};

    // statusフィールドがない場合は追加
    if (!data.status) {
      updates.status = 'active';
    }

    // updatedAtフィールドがない場合は追加（createdAtと同じ値）
    if (!data.updatedAt) {
      updates.updatedAt = data.createdAt || Timestamp.now();
    }

    // createdByフィールドがない場合はnullを設定（admin側から作成された可能性）
    if (!data.createdBy) {
      updates.createdBy = null;
    }

    // departmentフィールドがない場合は空文字列
    if (data.department === undefined) {
      updates.department = '';
    }

    // positionフィールドがない場合は空文字列
    if (data.position === undefined) {
      updates.position = '';
    }

    // 更新がある場合のみバッチに追加
    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      count++;
    }
  }

  // バッチコミット（500件ずつ）
  if (count > 0) {
    await batch.commit();
    console.log(`✅ ${count}件のユーザーデータをマイグレーションしました`);
  } else {
    console.log('✅ マイグレーションが必要なユーザーはありませんでした');
  }
}

migrateUsers()
  .then(() => {
    console.log('✅ マイグレーション完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ マイグレーションエラー:', error);
    process.exit(1);
  });
```

### 4. 型定義の追加 ✅ 完了

TypeScriptの型定義を追加して、統一されたスキーマを強制します。

✅ `src/types/user.ts`を作成済み

このファイルには以下が含まれています：
- `User`インターフェース: 統一されたユーザースキーマ
- `UserRole`型: 'admin' | 'manager' | 'user'
- `UserStatus`型: 'active' | 'inactive' | 'suspended'
- `DEFAULT_USER_VALUES`: デフォルト値の定義
- `validateUserData()`: ユーザーデータのバリデーション関数
- `normalizeUserData()`: 既存データを統一スキーマに変換する関数

**使用例:**
```typescript
import { User, validateUserData, normalizeUserData } from '@/types/user';

// 新規ユーザー作成時
const newUser: Partial<User> = {
  email: 'user@example.com',
  displayName: 'テストユーザー',
  companyName: '株式会社テスト',
  role: 'user',
  status: 'active',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

// バリデーション
const validation = validateUserData(newUser);
if (!validation.valid) {
  console.error('バリデーションエラー:', validation.errors);
}

// 既存データの正規化（マイグレーション用）
const normalized = normalizeUserData(existingUserData);
```

## 移行手順

### ステップ1: スキーマ定義の追加 ✅ 完了
1. ✅ `src/types/user.ts`を作成して統一スキーマを定義
2. ⏳ 既存のコードで使用している型定義を更新（必要に応じて）

### ステップ2: APIの修正 ✅ 完了
1. ✅ `/api/admin/users/route.ts`のPOSTメソッドを修正（`updatedAt`フィールドを追加）
2. ⏳ admin側（upmo-admin）のユーザー作成APIも同様に修正（要実装）

**upmo-admin側で実装が必要な内容:**
```typescript
// admin側のユーザー作成API（upmo-admin側で実装）
await db.collection('users').doc(userRecord.uid).set({
  email,
  displayName: displayName || email.split('@')[0],
  companyName: companyName,
  role: role || 'user',
  status: 'active',                    // 追加
  department: department || '',         // 追加（オプション）
  position: position || '',            // 追加（オプション）
  createdAt: Timestamp.now(),
  createdBy: null,                     // admin側から作成した場合はnull
  updatedAt: Timestamp.now(),          // 追加
  subscriptionType: subscriptionType || null,  // admin側で設定
});
```

### ステップ3: マイグレーションスクリプトの準備 ✅ 完了
1. ✅ `scripts/migrate-user-schema.ts`を作成
2. ⏳ 本番環境で実行前に、ステージング環境でテスト
3. ⏳ バックアップを取得してから本番環境で実行

**マイグレーションスクリプトの実行方法:**
```bash
# 必要なパッケージのインストール（まだの場合）
npm install --save-dev ts-node dotenv

# マイグレーションスクリプトの実行
npx ts-node scripts/migrate-user-schema.ts
```

**注意事項:**
- 実行前に必ずFirestoreのバックアップを取得してください
- ステージング環境でテストしてから本番環境で実行してください
- マイグレーションは冪等性があるため、複数回実行しても問題ありません

### ステップ4: 動作確認
1. ⏳ 新規ユーザー作成（admin側・利用者招待側）で統一スキーマが使用されることを確認
2. ⏳ 既存ユーザーのデータが正しくマイグレーションされたことを確認
3. ⏳ ユーザー一覧取得、更新、削除が正常に動作することを確認

**確認項目:**
- [ ] 利用者招待から新規ユーザーを作成し、すべてのフィールドが正しく設定されているか
- [ ] admin側から新規ユーザーを作成し、統一スキーマに準拠しているか
- [ ] 既存ユーザーのデータがマイグレーション後、すべてのフィールドが存在するか
- [ ] ユーザー一覧取得APIが正常に動作するか
- [ ] ユーザー更新APIが正常に動作するか

## 注意事項

1. **後方互換性**: 既存のコードが`status`や`updatedAt`フィールドを前提としていないか確認
2. **マイグレーションの安全性**: 本番環境で実行する前に、必ずバックアップを取得
3. **段階的な移行**: 一度にすべてを変更せず、段階的に移行することを推奨
4. **admin側との連携**: upmo-admin側のコードも同時に修正する必要がある

## 期待される効果

1. **データ構造の統一**: すべてのユーザーが同じスキーマを持つ
2. **クエリの簡素化**: フィールドの有無をチェックする必要がなくなる
3. **保守性の向上**: 1つのスキーマを管理するだけで良い
4. **機能の拡張性**: 新しいフィールドを追加しやすくなる
5. **ツール内共有の改善**: データ構造が統一されることで、共有機能が正常に動作する

