// BFFの型定義：アプリの「意味」を表現

export type EntityType = 'string' | 'number' | 'date' | 'enum' | 'boolean' | 'array' | 'object';

export type PageEntity = {
  id: string;
  label: string;
  type: EntityType;
  description?: string;
  enumValues?: string[];
};

export type PageOperation = {
  id: string;
  label: string;
  description: string;
  requires?: string[]; // 必要なentityのid
};

export type PageContext = {
  page: string;
  description: string;
  entities: PageEntity[];
  operations: PageOperation[];
  keywords: string[]; // このページに関連するキーワード
  url?: string; // このページへのURL
};

export type AppKnowledge = {
  pages: PageContext[];
};


