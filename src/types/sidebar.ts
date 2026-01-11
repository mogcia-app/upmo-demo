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
}

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

export interface SidebarConfig {
  companyName?: string;
  commonMenuItems: MenuItem[];
  adminMenuItems: MenuItem[];
  availableMenuItems?: MenuItem[];
  enabledMenuItems?: string[];
  updatedAt?: Date;
  updatedBy?: string;
}

// 後方互換性のため、エイリアスを保持
export type AvailableMenuItem = MenuItem;
export type SidebarMenuItem = MenuItem;

// カテゴリ名のマッピング
export const CATEGORY_NAMES: Record<string, string> = {
  sales: '営業管理',
  customer: '顧客管理',
  document: 'ドキュメント管理',
};

// カテゴリの表示順序
export const CATEGORY_ORDER: string[] = [
  'sales',
  'customer',
  'document',
];

// 利用可能なメニュー項目の候補プール
export const AVAILABLE_MENU_ITEMS: MenuItem[] = [
  // メインメニュー
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
          japaneseNames: ['タスク', 'タイトル', '内容', 'やること'],
          searchable: true,
          weight: 10
        },
        {
          fieldName: 'description',
          japaneseNames: ['説明', '詳細', '備考', 'メモ'],
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
          japanese: ['共有事項', 'shared', '共有', 'チーム共有'],
          english: 'shared',
          type: 'string'
        },
        {
          japanese: ['todo', 'ToDo', 'タスク', 'やること', '未着手', 'pending', '待機中', '未開始'],
          english: 'todo',
          type: 'string'
        },
        {
          japanese: ['進行中', 'in-progress', '作業中', '実行中'],
          english: 'in-progress',
          type: 'string'
        },
        {
          japanese: ['完了', 'completed', '完了事項', '終了', '済み'],
          english: 'completed',
          type: 'string'
        }
      ]
    }
  },
  {
    id: 'progress-notes',
    name: '進捗メモ',
    icon: '•',
    href: '/sales/progress-notes',
    description: '営業活動の進捗記録',
    category: 'sales',
    aiChatMetadata: {
      collectionName: 'progressNotes',
      searchByCompany: false,
      searchByUser: true,
      defaultLimit: 10,
      searchableFields: [
        {
          fieldName: 'title',
          japaneseNames: ['タイトル', '件名', '題名'],
          searchable: true,
          weight: 10
  },
  {
          fieldName: 'content',
          japaneseNames: ['内容', '本文', 'メモ', '記録'],
          searchable: true,
          weight: 8
        },
        {
          fieldName: 'caseTitle',
          japaneseNames: ['案件', '案件名', '関連案件'],
          searchable: true,
          weight: 5
        }
      ],
      fieldMappings: []
    }
  },
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
          japaneseNames: ['タイトル', '契約書名', '文書名', '名称'],
          searchable: true,
          weight: 10
        },
        {
          fieldName: 'description',
          japaneseNames: ['説明', '概要', '内容', '詳細'],
          searchable: true,
          weight: 5
        }
      ],
      fieldMappings: [
        {
          japanese: ['料金', '価格', '費用', '金額', 'コスト'],
          english: 'pricing',
          type: 'array'
        },
        {
          japanese: ['説明', '概要', '内容', '詳細', '紹介'],
          english: 'overview',
          type: 'string'
        },
        {
          japanese: ['特徴', '機能', '仕様', 'スペック'],
          english: 'features',
          type: 'array'
        },
        {
          japanese: ['手順', '使い方', '方法', '手続き', 'プロセス'],
          english: 'procedures',
          type: 'array'
        },
        {
          japanese: ['サポート', 'サポート情報', 'ヘルプ', '支援'],
          english: 'support',
          type: 'string'
        },
        {
          japanese: ['規則', 'ルール', '規約', '規定'],
          english: 'rules',
          type: 'array'
        },
        {
          japanese: ['条件', '条項', '約款', '規約'],
          english: 'terms',
          type: 'string'
        },
        {
          japanese: ['Q&A', '質問', 'FAQ', 'よくある質問', '質疑応答'],
          english: 'qa',
          type: 'array'
        }
      ]
    }
  },
  {
    id: 'users',
    name: '利用者管理',
    icon: '•',
    href: '/admin/users',
    description: 'ユーザー管理',
    category: 'other',
    aiChatMetadata: {
      collectionName: 'users',
      searchByCompany: true,
      searchByUser: false,
      defaultLimit: 20,
      searchableFields: [
        {
          fieldName: 'displayName',
          japaneseNames: ['名前', '表示名', '氏名', 'ユーザー名'],
          searchable: true,
          weight: 10
  },
  {
          fieldName: 'email',
          japaneseNames: ['メール', 'メールアドレス', 'Eメール'],
          searchable: true,
          weight: 8
        },
        {
          fieldName: 'department',
          japaneseNames: ['部署', '部門', 'セクション'],
          searchable: true,
          weight: 5
        },
        {
          fieldName: 'position',
          japaneseNames: ['役職', 'ポジション', '職位'],
          searchable: true,
          weight: 3
        }
      ],
      fieldMappings: []
    }
  },
  {
    id: 'company-info',
    name: '会社情報',
    icon: '🏢',
    href: '/admin/company',
    description: '会社の基本情報',
    category: 'other',
    aiChatMetadata: {
      collectionName: 'companyInfo',
      searchByCompany: true,
      searchByUser: false,
      defaultLimit: 1,
      searchableFields: [
        {
          fieldName: 'name',
          japaneseNames: ['会社名', '名称', '企業名'],
          searchable: true,
          weight: 10
        },
        {
          fieldName: 'address',
          japaneseNames: ['住所', '所在地', 'アドレス'],
          searchable: true,
          weight: 5
        },
        {
          fieldName: 'phone',
          japaneseNames: ['電話', '電話番号', 'TEL'],
          searchable: true,
          weight: 3
        }
      ],
      fieldMappings: []
    }
  },
  {
    id: 'invoice',
    name: '請求書発行',
    icon: '🧾',
    href: '/admin/invoice',
    description: '請求書の作成と発行',
    category: 'other',
    aiChatMetadata: {
      collectionName: 'invoices',
      searchByCompany: true,
      searchByUser: false,
      defaultLimit: 20,
      searchableFields: [
        {
          fieldName: 'invoiceNumber',
          japaneseNames: ['請求書番号', '番号', 'インボイス番号'],
          searchable: true,
          weight: 10
  },
  {
          fieldName: 'customerName',
          japaneseNames: ['顧客名', '顧客', '取引先'],
          searchable: true,
          weight: 8
        },
        {
          fieldName: 'totalAmount',
          japaneseNames: ['合計金額', '金額', '総額'],
          searchable: true,
          weight: 5
        },
        {
          fieldName: 'issueDate',
          japaneseNames: ['発行日', '発行日付', '日付'],
          searchable: true,
          weight: 3
        },
        {
          fieldName: 'dueDate',
          japaneseNames: ['支払期限', '期限', '期日'],
          searchable: true,
          weight: 3
        }
      ],
      fieldMappings: []
    }
  },
  {
    id: 'calendar',
    name: 'カレンダー',
    icon: '📅',
    href: '/calendar',
    description: '予定の管理',
    category: 'other',
    aiChatMetadata: {
      collectionName: 'events',
      searchByCompany: true,
      searchByUser: false,
      defaultLimit: 20,
      searchableFields: [
        {
          fieldName: 'title',
          japaneseNames: ['タイトル', '予定名', '件名'],
          searchable: true,
          weight: 10
        },
        {
          fieldName: 'description',
          japaneseNames: ['説明', '詳細', '内容'],
          searchable: true,
          weight: 5
        },
        {
          fieldName: 'location',
          japaneseNames: ['場所', 'ロケーション', '会場'],
          searchable: true,
          weight: 3
        },
        {
          fieldName: 'date',
          japaneseNames: ['日付', '日程', '予定日'],
          searchable: true,
          weight: 3
        }
      ],
      fieldMappings: []
    }
  },
  // 営業管理
  {
    id: 'sales-opportunity',
    name: '商談管理',
    icon: '🤝',
    href: '/sales/opportunities',
    description: '営業案件・商談の進捗管理',
    category: 'sales',
    aiChatMetadata: {
      collectionName: 'salesCases',
      searchByCompany: false,
      searchByUser: true,
      defaultLimit: 10,
      searchableFields: [
        {
          fieldName: 'title',
          japaneseNames: ['案件名', '商談名', 'タイトル', '件名'],
          searchable: true,
          weight: 10
        },
        {
          fieldName: 'customerName',
          japaneseNames: ['顧客名', '顧客', '取引先'],
          searchable: true,
          weight: 8
        },
        {
          fieldName: 'description',
          japaneseNames: ['概要', '説明', '詳細', '内容'],
          searchable: true,
          weight: 5
        },
        {
          fieldName: 'status',
          japaneseNames: ['ステータス', '状況', '状態'],
          searchable: true,
          weight: 3
        }
      ],
      fieldMappings: []
    }
  },
  {
    id: 'sales-lead',
    name: '見込み客管理',
    icon: '🎯',
    href: '/sales/leads',
    description: 'リード・見込み客の管理',
    category: 'sales',
    aiChatMetadata: {
      collectionName: 'leads',
      searchByCompany: true,
      searchByUser: false,
      defaultLimit: 20,
      searchableFields: [
        {
          fieldName: 'name',
          japaneseNames: ['名前', '見込み客名', '氏名'],
          searchable: true,
          weight: 10
        },
        {
          fieldName: 'company',
          japaneseNames: ['会社名', '企業名', '会社'],
          searchable: true,
          weight: 8
  },
  {
          fieldName: 'email',
          japaneseNames: ['メール', 'メールアドレス', 'Eメール'],
          searchable: true,
          weight: 5
        }
      ],
      fieldMappings: []
    }
  },
  {
    id: 'sales-activity',
    name: '営業活動管理',
    icon: '📞',
    href: '/sales/activities',
    description: '訪問記録・営業活動の記録',
    category: 'sales',
    aiChatMetadata: {
      collectionName: 'salesActivities',
      searchByCompany: false,
      searchByUser: true,
      defaultLimit: 10,
      searchableFields: [
        {
          fieldName: 'title',
          japaneseNames: ['タイトル', '活動内容', '件名'],
          searchable: true,
          weight: 10
        },
        {
          fieldName: 'customerName',
          japaneseNames: ['顧客名', '顧客', '取引先'],
          searchable: true,
          weight: 8
  },
  {
          fieldName: 'notes',
          japaneseNames: ['メモ', '詳細', '内容', '記録'],
          searchable: true,
          weight: 5
        }
      ],
      fieldMappings: []
    }
  },
  // 顧客管理
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
          japaneseNames: ['名前', '顧客名', '氏名', '担当者名'],
          searchable: true,
          weight: 10
        },
        {
          fieldName: 'company',
          japaneseNames: ['会社', '会社名', '企業名', '取引先'],
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
          japaneseNames: ['メモ', '備考', 'ノート', '記録'],
          searchable: true,
          weight: 2
        }
      ],
      fieldMappings: []
    }
  },
  {
    id: 'customer-list',
    name: 'リスト',
    icon: '📋',
    href: '/customers/list',
    description: '顧客リストの管理',
    category: 'customer',
    // customer-managementと同じメタデータを使用
    aiChatMetadata: {
      collectionName: 'customers',
      searchByCompany: true,
      searchByUser: false,
      defaultLimit: 20,
      searchableFields: [
        {
          fieldName: 'name',
          japaneseNames: ['名前', '顧客名', '氏名', '担当者名'],
          searchable: true,
          weight: 10
        },
        {
          fieldName: 'company',
          japaneseNames: ['会社', '会社名', '企業名', '取引先'],
          searchable: true,
          weight: 8
        },
        {
          fieldName: 'email',
          japaneseNames: ['メール', 'メールアドレス', 'Eメール'],
          searchable: true,
          weight: 5
        }
      ],
      fieldMappings: []
    }
  },
  // ドキュメント管理
  {
    id: 'template-management',
    name: 'テンプレート管理',
    icon: '📄',
    href: '/templates',
    description: '文書テンプレートの管理',
    category: 'document',
  },
  {
    id: 'minutes-management',
    name: '議事録管理',
    icon: '📝',
    href: '/minutes',
    description: '会議の議事録管理',
    category: 'document',
    aiChatMetadata: {
      collectionName: 'meetingNotes',
      searchByCompany: true,
      searchByUser: false,
      defaultLimit: 20,
      searchableFields: [
        {
          fieldName: 'title',
          japaneseNames: ['タイトル', '議題', '件名', '会議名'],
          searchable: true,
          weight: 10
        },
        {
          fieldName: 'notes',
          japaneseNames: ['議事録', '内容', '備考', '記録', 'メモ'],
          searchable: true,
          weight: 8
        },
        {
          fieldName: 'location',
          japaneseNames: ['場所', '会議室', 'ロケーション'],
          searchable: true,
          weight: 3
        }
      ],
      fieldMappings: []
    }
  },
  {
    id: 'document-management',
    name: 'ドキュメント管理',
    icon: '📚',
    href: '/documents',
    description: '各種ドキュメントの管理',
    category: 'document',
  },
];

// カテゴリごとにグループ化する関数
export function getMenuItemsByCategory(items: MenuItem[]): Record<string, MenuItem[]> {
  const grouped: Record<string, MenuItem[]> = {};
  
  items.forEach((item) => {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
    }
    grouped[item.category].push(item);
  });
  
  return grouped;
}

// カテゴリの順序に従ってグループ化されたメニュー項目を取得する関数
export function getMenuItemsByCategoryOrdered(items: MenuItem[]): Array<[string, MenuItem[]]> {
  const grouped = getMenuItemsByCategory(items);
  const ordered: Array<[string, MenuItem[]]> = [];
  
  CATEGORY_ORDER.forEach((category) => {
    if (grouped[category] && grouped[category].length > 0) {
      ordered.push([category, grouped[category]]);
    }
  });
  
  // カテゴリ順序に含まれていないカテゴリも追加
  Object.entries(grouped).forEach(([category, items]) => {
    if (!CATEGORY_ORDER.includes(category)) {
      ordered.push([category, items]);
    }
  });
  
  return ordered;
}
