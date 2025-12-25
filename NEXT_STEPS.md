# 次のステップ

## ✅ 完了したこと

1. **BFFアーキテクチャの実装**
   - 各ページのBFF関数を作成
   - チャットAPIをBFF参照に変更
   - 認証トークンの送信を修正

## 🎯 推奨される次のステップ（優先度順）

### 1. **動作確認とテスト** ⭐ 最優先

```bash
# 開発サーバーを起動
npm run dev

# 以下をテスト：
# - 「顧客一覧を見たい」→ 顧客管理ページの情報が返るか
# - 「営業案件を教えて」→ 営業案件の情報が返るか
# - 「今日のタスクは？」→ タスク情報が返るか
# - 「議事録を見たい」→ 議事録情報が返るか
```

**確認ポイント：**
- 認証が正しく動作しているか
- BFFのキーワードマッチングが機能しているか
- 検索結果が正しく返ってくるか
- エラーハンドリングが適切か

---

### 2. **他のページのBFF追加** ⭐⭐

現在サポートしていないページを追加：

```typescript
// src/bff/pages/quote.ts
export function getQuotePageContext(): PageContext {
  return {
    page: 'quote',
    description: '見積管理ページ...',
    // ...
  };
}

// src/bff/pages/invoice.ts
// src/bff/pages/expense.ts
// src/bff/pages/inventory.ts
// src/bff/pages/purchase.ts
```

**メリット：**
- より多くのページで質問可能に
- 一貫したアーキテクチャ

---

### 3. **操作の実行機能** ⭐⭐⭐

BFFで定義した操作を実際に実行できるように：

```typescript
// src/bff/operations.ts
export async function executeOperation(
  pageId: string,
  operationId: string,
  params: Record<string, any>
): Promise<any> {
  // 例：「顧客のステータスを変更する」
  if (pageId === 'customer' && operationId === 'update-status') {
    // 実際のAPI呼び出し
    return await updateCustomerStatus(params.name, params.status);
  }
  // ...
}
```

**メリット：**
- 質問だけでなく、操作も実行可能に
- より実用的なアシスタントに

---

### 4. **ページ間の関係性定義** ⭐⭐

```typescript
// src/bff/types.ts
export type PageRelation = {
  from: string;
  to: string;
  relation: 'belongs_to' | 'has_many' | 'related_to';
  description: string;
};

// 例：営業案件 → 顧客（belongs_to）
// 例：進捗メモ → 営業案件（belongs_to）
```

**メリット：**
- 「この案件の顧客は？」のような関連質問に対応
- より自然な会話が可能に

---

### 5. **エラーハンドリングの改善** ⭐

```typescript
// より詳細なエラーメッセージ
// リトライロジック
// フォールバック機能
```

---

### 6. **ログとモニタリング** ⭐

```typescript
// どのページがよく質問されているか
// どの操作がよく使われているか
// エラー率の追跡
```

---

### 7. **AI統合の準備** ⭐⭐⭐

将来的にAIを統合する場合：

```typescript
// BFFの知識をRAGの知識ソースとして使用
// 構造化された知識で精度向上
// ページの説明・操作をプロンプトに含める
```

---

## 🚀 すぐに始められること

### 最小限の動作確認

1. 開発サーバーを起動
2. ブラウザで `/personal-chat` にアクセス
3. 「顧客一覧を見たい」と入力
4. 正しく応答が返るか確認

### 次のページ追加（15分）

1. `src/bff/pages/quote.ts` を作成
2. `src/bff/index.ts` に追加
3. `src/app/api/ai-chat/route.ts` の `searchByIntent` に `quote` ケースを追加

---

## 💡 設計の考え方

### BFFの責務
- ✅ ページの「意味」を定義
- ✅ 利用可能な操作を定義
- ✅ キーワードマッチング
- ❌ データベースアクセス（これはAPIの責務）
- ❌ ビジネスロジック（これもAPIの責務）

### チャットAPIの責務
- ✅ Intent判定（BFFを使用）
- ✅ データ検索（DBアクセス）
- ✅ 応答生成（BFFの情報を使用）
- ❌ ページの意味定義（これはBFFの責務）

---

## 📝 メモ

- BFFは「翻訳者」として機能
- ページが増えても、BFFに1ファイル追加するだけ
- DBスキーマ変更不要
- 将来AIを統合する際も、BFFがそのまま使える

