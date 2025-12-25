import { PageContext } from '../types';

export function getTodoPageContext(): PageContext {
  return {
    page: 'todo',
    description: 'タスク管理ページ。タスクの作成・進捗管理・完了処理ができます。',
    entities: [
      {
        id: 'title',
        label: 'タスク名',
        type: 'string',
        description: 'タスクのタイトル'
      },
      {
        id: 'description',
        label: '説明',
        type: 'string',
        description: 'タスクの詳細説明'
      },
      {
        id: 'status',
        label: 'ステータス',
        type: 'enum',
        description: 'タスクの完了状態',
        enumValues: ['pending', 'in_progress', 'completed', 'cancelled']
      },
      {
        id: 'priority',
        label: '優先度',
        type: 'enum',
        description: 'タスクの優先度',
        enumValues: ['low', 'medium', 'high', 'urgent']
      },
      {
        id: 'dueDate',
        label: '期限',
        type: 'date',
        description: 'タスクの期限日'
      }
    ],
    operations: [
      {
        id: 'list',
        label: 'タスク一覧を見る',
        description: '登録されているタスクの一覧を表示します'
      },
      {
        id: 'search',
        label: 'タスクを検索する',
        description: 'タスク名・説明で検索します',
        requires: ['title', 'description']
      },
      {
        id: 'view',
        label: 'タスク詳細を見る',
        description: '特定のタスクの詳細情報を表示します',
        requires: ['title']
      },
      {
        id: 'update-status',
        label: 'ステータスを更新する',
        description: 'タスクの完了状態を更新します',
        requires: ['title', 'status']
      },
      {
        id: 'filter-by-priority',
        label: '優先度で絞り込む',
        description: '優先度（低・中・高・緊急）でタスクを絞り込みます',
        requires: ['priority']
      },
      {
        id: 'filter-by-due-date',
        label: '期限で絞り込む',
        description: '期限日でタスクを絞り込みます',
        requires: ['dueDate']
      }
    ],
    keywords: ['タスク', 'todo', 'やること', 'やる事', 'task', 'todoリスト'],
    url: '/todo'
  };
}


