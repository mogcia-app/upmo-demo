# AIアシスタント出力の安定性改善提案

## 現状の問題点

### 1. 意図解析（Intent Parsing）の不安定性

**問題:**
- `findPageByKeyword`に依存したキーワードマッチングが不正確
- 同じ質問でも異なる意図に分類される可能性がある
- 曖昧な質問に対して`unknown`に分類されやすい

**例:**
- 「顧客について教えて」→ `customer` または `unknown`
- 「Signal.の料金について」→ `document` または `unknown`

### 2. 検索ロジックの複雑さ

**問題:**
- 複数の条件分岐（`isGeneralQuery`, `extractedTitle`, `targetSectionKey`など）
- 同じ質問でも検索結果が異なる可能性がある
- フォールバック処理が複雑で予測困難

**例:**
- 「今日のタスクは？」→ 日付判定ロジックが複雑
- 「契約書について」→ タイトル抽出パターンが複雑

### 3. レスポンス生成の一貫性

**問題:**
- `buildResponse`関数が複雑で、同じ入力でも異なる出力が生成される
- エラー時のフォールバックが不十分
- デバッグログが開発環境のみ

### 4. エラーハンドリング

**問題:**
- エラーが発生してもユーザーには不十分な情報しか返されない
- エラーの原因が特定しにくい
- リトライ機能がない

## 改善提案

### フェーズ1: 意図解析の改善（優先度: 高）

#### 1.1 重み付きキーワードマッチング

```typescript
interface IntentScore {
  type: Intent['type'];
  score: number;
  confidence: number;
}

function parseIntentWithScore(message: string): IntentScore[] {
  const messageLower = message.toLowerCase();
  const scores: IntentScore[] = [];
  
  // 各意図タイプに対するキーワードと重み
  const intentKeywords = {
    customer: [
      { keyword: '顧客', weight: 10 },
      { keyword: 'customer', weight: 10 },
      { keyword: '取引先', weight: 8 },
      { keyword: 'クライアント', weight: 8 },
      { keyword: '会社', weight: 5 },
      { keyword: '企業', weight: 5 }
    ],
    sales: [
      { keyword: '営業', weight: 10 },
      { keyword: '案件', weight: 10 },
      { keyword: '商談', weight: 9 },
      { keyword: '見積', weight: 8 },
      { keyword: '成約', weight: 7 }
    ],
    // ... 他の意図タイプ
  };
  
  // スコア計算
  Object.entries(intentKeywords).forEach(([type, keywords]) => {
    let score = 0;
    keywords.forEach(({ keyword, weight }) => {
      if (messageLower.includes(keyword)) {
        score += weight;
      }
    });
    
    if (score > 0) {
      scores.push({
        type: type as Intent['type'],
        score,
        confidence: Math.min(score / 50, 1.0) // 0-1の信頼度
      });
    }
  });
  
  // スコアでソート
  scores.sort((a, b) => b.score - a.score);
  
  return scores;
}
```

#### 1.2 複数意図の考慮

```typescript
function parseIntent(message: string): Intent {
  const scores = parseIntentWithScore(message);
  
  if (scores.length === 0) {
    return { type: 'unknown' };
  }
  
  // 最高スコアの意図を選択
  const topScore = scores[0];
  
  // 信頼度が低い場合は、複数の意図を考慮
  if (topScore.confidence < 0.5 && scores.length > 1) {
    // 2番目のスコアと比較
    const secondScore = scores[1];
    if (secondScore.score / topScore.score > 0.8) {
      // スコアが近い場合は、より一般的な意図を選択
      return { type: 'unknown' };
    }
  }
  
  return { type: topScore.type };
}
```

### フェーズ2: 検索ロジックの簡素化（優先度: 高）

#### 2.1 検索結果のキャッシュ

```typescript
// 検索結果をキャッシュ（5分間）
const searchCache = new Map<string, { result: ContextResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分

async function searchByIntentWithCache(
  intent: Intent,
  message: string,
  userId: string,
  companyName: string
): Promise<ContextResult | null> {
  const cacheKey = `${intent.type}:${message}:${userId}:${companyName}`;
  const cached = searchCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  
  const result = await searchByIntent(intent, message, userId, companyName);
  
  if (result) {
    searchCache.set(cacheKey, { result, timestamp: Date.now() });
  }
  
  return result;
}
```

#### 2.2 検索ロジックの統一

```typescript
// 統一された検索インターフェース
interface SearchOptions {
  query: string;
  userId: string;
  companyName: string;
  limit?: number;
  filters?: Record<string, any>;
}

async function unifiedSearch(
  intent: Intent,
  options: SearchOptions
): Promise<ContextResult | null> {
  // 各意図タイプに対して統一された検索ロジックを適用
  // 複雑な条件分岐を減らす
}
```

### フェーズ3: レスポンス生成の改善（優先度: 中）

#### 3.1 テンプレートベースのレスポンス生成

```typescript
interface ResponseTemplate {
  type: Intent['type'];
  templates: {
    success: string;
    notFound: string;
    error: string;
  };
}

const responseTemplates: ResponseTemplate[] = [
  {
    type: 'customer',
    templates: {
      success: '【顧客管理】\n\n{count}件の顧客情報が見つかりました。\n\n{items}\n\n[📋 顧客管理ページへ移動]({url})',
      notFound: '【顧客管理】\n\n顧客情報が見つかりませんでした。\n\n別のキーワードで検索していただくか、顧客名・会社名・メールアドレスで検索してみてください。',
      error: '【顧客管理】\n\n検索中にエラーが発生しました。もう一度お試しください。'
    }
  },
  // ... 他の意図タイプ
];

function buildResponseWithTemplate(
  intent: Intent,
  result: ContextResult | null,
  message: string
): string {
  const template = responseTemplates.find(t => t.type === intent.type);
  
  if (!template) {
    return buildResponse(intent, result, message); // フォールバック
  }
  
  if (result && result.items.length > 0) {
    // 成功時のテンプレートを使用
    return template.templates.success
      .replace('{count}', result.items.length.toString())
      .replace('{items}', formatItems(result.items))
      .replace('{url}', result.pageUrl || '');
  } else if (result && result.items.length === 0) {
    // 見つからなかった場合
    return template.templates.notFound;
  } else {
    // エラー時
    return template.templates.error;
  }
}
```

#### 3.2 レスポンスの検証

```typescript
function validateResponse(response: string): { valid: boolean; error?: string } {
  if (!response || response.trim().length === 0) {
    return { valid: false, error: 'Response is empty' };
  }
  
  if (response.length > 5000) {
    return { valid: false, error: 'Response is too long' };
  }
  
  // 不正な文字が含まれていないかチェック
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(response)) {
    return { valid: false, error: 'Response contains invalid characters' };
  }
  
  return { valid: true };
}
```

### フェーズ4: エラーハンドリングの強化（優先度: 中）

#### 4.1 リトライ機能

```typescript
async function searchWithRetry(
  intent: Intent,
  message: string,
  userId: string,
  companyName: string,
  maxRetries: number = 3
): Promise<ContextResult | null> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await searchByIntent(intent, message, userId, companyName);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Search Retry] Attempt ${attempt} failed:`, lastError);
      
      if (attempt < maxRetries) {
        // 指数バックオフ
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  // すべてのリトライが失敗した場合
  console.error('[Search Retry] All attempts failed:', lastError);
  return null;
}
```

#### 4.2 エラーログの改善

```typescript
interface ErrorLog {
  timestamp: Date;
  userId: string;
  intent: Intent['type'];
  message: string;
  error: string;
  stack?: string;
  context?: Record<string, any>;
}

async function logError(error: Error, context: {
  userId: string;
  intent: Intent['type'];
  message: string;
  [key: string]: any;
}) {
  const errorLog: ErrorLog = {
    timestamp: new Date(),
    userId: context.userId,
    intent: context.intent,
    message: context.message,
    error: error.message,
    stack: error.stack,
    context: { ...context, error: undefined }
  };
  
  // Firestoreに保存（本番環境でも）
  if (adminDb) {
    try {
      await adminDb.collection('aiChatErrors').add(errorLog);
    } catch (logError) {
      console.error('[Error Logging] Failed to log error:', logError);
    }
  }
  
  // 開発環境ではコンソールにも出力
  if (process.env.NODE_ENV === 'development') {
    console.error('[AI Chat Error]', errorLog);
  }
}
```

### フェーズ5: テストとモニタリング（優先度: 低）

#### 5.1 ユニットテスト

```typescript
describe('parseIntent', () => {
  it('should correctly identify customer intent', () => {
    expect(parseIntent('顧客一覧を見たい')).toEqual({ type: 'customer' });
    expect(parseIntent('customer list')).toEqual({ type: 'customer' });
  });
  
  it('should handle ambiguous queries', () => {
    const result = parseIntent('情報を見たい');
    // 曖昧な場合はunknownを返す
    expect(result.type).toBe('unknown');
  });
});
```

#### 5.2 パフォーマンスモニタリング

```typescript
interface PerformanceMetrics {
  intent: Intent['type'];
  searchTime: number;
  responseTime: number;
  cacheHit: boolean;
  error: boolean;
}

async function trackPerformance(metrics: PerformanceMetrics) {
  // Firestoreに保存
  if (adminDb) {
    await adminDb.collection('aiChatMetrics').add({
      ...metrics,
      timestamp: Timestamp.now()
    });
  }
}
```

## 実装優先順位

1. **フェーズ1: 意図解析の改善** - 最も影響が大きい
2. **フェーズ2: 検索ロジックの簡素化** - 安定性向上
3. **フェーズ4: エラーハンドリングの強化** - ユーザー体験向上
4. **フェーズ3: レスポンス生成の改善** - 一貫性向上
5. **フェーズ5: テストとモニタリング** - 長期的な改善

## 期待される効果

1. **出力の一貫性向上**: 同じ質問に対して同じ結果が返る
2. **意図解析の精度向上**: より正確な意図判定
3. **エラー処理の改善**: エラー時の適切なフォールバック
4. **パフォーマンス向上**: キャッシュによる高速化
5. **デバッグの容易さ**: 詳細なログとモニタリング

## 注意事項

- 既存のコードとの互換性を保つ
- 段階的な実装を推奨
- 本番環境でのテストを十分に行う
- ユーザーフィードバックを収集して改善を継続

