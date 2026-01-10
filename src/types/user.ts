/**
 * 統一されたユーザースキーマの型定義
 * 
 * この型定義は、admin側から追加したユーザーと、
 * ツール内の「利用者招待」から追加したユーザーの両方に適用されます。
 */

import { Timestamp } from 'firebase-admin/firestore';

/**
 * ユーザーのロール
 */
export type UserRole = 'admin' | 'manager' | 'user';

/**
 * ユーザーのステータス
 */
export type UserStatus = 'active' | 'inactive' | 'suspended';

/**
 * 統一されたユーザースキーマ
 * 
 * すべてのユーザー（admin側から追加、利用者招待から追加）が
 * このスキーマに準拠する必要があります。
 */
export interface User {
  // 基本情報
  id: string;                    // ドキュメントID（Firebase Auth UID）
  email: string;                  // メールアドレス（必須）
  displayName: string;            // 表示名（必須）
  
  // 会社・組織情報
  companyName: string;           // 会社名（必須）
  
  // 権限・ステータス
  role: UserRole;                // ロール（必須、デフォルト: 'user'）
  status: UserStatus;            // ステータス（必須、デフォルト: 'active'）
  
  // 作成・更新情報
  createdAt: Timestamp | Date;   // 作成日時（必須）
  createdBy?: string | null;     // 作成者のUID（オプション、admin側から作成した場合はnullでも可）
  updatedAt?: Timestamp | Date;  // 更新日時（オプション、更新時に設定）
  
  // オプションフィールド
  department?: string;           // 部署（オプション、デフォルト: ''）
  position?: string;             // 役職（オプション、デフォルト: ''）
  photoURL?: string;             // プロフィール画像URL（オプション）
  subscriptionType?: string;     // サブスクリプションタイプ（オプション、admin側で設定）
  lastLoginAt?: Timestamp | Date; // 最終ログイン日時（オプション）
}

/**
 * ユーザー作成時のデフォルト値
 */
export const DEFAULT_USER_VALUES: Partial<User> = {
  role: 'user',
  status: 'active',
  department: '',
  position: '',
  createdBy: null,
};

/**
 * ユーザー作成時の必須フィールド
 */
export const REQUIRED_USER_FIELDS: (keyof User)[] = [
  'email',
  'displayName',
  'companyName',
  'role',
  'status',
  'createdAt',
];

/**
 * ユーザーデータのバリデーション
 */
export function validateUserData(data: Partial<User>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of REQUIRED_USER_FIELDS) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(`${field}は必須です`);
    }
  }

  // emailの形式チェック
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('有効なメールアドレスを入力してください');
  }

  // roleの値チェック
  if (data.role && !['admin', 'manager', 'user'].includes(data.role)) {
    errors.push('roleは admin, manager, user のいずれかである必要があります');
  }

  // statusの値チェック
  if (data.status && !['active', 'inactive', 'suspended'].includes(data.status)) {
    errors.push('statusは active, inactive, suspended のいずれかである必要があります');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * ユーザーデータを統一スキーマに変換（既存データのマイグレーション用）
 */
export function normalizeUserData(data: any): Partial<User> {
  const normalized: Partial<User> = {
    ...data,
  };

  // デフォルト値の適用
  if (!normalized.status) {
    normalized.status = DEFAULT_USER_VALUES.status as UserStatus;
  }
  if (normalized.department === undefined) {
    normalized.department = DEFAULT_USER_VALUES.department;
  }
  if (normalized.position === undefined) {
    normalized.position = DEFAULT_USER_VALUES.position;
  }
  if (normalized.createdBy === undefined) {
    normalized.createdBy = DEFAULT_USER_VALUES.createdBy;
  }
  if (!normalized.updatedAt && normalized.createdAt) {
    normalized.updatedAt = normalized.createdAt;
  }

  return normalized;
}





