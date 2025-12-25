import { PageContext } from '../types';

export function getSalesPageContext(): PageContext {
  return {
    page: 'sales',
    description: '営業案件管理ページ。営業案件の作成・進捗管理・成約管理ができます。',
    entities: [
      {
        id: 'title',
        label: '案件名',
        type: 'string',
        description: '営業案件のタイトル'
      },
      {
        id: 'customerName',
        label: '顧客名',
        type: 'string',
        description: '案件に関連する顧客名'
      },
      {
        id: 'customerCompany',
        label: '顧客会社',
        type: 'string',
        description: '案件に関連する顧客の会社名'
      },
      {
        id: 'status',
        label: 'ステータス',
        type: 'enum',
        description: '案件の進行状況',
        enumValues: ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
      },
      {
        id: 'estimatedValue',
        label: '見積金額',
        type: 'number',
        description: '案件の見積もり金額（円）'
      },
      {
        id: 'probability',
        label: '成約確率',
        type: 'number',
        description: '成約の見込み確率（%）'
      },
      {
        id: 'expectedCloseDate',
        label: '予定クロージング日',
        type: 'date',
        description: '成約予定日'
      },
      {
        id: 'description',
        label: '概要',
        type: 'string',
        description: '案件の詳細説明'
      }
    ],
    operations: [
      {
        id: 'list',
        label: '営業案件一覧を見る',
        description: '登録されている営業案件の一覧を表示します'
      },
      {
        id: 'search',
        label: '案件を検索する',
        description: '案件名・顧客名で検索します',
        requires: ['title', 'customerName']
      },
      {
        id: 'view',
        label: '案件詳細を見る',
        description: '特定の案件の詳細情報を表示します',
        requires: ['title']
      },
      {
        id: 'update-status',
        label: 'ステータスを更新する',
        description: '案件の進行状況を更新します',
        requires: ['title', 'status']
      }
    ],
    keywords: ['案件', '営業', 'セールス', 'sales', 'case', 'opportunity'],
    url: '/sales/cases'
  };
}


