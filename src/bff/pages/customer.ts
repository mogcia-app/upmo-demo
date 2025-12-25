import { PageContext } from '../types';

export function getCustomerPageContext(): PageContext {
  return {
    page: 'customer',
    description: '顧客管理ページ。顧客情報の登録・編集・検索ができます。',
    entities: [
      {
        id: 'name',
        label: '顧客名',
        type: 'string',
        description: '顧客の氏名'
      },
      {
        id: 'company',
        label: '会社名',
        type: 'string',
        description: '顧客の所属会社名'
      },
      {
        id: 'email',
        label: 'メールアドレス',
        type: 'string',
        description: '顧客の連絡先メールアドレス'
      },
      {
        id: 'phone',
        label: '電話番号',
        type: 'string',
        description: '顧客の連絡先電話番号'
      },
      {
        id: 'status',
        label: 'ステータス',
        type: 'enum',
        description: '顧客の契約状態',
        enumValues: ['active', 'prospect', 'inactive']
      },
      {
        id: 'notes',
        label: 'メモ',
        type: 'string',
        description: '顧客に関する備考・メモ'
      }
    ],
    operations: [
      {
        id: 'list',
        label: '顧客一覧を見る',
        description: '登録されている顧客の一覧を表示します'
      },
      {
        id: 'search',
        label: '顧客を検索する',
        description: '顧客名・会社名・メールアドレスで検索します',
        requires: ['name', 'company', 'email']
      },
      {
        id: 'view',
        label: '顧客詳細を見る',
        description: '特定の顧客の詳細情報を表示します',
        requires: ['name']
      },
      {
        id: 'update-status',
        label: 'ステータスを変更する',
        description: '顧客のステータス（アクティブ・見込み客・非アクティブ）を変更します',
        requires: ['name', 'status']
      }
    ],
    keywords: ['顧客', 'お客様', 'クライアント', 'customer', 'client'],
    url: '/customers'
  };
}


