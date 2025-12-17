// サイドバー設定関連の型定義

export interface AvailableMenuItem {
  id: string;              // 一意のID
  name: string;            // 表示名
  icon: string;            // アイコン（絵文字または文字）
  href: string;            // ルートパス
  category: MenuCategory;  // カテゴリ
  description: string;     // 説明
  requiresAuth?: boolean;  // 認証が必要か（デフォルト: true）
  requiredRole?: string;  // 必要なロール（admin, manager等、オプション）
  order?: number;         // カテゴリ内の表示順序
}

export type MenuCategory = 
  | 'sales'           // 営業管理
  | 'customer'        // 顧客管理
  | 'inventory'       // 在庫・発注管理
  | 'finance'         // 財務管理
  | 'pdca'            // PDCA管理
  | 'document'        // ドキュメント管理
  | 'project'          // プロジェクト管理
  | 'analytics'        // 分析・レポート
  | 'other';          // その他

export interface SidebarConfig {
  id: string;
  // デフォルトメニュー（固定、変更不可）
  commonMenuItems: SidebarMenuItem[];
  adminMenuItems: SidebarMenuItem[];
  // 有効化された追加メニュー項目（admin側で選択されたもの）
  enabledMenuItems: string[]; // AvailableMenuItemのIDの配列
  updatedAt: Date;
  updatedBy: string;
}

export interface SidebarMenuItem {
  id: string;
  name: string;
  icon: string;
  href: string;
  enabled: boolean;
  order: number;
}

// 利用可能なメニュー項目の候補プール（全モジュール）
export const AVAILABLE_MENU_ITEMS: AvailableMenuItem[] = [
  // ===== 営業管理 =====
  // 営業案件管理は顧客管理に統合されました
  
  // ===== 顧客管理 =====
  {
    id: 'customer-management',
    name: '顧客管理',
    icon: '👥',
    href: '/customers',
    category: 'customer',
    description: '顧客情報の管理',
    order: 1,
  },
  
  // ===== 在庫・発注管理 =====
  {
    id: 'inventory-management',
    name: '在庫管理',
    icon: '📦',
    href: '/inventory',
    category: 'inventory',
    description: '在庫の管理と追跡',
    order: 1,
  },
  {
    id: 'purchase-management',
    name: '発注管理',
    icon: '🛒',
    href: '/purchases',
    category: 'inventory',
    description: '発注情報の管理',
    order: 2,
  },
  
  // ===== 財務管理 =====
  {
    id: 'sales-quotes',
    name: '見積管理',
    icon: '💰',
    href: '/sales/quotes',
    category: 'finance',
    description: '見積書の作成と管理',
    order: 1,
  },
  {
    id: 'sales-orders',
    name: '受注管理',
    icon: '✅',
    href: '/sales/orders',
    category: 'finance',
    description: '受注情報の管理',
    order: 2,
  },
  {
    id: 'billing-management',
    name: '請求管理',
    icon: '🧾',
    href: '/billing',
    category: 'finance',
    description: '請求書の作成と管理',
    order: 3,
  },
  {
    id: 'expense-management',
    name: '経費管理',
    icon: '💳',
    href: '/expenses',
    category: 'finance',
    description: '経費の記録と管理',
    order: 4,
  },
  
  // ===== PDCA管理 =====
  {
    id: 'pdca-plan',
    name: '計画管理',
    icon: '📝',
    href: '/pdca/plan',
    category: 'pdca',
    description: '営業計画・目標設定',
    order: 1,
  },
  {
    id: 'pdca-do',
    name: '実行管理',
    icon: '🚀',
    href: '/pdca/do',
    category: 'pdca',
    description: '活動記録・タスク管理',
    order: 2,
  },
  {
    id: 'pdca-check',
    name: '評価管理',
    icon: '📊',
    href: '/pdca/check',
    category: 'pdca',
    description: '実績分析・KPI管理',
    order: 3,
  },
  {
    id: 'pdca-action',
    name: '改善管理',
    icon: '🔄',
    href: '/pdca/action',
    category: 'pdca',
    description: '改善アクション・次期計画',
    order: 4,
  },
  
  // ===== ドキュメント管理 =====
  {
    id: 'template-management',
    name: 'テンプレート管理',
    icon: '📄',
    href: '/templates',
    category: 'document',
    description: '文書テンプレートの作成と管理',
    order: 1,
  },
  {
    id: 'meeting-notes',
    name: '議事録管理',
    icon: '📝',
    href: '/meeting-notes',
    category: 'document',
    description: '会議議事録・打ち合わせ記録',
    order: 2,
  },
  {
    id: 'document-management',
    name: 'ドキュメント管理',
    icon: '📚',
    href: '/documents',
    category: 'document',
    description: '文書の保管・共有・検索',
    order: 3,
  },
  
  // ===== その他 =====
  {
    id: 'calendar',
    name: 'カレンダー',
    icon: '📅',
    href: '/calendar',
    category: 'other',
    description: 'スケジュール管理',
    order: 1,
  },
  {
    id: 'reports',
    name: 'レポート',
    icon: '📈',
    href: '/reports',
    category: 'other',
    description: '各種レポートの生成',
    order: 2,
  },
  {
    id: 'analytics-dashboard',
    name: '分析ダッシュボード',
    icon: '📊',
    href: '/analytics',
    category: 'analytics',
    description: 'データ分析と可視化',
    order: 1,
  },
];

// カテゴリの表示名
export const CATEGORY_NAMES: Record<MenuCategory, string> = {
  sales: '営業管理',
  customer: '顧客管理',
  inventory: '在庫・発注管理',
  finance: '財務管理',
  pdca: 'PDCA管理',
  document: 'ドキュメント管理',
  project: 'プロジェクト管理',
  analytics: '分析・レポート',
  other: 'その他',
};

// カテゴリごとにグループ化
export const getMenuItemsByCategory = (items: AvailableMenuItem[]): Record<MenuCategory, AvailableMenuItem[]> => {
  const grouped: Record<MenuCategory, AvailableMenuItem[]> = {
    sales: [],
    customer: [],
    inventory: [],
    finance: [],
    pdca: [],
    document: [],
    project: [],
    analytics: [],
    other: [],
  };
  
  items.forEach(item => {
    if (grouped[item.category]) {
      grouped[item.category].push(item);
    }
  });
  
  // 各カテゴリ内でorder順にソート
  Object.keys(grouped).forEach(category => {
    grouped[category as MenuCategory].sort((a, b) => (a.order || 0) - (b.order || 0));
  });
  
  return grouped;
};



