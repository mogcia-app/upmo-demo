import { PageContext } from '../types';

export function getProgressPageContext(): PageContext {
  return {
    page: 'progress',
    description: '進捗メモ管理ページ。営業案件の進捗を記録・管理できます。',
    entities: [
      {
        id: 'title',
        label: 'タイトル',
        type: 'string',
        description: '進捗メモのタイトル'
      },
      {
        id: 'date',
        label: '日付',
        type: 'date',
        description: 'メモの記録日'
      },
      {
        id: 'content',
        label: '内容',
        type: 'string',
        description: '進捗メモの内容'
      },
      {
        id: 'caseTitle',
        label: '関連案件',
        type: 'string',
        description: '関連する営業案件のタイトル'
      },
      {
        id: 'nextActions',
        label: '次アクション',
        type: 'array',
        description: '次に取るべきアクションのリスト'
      },
      {
        id: 'risks',
        label: 'リスク・懸念',
        type: 'array',
        description: 'リスクや懸念事項のリスト'
      }
    ],
    operations: [
      {
        id: 'list',
        label: '進捗メモ一覧を見る',
        description: '登録されている進捗メモの一覧を表示します'
      },
      {
        id: 'search',
        label: '進捗メモを検索する',
        description: 'タイトル・内容で検索します',
        requires: ['title', 'content']
      },
      {
        id: 'view',
        label: '進捗メモ詳細を見る',
        description: '特定の進捗メモの詳細情報を表示します',
        requires: ['title']
      },
      {
        id: 'filter-by-case',
        label: '案件で絞り込む',
        description: '関連する営業案件で進捗メモを絞り込みます',
        requires: ['caseTitle']
      }
    ],
    keywords: ['メモ', '進捗', 'プログレス', 'progress', '進捗メモ', 'note'],
    url: '/sales/progress-notes'
  };
}


