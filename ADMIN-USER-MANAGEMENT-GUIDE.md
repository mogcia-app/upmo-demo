# upmo-admin側 利用者管理ガイド

## 概要

upmo-demo側での利用者招待機能を削除し、**すべての利用者管理はupmo-admin側で一元管理**する方針に変更します。

### 旧構造（問題が起きる構造）

```
admin（親）
 └ demo-admin（子）
     └ demo-user（孫）
```

**問題点**:
- 誰が誰を作ったか分からなくなる
- 「あの人は招待できる」「この人はできない」
- 無意識に"上下関係"が生まれる

### 新構造（今回の設計）

```
upmo-admin（唯一の生成源）
 ├ user A
 ├ user B
 └ user C
```

**メリット**:
- 全員、同じ場所から生まれる
- demo側には「生成」の概念が存在しない
- ロールは「上下」ではなく「役割」
- **ロールを"権力"から"属性"に落とす設計**

### 設計の3つの柱

1. **validateUserDataに寄せ切る**
   - 唯一の「憲法」として、正しさの定義を1つに統一
   - API側で事前ifを増やすと、正しさがズレていく（ロール分岐の再発）

2. **adminに一元化**
   - 人の生成源を1つにする設計
   - 親・子構造が発生しようがない

3. **demo側から「招待」という権限を奪う**
   - demoは"見る・使う"だけの世界
   - 人は必ずupmo-adminという「唯一の入口」から生まれる

---

## 背景

### 現状の問題点
- upmo-demo側で`admin`が利用者を招待できる
- 親→子→子という階層構造が生まれる
- 情報格差が生まれる可能性がある

### 新しい方針
- **すべての利用者管理はupmo-admin側で一元管理**
- upmo-demo側では利用者一覧の表示のみ（招待機能は非表示）
- 全員が同じ視界を見られるようにする

---

## 新しいフロー

### フロー1: 初期登録（契約時）

1. **upmo-admin側で必要な人数分を最初に登録**
   - 会社名、名前、メールアドレス、仮パスワードを入力
   - すべてのユーザーを一度に登録可能
   - 各ユーザーに`companyName`を設定

2. **登録されたユーザーがupmo-demoにログイン**
   - メールアドレスと仮パスワードでログイン
   - 初回ログイン時にパスワード変更を促す（オプション）

### フロー2: 追加登録（後日）

1. **upmo-admin側で追加のユーザーを登録**
   - 会社名、名前、メールアドレス、仮パスワードを入力
   - 既存のユーザーと同じ`companyName`を設定
   - 登録されたユーザーがupmo-demoにログイン可能

---

## upmo-admin側で実装すべき機能

### 1. 一括登録機能（フェーズ2で実装）

**目的**: 契約時に必要な人数分を一度に登録

**評価**: やったほうがいい（でも今じゃなくていい）

**理由**:
- 契約時に「人数決まってる」世界観
- 人を"増やす"のが日常業務じゃない
- むしろ初期セットアップのための機能

**実装優先順位**:
- **MVP**: 個別登録でOK
- **フェーズ2**: 一括登録（CSV含む）

**機能**:
- 複数ユーザーの一括登録フォーム
- CSVインポート機能（フェーズ2、今はいらない）
- 登録前のプレビュー機能

**実装例**:
```typescript
// 一括登録フォーム
interface BulkUserRegistration {
  companyName: string;
  users: Array<{
    email: string;
    password: string;
    displayName: string;
    role?: 'admin' | 'user';
    department?: string;
    position?: string;
  }>;
}

// 一括登録API
POST /api/admin/bulk-users
{
  companyName: "株式会社テスト",
  users: [
    {
      email: "user1@example.com",
      password: "temp123456",
      displayName: "ユーザー1",
      role: "user",
      department: "営業部",
      position: "営業"
    },
    {
      email: "user2@example.com",
      password: "temp123456",
      displayName: "ユーザー2",
      role: "user",
      department: "営業部",
      position: "営業"
    }
  ]
}
```

### 2. 個別登録機能（MVP・最優先）

**目的**: 後日、追加のユーザーを登録

**機能**:
- 1人ずつユーザーを登録
- 既存のユーザーと同じ`companyName`を設定
- 統一スキーマに準拠したデータを保存
- **validateUserDataに寄せ切る**（必須）

**実装内容**:
- 既存のユーザー作成APIを統一スキーマに準拠させる
- `ADMIN-IMPLEMENTATION-GUIDE.md`を参照
- **validateUserDataを唯一の正しさとして使用**

### 3. ユーザー一覧・管理機能

**目的**: 登録されたユーザーを管理

**機能**:
- 会社単位でユーザー一覧を表示
- ユーザーの編集（ロール、部署、役職など）
- ユーザーの削除
- パスワードリセット

---

## データ構造の統一

### 統一スキーマに準拠

すべてのユーザー（upmo-admin側から作成）は、以下のスキーマに準拠する必要があります：

```typescript
{
  email: string,
  displayName: string,
  companyName: string,
  role: 'admin' | 'manager' | 'user',
  status: 'active',                    // ✅ 必須
  department: department || '',         // ✅ 必須（空文字列でも可）
  position: position || '',            // ✅ 必須（空文字列でも可）
  createdAt: Timestamp.now(),
  createdBy: null,                     // ✅ admin側から作成した場合はnull
  updatedAt: Timestamp.now(),          // ✅ 必須
  subscriptionType: subscriptionType || null,
}
```

**詳細**: `ADMIN-IMPLEMENTATION-GUIDE.md`を参照

---

## 実装チェックリスト

### ✅ 必須実装項目（MVP）

- [ ] **validateUserDataに寄せ切る**（最優先・必須）
  - [ ] `validateUserData`を唯一の「憲法」として使用
  - [ ] API側で事前ifを増やさない（正しさの定義がズレる）
  - [ ] すべてのユーザー作成APIで`validateUserData`を使用

- [ ] **統一スキーマに準拠したユーザー作成**
  - [ ] `status: 'active'`を追加
  - [ ] `department: ''`を追加
  - [ ] `position: ''`を追加
  - [ ] `createdBy: null`を追加
  - [ ] `updatedAt: Timestamp.now()`を追加

- [ ] **会社単位でのユーザー管理**
  - [ ] 会社名でユーザーをフィルタリング
  - [ ] 同じ会社のユーザーのみ表示・編集可能

- [ ] **パスワード管理**
  - [ ] admin側: ランダム仮パスワード生成
  - [ ] demo側: 初回ログイン時にパスワード変更必須
  - [ ] demo側: パスワード変更・リセット機能

### 📋 推奨実装項目（フェーズ2）

- [ ] **一括登録機能**
  - [ ] 複数ユーザーを一度に登録できるフォーム
  - [ ] CSVインポート機能（後回し、今はいらない）

- [ ] **ユーザー一覧の改善**
  - [ ] 会社単位でユーザーを表示
  - [ ] 検索・フィルタリング機能
  - [ ] ユーザーの編集・削除機能

---

## 実装例

### ユーザー作成API（統一スキーマに準拠）

```typescript
// upmo-admin側のユーザー作成API
import { validateUserData } from '@/types/user';

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName, role, department, position, companyName, subscriptionType } = await request.json();

    // バリデーション
    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードは必須です' },
        { status: 400 }
      );
    }

    // Firebase Auth でユーザーを作成
    const auth = getAuth();
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0],
      emailVerified: false,
    });

    // Firestore にユーザー情報を保存（統一スキーマに準拠）
    const db = getFirestore();
    const userData = {
      email,
      displayName: displayName || email.split('@')[0],
      companyName: companyName,
      role: role || 'user',
      status: 'active',                    // ✅ 必須
      department: department || '',         // ✅ 必須
      position: position || '',            // ✅ 必須
      createdAt: Timestamp.now(),
      createdBy: null,                     // ✅ admin側から作成
      updatedAt: Timestamp.now(),          // ✅ 必須
      subscriptionType: subscriptionType || null,
    };

    // バリデーション（必須）: validateUserDataに寄せ切る
    const validation = validateUserData(userData);
    if (!validation.valid) {
      // バリデーションエラーの場合、Firebase Authのユーザーを削除
      await auth.deleteUser(userRecord.uid);
      return NextResponse.json(
        { error: `バリデーションエラー: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
    }
    
    // 注意: API側で事前ifを増やさない
    // 例: if (!companyName) return 400 ← これはやらない
    // 理由: 正しさの定義がズレていく（ロール分岐の再発）
    // validateUserDataが唯一の「憲法」

    await db.collection('users').doc(userRecord.uid).set(userData);

    return NextResponse.json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: userData.role,
        status: userData.status,
      },
    });

  } catch (error: any) {
    console.error('ユーザー作成エラー:', error);
    return NextResponse.json(
      { error: `ユーザー作成に失敗しました: ${error.message || '不明なエラー'}` },
      { status: 500 }
    );
  }
}
```

### 一括登録API（フェーズ2）

**注意**: この機能はフェーズ2で実装。MVPでは個別登録のみ。

```typescript
// upmo-admin側の一括ユーザー登録API
import { validateUserData } from '@/types/user';

export async function POST(request: NextRequest) {
  try {
    const { companyName, users } = await request.json();

    // 注意: 基本的なチェックは必要だが、詳細なバリデーションはvalidateUserDataに寄せ切る
    if (!companyName || !users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: '会社名とユーザーリストは必須です' },
        { status: 400 }
      );
    }

    const auth = getAuth();
    const db = getFirestore();
    const results = [];
    const errors = [];

    for (const userData of users) {
      try {
        const { email, password, displayName, role, department, position } = userData;

        // Firebase Auth でユーザーを作成
        const userRecord = await auth.createUser({
          email,
          password,
          displayName: displayName || email.split('@')[0],
          emailVerified: false,
        });

        // Firestore にユーザー情報を保存（統一スキーマに準拠）
        const userData = {
          email,
          displayName: displayName || email.split('@')[0],
          companyName: companyName,
          role: role || 'user',
          status: 'active',
          department: department || '',
          position: position || '',
          createdAt: Timestamp.now(),
          createdBy: null,
          updatedAt: Timestamp.now(),
        };

        // バリデーション（必須）: validateUserDataに寄せ切る
        const validation = validateUserData(userData);
        if (!validation.valid) {
          // バリデーションエラーの場合、Firebase Authのユーザーを削除
          await auth.deleteUser(userRecord.uid);
          errors.push({
            email: userData.email,
            error: `バリデーションエラー: ${validation.errors.join(', ')}`
          });
          continue;
        }

        await db.collection('users').doc(userRecord.uid).set(userData);

        results.push({
          email,
          uid: userRecord.uid,
          success: true
        });
      } catch (error: any) {
        errors.push({
          email: userData.email,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      errors,
      summary: {
        total: users.length,
        success: results.length,
        failed: errors.length
      }
    });

  } catch (error: any) {
    console.error('一括ユーザー登録エラー:', error);
    return NextResponse.json(
      { error: `一括ユーザー登録に失敗しました: ${error.message || '不明なエラー'}` },
      { status: 500 }
    );
  }
}
```

---

## upmo-demo側の変更

### 利用者招待機能の削除・非表示

**変更ファイル**: `src/app/admin/users/page.tsx`

**変更内容**:
- 「利用者を追加」ボタンを非表示または削除
- 利用者一覧の表示のみ（読み取り専用）
- ユーザー詳細の表示は維持（編集・削除機能は非表示）

**実装例**:
```typescript
// 変更前
<button onClick={() => setShowCreateModal(true)}>
  利用者を追加
</button>

// 変更後
// ボタンを削除または非表示
// または、以下のようなメッセージを表示
<div className="text-sm text-gray-500">
  利用者の追加はupmo-admin側で行ってください
</div>
```

---

## セキュリティの考慮

### 1. 会社単位の管理

**原則**: 同じ`companyName`のユーザーのみ管理可能
- upmo-admin側でも、会社単位でユーザーを管理
- 異なる会社のユーザーを誤って登録しないように注意

### 2. パスワード管理

**推奨実装**:
- **admin側**: ランダム仮パスワード生成
- **demo側**: 初回ログイン時にパスワード変更必須
- **demo側**: パスワード変更・リセット機能を提供

**理由**:
- adminは「管理」、demoは「利用」という役割分離が綺麗
- セキュリティが向上
- ユーザーが自分でパスワードを管理できる

### 3. ロール管理

**推奨**:
- 最初のユーザーは自動的に`admin`ロールを付与
- その他のユーザーは`user`ロールを付与
- 必要に応じて`admin`ロールを付与可能

---

## 移行手順

### ステップ1: 統一スキーマへの移行

1. **既存のユーザー作成APIを統一スキーマに準拠させる**
   - `ADMIN-IMPLEMENTATION-GUIDE.md`を参照
   - `status`, `department`, `position`, `createdBy`, `updatedAt`を追加

2. **既存ユーザーデータのマイグレーション**
   - `upmo-demo/scripts/migrate-user-schema.ts`を実行
   - または、upmo-admin側でも同様のマイグレーションスクリプトを作成

### ステップ2: 一括登録機能の実装（フェーズ2）

**実装タイミング**: MVP完了後、運用が落ち着いてから

1. **一括登録フォームの作成**
   - 複数ユーザーを一度に登録できるフォーム
   - CSVインポート機能は後回し（今はいらない）

2. **一括登録APIの実装**
   - 上記の実装例を参考
   - **validateUserDataに寄せ切る**（必須）

### ステップ3: upmo-demo側の変更

1. **利用者招待機能の削除・非表示**
   - `src/app/admin/users/page.tsx`を修正
   - 「利用者を追加」ボタンを非表示または削除

2. **利用者一覧の表示のみ維持**
   - 読み取り専用で利用者一覧を表示
   - ユーザー詳細の表示は維持

---

## 実装優先順位（確定版）

### フェーズ1: MVP（最優先）

1. **統一スキーマに準拠した個別登録機能**
   - `validateUserData`に寄せ切る（必須）
   - 統一スキーマに準拠したデータを保存
   - 実装時間: 2-3時間

2. **パスワード管理**
   - admin側: ランダム仮パスワード生成
   - demo側: 初回ログイン時にパスワード変更必須
   - 実装時間: 2-3時間

3. **upmo-demo側の利用者招待機能の削除・非表示**
   - 利用者一覧の表示のみ（読み取り専用）
   - 実装時間: 1-2時間

### フェーズ2: 改善（後で）

4. **一括登録機能**
   - 複数ユーザーを一度に登録できるフォーム
   - 実装時間: 4-6時間

5. **CSVインポート機能**
   - 今はいらない（運用が落ち着いてから）
   - 実装時間: 6-8時間

---

## 注意事項

### companyName = 管理キー問題

**現状**:
- 同じ`companyName`のユーザーのみ管理可能

**将来的な検討事項**:
- `companyId`（UUID）を管理キーにする
- `companyName`は表示用にする

**理由**:
- 会社名の変更に対応しやすくなる
- 会社名の重複を防げる
- より柔軟な管理が可能

**実装タイミング**:
- 今すぐじゃなくていい
- でも「概念としては」頭の片隅に置いておくと良い

---

## まとめ

### この設計の評価

**評価**: かなり良い。筋が通ってる

**特に良い点**:
- ❌ upmo-demo側で人を増やせない
- ⭕ 人は必ずupmo-adminという「唯一の入口」から生まれる
- ⭕ demoは"見る・使う"だけの世界

**これは完全に「人の発生源を1つにする設計」で、親・子構造が発生しようがない。**

### 設計の3つの柱

1. **validateUserDataに寄せ切る** → 唯一の「憲法」
2. **adminに一元化** → 人の生成源を1つにする
3. **demo側から「招待」という権限を奪う** → ロールを"権力"から"属性"に

### この設計は…

- 親・子ロールを構造的に消している
- 権限ではなく責務で役割を分けている
- validateUserDataを唯一の正しさにしている

👉 **思想にかなり忠実な設計**

