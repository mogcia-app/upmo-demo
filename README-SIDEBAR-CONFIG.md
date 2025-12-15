# サイドバー設定機能

## 概要

upmo-adminプロジェクトからサイドバーの表示項目を動的に制御できる機能です。Firestoreを共有データベースとして使用し、upmo-admin側でチェックマークを付けたメニューアイテムのみがupmo-demo側のサイドバーに表示されます。

## アーキテクチャ

```
upmo-admin (管理画面)
    ↓ (API経由で設定を更新)
Firestore (sidebarConfig/default)
    ↓ (リアルタイム同期)
upmo-demo (メインアプリ)
    ↓ (設定を読み込んで表示)
サイドバー (動的にメニューを表示)
```

## データ構造

### Firestore: `sidebarConfig/default`

```typescript
{
  commonMenuItems: [
    {
      id: "dashboard",
      name: "ダッシュボード",
      icon: "•",
      href: "/",
      enabled: true,  // チェックマークが付いているかどうか
      order: 1        // 表示順序
    },
    // ... 他のメニューアイテム
  ],
  adminMenuItems: [
    {
      id: "contracts",
      name: "契約書",
      icon: "•",
      href: "/admin/contracts",
      enabled: true,
      order: 1
    },
    // ... 他のメニューアイテム
  ],
  updatedAt: Timestamp,
  updatedBy: string  // 更新者のユーザーID
}
```

## upmo-admin側での実装方法

### 1. サイドバー設定を取得

```typescript
// GET /api/admin/sidebar-config
const response = await fetch('https://upmo-demo.vercel.app/api/admin/sidebar-config', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
});

const config = await response.json();
console.log(config.commonMenuItems);
console.log(config.adminMenuItems);
```

### 2. 利用可能なメニュー項目の候補を取得

```typescript
// GET /api/admin/sidebar-config
const response = await fetch('https://upmo-demo.vercel.app/api/admin/sidebar-config');
const config = await response.json();

// 利用可能なメニュー項目の候補プール
console.log(config.availableMenuItems);
// [
//   { id: 'sales-quotes', name: '見積管理', icon: '💰', href: '/sales/quotes', category: 'sales', ... },
//   { id: 'inventory-management', name: '在庫管理', icon: '📦', href: '/inventory', category: 'inventory', ... },
//   // ... 他の候補項目
// ]

// 現在有効化されているメニュー項目のIDリスト
console.log(config.enabledMenuItems);
// ['sales-quotes', 'inventory-management', ...]
```

### 3. サイドバー設定を更新（追加メニュー項目の有効化）

```typescript
// POST /api/admin/sidebar-config
const response = await fetch('https://upmo-demo.vercel.app/api/admin/sidebar-config', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`, // Firebase認証トークン
  },
  body: JSON.stringify({
    // 有効化したいメニュー項目のIDリストを指定
    enabledMenuItems: [
      'sales-quotes',        // 見積管理
      'sales-orders',        // 受注管理
      'inventory-management', // 在庫管理
      'billing-management',  // 請求管理
      'pdca-plan',          // 計画管理
      'pdca-do',            // 実行管理
      'template-management', // テンプレート管理
      'calendar',           // カレンダー
      // ... 他の有効化したい項目のID
    ],
  }),
});

const result = await response.json();
console.log(result.message); // "Sidebar config updated successfully"
```

### 4. upmo-admin側のUI実装例

```tsx
// upmo-admin側のコンポーネント例
import { useState, useEffect } from 'react';
import { getMenuItemsByCategory, CATEGORY_NAMES } from '@/types/sidebar';

const SidebarConfigPage = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // 設定を取得
  useEffect(() => {
    const fetchConfig = async () => {
      const response = await fetch('https://upmo-demo.vercel.app/api/admin/sidebar-config');
      const data = await response.json();
      setConfig(data);
      setLoading(false);
    };
    fetchConfig();
  }, []);

  // チェックボックスの変更を処理
  const handleToggle = async (itemId: string) => {
    const enabledMenuItems = config.enabledMenuItems || [];
    const isEnabled = enabledMenuItems.includes(itemId);
    
    const updatedEnabledMenuItems = isEnabled
      ? enabledMenuItems.filter((id: string) => id !== itemId) // チェックを外す
      : [...enabledMenuItems, itemId]; // チェックを付ける

    // 更新を送信
    const userToken = await getAuthToken(); // Firebase認証トークンを取得
    const response = await fetch('https://upmo-demo.vercel.app/api/admin/sidebar-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        enabledMenuItems: updatedEnabledMenuItems,
      }),
    });

    const result = await response.json();
    if (result.success) {
      setConfig({
        ...config,
        enabledMenuItems: updatedEnabledMenuItems,
      });
    }
  };

  if (loading) return <div>読み込み中...</div>;

  // カテゴリごとにグループ化
  const groupedItems = getMenuItemsByCategory(config.availableMenuItems);

  return (
    <div>
      <h2>サイドバー設定</h2>
      <p>表示したい機能にチェックマークを付けてください</p>
      
      {/* カテゴリごとに表示 */}
      {Object.entries(groupedItems).map(([category, items]) => (
        <div key={category} className="mb-6">
          <h3>{CATEGORY_NAMES[category]}</h3>
          {items.map((item) => {
            const isEnabled = config.enabledMenuItems?.includes(item.id) || false;
            return (
              <label key={item.id} className="flex items-center p-2 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => handleToggle(item.id)}
                  className="mr-2"
                />
                <span className="mr-2">{item.icon}</span>
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
};
```

## upmo-demo側の実装

### 自動的な動作

1. **useSidebarConfigフック**: Firestoreから設定を読み込み、リアルタイムで監視
2. **Sidebarコンポーネント**: `enabled: true`のメニューアイテムのみを表示
3. **自動更新**: Firestoreの変更がリアルタイムで反映される

### メニュー構造

サイドバーは以下の3つのセクションで構成されます：

1. **共通メニュー（固定）**: デフォルトで表示される基本機能
   - ダッシュボード (`/`)
   - 個人チャット (`/personal-chat`)
   - TODOリスト (`/todo`)
   - 営業案件 (`/sales/cases`)
   - 進捗メモ (`/sales/progress-notes`)

2. **追加メニュー（admin側で選択可能）**: 利用可能な候補項目から必要なものだけを選択
   - 営業管理: 見積管理、受注管理など
   - 顧客管理: 顧客管理
   - 在庫・発注管理: 在庫管理、発注管理
   - 財務管理: 請求管理、経費管理
   - PDCA管理: 計画管理、実行管理、評価管理、改善管理
   - ドキュメント管理: テンプレート管理、議事録管理、ドキュメント管理
   - その他: カレンダー、レポート、分析ダッシュボード

3. **管理者メニュー（固定）**: 管理者のみに表示される機能
   - 契約書 (`/admin/contracts`)
   - ユーザー管理 (`/admin/users`)

## セキュリティ

- **読み取り**: 認証済みユーザー全員が読み取り可能
- **書き込み**: 管理者のみが書き込み可能（Firestoreルールで制御）
- **API認証**: Bearerトークンによる認証が必要

## 注意事項

1. **Firebase認証トークン**: upmo-admin側でFirebase認証トークンを取得し、APIリクエストの`Authorization`ヘッダーに含める必要があります
2. **リアルタイム更新**: upmo-demo側はFirestoreの変更をリアルタイムで監視しているため、upmo-admin側で設定を更新すると、数秒以内にupmo-demo側のサイドバーに反映されます
3. **デフォルト設定**: 共通メニューと管理者メニューは固定で変更できません。追加メニュー項目のみadmin側で選択可能です
4. **カスタムタブ機能の廃止**: 従来のカスタムタブ機能は廃止され、代わりにadmin側で選択可能な追加メニュー項目システムに移行しました

## トラブルシューティング

### 設定が反映されない場合

1. Firestoreルールが正しく設定されているか確認
2. Firebase認証トークンが正しく送信されているか確認
3. ブラウザのコンソールでエラーを確認
4. Firestoreの`sidebarConfig/default`ドキュメントが正しく作成されているか確認

### APIエラーが発生する場合

- `401 Unauthorized`: 認証トークンが無効または欠落
- `500 Internal Server Error`: Firebase Admin SDKの初期化エラーまたはFirestore接続エラー

