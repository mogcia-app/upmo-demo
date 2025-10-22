// Azure OpenAI Service統合の実装案

import OpenAI from 'openai';

// Azure OpenAI Service設定
const azureConfig = {
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT, // https://your-resource.openai.azure.com/
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME, // gpt-35-turbo
  apiVersion: '2024-02-15-preview'
};

// Azure OpenAI Serviceクライアント
const azureOpenAI = new OpenAI({
  apiKey: azureConfig.apiKey,
  baseURL: `${azureConfig.endpoint}/openai/deployments/${azureConfig.deploymentName}`,
  defaultQuery: {
    'api-version': azureConfig.apiVersion
  }
});

// ナレッジベース検索（RAG）
export async function searchKnowledgeBase(query: string, documents: string[]): Promise<string> {
  try {
    // 1. 文書の埋め込みベクトル化（省略 - Azure Cognitive Search等を使用）
    // 2. クエリの埋め込みベクトル化
    // 3. 類似度検索で関連文書を取得
    // 4. 関連文書とクエリを組み合わせてAI回答を生成
    
    const relevantDocs = await findRelevantDocuments(query, documents);
    
    const prompt = `以下の文書を参照して、「${query}」について回答してください。

参照文書:
${relevantDocs.join('\n\n')}

回答要件:
- 文書の内容に基づいて正確に回答してください
- 読みやすく整理してください
- 具体的な数値や詳細があれば含めてください
- 文書に該当する情報がない場合は「該当する情報が見つかりませんでした」と回答してください

回答:`;

    const response = await azureOpenAI.chat.completions.create({
      model: azureConfig.deploymentName || 'gpt-35-turbo',
      messages: [
        {
          role: 'system',
          content: 'あなたは文書検索アシスタントです。提供された文書の内容に基づいて、正確で読みやすい回答を提供してください。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    return response.choices[0]?.message?.content || '回答を生成できませんでした。';
  } catch (error) {
    console.error('Azure OpenAI Service エラー:', error);
    throw error;
  }
}

// 関連文書検索（簡易版）
async function findRelevantDocuments(query: string, documents: string[]): Promise<string[]> {
  // 実際の実装では、Azure Cognitive Searchやベクトル検索を使用
  // ここでは簡易的なキーワードマッチングを使用
  
  const queryWords = query.toLowerCase().split(/\s+/);
  const scoredDocs = documents.map(doc => {
    let score = 0;
    queryWords.forEach(word => {
      if (doc.toLowerCase().includes(word)) {
        score++;
      }
    });
    return { doc, score };
  });
  
  return scoredDocs
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3) // 上位3文書
    .map(item => item.doc);
}

// ファイルアップロード時の自動処理
export async function processUploadedFile(file: File): Promise<string> {
  try {
    // 1. ファイルからテキスト抽出
    const text = await extractTextFromFile(file);
    
    // 2. テキストをチャンクに分割
    const chunks = splitTextIntoChunks(text, 1000); // 1000文字ずつ
    
    // 3. 各チャンクをベクトル化してストレージに保存
    // （実際の実装では、Azure Cognitive SearchやVector Storeを使用）
    console.log(`テキストを${chunks.length}個のチャンクに分割しました`);
    
    return 'ファイルが正常に処理されました。';
  } catch (error) {
    console.error('ファイル処理エラー:', error);
    throw error;
  }
}

// テキストをチャンクに分割
function splitTextIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[。！？]/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence + '。';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// ファイルからテキスト抽出（既存の関数を再利用）
async function extractTextFromFile(file: File): Promise<string> {
  const { extractTextFromFile } = await import('./fileExtractor');
  return await extractTextFromFile(file);
}
