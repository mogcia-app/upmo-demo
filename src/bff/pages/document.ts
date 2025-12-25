import { PageContext } from '../types';

export function getDocumentPageContext(): PageContext {
  return {
    page: 'document',
    description: '社内ドキュメント管理ページ。社内文書・マニュアル・契約書などを管理できます。',
    entities: [
      {
        id: 'title',
        label: 'タイトル',
        type: 'string',
        description: 'ドキュメントのタイトル'
      },
      {
        id: 'sections',
        label: 'セクション',
        type: 'object',
        description: 'ドキュメントのセクション構成'
      }
    ],
    operations: [
      {
        id: 'list',
        label: 'ドキュメント一覧を見る',
        description: '登録されているドキュメントの一覧を表示します'
      },
      {
        id: 'search',
        label: 'ドキュメントを検索する',
        description: 'タイトル・内容で検索します',
        requires: ['title']
      },
      {
        id: 'view',
        label: 'ドキュメント詳細を見る',
        description: '特定のドキュメントの内容を表示します',
        requires: ['title']
      }
    ],
    keywords: ['文書', 'ドキュメント', '資料', '契約書', 'document', 'manual', 'マニュアル', '契約', '規約', '手順書', 'Signal'],
    url: '/admin/contracts'
  };
}


