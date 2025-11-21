import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Firebase Admin SDK の初期化
if (!getApps().length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    initializeApp({
      credential: cert(serviceAccount),
    });
  }
}

const auth = getApps().length > 0 ? getAuth() : null;
const adminDb = getApps().length > 0 ? getFirestore() : null;

// 認証トークンを検証するヘルパー関数
async function verifyAuthToken(request: NextRequest): Promise<string | null> {
  if (!auth) return null;
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('認証トークン検証エラー:', error);
    return null;
  }
}

// 管理者権限をチェックするヘルパー関数
async function checkAdminRole(userId: string): Promise<boolean> {
  if (!adminDb) return false;
  
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    return userData?.role === 'admin';
  } catch (error) {
    console.error('管理者権限チェックエラー:', error);
    return false;
  }
}

interface AIParseRequest {
  content: string;
  documentType: string;
}

interface ParsedDocument {
  title: string;
  type: 'meeting' | 'policy' | 'contract' | 'manual' | 'other';
  description: string;
  sections: {
    overview: string;
    features: string[];
    pricing: string[];
    procedures: string[];
    support?: string[];
    rules?: string[];
    terms?: string[];
  };
  tags: string[];
  priority: 'high' | 'medium' | 'low';
}

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 管理者権限チェック
    const isAdmin = await checkAdminRole(userId);
    if (!isAdmin) {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const { content, documentType }: AIParseRequest = await request.json();

    if (!content || !documentType) {
      return NextResponse.json({ 
        error: 'コンテンツとドキュメントタイプが必要です' 
      }, { status: 400 });
    }

    // AI解析のプロンプトを作成
    const prompt = `
以下のテキストを解析して、構造化された文書データに変換してください。

テキスト:
${content}

ドキュメントタイプ: ${documentType}

以下のJSON形式で回答してください:
{
  "title": "文書のタイトル（簡潔に）",
  "type": "meeting|policy|contract|manual|other",
  "description": "文書の概要説明",
  "sections": {
    "overview": "概要・説明",
    "features": ["機能1", "機能2", "機能3"],
    "pricing": ["料金情報1", "料金情報2"],
    "procedures": ["手順1", "手順2", "手順3"],
    "support": ["サポート情報1", "サポート情報2"],
    "rules": ["ルール1", "ルール2"],
    "terms": ["条件1", "条件2"]
  },
  "tags": ["タグ1", "タグ2", "タグ3"],
  "priority": "high|medium|low"
}

注意事項:
- 料金情報は必ずpricingセクションに含めてください
- 機能や特徴はfeaturesセクションに含めてください
- 手順やプロセスはproceduresセクションに含めてください
- 空の配列は[]としてください
- 日本語で回答してください
`;

    // OpenAI APIを使用してAI解析を実行
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      // OpenAI APIキーがない場合は手動解析を実行
      return NextResponse.json({
        success: true,
        parsedDocument: await parseDocumentManually(content, documentType)
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたは文書解析の専門家です。与えられたテキストを構造化されたJSON形式で解析してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    try {
      // AIの回答をJSONとして解析
      const parsedDocument = JSON.parse(aiResponse);
      
      return NextResponse.json({
        success: true,
        parsedDocument: parsedDocument
      });
    } catch (parseError) {
      console.error('AI response parse error:', parseError);
      // JSON解析に失敗した場合は手動解析を使用
      return NextResponse.json({
        success: true,
        parsedDocument: await parseDocumentManually(content, documentType)
      });
    }

  } catch (error) {
    console.error('AI document parsing error:', error);
    return NextResponse.json({ 
      error: '文書の解析に失敗しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 手動解析のフォールバック関数
async function parseDocumentManually(content: string, documentType: string): Promise<ParsedDocument> {
  const lines = content.split('\n').filter(line => line.trim());
  
  // 基本的な解析ロジック
  const title = lines[0] || '解析された文書';
  const description = lines.slice(0, 3).join(' ').substring(0, 100) + '...';
  
  // 料金情報を抽出
  const pricingKeywords = ['料金', '価格', '費用', '月額', '年額', '円', '万円', 'ドル', 'USD', '¥', '$'];
  const pricing = lines.filter(line => 
    pricingKeywords.some(keyword => line.includes(keyword))
  );
  
  // 機能・特徴を抽出
  const featureKeywords = ['機能', '特徴', 'できる', '可能', '提供', 'サービス'];
  const features = lines.filter(line => 
    featureKeywords.some(keyword => line.includes(keyword))
  );
  
  // 手順・プロセスを抽出
  const procedureKeywords = ['手順', '方法', 'やり方', 'ステップ', 'プロセス', '流れ'];
  const procedures = lines.filter(line => 
    procedureKeywords.some(keyword => line.includes(keyword))
  );
  
  // タグを生成
  const tags = [documentType, 'AI解析'];
  if (pricing.length > 0) tags.push('料金情報');
  if (features.length > 0) tags.push('機能説明');
  if (procedures.length > 0) tags.push('手順');
  
  return {
    title,
    type: documentType as any,
    description,
    sections: {
      overview: description,
      features: features.slice(0, 5),
      pricing: pricing.slice(0, 5),
      procedures: procedures.slice(0, 5),
      support: [],
      rules: [],
      terms: []
    },
    tags,
    priority: 'medium'
  };
}
