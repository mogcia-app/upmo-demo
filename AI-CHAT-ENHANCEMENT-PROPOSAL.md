# AIチャット機能拡張提案

## 現状の実装状況

### 現在できること
- ✅ データの検索と表示（「TODOリストについて教えて」→ TODO一覧を返す）
- ✅ メタデータベースの検索（メニュー項目ごとの検索ロジック）
- ✅ セクション指定の検索（「Signal.の料金について教えて」→ 料金セクションのみ）
- ✅ ステータス指定の検索（「共有事項について教えて」→ sharedステータスのみ）
- ✅ 基本的なフォーマット（リンク付きの結果表示）

### 現在できないこと
- ❌ アクション指向の応答（「作って」「確認して」などの動詞の検出と実行）
- ❌ 複数のデータソースを組み合わせた検索（顧客情報 + 契約書情報）
- ❌ 現在時刻を考慮したフィルタリング（「13時から〇〇が入ってます」）
- ❌ 期限・日時ベースの優先順位付け（「15時締め切りの〇〇があります」）
- ❌ 推奨アクションの提案（「月○円で作成してください」）

---

## 提案された機能

### 1. 「〇〇さんに請求書作って！」機能

**期待される動作：**
```
ユーザー: 「山田さんに請求書作って！」

AI: 
【請求書作成の準備ができました】

📋 顧客情報
- 顧客名: 山田太郎
- 会社名: 株式会社山田
- メール: yamada@example.com

📄 契約書情報
- 契約書名: Signal.
- 月額料金: 12万円
- 契約期間: 2024年1月〜2024年12月

💡 推奨アクション
月額12万円で請求書を作成してください。

[📄 請求書発行ページへ移動](/admin/invoice)
```

**実装に必要な機能：**
1. **アクション検出**: 「作って」「作成して」「発行して」などの動詞を検出
2. **エンティティ抽出**: 「〇〇さん」から顧客名を抽出
3. **複数データソースの検索**:
   - 顧客情報（`customers`コレクション）
   - 契約書情報（`manualDocuments`コレクション）
   - 過去の請求書情報（`invoices`コレクション）
4. **推奨アクションの生成**: 契約書の料金情報から推奨金額を提案

**実装アプローチ：**

⚠️ **重要**: `detectAction`が太りすぎる未来を防ぐため、2段階の設計を採用

```typescript
// ① まず意図だけ（将来の拡張耐性を確保）
type Intent =
  | 'create'    // 作成
  | 'check'     // 確認
  | 'search'    // 検索
  | 'update'    // 更新
  | 'delete';   // 削除

// ② 次にドメイン
type Domain =
  | 'invoice'   // 請求書
  | 'todo'      // TODO
  | 'customer'  // 顧客
  | 'contract'; // 契約書

// アクションタイプの定義（Intent + Domain + エンティティ）
type ActionType = {
  intent: Intent;
  domain: Domain;
  entities: Record<string, string>; // エンティティ（顧客名、タスク名など）
};

// アクション検出関数（2段階アプローチ）
function detectAction(message: string): ActionType | null {
  const messageLower = message.toLowerCase();
  
  // Step 1: 意図の検出
  let intent: Intent | null = null;
  if (['作', '作成', '発行', '作って', '作成して'].some(keyword => 
    messageLower.includes(keyword)
  )) {
    intent = 'create';
  } else if (['確認', '見', 'チェック', '確認して'].some(keyword => 
    messageLower.includes(keyword)
  )) {
    intent = 'check';
  } else if (['検索', '探', '見つけ', '検索して'].some(keyword => 
    messageLower.includes(keyword)
  )) {
    intent = 'search';
  }
  
  if (!intent) return null;
  
  // Step 2: ドメインの検出
  let domain: Domain | null = null;
  if (['請求書', 'invoice'].some(keyword => messageLower.includes(keyword))) {
    domain = 'invoice';
  } else if (['todo', 'タスク', 'やること'].some(keyword => messageLower.includes(keyword))) {
    domain = 'todo';
  } else if (['顧客', 'customer'].some(keyword => messageLower.includes(keyword))) {
    domain = 'customer';
  } else if (['契約書', '契約', 'contract'].some(keyword => messageLower.includes(keyword))) {
    domain = 'contract';
  }
  
  if (!domain) return null;
  
  // Step 3: エンティティ抽出（Phase 1: 正規表現、Phase 2: DB補完）
  const entities: Record<string, string> = {};
  
  // 顧客名の抽出（Phase 1: 正規表現）
  const customerMatch = message.match(/(.+?)(さん|様|に)/);
  if (customerMatch) {
    entities.customerName = customerMatch[1].trim();
  }
  
  // Phase 2では、customersコレクションのname一覧と部分一致で補完
  
  return {
    intent,
    domain,
    entities
  };
}

// エンティティ抽出の改善（Phase 2: DB補完）
async function extractCustomerName(
  message: string,
  companyName: string
): Promise<string | null> {
  // Phase 1: 正規表現で抽出を試みる
  const customerMatch = message.match(/(.+?)(さん|様|に)/);
  if (customerMatch) {
    const extractedName = customerMatch[1].trim();
    
    // Phase 2: DB補完 - customersコレクションのname一覧と部分一致
    const customersSnapshot = await adminDb.collection('customers')
      .where('companyName', '==', companyName)
      .get();
    
    const customerNames = customersSnapshot.docs
      .map(doc => doc.data().name)
      .filter(name => name);
    
    // 部分一致で最も近い顧客名を探す
    const matchedCustomer = customerNames.find(name => 
      name.includes(extractedName) || extractedName.includes(name)
    );
    
    return matchedCustomer || extractedName;
  }
  
  return null;
}

// 複数データソースの検索
async function searchForInvoiceCreation(
  customerName: string,
  userId: string,
  companyName: string
): Promise<{
  customer: any;
  contract: any;
  previousInvoices: any[];
}> {
  // 1. 顧客情報を検索（部分一致も考慮）
  const customersSnapshot = await adminDb.collection('customers')
    .where('companyName', '==', companyName)
    .get();
  
  const customer = customersSnapshot.docs
    .map(doc => doc.data())
    .find(c => 
      c.name === customerName || 
      c.name?.includes(customerName) || 
      customerName.includes(c.name)
    );
  
  // 2. 契約書情報を検索（顧客名または会社名で）
  const contractSnapshot = await adminDb.collection('manualDocuments')
    .where('companyName', '==', companyName)
    .get();
  
  // 顧客名や会社名でマッチング
  const contract = contractSnapshot.docs
    .map(doc => doc.data())
    .find(doc => 
      doc.title?.includes(customerName) || 
      doc.title?.includes(customer?.company)
    );
  
  // 3. 過去の請求書を検索
  const invoiceSnapshot = await adminDb.collection('invoices')
    .where('companyName', '==', companyName)
    .where('customerName', '==', customer?.name || customerName)
    .orderBy('issueDate', 'desc')
    .limit(5)
    .get();
  
  const previousInvoices = invoiceSnapshot.docs.map(doc => doc.data());
  
  return { customer, contract, previousInvoices };
}

// 推奨アクションの生成（AIっぽい文章で判断している感を出す）
function generateInvoiceRecommendation(
  customer: any,
  contract: any,
  previousInvoices: any[]
): string {
  let recommendation = '';
  
  // 契約書から料金情報を取得
  if (contract?.sections?.pricing) {
    const pricing = contract.sections.pricing;
    // 料金情報を解析（例: 「12万円」→ 120000）
    const monthlyAmount = extractAmount(pricing);
    
    // AIっぽい文章：判断している感を出す
    recommendation = `契約内容を確認したところ、月額${formatCurrency(monthlyAmount)}の契約になっています。\nこの金額で請求書を作成するのが自然そうです。`;
  } else if (previousInvoices.length > 0) {
    // 過去の請求書から金額を取得
    const lastInvoice = previousInvoices[0];
    recommendation = `過去の請求履歴を確認したところ、前回は${formatCurrency(lastInvoice.totalAmount)}で請求されています。\n同額での請求が適切かもしれません。`;
  } else {
    recommendation = `契約書や過去の請求履歴が見つかりませんでした。\n請求書発行ページで金額を確認してから作成してください。`;
  }
  
  return recommendation;
}
```

---

### 2. 「todoリストについて教えて」→ 現在時刻を考慮した応答

**期待される動作：**
```
ユーザー（12時に質問）: 「todoリストについて教えて」

AI: 
【TODOリスト - 今すぐすべきこと】

⏰ 今日の予定
- 13:00 - 〇〇ミーティング（1時間後）
- 15:00 - 〇〇の締め切り（3時間後）

📋 今日のタスク
- 〇〇の資料作成（期限: 今日）
- 〇〇の報告書提出（期限: 今日）

[✅ タスク管理ページへ移動](/todo)
```

**実装に必要な機能：**
1. **現在時刻の取得**: サーバー側で現在時刻を取得
2. **日時ベースのフィルタリング**:
   - `dueDate`が今日のタスク
   - `startDate`が今日のタスク
   - `dueDate`が近いタスク（例: 3時間以内）
3. **優先順位付け**:
   - 締め切りが近い順
   - 重要度が高い順
4. **時間ベースのメッセージ生成**: 「1時間後」「3時間後」などの相対時間表示

**実装アプローチ：**
```typescript
// 現在時刻を考慮したTODO検索
async function searchTodosWithTimeContext(
  message: string,
  userId: string,
  companyName: string
): Promise<ContextResult | null> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  
  // TODOを取得
  const todosSnapshot = await adminDb.collection('todos')
    .where('userId', '==', userId)
    .get();
  
  const todos = todosSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // 現在時刻を考慮したフィルタリング
  const urgentTodos = todos.filter(todo => {
    if (!todo.dueDate) return false;
    
    const dueDate = todo.dueDate instanceof Timestamp 
      ? todo.dueDate.toDate() 
      : new Date(todo.dueDate);
    
    // 今日のタスク
    if (dueDate >= today && dueDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
      return true;
    }
    
    // 3時間以内の締め切り
    if (dueDate >= now && dueDate <= threeHoursLater) {
      return true;
    }
    
    return false;
  });
  
  // 優先順位付け（締め切りが近い順）
  urgentTodos.sort((a, b) => {
    const dueDateA = a.dueDate instanceof Timestamp 
      ? a.dueDate.toDate() 
      : new Date(a.dueDate);
    const dueDateB = b.dueDate instanceof Timestamp 
      ? b.dueDate.toDate() 
      : new Date(b.dueDate);
    return dueDateA.getTime() - dueDateB.getTime();
  });
  
  // 時間ベースのメッセージ生成
  const formattedTodos = urgentTodos.map(todo => {
    const dueDate = todo.dueDate instanceof Timestamp 
      ? todo.dueDate.toDate() 
      : new Date(todo.dueDate);
    
    const hoursUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (60 * 60 * 1000));
    const minutesUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (60 * 1000));
    
    let timeMessage = '';
    if (hoursUntilDue < 1) {
      timeMessage = `${minutesUntilDue}分後`;
    } else if (hoursUntilDue < 24) {
      timeMessage = `${hoursUntilDue}時間後`;
    } else {
      timeMessage = dueDate.toLocaleDateString('ja-JP');
    }
    
    return `- ${todo.text}（期限: ${timeMessage}）`;
  });
  
  return {
    type: 'todo',
    items: urgentTodos,
    formatted: `【TODOリスト - 今すぐすべきこと】\n\n⏰ 今日の予定\n${formattedTodos.join('\n')}\n\n[✅ タスク管理ページへ移動](/todo)`,
    pageUrl: '/todo'
  };
}
```

---

## 実装の優先順位

### Phase 1: 基本的なアクション検出（高優先度）
- 「作って」「作成して」などの動詞の検出
- エンティティ抽出（顧客名、タスク名など）
- 基本的なアクション応答（リンクと簡単な説明）

### Phase 2: 時間ベースのフィルタリング（中優先度）
- 現在時刻を考慮したTODO検索
- 締め切りが近いタスクの優先表示
- 相対時間の表示（「1時間後」「3時間後」）

### Phase 3: 複数データソースの統合（中優先度）
- 顧客情報 + 契約書情報の組み合わせ検索
- 過去の請求書情報の参照
- 推奨アクションの生成

### Phase 4: 高度な自然言語処理（低優先度）
- より複雑な質問の理解
- コンテキストの保持（会話の流れを理解）
- 推論機能（データから推測して提案）

---

## 技術的な課題と解決策

### 1. 自然言語処理の精度

**課題：**
- 日本語の動詞の検出（「作って」「作成して」「発行して」など）
- エンティティ抽出の精度（「山田さん」→ 顧客名の抽出）
- あいまいな表現の処理（「〇〇さん」が複数の顧客にマッチする場合）

**解決策（段階的アプローチ）：**
- **Phase 1**: 正規表現ベースの検出（現実的な落とし所）
- **Phase 2**: DB補完によるエンティティ解決
  - `customers`コレクションの`name`一覧を先に取得
  - メッセージに含まれる文字列と部分一致で補完
  - **NLPではなくDB主導のエンティティ解決**（業務系AIでは王道）
- **Phase 3**: より高度な自然言語処理（必要に応じて）

### 2. パフォーマンス

**課題：**
- 複数のデータソースを検索する際のパフォーマンス
- リアルタイムでの時刻計算とフィルタリング

**解決策：**
- 並列検索の活用（Promise.all）
- キャッシュの活用（顧客名一覧など）
- 必要最小限のデータ取得

### 3. エラーハンドリング

**課題：**
- 顧客が見つからない場合
- 契約書が見つからない場合
- データが不完全な場合

**解決策：**
- 段階的なフォールバック（契約書がない場合は過去の請求書を参照）
- 明確なエラーメッセージ（「顧客が見つかりませんでした。顧客名を確認してください」）
- 部分的な情報でも可能な限り有用な情報を返す

---

## 推奨される実装アプローチ

### 段階的な実装
1. **まずは基本的なアクション検出から**
   - 「作って」「確認して」などの動詞を検出
   - **Intent + Domain の2段階設計**で将来の拡張耐性を確保
   - 簡単な応答（「請求書発行ページで作成できます」など）

2. **時間ベースのフィルタリングを追加**
   - TODOリストの時刻フィルタリング
   - 締め切りが近いタスクの優先表示
   - **「今すぐ影響あるものだけ」に絞る**（差別化ポイント）

3. **複数データソースの統合**
   - 顧客情報と契約書情報の組み合わせ
   - 推奨アクションの生成
   - **AIっぽい文章で判断している感を出す**

### 外部ライブラリの活用
- **自然言語処理**: Phase 1では不要、Phase 3以降で検討
- **エンティティ抽出**: **DB補完ベース**（業務系AIでは王道）
- **時刻処理**: `date-fns` や `moment.js` など

### 重要な設計原則

❗ **AIにやらせるな、AIっぽく見せろ**

- **判断ロジック**: JS / TS（決定論的、事故らない）
- **表現**: AIっぽい文章生成（「確認したところ」「自然そうです」など）

👉 業務AIで一番事故らない構成

---

## 重要な設計改善点

### 1. `detectAction`の設計改善

**問題点：**
- 現在の設計では、将来的に`create-invoice`, `confirm-invoice`, `create-todo`, `check-todo`などが増え続けて地獄になる

**改善案：**
- **Intent + Domain の2段階設計**を採用
- `{ intent: 'create', domain: 'invoice', entities: { customerName: '山田' } }`
- これだけで将来の拡張耐性が段違い

### 2. エンティティ抽出の改善

**問題点：**
- 正規表現 `/(.+?)(さん|様|に)/` だけでは限界が来る

**改善案：**
- **Phase 1**: 正規表現（今のままでOK）
- **Phase 2**: DB補完によるエンティティ解決
  - `customers`コレクションの`name`一覧を先に取得
  - メッセージに含まれる文字列と部分一致で補完
  - **NLPではなくDB主導**（業務系AIでは王道）

### 3. 出力文の改善

**問題点：**
- 現在の出力は正しいが少し硬い
- 「月額12万円で請求書を作成してください」→ 判断している感がない

**改善案：**
- AIっぽい文章で判断している感を出す
- 「契約内容を確認したところ、月額12万円の契約になっています。この金額で請求書を作成するのが自然そうです。」
- **同じロジックでも価値が跳ねる**

## 結論

提案された機能は**実装可能**で、**「検索AI」→「仕事を進めるAI」**への進化として正しい方向性です。

特に重要なポイント：
1. ✅ **「検索AI」から「業務アシスタント」へ進化**（意図を理解 → 状況を整理 → 次の行動を提示）
2. ✅ **推奨アクションを確定操作にしない**（人間主導の設計、業務AIとして超重要）
3. ✅ **Phase分けが現実的**（ルールベース → 自然言語処理の順）
4. ✅ **TODO × 時刻連動は差別化ポイント**（「今すぐ影響あるものだけ」に絞る）

修正すべき点：
1. `detectAction`を **Intent + Domain に分離**
2. エンティティ抽出は **DB補完前提**に
3. 出力文だけ少し**"考えてる感"**を足す

この3点を実装すれば、**「検索AI」→「仕事を進めるAI」**になる。

