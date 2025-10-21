export interface CompanyPolicy {
  id: string;
  title: string;
  category: string;
  content: string;
  chunks: string[];
  lastUpdated: Date;
}

// 社内規則データベース（実際はFirestoreから取得）
let companyPolicies: CompanyPolicy[] = [];

// キーワード検索用のインデックス
const createSearchIndex = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAFa-zA-Z0-9\s]/g, '') // 日本語と英数字のみ
    .split(/\s+/)
    .filter(word => word.length > 1); // 1文字以下は除外
};

// 関連度スコア計算
const calculateRelevanceScore = (query: string, text: string): number => {
  const queryWords = createSearchIndex(query);
  const textWords = createSearchIndex(text);
  
  let score = 0;
  
  for (const queryWord of queryWords) {
    for (const textWord of textWords) {
      if (textWord.includes(queryWord) || queryWord.includes(textWord)) {
        score += 1;
      }
      // 完全一致は高スコア
      if (textWord === queryWord) {
        score += 3;
      }
    }
  }
  
  return score;
};

// 社内規則を検索
export const searchCompanyPolicies = (query: string): { policy: CompanyPolicy; relevanceScore: number; matchedChunk: string }[] => {
  if (!query.trim()) return [];
  
  const results: { policy: CompanyPolicy; relevanceScore: number; matchedChunk: string }[] = [];
  
  for (const policy of companyPolicies) {
    // タイトルでの検索
    const titleScore = calculateRelevanceScore(query, policy.title);
    
    // コンテンツのチャンクごとの検索
    let bestChunk = '';
    let bestScore = 0;
    
    for (const chunk of policy.chunks) {
      const chunkScore = calculateRelevanceScore(query, chunk);
      if (chunkScore > bestScore) {
        bestScore = chunkScore;
        bestChunk = chunk;
      }
    }
    
    const totalScore = titleScore * 2 + bestScore; // タイトルマッチは重み付け
    
    if (totalScore > 0) {
      results.push({
        policy,
        relevanceScore: totalScore,
        matchedChunk: bestChunk || policy.content.substring(0, 200) + '...'
      });
    }
  }
  
  // 関連度順でソート
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
};

// AI風の回答を生成
export const generateAIResponse = (query: string, searchResults: { policy: CompanyPolicy; relevanceScore: number; matchedChunk: string }[]): string => {
  if (searchResults.length === 0) {
    return `申し訳ございませんが、「${query}」に関する社内規則が見つかりませんでした。\n\n別のキーワードで検索していただくか、管理者にお問い合わせください。`;
  }
  
  const topResult = searchResults[0];
  const { policy, matchedChunk } = topResult;
  
  // AI風の回答テンプレート
  const responses = [
    `「${query}」について、以下の社内規則をご確認ください：\n\n📋 **${policy.title}**\n\n${matchedChunk}\n\nこの規則は${policy.category}カテゴリに分類されており、最終更新日は${policy.lastUpdated.toLocaleDateString('ja-JP')}です。`,
    
    `お問い合わせの「${query}」に関して、社内規則をご案内いたします：\n\n📄 **${policy.title}**\n\n${matchedChunk}\n\n詳細については、上記規則をご参照ください。`,
    
    `「${query}」について、関連する社内規則を発見しました：\n\n📚 **${policy.title}**\n\n${matchedChunk}\n\n他にも関連する規則がある場合は、具体的なキーワードでお聞きください。`
  ];
  
  // ランダムに回答を選択
  return responses[Math.floor(Math.random() * responses.length)];
};

// 社内規則を追加
export const addCompanyPolicy = (policy: Omit<CompanyPolicy, 'chunks'> & { content: string }): void => {
  const chunks = policy.content.split(/\n\n+/).filter(chunk => chunk.trim().length > 0);
  
  const newPolicy: CompanyPolicy = {
    ...policy,
    chunks,
    lastUpdated: new Date()
  };
  
  companyPolicies.push(newPolicy);
};

// 社内規則を取得
export const getCompanyPolicies = (): CompanyPolicy[] => {
  return companyPolicies;
};

// 社内規則を削除
export const removeCompanyPolicy = (id: string): void => {
  companyPolicies = companyPolicies.filter(policy => policy.id !== id);
};
