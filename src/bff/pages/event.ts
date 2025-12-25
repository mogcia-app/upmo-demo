import { PageContext } from '../types';

export function getEventPageContext(): PageContext {
  return {
    page: 'event',
    description: 'カレンダー・予定管理ページ。イベントの作成・検索・管理ができます。',
    entities: [
      {
        id: 'title',
        label: 'イベント名',
        type: 'string',
        description: 'イベントのタイトル'
      },
      {
        id: 'date',
        label: '日付',
        type: 'date',
        description: 'イベントの開催日'
      },
      {
        id: 'time',
        label: '時間',
        type: 'string',
        description: 'イベントの開催時間'
      },
      {
        id: 'location',
        label: '場所',
        type: 'string',
        description: 'イベントの開催場所'
      },
      {
        id: 'description',
        label: '説明',
        type: 'string',
        description: 'イベントの詳細説明'
      }
    ],
    operations: [
      {
        id: 'list',
        label: '予定一覧を見る',
        description: '登録されている予定の一覧を表示します'
      },
      {
        id: 'search',
        label: '予定を検索する',
        description: 'イベント名・説明で検索します',
        requires: ['title', 'description']
      },
      {
        id: 'view',
        label: '予定詳細を見る',
        description: '特定の予定の詳細情報を表示します',
        requires: ['title']
      },
      {
        id: 'filter-by-date',
        label: '日付で絞り込む',
        description: '開催日で予定を絞り込みます',
        requires: ['date']
      }
    ],
    keywords: ['予定', 'イベント', 'カレンダー', 'スケジュール', 'event', 'calendar', 'schedule'],
    url: '/calendar'
  };
}


