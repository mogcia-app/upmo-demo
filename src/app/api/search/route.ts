import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Firebase Admin SDK の初期化
if (!getApps().length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
}

const adminDb = getFirestore();

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
    
    // 3. 精密検索実行
    const results = await searchStructuredDocuments(searchQuery, targetDocType);
    
    // 4. 構造化回答生成
    const structuredAnswer = generateStructuredAnswer(results, queryText);
    
    return NextResponse.json({
      success: true,
      query: queryText,
      documentType: targetDocType,
      answer: structuredAnswer,
      sources: results.map(r => r.name),
      sectionCount: results.reduce((sum, r) => sum + Object.keys(r.sections).length, 0)
    });

  } catch (error) {
    console.error('検索エラー:', error);
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
    return 'procedure';
  }
  if (queryLower.includes('規則') || queryLower.includes('規定') || queryLower.includes('ポリシー')) {
    return 'rules';
  }
  if (queryLower.includes('契約') || queryLower.includes('条項') || queryLower.includes('条件')) {
    return 'contract';
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

// 構造化文書検索
async function searchStructuredDocuments(searchQuery: any, docType: string | null) {
  let queryRef: FirebaseFirestore.CollectionReference | FirebaseFirestore.Query = adminDb.collection('structuredDocuments');
  
  // 文書タイプでフィルタ
  if (docType) {
    queryRef = queryRef.where('type', '==', docType);
  }
  
  const snapshot = await queryRef.get();
  const results: any[] = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const relevanceScore = calculateRelevanceScore(data, searchQuery);
    
    if (relevanceScore > 0) {
      results.push({
        id: doc.id,
        name: data.name,
        type: data.type,
        sections: data.sections,
        relevanceScore,
        lastUpdated: data.lastUpdated?.toDate?.() || new Date()
      });
    }
  }
  
  // 関連度順でソート（その後、更新日順でもソート）
  return results
    .sort((a, b) => {
      // まず関連度でソート
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      // 関連度が同じ場合は更新日でソート
      return (b.lastUpdated?.getTime?.() || 0) - (a.lastUpdated?.getTime?.() || 0);
    })
    .slice(0, 5);
}

// 関連度スコア計算
function calculateRelevanceScore(document: any, searchQuery: any): number {
  let score = 0;
  const { keywords, intent, priority } = searchQuery;
  
  // 文書名でのマッチ
  const docNameLower = document.name.toLowerCase();
  for (const keyword of keywords) {
    if (docNameLower.includes(keyword)) {
      score += 2;
    }
  }
  
  // セクション内容でのマッチ
  for (const [sectionName, sectionContent] of Object.entries(document.sections)) {
    const sectionText = Array.isArray(sectionContent) 
      ? sectionContent.join(' ') 
      : String(sectionContent);
    const sectionLower = sectionText.toLowerCase();
    
    for (const keyword of keywords) {
      if (sectionLower.includes(keyword)) {
        score += 1;
      }
    }
    
    // 意図に基づくボーナス
    if (intent === 'pricing' && (sectionName.includes('料金') || sectionName.includes('価格'))) {
      score += 3;
    }
    if (intent === 'features' && (sectionName.includes('機能') || sectionName.includes('feature'))) {
      score += 3;
    }
    if (intent === 'procedure' && (sectionName.includes('手順') || sectionName.includes('流れ'))) {
      score += 3;
    }
  }
  
  // 優先度ボーナス
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
  for (const [sectionName, sectionContent] of Object.entries(sections)) {
    if (intent === 'pricing' && (sectionName.includes('料金') || sectionName.includes('価格'))) {
      relevantSection = sectionName;
      relevantContent = Array.isArray(sectionContent) 
        ? sectionContent.join('\n') 
        : String(sectionContent);
      break;
    }
    if (intent === 'features' && (sectionName.includes('機能') || sectionName.includes('feature'))) {
      relevantSection = sectionName;
      relevantContent = Array.isArray(sectionContent) 
        ? sectionContent.join('\n') 
        : String(sectionContent);
      break;
    }
    if (intent === 'procedure' && (sectionName.includes('手順') || sectionName.includes('流れ'))) {
      relevantSection = sectionName;
      relevantContent = Array.isArray(sectionContent) 
        ? sectionContent.join('\n') 
        : String(sectionContent);
      break;
    }
  }
  
  // 意図に合致するセクションがない場合は概要を使用
  if (!relevantSection) {
    relevantSection = '概要';
    relevantContent = sections['概要'] || sections[Object.keys(sections)[0]];
    if (Array.isArray(relevantContent)) {
      relevantContent = relevantContent.join('\n');
    }
  }
  
  // 回答を構築
  let answer = `${bestResult.name}について\n\n`;
  answer += `${relevantSection}\n${relevantContent}`;
  
  // 複数の結果がある場合は追加情報を提供
  if (results.length > 1) {
    answer += `\n\n他にも関連する情報があります。`;
  }
  
  return answer;
}
