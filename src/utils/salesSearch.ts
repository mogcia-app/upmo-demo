// 営業案件と進捗メモの検索ユーティリティ

import { collection, query, getDocs, orderBy, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SalesCase, ProgressNote, SearchContext } from '@/types/sales';

/**
 * キーワードから関連する案件を検索
 */
export async function searchSalesCases(
  searchQuery: string,
  userId?: string,
  maxResults: number = 5
): Promise<SalesCase[]> {
  if (!db) {
    console.warn('Firestore is not initialized');
    return [];
  }

  try {
    const queryLower = searchQuery.toLowerCase();
    const keywords = extractKeywords(searchQuery);
    
    // 案件コレクションを取得
    let q = query(collection(db, 'salesCases'), orderBy('updatedAt', 'desc'));
    
    // ユーザーIDでフィルタ（指定されている場合）
    if (userId) {
      q = query(q, where('userId', '==', userId));
    }
    
    const querySnapshot = await getDocs(q);
    const results: Array<{ case: SalesCase; score: number }> = [];
    
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      const caseData: SalesCase = {
        id: doc.id,
        title: data.title || '',
        customerName: data.customerName || '',
        customerCompany: data.customerCompany,
        status: data.status || 'prospecting',
        stage: data.stage,
        expectedCloseDate: data.expectedCloseDate?.toDate(),
        estimatedValue: data.estimatedValue,
        probability: data.probability,
        description: data.description,
        tags: data.tags || [],
        assignedTo: data.assignedTo,
        assignedToName: data.assignedToName,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        userId: data.userId || ''
      };
      
      // 関連度スコアを計算
      const score = calculateCaseRelevanceScore(caseData, queryLower, keywords);
      
      if (score > 0) {
        results.push({ case: caseData, score });
      }
    }
    
    // スコア順でソートして上位N件を返す
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(item => item.case);
      
  } catch (error) {
    console.error('Error searching sales cases:', error);
    return [];
  }
}

/**
 * キーワードから関連する進捗メモを検索
 */
export async function searchProgressNotes(
  searchQuery: string,
  userId?: string,
  caseId?: string,
  maxResults: number = 5
): Promise<ProgressNote[]> {
  if (!db) {
    console.warn('Firestore is not initialized');
    return [];
  }

  try {
    const queryLower = searchQuery.toLowerCase();
    const keywords = extractKeywords(searchQuery);
    
    // 進捗メモコレクションを取得
    let q = query(collection(db, 'progressNotes'), orderBy('updatedAt', 'desc'));
    
    // ユーザーIDでフィルタ（指定されている場合）
    if (userId) {
      q = query(q, where('userId', '==', userId));
    }
    
    // 案件IDでフィルタ（指定されている場合）
    if (caseId) {
      q = query(q, where('caseId', '==', caseId));
    }
    
    const querySnapshot = await getDocs(q);
    const results: Array<{ note: ProgressNote; score: number }> = [];
    
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      const noteData: ProgressNote = {
        id: doc.id,
        caseId: data.caseId,
        caseTitle: data.caseTitle,
        title: data.title || '',
        content: data.content || '',
        type: data.type || 'other',
        date: data.date?.toDate() || new Date(),
        participants: data.participants || [],
        nextActions: data.nextActions || [],
        risks: data.risks || [],
        tags: data.tags || [],
        priority: data.priority,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        userId: data.userId || ''
      };
      
      // 関連度スコアを計算
      const score = calculateNoteRelevanceScore(noteData, queryLower, keywords);
      
      if (score > 0) {
        results.push({ note: noteData, score });
      }
    }
    
    // スコア順でソートして上位N件を返す
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(item => item.note);
      
  } catch (error) {
    console.error('Error searching progress notes:', error);
    return [];
  }
}

/**
 * 検索クエリからキーワードを抽出
 */
function extractKeywords(text: string): string[] {
  const textLower = text.toLowerCase();
  
  // 助詞や接続詞を除去
  const cleanedText = textLower
    .replace(/[のをについて教えてとは]/g, ' ')
    .replace(/[、。！？]/g, ' ')
    .trim();
  
  // 空白で分割
  const words = cleanedText.split(/\s+/).filter(word => word.length > 1);
  
  // 元のクエリも含める
  return [...new Set([textLower, ...words])];
}

/**
 * 案件の関連度スコアを計算
 */
function calculateCaseRelevanceScore(
  salesCase: SalesCase,
  queryLower: string,
  keywords: string[]
): number {
  let score = 0;
  
  // 案件名でのマッチ
  const titleLower = salesCase.title.toLowerCase();
  if (titleLower.includes(queryLower)) {
    score += 10;
  }
  for (const keyword of keywords) {
    if (titleLower.includes(keyword)) {
      score += 5;
    }
  }
  
  // 顧客名でのマッチ
  const customerLower = salesCase.customerName.toLowerCase();
  if (customerLower.includes(queryLower)) {
    score += 8;
  }
  for (const keyword of keywords) {
    if (customerLower.includes(keyword)) {
      score += 4;
    }
  }
  
  // 顧客会社名でのマッチ
  if (salesCase.customerCompany) {
    const companyLower = salesCase.customerCompany.toLowerCase();
    if (companyLower.includes(queryLower)) {
      score += 8;
    }
    for (const keyword of keywords) {
      if (companyLower.includes(keyword)) {
        score += 4;
      }
    }
  }
  
  // 説明でのマッチ
  if (salesCase.description) {
    const descLower = salesCase.description.toLowerCase();
    if (descLower.includes(queryLower)) {
      score += 5;
    }
    for (const keyword of keywords) {
      if (descLower.includes(keyword)) {
        score += 2;
      }
    }
  }
  
  // タグでのマッチ
  if (salesCase.tags) {
    for (const tag of salesCase.tags) {
      const tagLower = tag.toLowerCase();
      for (const keyword of keywords) {
        if (tagLower.includes(keyword)) {
          score += 3;
        }
      }
    }
  }
  
  // ステータスでのマッチ（「進行中」「クローズ」などの検索）
  if (queryLower.includes('進行中') || queryLower.includes('進行')) {
    if (['prospecting', 'qualification', 'proposal', 'negotiation'].includes(salesCase.status)) {
      score += 5;
    }
  }
  if (queryLower.includes('クローズ') || queryLower.includes('完了')) {
    if (['closed_won', 'closed_lost'].includes(salesCase.status)) {
      score += 5;
    }
  }
  
  return score;
}

/**
 * 進捗メモの関連度スコアを計算
 */
function calculateNoteRelevanceScore(
  note: ProgressNote,
  queryLower: string,
  keywords: string[]
): number {
  let score = 0;
  
  // タイトルでのマッチ
  const titleLower = note.title.toLowerCase();
  if (titleLower.includes(queryLower)) {
    score += 10;
  }
  for (const keyword of keywords) {
    if (titleLower.includes(keyword)) {
      score += 5;
    }
  }
  
  // 内容でのマッチ
  const contentLower = note.content.toLowerCase();
  if (contentLower.includes(queryLower)) {
    score += 8;
  }
  for (const keyword of keywords) {
    // キーワードが内容に含まれる回数をカウント
    const matches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
    score += matches * 2;
  }
  
  // 案件名でのマッチ
  if (note.caseTitle) {
    const caseTitleLower = note.caseTitle.toLowerCase();
    if (caseTitleLower.includes(queryLower)) {
      score += 6;
    }
    for (const keyword of keywords) {
      if (caseTitleLower.includes(keyword)) {
        score += 3;
      }
    }
  }
  
  // 次アクションでのマッチ
  if (note.nextActions) {
    for (const action of note.nextActions) {
      const actionLower = action.toLowerCase();
      if (actionLower.includes(queryLower)) {
        score += 5;
      }
      for (const keyword of keywords) {
        if (actionLower.includes(keyword)) {
          score += 3;
        }
      }
    }
  }
  
  // リスクでのマッチ
  if (note.risks) {
    for (const risk of note.risks) {
      const riskLower = risk.toLowerCase();
      if (riskLower.includes(queryLower)) {
        score += 5;
      }
      for (const keyword of keywords) {
        if (riskLower.includes(keyword)) {
          score += 3;
        }
      }
    }
  }
  
  // タグでのマッチ
  if (note.tags) {
    for (const tag of note.tags) {
      const tagLower = tag.toLowerCase();
      for (const keyword of keywords) {
        if (tagLower.includes(keyword)) {
          score += 3;
        }
      }
    }
  }
  
  // 優先度でのマッチ
  if (queryLower.includes('重要') || queryLower.includes('緊急')) {
    if (note.priority === 'high') {
      score += 5;
    }
  }
  
  return score;
}

/**
 * 統合検索：文書、案件、進捗メモを一度に検索
 */
export async function searchAllContexts(
  searchQuery: string,
  userId?: string
): Promise<SearchContext> {
  const [salesCases, progressNotes] = await Promise.all([
    searchSalesCases(searchQuery, userId, 3),
    searchProgressNotes(searchQuery, userId, undefined, 3)
  ]);
  
  return {
    documents: [], // 文書は別の関数で検索される
    salesCases: salesCases.map(c => ({
      id: c.id,
      title: c.title,
      customerName: c.customerName,
      status: c.status,
      description: c.description,
      updatedAt: c.updatedAt
    })),
    progressNotes: progressNotes.map(n => ({
      id: n.id,
      title: n.title,
      content: n.content,
      caseTitle: n.caseTitle,
      date: n.date,
      type: n.type,
      updatedAt: n.updatedAt
    }))
  };
}

























