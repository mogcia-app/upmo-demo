// 顧客リストの型定義

export type ColumnType = 'text' | 'dropdown';

export interface DropdownOption {
  id: string;
  label: string;
}

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  options?: DropdownOption[]; // typeが'dropdown'の場合のみ
  order: number;
}

export interface CustomerListRow {
  id: string;
  [key: string]: any; // 動的な列の値
}

export interface CustomerListTab {
  id: string;
  name: string;
  columns: Column[];
  rows: CustomerListRow[];
  userId: string;
  companyName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  duplicateRows: Array<{
    rowId: string;
    duplicateWith: string[];
    fields: string[];
  }>;
}

