# AIアシスタント 要件定義書

## 1. 概要

### 1.1 目的
アプリケーション内の各ページ（顧客管理、営業案件、タスク管理など）の情報を、チャット形式で質問・検索できるAIアシスタント機能を提供する。

### 1.2 基本方針
- **AIを使わない設計**: 現時点ではLLMを使用せず、BFF（Backend for Frontend）パターンによる構造化された知識ベースと検索ロジックで実現
- **BFFアーキテクチャ**: 各ページの「意味」を抽象化し、DB直読みではなく「アプリ状態の問い合わせ」として実装
- **拡張性**: 将来的にAI（LLM/RAG）を統合する際も、BFFがそのまま知識ソースとして利用可能

### 1.3 設計思想
> 「社内ナレッジツール」ではなく「アプリに質問できるOS」を作る

- DBは「事実」を保持、BFFは「意味」を保持
- ページ構造が変わってもDBスキーマ変更不要
- UI文言変更に強い（意味レイヤーはそのまま）

---

## 2. アーキテクチャ

### 2.1 全体構成

```
[UIページ（20前後）]
    ↓
[BFF（意味・操作・状態の抽象化）]
    ↓
[チャットAPI（司令塔）]
    ↓
[Firestore（データ取得）]
```

### 2.2 BFF（Backend for Frontend）パターン

#### 責務
- ✅ ページの「意味」を定義
- ✅ 利用可能な操作を定義
- ✅ キーワードマッチング
- ❌ データベースアクセス（APIの責務）
- ❌ ビジネスロジック（APIの責務）

#### 構造
```
src/bff/
├── types.ts              # 型定義
├── index.ts              # 集約関数
└── pages/
    ├── customer.ts       # 顧客管理ページ
    ├── sales.ts          # 営業案件ページ
    ├── todo.ts           # タスク管理ページ
    ├── meeting.ts        # 議事録ページ
    ├── event.ts          # カレンダーページ
    ├── document.ts       # 社内ドキュメントページ
    └── progress.ts       # 進捗メモページ
```

### 2.3 データフロー

```
1. ユーザーが質問を入力
   ↓
2. parseIntent(message) → BFFのキーワードマッチングでintent決定
   ↓
3. searchByIntent(intent, ...) → intentに基づいて1系統だけ検索
   ↓
4. buildResponse(intent, result) → BFFの情報を使って応答生成
   ↓
5. ユーザーに応答を返す
```

---

## 3. 機能要件

### 3.1 コア機能

#### 3.1.1 Intent判定
- **入力**: ユーザーの質問メッセージ
- **処理**: BFFのキーワードマッチングでページを特定
- **出力**: Intent型（customer, sales, todo, meeting, event, document, unknown）

#### 3.1.2 検索機能
- **原則**: Intentに基づいて1系統だけ検索（全件検索しない）
- **対象ページ**:
  - 顧客管理（customer）
  - 営業案件（sales）
  - タスク管理（todo）
  - 議事録（meeting）
  - カレンダー（event）
  - 社内ドキュメント（document）
  - 進捗メモ（progress）

#### 3.1.3 応答生成
- **成功時**: 検索結果を構造化して返す
- **失敗時**: BFFからページ情報を取得し、利用可能な操作を案内

### 3.2 特殊機能

#### 3.2.1 日付フィルタリング（タスク管理）
- 「今日のタスクは？」→ 期限が今日のタスクを取得
- キーワード: 「今日」「きょう」「today」「本日」
- フォールバック: 見つからない場合は全タスクを返す

#### 3.2.2 ステータス・優先度の日本語化
- タスクステータス: pending→未着手, in_progress→進行中, completed→完了, cancelled→キャンセル
- 優先度: low→低, medium→中, high→高, urgent→緊急

---

## 4. 技術仕様

### 4.1 API仕様

#### エンドポイント
```
POST /api/ai-chat
```

#### リクエスト
```typescript
{
  message: string  // ユーザーの質問
}
```

#### リクエストヘッダー
```
Authorization: Bearer <Firebase ID Token>
Content-Type: application/json
```

#### レスポンス（成功時）
```typescript
{
  response: string,           // AIアシスタントの応答
  intent: string,             // 判定されたintent
  contextSources?: {         // 後方互換性のため
    [key: string]: boolean
  }
}
```

#### レスポンス（エラー時）
```typescript
{
  error: string,
  response: string,
  details?: string  // 開発環境のみ
}
```

### 4.2 型定義

#### Intent型
```typescript
type Intent = 
  | { type: 'customer' }
  | { type: 'sales' }
  | { type: 'progress' }
  | { type: 'meeting' }
  | { type: 'todo' }
  | { type: 'event' }
  | { type: 'document' }
  | { type: 'unknown' };
```

#### ContextResult型
```typescript
type ContextResult = {
  type: Intent['type'];
  items: any[];
  formatted: string;
};
```

#### PageContext型（BFF）
```typescript
type PageContext = {
  page: string;
  description: string;
  entities: PageEntity[];
  operations: PageOperation[];
  keywords: string[];
};
```

### 4.3 認証
- Firebase AuthenticationのID Tokenを使用
- トークンからuserIdを取得し、ユーザー固有のデータのみ検索

---

## 5. 実装済み機能

### 5.1 BFF実装
- ✅ 7つのページのBFF関数を実装
  - customer（顧客管理）
  - sales（営業案件）
  - todo（タスク管理）
  - meeting（議事録）
  - event（カレンダー）
  - document（社内ドキュメント）
  - progress（進捗メモ）
- ✅ 集約関数（getAppKnowledge, findPageByKeyword, getPageContext）

### 5.2 チャットAPI実装
- ✅ Intent判定（BFFベース）
- ✅ 検索機能（intent別）
- ✅ 応答生成（BFF情報を使用）
- ✅ 日付フィルタリング（タスク管理）
- ✅ ステータス・優先度の日本語化

### 5.3 フロントエンド統合
- ✅ ダッシュボード（`/`）のAIアシスタントに統合
- ✅ 認証トークンの送信
- ✅ エラーハンドリング

---

## 6. 今後の拡張予定

### 6.1 短期（優先度: 高）

#### 6.1.1 他のページのBFF追加
- quote（見積管理）
- order（受注管理）
- invoice（請求管理）
- expense（経費管理）
- inventory（在庫管理）
- purchase（発注管理）

#### 6.1.2 操作の実行機能
```typescript
// BFFで定義した操作を実際に実行
executeOperation(pageId, operationId, params)
```
- 例：「顧客のステータスを変更する」
- 例：「タスクのステータスを更新する」

### 6.2 中期（優先度: 中）

#### 6.2.1 ページ間の関係性定義
```typescript
type PageRelation = {
  from: string;
  to: string;
  relation: 'belongs_to' | 'has_many' | 'related_to';
  description: string;
};
```
- 例：「この案件の顧客は？」→ 営業案件 → 顧客（belongs_to）

#### 6.2.2 より高度な検索
- 複数条件の組み合わせ
- 日付範囲検索
- ステータスフィルタリング

### 6.3 長期（優先度: 低）

#### 6.3.1 AI統合（LLM/RAG）
- BFFの知識をRAGの知識ソースとして使用
- 構造化された知識で精度向上
- ページの説明・操作をプロンプトに含める

#### 6.3.2 ログとモニタリング
- どのページがよく質問されているか
- どの操作がよく使われているか
- エラー率の追跡

---

## 7. 制約事項

### 7.1 技術的制約
- Firestoreのインデックスが必要な場合がある（日付フィルタリングなど）
- 認証トークンが必須
- ユーザー固有のデータのみ検索可能

### 7.2 設計上の制約
- Intentに基づいて1系統だけ検索（パフォーマンス考慮）
- BFFは「意味」のみ定義、データアクセスはAPIの責務
- 現時点ではLLMを使用しない

---

## 8. エラーハンドリング

### 8.1 認証エラー
- トークンがない/無効 → 401 Unauthorized
- メッセージ: 「認証が必要です」

### 8.2 データベースエラー
- Firestore接続エラー → 500 Internal Server Error
- メッセージ: 「データベース接続エラー」

### 8.3 検索結果なし
- Intentは判定できたが結果なし → BFFからページ情報を取得し案内
- Intentがunknown → 利用可能な機能一覧を表示

---

## 9. パフォーマンス考慮

### 9.1 検索の最適化
- Intent判定を最初に実行（無駄な検索を避ける）
- 1系統だけ検索（14系統全部検索しない）
- 適切なlimit設定（デフォルト10件、特殊ケース20件）

### 9.2 キャッシュ（将来実装）
- BFFの知識は変更頻度が低いためキャッシュ可能
- 検索結果のキャッシュ（TTL設定）

---

## 10. セキュリティ

### 10.1 認証・認可
- Firebase AuthenticationのID Token必須
- ユーザー固有のデータのみアクセス可能（userIdでフィルタリング）
- 会社固有のデータはcompanyNameでフィルタリング

### 10.2 データ保護
- 個人情報を含むデータは適切にフィルタリング
- エラーメッセージに機密情報を含めない（開発環境のみ詳細表示）

---

## 11. テスト項目

### 11.1 機能テスト
- [ ] 「顧客一覧を見たい」→ 顧客管理の情報が返る
- [ ] 「営業案件を教えて」→ 営業案件の情報が返る
- [ ] 「今日のタスクは？」→ 今日のタスクが返る
- [ ] 「議事録を見たい」→ 議事録の情報が返る
- [ ] 不明な質問 → 利用可能な機能一覧が返る

### 11.2 エラーテスト
- [ ] 認証トークンなし → 401エラー
- [ ] 無効なトークン → 401エラー
- [ ] データベース接続エラー → 500エラー

### 11.3 パフォーマンステスト
- [ ] 検索レスポンス時間 < 2秒
- [ ] 同時リクエスト処理

---

## 12. 用語集

### BFF（Backend for Frontend）
フロントエンド専用のバックエンド。各ページの「意味」を抽象化し、チャットAPIが参照できる形式で提供。

### Intent
ユーザーの質問の意図。どのページに関する質問かを表す。

### ContextResult
検索結果を構造化した型。type（intent）、items（データ）、formatted（フォーマット済み文字列）を含む。

### PageContext
BFFで定義されるページの情報。説明、エンティティ、操作、キーワードを含む。

---

## 13. 参考資料

### 13.1 関連ファイル
- `src/bff/` - BFF実装
- `src/app/api/ai-chat/route.ts` - チャットAPI
- `src/app/page.tsx` - ダッシュボード（AIアシスタント統合）
- `NEXT_STEPS.md` - 次のステップ

### 13.2 設計ドキュメント
- BFFアーキテクチャの説明
- 制御フローの改善履歴

---

## 14. トラブルシューティング

### 14.1 出力がうまくいかない時の確認ポイント

#### 14.1.1 ContextResult.formatted が空 or 未生成問題

**症状**
- `response: undefined`
- 返答が空
- `result.formatted → undefined`

**原因**
- 検索結果が0件で`null`を返している
- `formatted`を生成する前に`return null`している
- fallback時に`formatted`を作成していない

**確認方法**
```typescript
// デバッグログで確認
console.log('[AI Chat] Search result:', { 
  intent: intent.type, 
  hasResult: !!result,
  hasFormatted: result?.formatted ? result.formatted.length > 0 : false,
  itemsCount: result?.items?.length || 0
});
```

**修正済み**
- ✅ `buildResponse`で`formatted`が空の場合のフォールバック処理を追加
- ✅ すべてのパスで必ず文字列を返すことを保証
- ✅ `aiResponse`が空の場合の最終チェックを追加

#### 14.1.2 Intent判定 → ページ検索 → 応答生成の責務分離が破綻

**症状**
- 意図しない空出力
- 意味不明な返答
- `unknown` intentでも検索が走る

**原因**
- `searchByIntent`で直接返答文を生成している
- `buildResponse`が実行されない
- `unknown` intentでも`searchByIntent`が呼ばれる

**確認方法**
```typescript
// デバッグログで確認
console.log('[AI Chat] Intent parsed:', { message, intent: intent.type });
console.log('[AI Chat] Search result:', { intent: intent.type, hasResult: !!result });
```

**修正済み**
- ✅ `unknown` intentの場合は`searchByIntent`を呼ばない（パフォーマンス向上）
- ✅ `buildResponse`が必ず実行されることを保証
- ✅ 各関数の責務を明確化

#### 14.1.3 BFF keywords と parseIntent が噛み合ってない

**症状**
- `intent = unknown` 連発
- 検索が走らない
- fallbackが走る

**原因**
- keywordsがミススペル
- keywordsに日本語/英語混在で`parseIntent`と一致しない
- `findPageByKeyword`のロジックが正しく動作していない

**確認方法**
```typescript
// BFFのkeywordsを確認
const pageId = findPageByKeyword(message);
console.log('[AI Chat] Page found by keyword:', { message, pageId });
```

**現在のkeywords一覧**
- customer: `['顧客', 'お客様', 'クライアント', 'customer', 'client']`
- sales: `['案件', '営業', 'セールス', 'sales', 'case', 'opportunity']`
- todo: `['タスク', 'todo', 'やること', 'やる事', 'task', 'todoリスト']`
- meeting: `['議事録', '会議', 'ミーティング', 'meeting', '議題', '会議録']`
- event: `['予定', 'イベント', 'カレンダー', 'スケジュール', 'event', 'calendar', 'schedule']`
- document: `['文書', 'ドキュメント', '資料', '契約書', 'document', 'manual', 'マニュアル']`
- progress: `['メモ', '進捗', 'プログレス', 'progress', '進捗メモ', 'note']`

### 14.2 デバッグ方法

#### 14.2.1 開発環境でのログ確認

開発環境（`NODE_ENV === 'development'`）では、以下のログが出力されます：

```typescript
// Intent判定時
[AI Chat] Intent parsed: { message: "...", intent: "todo" }

// 検索結果
[AI Chat] Search result: { 
  intent: "todo", 
  hasResult: true,
  hasFormatted: true,
  itemsCount: 5
}
```

#### 14.2.2 エラーログの確認

以下のエラーログが出た場合：

```typescript
// formattedが空の場合
[buildResponse] result.formatted is empty

// BFF取得エラー
[buildResponse] Error getting app knowledge

// ページコンテキスト取得エラー
[buildResponse] Error getting page context

// 最終的な応答生成失敗
[AI Chat] aiResponse is empty!
```

### 14.3 典型的なバグパターンと対策

#### パターン1: formattedがundefined

**原因**: `searchByIntent`で`formatted`を生成せずに`return`している

**対策**: すべての`return`文で`formatted`を含む`ContextResult`を返すことを確認

#### パターン2: unknown intent連発

**原因**: BFFのkeywordsと実際の質問が一致していない

**対策**: 
1. `findPageByKeyword`の動作を確認
2. keywordsに不足しているキーワードを追加
3. 大文字小文字の違いを確認

#### パターン3: 検索結果が0件で空返答

**原因**: `buildResponse`のfallback処理が正しく動作していない

**対策**: `buildResponse`が必ず文字列を返すことを確認（修正済み）

### 14.4 Runtime Safety（実行時安全性）の重要性

#### 14.4.1 問題の本質

論理的な修正だけでは不十分。**TypeScriptの型チェックはコンパイル時のみ**で、実行時には保証されない。

**典型的な問題**:
- `catch`ブロックで`return`がない → `undefined`返却
- `ContextResult`の構造が不完全 → `formatted`が欠落
- `null`チェックが不十分 → ランタイムエラー

#### 14.4.2 実装済みの対策

**✅ ContextResultのRuntime Validation**
```typescript
function validateContextResult(result: any): ContextResult | null {
  if (!result) return null;
  return {
    type: result.type || 'unknown',
    items: Array.isArray(result.items) ? result.items : [],
    formatted: typeof result.formatted === 'string' && result.formatted.trim() !== '' 
      ? result.formatted 
      : ''
  };
}
```

**✅ buildResponseの絶対文字列返却保証**
- すべてのパスで必ず`return`文がある
- `catch`ブロック内でも必ず`return`
- 最終フォールバックで必ず文字列を返す

**✅ POST関数での二重チェック**
- `buildResponse`を`try-catch`で囲む
- `aiResponse`が空の場合の最終フォールバック

#### 14.4.3 確認すべきポイント

1. **すべての`catch`ブロックに`return`があるか？**
   ```typescript
   try {
     ...
   } catch (error) {
     console.error(...);
     return '...'; // ← 必須
   }
   ```

2. **`ContextResult`の構造が保証されているか？**
   - `validateContextResult`で検証済み ✅

3. **`buildResponse`が必ず文字列を返すか？**
   - すべてのパスで`return`文あり ✅
   - 最終フォールバックあり ✅

#### 14.4.4 デバッグ時の確認方法

```typescript
// 1. resultのvalidation結果を確認
const validatedResult = validateContextResult(rawResult);
console.log('[AI Chat] Validation:', { 
  raw: !!rawResult, 
  validated: !!validatedResult,
  hasFormatted: validatedResult?.formatted?.length > 0
});

// 2. buildResponseの返り値を確認
const aiResponse = buildResponse(intent, result, message);
console.log('[AI Chat] Response:', { 
  length: aiResponse?.length || 0,
  isEmpty: !aiResponse || aiResponse.trim() === ''
});
```

#### 14.4.5 修正済み（v1.4.0）

- ✅ `validateContextResult`関数を追加
- ✅ `buildResponse`のすべてのパスで`return`保証
- ✅ `catch`ブロック内でも必ず`return`
- ✅ POST関数での二重チェック

---

## 15. 変更履歴

| 日付 | バージョン | 変更内容 | 担当 |
|------|-----------|---------|------|
| 2024-XX-XX | 1.0.0 | 初版作成 | - |
| 2024-XX-XX | 1.1.0 | BFFアーキテクチャ実装 | - |
| 2024-XX-XX | 1.2.0 | 日付フィルタリング追加 | - |
| 2024-XX-XX | 1.3.0 | 出力保証とデバッグログ追加 | - |
| 2024-XX-XX | 1.4.0 | Runtime Safety強化（validateContextResult追加、絶対文字列返却保証） | - |

---

## 16. 承認

| 役割 | 名前 | 承認日 | 署名 |
|------|------|--------|------|
| プロジェクトマネージャー | - | - | - |
| テックリード | - | - | - |
| ステークホルダー | - | - | - |

