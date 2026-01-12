export interface Template {
  id: string;
  title: string;
  description?: string;
  type: 'document' | 'form' | 'email' | 'contract' | 'other';
  status: 'active' | 'scheduled' | 'expired' | 'archived';
  category?: string;
  tags: string[];
  content: string;
  fields?: TemplateField[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  createdByName?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  views?: number;
  uses?: number;
  isFavorite?: boolean;
  fromRSS?: boolean;
  tabId?: string; // カスタムタブID
}

export interface TemplateField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  count: number;
  color?: string;
}

