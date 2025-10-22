import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryText = searchParams.get('q');
    const docType = searchParams.get('type');
    
    if (!queryText) {
      return NextResponse.json({ error: '検索クエリが必要です' }, { status: 400 });
    }

    // 1. クエリ解析
    const searchQuery = analyzeQuery(queryText);
    
    // 2. 文書タイプ判定
    const targetDocType = docType || detectDocumentTypeFromQuery(queryText);
    
    // 3. 手動入力文書を検索
    const results = await searchManualDocuments(searchQuery, targetDocType);
    
    // 4. 構造化回答生成
    const structuredAnswer = generateStructuredAnswer(results, queryText);
    
    return NextResponse.json({
      success: true,
      query: queryText,
      documentType: targetDocType,
      answer: structuredAnswer,
      sources: results.map(r => r.title),
      documentCount: results.length
    });

  } catch (error) {
    console.error('Manual search error:', error);
    return NextResponse.json({ error: '検索に失敗しました' }, { status: 500 });
  }
}

// クエリ解析
function analyzeQuery(queryText: string) {
  const queryLower = queryText.toLowerCase();
  
  return {
    keywords: extractKeywords(queryText),
    intent: detectIntent(queryLower),
    priority: detectPriority(queryLower)
  };
}

// キーワード抽出
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const textLower = text.toLowerCase();
  
  // 助詞や接続詞を除去
  const cleanedText = textLower
    .replace(/[のをについて教えてとは]/g, ' ')
    .replace(/[、。！？]/g, ' ')
    .trim();
  
  // 空白で分割
  const words = cleanedText.split(/\s+/).filter(word => word.length > 1);
  
  // 元のクエリも含める
  keywords.push(textLower);
  keywords.push(...words);
  
  return [...new Set(keywords)]; // 重複除去
}

// 意図検出
function detectIntent(queryLower: string): string {
  if (queryLower.includes('料金') || queryLower.includes('価格') || queryLower.includes('費用')) {
    return 'pricing';
  }
  if (queryLower.includes('機能') || queryLower.includes('feature')) {
    return 'features';
  }
  if (queryLower.includes('手順') || queryLower.includes('流れ') || queryLower.includes('方法')) {
    return 'procedures';
  }
  if (queryLower.includes('規則') || queryLower.includes('規定') || queryLower.includes('ポリシー')) {
    return 'rules';
  }
  if (queryLower.includes('契約') || queryLower.includes('条項') || queryLower.includes('条件')) {
    return 'terms';
  }
  if (queryLower.includes('サポート') || queryLower.includes('支援')) {
    return 'support';
  }
  return 'general';
}

// 優先度検出
function detectPriority(queryLower: string): number {
  if (queryLower.includes('緊急') || queryLower.includes('重要')) return 3;
  if (queryLower.includes('詳細') || queryLower.includes('詳しく')) return 2;
  return 1;
}

// クエリから文書タイプ判定
function detectDocumentTypeFromQuery(queryText: string): string | null {
  const queryLower = queryText.toLowerCase();
  
  if (queryLower.includes('打ち合わせ') || queryLower.includes('資料') || queryLower.includes('meeting')) {
    return 'meeting';
  }
  if (queryLower.includes('規則') || queryLower.includes('policy') || queryLower.includes('規定')) {
    return 'policy';
  }
  if (queryLower.includes('契約') || queryLower.includes('contract') || queryLower.includes('規約')) {
    return 'contract';
  }
  if (queryLower.includes('マニュアル') || queryLower.includes('manual') || queryLower.includes('手順')) {
    return 'manual';
  }
  
  return null; // 全文書検索
}

// 手動入力文書検索
async function searchManualDocuments(searchQuery: any, docType: string | null) {
  let q = query(collection(db, 'manualDocuments'), orderBy('lastUpdated', 'desc'));
  
  // 文書タイプでフィルタ
  if (docType) {
    q = query(q, where('type', '==', docType));
  }
  
  const querySnapshot = await getDocs(q);
  const results: any[] = [];
  
  for (const doc of querySnapshot.docs) {
    const data = doc.data();
    const relevanceScore = calculateRelevanceScore(data, searchQuery);
    
    if (relevanceScore > 0) {
      results.push({
        id: doc.id,
        title: data.title,
        type: data.type,
        sections: data.sections,
        tags: data.tags,
        priority: data.priority,
        relevanceScore,
        lastUpdated: data.lastUpdated?.toDate() || new Date()
      });
    }
  }
  
  // 関連度順でソート
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
}

// 関連度スコア計算
function calculateRelevanceScore(document: any, searchQuery: any): number {
  let score = 0;
  const { keywords, intent, priority } = searchQuery;
  
  // 文書名でのマッチ
  const docTitleLower = document.title.toLowerCase();
  for (const keyword of keywords) {
    if (docTitleLower.includes(keyword)) {
      score += 3;
    }
  }
  
  // タグでのマッチ
  if (document.tags) {
    for (const tag of document.tags) {
      const tagLower = tag.toLowerCase();
      for (const keyword of keywords) {
        if (tagLower.includes(keyword)) {
          score += 2;
        }
      }
    }
  }
  
  // セクション内容でのマッチ
  for (const [sectionName, sectionContent] of Object.entries(document.sections)) {
    if (Array.isArray(sectionContent)) {
      const sectionText = sectionContent.join(' ').toLowerCase();
      for (const keyword of keywords) {
        if (sectionText.includes(keyword)) {
          score += 1;
        }
      }
    } else if (typeof sectionContent === 'string') {
      const sectionLower = sectionContent.toLowerCase();
      for (const keyword of keywords) {
        if (sectionLower.includes(keyword)) {
          score += 1;
        }
      }
    }
    
    // 意図に基づくボーナス
    if (intent === 'pricing' && sectionName === 'pricing') {
      score += 5;
    }
    if (intent === 'features' && sectionName === 'features') {
      score += 5;
    }
    if (intent === 'procedures' && sectionName === 'procedures') {
      score += 5;
    }
    if (intent === 'rules' && sectionName === 'rules') {
      score += 5;
    }
    if (intent === 'terms' && sectionName === 'terms') {
      score += 5;
    }
    if (intent === 'support' && sectionName === 'support') {
      score += 5;
    }
  }
  
  // 優先度ボーナス
  if (document.priority === 'high') {
    score *= 1.5;
  }
  
  // クエリ優先度ボーナス
  score *= priority;
  
  return score;
}

// 構造化回答生成
function generateStructuredAnswer(results: any[], queryText: string): string {
  if (results.length === 0) {
    return '該当する情報が見つかりませんでした。';
  }
  
  const bestResult = results[0];
  const { sections } = bestResult;
  
  // クエリの意図に基づいて最適なセクションを選択
  const intent = detectIntent(queryText.toLowerCase());
  let relevantSection = null;
  let relevantContent = '';
  
  // 意図に合致するセクションを探す
  if (intent === 'pricing' && sections.pricing) {
    relevantSection = 'pricing';
    relevantContent = Array.isArray(sections.pricing) 
      ? sections.pricing.join('\n') 
      : sections.pricing;
  } else if (intent === 'features' && sections.features) {
    relevantSection = 'features';
    relevantContent = Array.isArray(sections.features) 
      ? sections.features.join('\n') 
      : sections.features;
  } else if (intent === 'procedures' && sections.procedures) {
    relevantSection = 'procedures';
    relevantContent = Array.isArray(sections.procedures) 
      ? sections.procedures.join('\n') 
      : sections.procedures;
  } else if (intent === 'rules' && sections.rules) {
    relevantSection = 'rules';
    relevantContent = Array.isArray(sections.rules) 
      ? sections.rules.join('\n') 
      : sections.rules;
  } else if (intent === 'terms' && sections.terms) {
    relevantSection = 'terms';
    relevantContent = Array.isArray(sections.terms) 
      ? sections.terms.join('\n') 
      : sections.terms;
  } else if (intent === 'support' && sections.support) {
    relevantSection = 'support';
    relevantContent = Array.isArray(sections.support) 
      ? sections.support.join('\n') 
      : sections.support;
  }
  
  // 意図に合致するセクションがない場合は概要を使用
  if (!relevantSection) {
    relevantSection = 'overview';
    relevantContent = sections.overview || '';
  }
  
  // 回答を構築
  let answer = `${bestResult.title}について\n\n`;
  answer += `${relevantSection === 'overview' ? '概要' : relevantSection}\n${relevantContent}`;
  
  // 複数の結果がある場合は追加情報を提供
  if (results.length > 1) {
    answer += `\n\n他にも関連する情報があります。`;
  }
  
  return answer;
}
