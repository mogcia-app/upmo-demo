import OpenAI from 'openai';
import { CompanyPolicy } from './companyPolicySearch';

// OpenAI APIクライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || 'your-api-key-here',
  dangerouslyAllowBrowser: true // ブラウザ環境での使用（本番では推奨しない）
});

// ベクトル検索用のシンプルな類似度計算
function calculateSimilarity(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\s+/);
  const textWords = text.toLowerCase().split(/\s+/);
  
  let matches = 0;
  for (const queryWord of queryWords) {
    for (const textWord of textWords) {
      if (textWord.includes(queryWord) || queryWord.includes(textWord)) {
        matches++;
      }
    }
  }
  
  return matches / queryWords.length;
}

// 文脈に基づく関連文書を検索
export async function findRelevantDocuments(query: string, policies: CompanyPolicy[]): Promise<CompanyPolicy[]> {
  const relevantPolicies: { policy: CompanyPolicy; score: number }[] = [];
  
  for (const policy of policies) {
    // タイトルでの類似度
    const titleScore = calculateSimilarity(query, policy.title);
    
    // コンテンツでの類似度
    let contentScore = 0;
    for (const chunk of policy.chunks) {
      contentScore = Math.max(contentScore, calculateSimilarity(query, chunk));
    }
    
    const totalScore = titleScore * 2 + contentScore;
    
    if (totalScore > 0.1) { // 閾値を下げてより多くの関連文書を取得
      relevantPolicies.push({ policy, score: totalScore });
    }
  }
  
  return relevantPolicies
    .sort((a, b) => b.score - a.score)
    .slice(0, 3) // 上位3件
    .map(item => item.policy);
}

// OpenAI APIを使用した本格的なAI回答生成
export async function generateAIResponse(query: string, policies: CompanyPolicy[]): Promise<string> {
  try {
    // 関連する文書を検索
    const relevantPolicies = await findRelevantDocuments(query, policies);
    
    if (relevantPolicies.length === 0) {
      return `申し訳ございませんが、「${query}」に関する情報が見つかりませんでした。\n\n別の表現で質問していただくか、管理者にお問い合わせください。`;
    }
    
    // 文脈を作成
    const context = relevantPolicies.map(policy => 
      `【${policy.title}】\n${policy.chunks.slice(0, 2).join('\n\n')}`
    ).join('\n\n---\n\n');
    
    // OpenAI APIで回答生成
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `あなたは企業の社内規則やポリシーについて質問に答えるAIアシスタントです。
以下の文書を参考にして、ユーザーの質問に正確で分かりやすい回答をしてください。

回答のガイドライン：
- 文書の内容に基づいて回答してください
- 不明な点がある場合は「文書に記載がありません」と明記してください
- 分かりやすい日本語で回答してください
- 必要に応じて文書の該当箇所を引用してください`
        },
        {
          role: "user",
          content: `質問: ${query}\n\n参考文書:\n${context}`
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });
    
    const response = completion.choices[0]?.message?.content || '回答を生成できませんでした。';
    
    // 回答に文書の出典を追加
    const sources = relevantPolicies.map(policy => `• ${policy.title}`).join('\n');
    
    return `${response}\n\n📚 **参考文書**\n${sources}`;
    
  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    // APIエラーの場合はフォールバック
    return generateFallbackResponse(query, policies);
  }
}

// APIが使えない場合のフォールバック回答
function generateFallbackResponse(query: string, policies: CompanyPolicy[]): string {
  const relevantPolicies = policies.filter(policy => {
    const queryLower = query.toLowerCase();
    const titleLower = policy.title.toLowerCase();
    const contentLower = policy.content.toLowerCase();
    
    return titleLower.includes(queryLower) || contentLower.includes(queryLower);
  });
  
  if (relevantPolicies.length === 0) {
    return `申し訳ございませんが、「${query}」に関する情報が見つかりませんでした。\n\n別のキーワードで検索していただくか、管理者にお問い合わせください。`;
  }
  
  const policy = relevantPolicies[0];
  const relevantChunk = policy.chunks.find(chunk => 
    chunk.toLowerCase().includes(query.toLowerCase())
  ) || policy.chunks[0];
  
  return `「${query}」について、以下の文書をご確認ください：\n\n📋 **${policy.title}**\n\n${relevantChunk}\n\nこの規則は${policy.category}カテゴリに分類されています。`;
}

// 環境変数チェック
export function checkOpenAISetup(): { isConfigured: boolean; message: string } {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  
  if (!apiKey || apiKey === 'your-api-key-here') {
    return {
      isConfigured: false,
      message: 'OpenAI APIキーが設定されていません。環境変数 NEXT_PUBLIC_OPENAI_API_KEY を設定してください。'
    };
  }
  
  return {
    isConfigured: true,
    message: 'OpenAI APIが利用可能です。'
  };
}
