import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromFile, parseDocumentByType } from '@/utils/fileExtractor';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 });
    }

    // ファイルサイズチェック (4MB制限 - Vercelの制限を考慮)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'ファイルサイズが大きすぎます。4MB以下のファイルを選択してください。' }, { status: 413 });
    }

    // 1. テキスト抽出
    let extractedText: string;
    try {
      extractedText = await extractTextFromFile(file);
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('テキストの抽出に失敗しました');
      }
    } catch (error) {
      console.error('テキスト抽出エラー:', error);
      return NextResponse.json({ error: 'ファイルからテキストを抽出できませんでした。ファイル形式を確認してください。' }, { status: 400 });
    }
    
    // 2. 文書タイプ自動判定
    const documentType = detectDocumentType(extractedText, file.name);
    
    // 3. AIでセクション自動分割・命名
    let structuredSections: Record<string, string | string[]>;
    try {
      structuredSections = await createStructuredSections(extractedText, documentType);
    } catch (error) {
      console.error('セクション分割エラー:', error);
      // フォールバック: 基本的なセクション分割
      structuredSections = createFallbackSections(extractedText, documentType);
    }
    
    // 4. Firestoreに保存
    let docRef;
    try {
      docRef = await addDoc(collection(db, 'structuredDocuments'), {
        name: title || file.name, // タイトルを優先、なければファイル名
        originalFileName: file.name,
        description: description || '',
        category: category || 'other',
        type: documentType,
        sections: structuredSections,
        originalText: extractedText.substring(0, 10000), // テキストを制限
        createdAt: new Date(),
        lastUpdated: new Date(),
        sectionCount: Object.keys(structuredSections).length,
        fileSize: file.size
      });
    } catch (error) {
      console.error('Firestore保存エラー:', error);
      return NextResponse.json({ error: 'データの保存に失敗しました。' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      documentId: docRef.id,
      name: title || file.name,
      type: documentType,
      sections: Object.keys(structuredSections)
    });

  } catch (error) {
    console.error('PDF処理エラー:', error);
    return NextResponse.json({ error: 'PDF処理に失敗しました' }, { status: 500 });
  }
}

// 文書タイプ自動判定
function detectDocumentType(text: string, filename: string): string {
  const textLower = text.toLowerCase();
  const filenameLower = filename.toLowerCase();
  
  // ファイル名から判定
  if (filenameLower.includes('打ち合わせ') || filenameLower.includes('meeting') || filenameLower.includes('資料')) {
    return 'meeting';
  }
  if (filenameLower.includes('規則') || filenameLower.includes('policy') || filenameLower.includes('規定')) {
    return 'policy';
  }
  if (filenameLower.includes('契約') || filenameLower.includes('contract') || filenameLower.includes('規約')) {
    return 'contract';
  }
  if (filenameLower.includes('マニュアル') || filenameLower.includes('manual') || filenameLower.includes('手順')) {
    return 'manual';
  }
  
  // テキスト内容から判定
  if (textLower.includes('料金') && textLower.includes('プラン') && textLower.includes('機能')) {
    return 'meeting';
  }
  if (textLower.includes('規則') && textLower.includes('遵守') && textLower.includes('規定')) {
    return 'policy';
  }
  if (textLower.includes('契約') && textLower.includes('条項') && textLower.includes('条件')) {
    return 'contract';
  }
  if (textLower.includes('手順') && textLower.includes('操作') && textLower.includes('マニュアル')) {
    return 'manual';
  }
  
  return 'general';
}

// AIでセクション自動分割・命名
async function createStructuredSections(text: string, documentType: string): Promise<Record<string, string | string[]>> {
  try {
    // OpenAI APIを使用してセクション分割
    const { generateAIResponse } = await import('@/utils/aiAssistant');
    
    const prompt = `以下の文書を適切なセクションに分割し、各セクションに適切な名前を付けてください。

文書タイプ: ${documentType}
文書内容:
${text.substring(0, 2000)}...

以下のJSON形式で回答してください:
{
  "セクション名1": "内容1",
  "セクション名2": ["項目1", "項目2", "項目3"],
  "セクション名3": "内容3"
}

要件:
- セクション名は日本語で分かりやすく
- 内容は簡潔に
- 配列形式と文字列形式を適切に使い分け
- 最大5セクションまで`;

    const response = await generateAIResponse(prompt, []);
    
    // JSONパース
    try {
      const sections = JSON.parse(response);
      return sections;
    } catch (parseError) {
      console.error('JSONパースエラー:', parseError);
      // フォールバック: 基本的なセクション分割
      return createFallbackSections(text, documentType);
    }
    
  } catch (error) {
    console.error('AIセクション分割エラー:', error);
    return createFallbackSections(text, documentType);
  }
}

// フォールバック: 基本的なセクション分割
function createFallbackSections(text: string, documentType: string): Record<string, string | string[]> {
  const sections: Record<string, string | string[]> = {};
  
  // 文書タイプに応じた基本セクション
  switch (documentType) {
    case 'meeting':
      sections['概要'] = text.substring(0, 500);
      sections['機能'] = extractFeatures(text);
      sections['料金'] = extractPricing(text);
      sections['導入手順'] = extractFlow(text);
      break;
    case 'policy':
      sections['概要'] = text.substring(0, 500);
      sections['規則'] = extractRules(text);
      sections['手順'] = extractProcedures(text);
      break;
    case 'contract':
      sections['概要'] = text.substring(0, 500);
      sections['条項'] = extractTerms(text);
      sections['条件'] = extractConditions(text);
      break;
    default:
      sections['概要'] = text.substring(0, 500);
      sections['詳細'] = text.substring(500, 1000);
  }
  
  return sections;
}

// ヘルパー関数
function extractFeatures(text: string): string[] {
  const features: string[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.includes('機能') || line.includes('feature') || line.includes('ツール')) {
      features.push(line.trim());
    }
  }
  
  return features.slice(0, 5); // 最大5個
}

function extractPricing(text: string): string[] {
  const pricing: string[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.includes('万円') || line.includes('円') || line.includes('料金') || line.includes('価格')) {
      pricing.push(line.trim());
    }
  }
  
  return pricing.slice(0, 5); // 最大5個
}

function extractFlow(text: string): string[] {
  const flow: string[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.includes('手順') || line.includes('流れ') || line.includes('ステップ')) {
      flow.push(line.trim());
    }
  }
  
  return flow.slice(0, 5); // 最大5個
}

function extractRules(text: string): string[] {
  const rules: string[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.includes('規則') || line.includes('規定') || line.includes('禁止')) {
      rules.push(line.trim());
    }
  }
  
  return rules.slice(0, 5); // 最大5個
}

function extractProcedures(text: string): string[] {
  const procedures: string[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.includes('手順') || line.includes('方法') || line.includes('プロセス')) {
      procedures.push(line.trim());
    }
  }
  
  return procedures.slice(0, 5); // 最大5個
}

function extractTerms(text: string): string[] {
  const terms: string[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.includes('条項') || line.includes('条件') || line.includes('契約')) {
      terms.push(line.trim());
    }
  }
  
  return terms.slice(0, 5); // 最大5個
}

function extractConditions(text: string): string[] {
  const conditions: string[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.includes('条件') || line.includes('要件') || line.includes('制限')) {
      conditions.push(line.trim());
    }
  }
  
  return conditions.slice(0, 5); // 最大5個
}
