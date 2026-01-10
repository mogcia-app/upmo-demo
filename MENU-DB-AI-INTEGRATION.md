# サイドバーメニューとDB構造のAIチャット連携設計

## 問題点

現在、サイドバーのメニュー項目とDB構造が連携していないため、AIチャットが適切に検索できない。

**例:**
- ユーザー: 「Signal.の料金について教えて」
- DB構造: `sections.pricing` として保存
- AIチャット: 「料金」という日本語で検索 → `pricing` にマッピングできない

## 解決策

### 1. MenuItemにAIチャット用メタデータを追加

```typescript
// src/types/sidebar.ts

// フィールドマッピング（日本語 ⇔ 英語）
export interface FieldMapping {
  japanese: string[];  // 日本語の表現（例: ['料金', '価格', '費用']）
  english: string;     // 英語のフィールド名（例: 'pricing'）
  type?: 'string' | 'number' | 'array' | 'object';  // フィールドの型
}

// 検索可能なフィールド定義
export interface SearchableField {
  fieldName: string;    // DBのフィールド名
  japaneseNames: string[];  // 日本語での呼び方
  searchable: boolean;  // 検索可能かどうか
  weight?: number;     // 検索時の重み（デフォルト: 1.0）
}

// AIチャット用のメタデータ
export interface AIChatMetadata {
  // Firestoreのコレクション名
  collectionName: string;
  
  // 検索可能なフィールド
  searchableFields: SearchableField[];
  
  // セクション/フィールドのマッピング（日本語 ⇔ 英語）
  fieldMappings: FieldMapping[];
  
  // 検索時のデフォルト制限
  defaultLimit?: number;
  
  // 会社単位で検索するかどうか
  searchByCompany?: boolean;
  
  // ユーザー単位で検索するかどうか
  searchByUser?: boolean;
  
  // 検索クエリの構築方法
  queryBuilder?: (query: string, userId: string, companyName: string) => any;
}

// MenuItemにAIチャット用メタデータを追加
export interface MenuItem {
  id: string;
  name: string;
  icon: string;
  href: string;
  description?: string;
  category: string;
  enabled?: boolean;
  order?: number;
  
  // AIチャット用メタデータ（オプション）
  aiChatMetadata?: AIChatMetadata;
}
```

### 2. メニュー項目の定義を拡張

```typescript
// src/types/sidebar.ts

export const AVAILABLE_MENU_ITEMS: MenuItem[] = [
  // ... 既存のメニュー項目
  
  // 契約書管理（例）
  {
    id: 'contracts',
    name: '契約書管理',
    icon: '•',
    href: '/admin/contracts',
    description: '契約書の管理',
    category: 'document',
    aiChatMetadata: {
      collectionName: 'manualDocuments',
      searchByCompany: true,
      searchByUser: false,
      defaultLimit: 10,
      searchableFields: [
        {
          fieldName: 'title',
          japaneseNames: ['タイトル', '契約書名', '文書名'],
          searchable: true,
          weight: 10
        },
        {
          fieldName: 'description',
          japaneseNames: ['説明', '概要', '内容'],
          searchable: true,
          weight: 5
        }
      ],
      fieldMappings: [
        {
          japanese: ['料金', '価格', '費用', '金額'],
          english: 'pricing',
          type: 'array'
        },
        {
          japanese: ['説明', '概要', '内容'],
          english: 'overview',
          type: 'string'
        },
        {
          japanese: ['特徴', '機能', '仕様'],
          english: 'features',
          type: 'array'
        },
        {
          japanese: ['手順', '使い方', '方法'],
          english: 'procedures',
          type: 'array'
        },
        {
          japanese: ['サポート', 'サポート情報'],
          english: 'support',
          type: 'string'
        },
        {
          japanese: ['規則', 'ルール', '規約'],
          english: 'rules',
          type: 'array'
        },
        {
          japanese: ['条件', '条項', '約款'],
          english: 'terms',
          type: 'string'
        },
        {
          japanese: ['Q&A', '質問', 'FAQ', 'よくある質問'],
          english: 'qa',
          type: 'array'
        }
      ]
    }
  },
  
  // 顧客管理（例）
  {
    id: 'customer-management',
    name: '顧客管理',
    icon: '👥',
    href: '/customers',
    description: '顧客情報・取引履歴の管理',
    category: 'customer',
    aiChatMetadata: {
      collectionName: 'customers',
      searchByCompany: true,
      searchByUser: false,
      defaultLimit: 20,
      searchableFields: [
        {
          fieldName: 'name',
          japaneseNames: ['名前', '顧客名', '氏名'],
          searchable: true,
          weight: 10
        },
        {
          fieldName: 'company',
          japaneseNames: ['会社', '会社名', '企業名'],
          searchable: true,
          weight: 8
        },
        {
          fieldName: 'email',
          japaneseNames: ['メール', 'メールアドレス', 'Eメール'],
          searchable: true,
          weight: 5
        },
        {
          fieldName: 'phone',
          japaneseNames: ['電話', '電話番号', 'TEL'],
          searchable: true,
          weight: 3
        },
        {
          fieldName: 'notes',
          japaneseNames: ['メモ', '備考', 'ノート'],
          searchable: true,
          weight: 2
        }
      ],
      fieldMappings: []
    }
  },
  
  // TODOリスト（例）
  {
    id: 'todo',
    name: 'TODOリスト',
    icon: '•',
    href: '/todo',
    description: 'タスク管理',
    category: 'other',
    aiChatMetadata: {
      collectionName: 'todos',
      searchByCompany: false,
      searchByUser: true,
      defaultLimit: 20,
      searchableFields: [
        {
          fieldName: 'text',
          japaneseNames: ['タスク', 'タイトル', '内容'],
          searchable: true,
          weight: 10
        },
        {
          fieldName: 'description',
          japaneseNames: ['説明', '詳細', '備考'],
          searchable: true,
          weight: 5
        },
        {
          fieldName: 'status',
          japaneseNames: ['ステータス', '状態', '状況'],
          searchable: true,
          weight: 3
        },
        {
          fieldName: 'priority',
          japaneseNames: ['優先度', '優先', '重要度'],
          searchable: true,
          weight: 2
        }
      ],
      fieldMappings: [
        {
          japanese: ['未着手', 'pending', '待機中'],
          english: 'pending',
          type: 'string'
        },
        {
          japanese: ['進行中', 'in-progress', '作業中'],
          english: 'in-progress',
          type: 'string'
        },
        {
          japanese: ['完了', 'completed', '終了'],
          english: 'completed',
          type: 'string'
        }
      ]
    }
  }
];
```

### 3. AIチャットがメニュー構造を参照する

```typescript
// src/app/api/ai-chat/route.ts

import { AVAILABLE_MENU_ITEMS } from '@/types/sidebar';

// メニュー項目からAIチャット用メタデータを取得
function getMenuAIMetadata(menuId: string): AIChatMetadata | null {
  const menuItem = AVAILABLE_MENU_ITEMS.find(item => item.id === menuId);
  return menuItem?.aiChatMetadata || null;
}

// メニュー項目IDから意図を判定
function parseIntentFromMenu(message: string): { menuId: string; intent: Intent } | null {
  const messageLower = message.toLowerCase();
  
  // 各メニュー項目のキーワードでマッチング
  for (const menuItem of AVAILABLE_MENU_ITEMS) {
    if (!menuItem.aiChatMetadata) continue;
    
    // メニュー名、説明、検索可能フィールドの日本語名でマッチング
    const keywords = [
      menuItem.name,
      menuItem.description,
      ...menuItem.aiChatMetadata.searchableFields.flatMap(f => f.japaneseNames)
    ];
    
    const matched = keywords.some(keyword => 
      messageLower.includes(keyword.toLowerCase())
    );
    
    if (matched) {
      // 意図タイプをメニューカテゴリから判定
      const intentType = mapCategoryToIntent(menuItem.category);
      return {
        menuId: menuItem.id,
        intent: { type: intentType }
      };
    }
  }
  
  return null;
}

// カテゴリを意図タイプにマッピング
function mapCategoryToIntent(category: string): Intent['type'] {
  const mapping: Record<string, Intent['type']> = {
    'customer': 'customer',
    'sales': 'sales',
    'document': 'document',
    'other': 'todo'
  };
  return mapping[category] || 'unknown';
}

// メニュー構造を参照した検索
async function searchByMenuMetadata(
  menuId: string,
  message: string,
  userId: string,
  companyName: string
): Promise<ContextResult | null> {
  const metadata = getMenuAIMetadata(menuId);
  if (!metadata) return null;
  
  const menuItem = AVAILABLE_MENU_ITEMS.find(item => item.id === menuId);
  if (!menuItem) return null;
  
  // フィールドマッピングを使用して検索クエリを構築
  const query = buildSearchQuery(message, metadata);
  
  // Firestoreで検索
  let snapshot;
  if (metadata.searchByCompany && companyName) {
    snapshot = await adminDb.collection(metadata.collectionName)
      .where('companyName', '==', companyName)
      .limit(metadata.defaultLimit || 10)
      .get();
  } else if (metadata.searchByUser) {
    snapshot = await adminDb.collection(metadata.collectionName)
      .where('userId', '==', userId)
      .limit(metadata.defaultLimit || 10)
      .get();
  } else {
    snapshot = await adminDb.collection(metadata.collectionName)
      .limit(metadata.defaultLimit || 10)
      .get();
  }
  
  // 検索結果をフィルタリング
  const results = filterResults(snapshot.docs, query, metadata);
  
  // 結果をフォーマット
  return formatResults(results, metadata, menuItem);
}

// 検索クエリを構築（フィールドマッピングを使用）
function buildSearchQuery(message: string, metadata: AIChatMetadata): {
  keywords: string[];
  fieldQueries: Record<string, string[]>;
  sectionQueries: Record<string, string>;
} {
  const messageLower = message.toLowerCase();
  const keywords: string[] = [];
  const fieldQueries: Record<string, string[]> = {};
  const sectionQueries: Record<string, string> = {};
  
  // フィールドマッピングをチェック
  for (const mapping of metadata.fieldMappings) {
    const matchedJapanese = mapping.japanese.find(jp => 
      messageLower.includes(jp.toLowerCase())
    );
    
    if (matchedJapanese) {
      // セクションクエリとして追加
      sectionQueries[mapping.english] = matchedJapanese;
    }
  }
  
  // 検索可能フィールドの日本語名をチェック
  for (const field of metadata.searchableFields) {
    const matchedJapanese = field.japaneseNames.find(jp => 
      messageLower.includes(jp.toLowerCase())
    );
    
    if (matchedJapanese) {
      if (!fieldQueries[field.fieldName]) {
        fieldQueries[field.fieldName] = [];
      }
      fieldQueries[field.fieldName].push(matchedJapanese);
    }
  }
  
  // 一般的なキーワードを抽出
  const words = messageLower.split(/\s+/).filter(w => w.length > 1);
  keywords.push(...words);
  
  return { keywords, fieldQueries, sectionQueries };
}

// 検索結果をフィルタリング
function filterResults(
  docs: any[],
  query: ReturnType<typeof buildSearchQuery>,
  metadata: AIChatMetadata
): any[] {
  return docs.filter(doc => {
    const data = doc.data();
    
    // セクションクエリのチェック（例: pricing）
    for (const [sectionKey, japaneseName] of Object.entries(query.sectionQueries)) {
      const sections = data.sections || {};
      if (sections[sectionKey] !== undefined && sections[sectionKey] !== null) {
        // セクションが存在する場合はマッチ
        return true;
      }
    }
    
    // フィールドクエリのチェック
    for (const [fieldName, japaneseNames] of Object.entries(query.fieldQueries)) {
      const fieldValue = data[fieldName];
      if (fieldValue) {
        const fieldValueLower = String(fieldValue).toLowerCase();
        const matched = japaneseNames.some(jp => 
          fieldValueLower.includes(jp.toLowerCase())
        );
        if (matched) return true;
      }
    }
    
    // キーワードマッチング
    const allText = JSON.stringify(data).toLowerCase();
    const matched = query.keywords.some(keyword => 
      allText.includes(keyword)
    );
    if (matched) return true;
    
    return false;
  });
}

// 結果をフォーマット
function formatResults(
  results: any[],
  metadata: AIChatMetadata,
  menuItem: MenuItem
): ContextResult {
  const formattedItems = results.map(doc => {
    const data = doc.data();
    const item: any = { id: doc.id, ...data };
    
    // セクションクエリがある場合は、そのセクションだけを返す
    // （例: 「料金」→ pricingセクションのみ）
    
    return item;
  });
  
  return {
    type: mapCategoryToIntent(menuItem.category) as Intent['type'],
    items: formattedItems,
    formatted: formatItemsAsText(formattedItems, metadata, menuItem),
    pageUrl: menuItem.href
  };
}
```

### 4. 実装の流れ

1. **MenuItem型の拡張**: `aiChatMetadata`フィールドを追加
2. **メニュー項目の定義更新**: 各メニュー項目にAIチャット用メタデータを追加
3. **AIチャットの検索ロジック更新**: メニュー構造を参照して検索
4. **フィールドマッピングの活用**: 日本語⇔英語のマッピングを使用

### 5. メリット

1. **一貫性**: メニュー構造とDB構造が連携
2. **保守性**: メニュー項目を追加するだけで、AIチャットも自動的に対応
3. **拡張性**: 新しいメニュー項目を追加する際に、AIチャット用メタデータを定義するだけ
4. **正確性**: フィールドマッピングにより、日本語での検索が正確に動作

### 6. 注意事項

- 既存のメニュー項目には後方互換性を保つ（`aiChatMetadata`はオプション）
- メニュー項目を追加する際は、必ず`aiChatMetadata`を定義する
- フィールドマッピングは、実際のDB構造と一致させる必要がある

