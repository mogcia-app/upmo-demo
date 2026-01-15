// 営業案件と進捗メモの型定義

export interface SalesCase {
  id: string;
  title: string; // 案件名
  customerName: string; // 顧客名
  customerCompany?: string; // 顧客会社名
  status: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'; // 案件ステータス
  stage?: string; // 商談ステージ
  expectedCloseDate?: Date; // 予定クロージング日
  estimatedValue?: number; // 見積金額
  probability?: number; // 成約確率（0-100）
  description?: string; // 案件概要
  tags?: string[]; // タグ
  assignedTo?: string; // 担当者ID
  assignedToName?: string; // 担当者名
  createdAt: Date;
  updatedAt: Date;
  userId: string; // 作成者ID
}

export interface ProgressNoteReply {
  id: string;
  content: string; // 返信内容
  userId: string; // 返信者ID
  userName: string; // 返信者名
  createdAt: Date; // 返信日時
}

export interface ProgressNote {
  id: string;
  caseId?: string; // 関連する案件ID（オプション）
  caseTitle?: string; // 案件名（検索用）
  title: string; // メモタイトル
  content: string; // メモ内容
  type: 'meeting' | 'call' | 'email' | 'document' | 'other'; // メモタイプ
  date: Date; // メモ日付
  participants?: string[]; // 参加者・関係者
  nextActions?: string[]; // 次アクション
  risks?: string[]; // リスク・懸念事項
  tags?: string[]; // タグ
  priority?: 'high' | 'medium' | 'low'; // 優先度
  replies?: ProgressNoteReply[]; // 返信一覧
  createdAt: Date;
  updatedAt: Date;
  userId: string; // 作成者ID
}

// 検索結果用の型
export interface SearchContext {
  documents: Array<{
    title: string;
    sections: Record<string, any>;
    type: string;
  }>;
  salesCases: Array<{
    id: string;
    title: string;
    customerName: string;
    status: string;
    description?: string;
    updatedAt: Date;
  }>;
  progressNotes: Array<{
    id: string;
    title: string;
    content: string;
    caseTitle?: string;
    date: Date;
    type: string;
    updatedAt: Date;
  }>;
}

// 営業活動の型定義
export interface SalesActivity {
  id: string;
  title: string; // 活動タイトル
  type: 'visit' | 'call' | 'email' | 'meeting' | 'presentation' | 'other'; // 活動タイプ
  companyName?: string; // 会社名
  companyData?: Record<string, any>; // 顧客リストから取得した会社情報（列データ）
  activityDate: Date; // 活動日
  participants?: string[]; // 参加者ID
  participantNames?: string[]; // 参加者名
  description?: string; // 活動内容
  outcome?: string; // 結果・成果
  nextAction?: string; // 次アクション
  tags?: string[]; // タグ
  createdAt: Date;
  updatedAt: Date;
  userId: string; // 作成者ID
  companyNameForSharing?: string; // 会社名（チーム共有用）
}




















