// BFF集約関数：アプリ全体の「知識」を返す
import { AppKnowledge } from './types';
import { getCustomerPageContext } from './pages/customer';
import { getSalesPageContext } from './pages/sales';
import { getTodoPageContext } from './pages/todo';
import { getMeetingPageContext } from './pages/meeting';
import { getEventPageContext } from './pages/event';
import { getDocumentPageContext } from './pages/document';
import { getProgressPageContext } from './pages/progress';

export function getAppKnowledge(): AppKnowledge {
  return {
    pages: [
      getCustomerPageContext(),
      getSalesPageContext(),
      getTodoPageContext(),
      getMeetingPageContext(),
      getEventPageContext(),
      getDocumentPageContext(),
      getProgressPageContext(),
    ]
  };
}

// キーワードからページを特定
export function findPageByKeyword(keyword: string): string | null {
  const knowledge = getAppKnowledge();
  const keywordLower = keyword.toLowerCase();
  
  for (const page of knowledge.pages) {
    if (page.keywords.some(k => keywordLower.includes(k.toLowerCase()))) {
      return page.page;
    }
  }
  
  return null;
}

// ページIDからページコンテキストを取得
export function getPageContext(pageId: string) {
  const knowledge = getAppKnowledge();
  return knowledge.pages.find(p => p.page === pageId) || null;
}





