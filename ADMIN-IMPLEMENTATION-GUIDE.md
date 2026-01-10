# Admin側（upmo-admin）実装ガイド

## 概要

このドキュメントは、`upmo-admin`プロジェクトでユーザーデータ構造の統一スキーマを実装するためのガイドです。

## 実装が必要な箇所

### 1. ユーザー作成APIの修正

**対象ファイル:** `upmo-admin`側のユーザー作成API（例: `/api/users/create` など）

**現在の実装（想定）:**
```typescript
await db.collection('users').doc(userRecord.uid).set({
  email,
  displayName: displayName || email.split('@')[0],
  companyName: companyName,
  role: role || 'user',
  subscriptionType: subscriptionType || null,
  createdAt: Timestamp.now(),
});
```

**修正後の実装:**
```typescript
await db.collection('users').doc(userRecord.uid).set({
  email,
  displayName: displayName || email.split('@')[0],
  companyName: companyName,
  role: role || 'user',
  status: 'active',                    // ✅ 追加（必須）
  department: department || '',         // ✅ 追加（オプション、デフォルト: ''）
  position: position || '',            // ✅ 追加（オプション、デフォルト: ''）
  createdAt: Timestamp.now(),
  createdBy: null,                     // ✅ 追加（admin側から作成した場合はnull）
  updatedAt: Timestamp.now(),          // ✅ 追加（必須）
  subscriptionType: subscriptionType || null,  // 既存（admin側で設定）
});
```

### 2. ユーザー更新APIの修正

**対象ファイル:** `upmo-admin`側のユーザー更新API（例: `/api/users/update` など）

**修正内容:**
- `lastUpdated`フィールドを`updatedAt`に変更
- `Timestamp.now()`を使用（`new Date()`ではなく）

**修正前（想定）:**
```typescript
updateData.lastUpdated = new Date();
```

**修正後:**
```typescript
updateData.updatedAt = Timestamp.now(); // 統一スキーマに準拠
```

### 3. 型定義の追加（推奨）

**対象ファイル:** `upmo-admin/src/types/user.ts`（新規作成または既存を更新）

**実装内容:**
`upmo-demo/src/types/user.ts`と同じ型定義を使用することを推奨します。

**方法1: 型定義をコピー**
- `upmo-demo/src/types/user.ts`の内容を`upmo-admin/src/types/user.ts`にコピー

**方法2: 共有パッケージを使用（モノレポ構成の場合）**
- モノレポ構成に移行している場合は、`@upmo/shared`パッケージからインポート

```typescript
import { User, UserRole, UserStatus, DEFAULT_USER_VALUES } from '@upmo/shared/types';
```

### 4. バリデーション関数の使用（推奨）

**実装例:**
```typescript
import { validateUserData, normalizeUserData } from '@/types/user';

// ユーザー作成時
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
  subscriptionType: subscriptionType || null,
};

// バリデーション
const validation = validateUserData(userData);
if (!validation.valid) {
  return NextResponse.json(
    { error: `バリデーションエラー: ${validation.errors.join(', ')}` },
    { status: 400 }
  );
}
```

## 統一スキーマの必須フィールド

すべてのユーザー（admin側から作成、利用者招待から作成）に以下のフィールドが存在する必要があります：

### 必須フィールド
- `email`: string（必須）
- `displayName`: string（必須）
- `companyName`: string（必須）
- `role`: 'admin' | 'manager' | 'user'（必須、デフォルト: 'user'）
- `status`: 'active' | 'inactive' | 'suspended'（必須、デフォルト: 'active'）
- `createdAt`: Timestamp（必須）

### 推奨フィールド（統一のため）
- `createdBy`: string | null（オプション、admin側から作成した場合はnull）
- `updatedAt`: Timestamp（推奨、更新時に設定）
- `department`: string（オプション、デフォルト: ''）
- `position`: string（オプション、デフォルト: ''）

### オプションフィールド
- `photoURL`: string（オプション）
- `subscriptionType`: string（オプション、admin側で設定）
- `lastLoginAt`: Timestamp（オプション）

## 実装チェックリスト

### ユーザー作成API
- [ ] `status: 'active'`を追加
- [ ] `department: department || ''`を追加
- [ ] `position: position || ''`を追加
- [ ] `createdBy: null`を追加（admin側から作成した場合）
- [ ] `updatedAt: Timestamp.now()`を追加

### ユーザー更新API
- [ ] `lastUpdated`を`updatedAt`に変更
- [ ] `new Date()`を`Timestamp.now()`に変更

### 型定義
- [ ] `User`インターフェースを追加または更新
- [ ] `UserRole`型を追加（'admin' | 'manager' | 'user'）
- [ ] `UserStatus`型を追加（'active' | 'inactive' | 'suspended'）

### バリデーション（推奨）
- [ ] `validateUserData()`関数を使用
- [ ] `normalizeUserData()`関数を使用（既存データのマイグレーション時）

## 注意事項

### 1. 後方互換性
- 既存のコードが`lastUpdated`フィールドを参照している場合は、`updatedAt`に変更する必要があります
- 既存のユーザーデータは、マイグレーションスクリプトで統一スキーマに移行されます

### 2. Timestampの使用
- Firestoreでは`Timestamp`オブジェクトを使用します
- `new Date()`ではなく`Timestamp.now()`を使用してください

```typescript
import { Timestamp } from 'firebase-admin/firestore';

// ✅ 正しい
updateData.updatedAt = Timestamp.now();

// ❌ 間違い
updateData.updatedAt = new Date();
```

### 3. デフォルト値の設定
- `status`のデフォルト値は`'active'`
- `department`と`position`のデフォルト値は空文字列`''`
- `createdBy`はadmin側から作成した場合は`null`

### 4. マイグレーション
- 既存のユーザーデータは、`upmo-demo`側のマイグレーションスクリプトで統一されます
- admin側で新規ユーザーを作成する際は、統一スキーマに準拠したデータを保存してください

## 実装例（完全版）

### ユーザー作成APIの完全な実装例

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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
      status: 'active',                    // ✅ 追加
      department: department || '',         // ✅ 追加
      position: position || '',            // ✅ 追加
      createdAt: Timestamp.now(),
      createdBy: null,                     // ✅ 追加（admin側から作成）
      updatedAt: Timestamp.now(),          // ✅ 追加
      subscriptionType: subscriptionType || null,
    };

    // バリデーション（オプション）
    const validation = validateUserData(userData);
    if (!validation.valid) {
      // バリデーションエラーの場合、Firebase Authのユーザーを削除
      await auth.deleteUser(userRecord.uid);
      return NextResponse.json(
        { error: `バリデーションエラー: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
    }

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

### ユーザー更新APIの完全な実装例

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export async function PUT(request: NextRequest) {
  try {
    const { uid, role, status, department, position, subscriptionType } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { error: 'ユーザーIDは必須です' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const updateData: any = {};

    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (department !== undefined) updateData.department = department;
    if (position !== undefined) updateData.position = position;
    if (subscriptionType !== undefined) updateData.subscriptionType = subscriptionType;
    
    updateData.updatedAt = Timestamp.now(); // ✅ 統一スキーマに準拠

    await db.collection('users').doc(uid).update(updateData);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('ユーザー更新エラー:', error);
    return NextResponse.json(
      { error: `ユーザー情報の更新に失敗しました: ${error.message || '不明なエラー'}` },
      { status: 500 }
    );
  }
}
```

## 参考資料

- `upmo-demo/src/types/user.ts`: 統一スキーマの型定義
- `upmo-demo/src/app/api/admin/users/route.ts`: 実装例（利用者招待API）
- `upmo-demo/USER-SCHEMA-PROPOSAL.md`: 詳細な提案ドキュメント

## 質問・サポート

実装中に問題が発生した場合は、`upmo-demo`側の実装を参考にしてください。

