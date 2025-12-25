import { PageContext } from '../types';

export function getMeetingPageContext(): PageContext {
  return {
    page: 'meeting',
    description: '議事録管理ページ。会議の議事録を記録・検索・管理できます。',
    entities: [
      {
        id: 'title',
        label: '議題',
        type: 'string',
        description: '会議の議題・タイトル'
      },
      {
        id: 'meetingDate',
        label: '日付',
        type: 'date',
        description: '会議の開催日'
      },
      {
        id: 'meetingTime',
        label: '時間',
        type: 'string',
        description: '会議の開催時間'
      },
      {
        id: 'location',
        label: '場所',
        type: 'string',
        description: '会議の開催場所'
      },
      {
        id: 'assignee',
        label: '担当者',
        type: 'string',
        description: '議事録の担当者'
      },
      {
        id: 'notes',
        label: '備考',
        type: 'string',
        description: '会議の議事録内容'
      },
      {
        id: 'actionItems',
        label: 'アクション項目',
        type: 'array',
        description: '会議で決定したアクション項目のリスト'
      }
    ],
    operations: [
      {
        id: 'list',
        label: '議事録一覧を見る',
        description: '登録されている議事録の一覧を表示します'
      },
      {
        id: 'search',
        label: '議事録を検索する',
        description: '議題・備考で検索します',
        requires: ['title', 'notes']
      },
      {
        id: 'view',
        label: '議事録詳細を見る',
        description: '特定の議事録の詳細情報を表示します',
        requires: ['title']
      },
      {
        id: 'filter-by-date',
        label: '日付で絞り込む',
        description: '開催日で議事録を絞り込みます',
        requires: ['meetingDate']
      }
    ],
    keywords: ['議事録', '会議', 'ミーティング', 'meeting', '議題', '会議録'],
    url: '/meeting-notes'
  };
}


