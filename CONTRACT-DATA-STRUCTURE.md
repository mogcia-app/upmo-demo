# 契約書データ構造とAIチャット検索の仕組み

## データ構造

### Firestore保存形式

`manualDocuments`コレクションに以下の形式で保存されます：

```typescript
{
  id: string,                    // ドキュメントID
  title: string,                  // タイトル（例: "Signal."）
  description: string,            // 説明
  type: 'meeting' | 'policy' | 'contract' | 'manual' | 'other',
  sections: {
    overview: string,             // 概要（文字列）
    features: (string | SectionItem)[],  // 機能（配列）
    pricing: (string | SectionItem)[],   // 料金（配列）
    procedures: (string | SectionItem)[], // 手順（配列）
    support?: (string | SectionItem)[],    // サポート（オプション）
    rules?: (string | SectionItem)[],     // 規則（オプション）
    terms?: (string | SectionItem)[],     // 条件（オプション）
    qa?: { question: string; answer: string }[]  // Q&A（オプション）
  },
  tags: string[],
  priority: 'low' | 'medium' | 'high',
  companyName: string,            // 会社名（共有用）
  userId: string,                 // 作成者ID
  createdAt: Timestamp,
  lastUpdated: Timestamp
}
```

### SectionItem形式

配列項目は以下の2つの形式をサポート：

1. **文字列形式**:
   ```typescript
   features: ["機能1", "機能2", "機能3"]
   ```

2. **オブジェクト形式**:
   ```typescript
   features: [
     { title: "機能1", content: "詳細説明" },
     { title: "機能2", content: "詳細説明" }
   ]
   ```

## AIチャット検索の仕組み

### 検索パターン

AIチャットは以下のパターンで検索できます：

#### 1. タイトル全体について質問
```
「Signal.について教えて」
「Signal.とは」
「Signal.の説明」
```
→ `overview`セクションまたは`description`を返す

#### 2. 特定項目について質問
```
「Signal.の料金について教えて」
「Signal.の価格について」
「Signal.の機能について」
「Signal.の手順について」
```
→ 指定された項目（`pricing`, `features`, `procedures`など）の内容だけを返す

#### 3. 一般的な検索
```
「契約書を検索したい」
「ドキュメント一覧」
```
→ すべてのドキュメントを返す

### 項目名のマッピング

日本語の項目名は以下のように英語キーにマッピングされます：

| 日本語 | 英語キー | 説明 |
|--------|----------|------|
| 説明、概要 | `overview` | 概要セクション |
| 料金、価格 | `pricing` | 料金セクション |
| 特徴、機能 | `features` | 機能セクション |
| 手順 | `procedures` | 手順セクション |
| サポート | `support` | サポートセクション |
| 規則 | `rules` | 規則セクション |
| 条件 | `terms` | 条件セクション |
| Q&A、質問 | `qa` | Q&Aセクション |

### 検索ロジックの改善（2024年実装）

#### 改善前の問題点
- `JSON.stringify(data.sections)`で全体を検索していたため、項目ごとの検索がうまく機能していなかった
- 項目指定があっても、すべてのセクションを検索していた

#### 改善後の動作
1. **項目指定がある場合**:
   - 指定された項目の内容だけを検索
   - 項目が存在しない、または内容が空の場合はスキップ
   - タイトルマッチングは維持

2. **項目指定がない場合**:
   - すべてのセクションを検索
   - タイトル、説明、セクション内容でマッチング

3. **セクション内容の文字列化**:
   - 文字列: そのまま使用
   - 配列: 各要素を文字列化して結合
   - オブジェクト: `title`と`content`を結合

### 実装例

#### 検索クエリ: 「Signal.の料金について教えて」

1. **パターン抽出**:
   - `extractedTitle = "Signal."`
   - `extractedSection = "料金"`
   - `targetSectionKey = "pricing"`

2. **検索処理**:
   - タイトルが「Signal.」に一致するドキュメントを検索
   - `sections.pricing`の内容だけを取得
   - `pricing`が空の場合はスキップ

3. **結果表示**:
   - `【Signal.】`の`料金:`セクションだけを表示

## データ構造の確認

### 現在の実装

✅ **データ構造は正しく保存されている**
- 各項目（`overview`, `features`, `pricing`など）は個別に保存されている
- 配列形式とオブジェクト形式の両方をサポート

✅ **AIチャットの検索ロジックは改善済み**
- 項目ごとの検索が正しく機能するようになった
- 項目指定がある場合、その項目の内容だけを返す

### 確認方法

1. **Firestoreで確認**:
   ```javascript
   // Firestoreコンソールで確認
   manualDocuments/{docId}
   {
     sections: {
       overview: "...",
       pricing: ["料金1", "料金2"],
       features: [{ title: "機能1", content: "説明" }]
     }
   }
   ```

2. **AIチャットで確認**:
   - 「Signal.について教えて」→ `overview`だけ表示
   - 「Signal.の料金について教えて」→ `pricing`だけ表示
   - 「Signal.の機能について教えて」→ `features`だけ表示

## トラブルシューティング

### 問題: 項目ごとに質問しても全部出てくる

**原因**: 
- 検索ロジックが改善される前の実装を使用している可能性

**解決策**:
- 最新のコードに更新されているか確認
- `targetSectionKey`が正しく設定されているか確認

### 問題: 特定の項目が表示されない

**原因**:
- その項目が存在しない
- その項目の内容が空

**確認方法**:
- Firestoreで該当ドキュメントの`sections`を確認
- 項目が存在し、内容が空でないことを確認

### 問題: タイトルが一致しない

**原因**:
- タイトルの表記が異なる（例: "Signal." vs "Signal"）

**解決策**:
- 部分一致もサポートされているため、タイトルに含まれる文字列で検索可能
- より正確な検索のため、完全一致を推奨

## 今後の改善案

1. **セクション内容の検索精度向上**:
   - セマンティック検索の導入
   - キーワードマッチングの改善

2. **項目名のマッピング拡張**:
   - より多くの日本語表現に対応
   - ユーザーがカスタマイズ可能に

3. **検索結果のランキング**:
   - マッチスコアの改善
   - 関連度の高い結果を優先表示

