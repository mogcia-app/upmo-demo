// 要約機能API

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Firebase Admin SDKの初期化
let adminDb: ReturnType<typeof getFirestore> | null = null;

const initAdmin = () => {
  if (getApps().length === 0) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      try {
        const serviceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        };
        initializeApp({
          credential: cert(serviceAccount),
        });
        adminDb = getFirestore();
      } catch (error) {
        console.error('Firebase Admin SDK初期化エラー:', error);
      }
    } else {
      console.warn('Firebase Admin SDKの環境変数が設定されていません');
    }
  } else {
    adminDb = getFirestore();
  }
  
  if (!adminDb) {
    throw new Error('Firebase Admin SDKが初期化されていません');
  }
  
  return adminDb;
};

// 認証トークンを検証
const verifyAuthToken = async (authHeader: string | null) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証が必要です');
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    initAdmin();
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error: any) {
    console.error('認証トークン検証エラー:', error);
    throw new Error('認証トークンの検証に失敗しました');
  }
};

// ロール別の要約プロンプトを生成
function getSummaryPrompt(role: 'executive' | 'sales' | 'backoffice', documentType: string, content: string): string {
  const rolePrompts = {
    executive: {
      base: `あなたは経営層向けの要約を作成する専門家です。以下の文書を要約してください。

要約の要件:
- 意思決定に必要な重要な情報のみを抽出
- 数値データ（金額、期間、数量など）を明確に記載
- リスクや課題を明確に示す
- アクションアイテムや次のステップを箇条書きで記載
- 簡潔で読みやすく、1ページ以内で完結
- 専門用語は必要最小限に留める`,
      meeting: `議事録の要約として、以下を含めてください:
- 会議の目的と主要な決定事項
- 重要な数値や指標
- リスクや懸念事項
- 次回までのアクションアイテム（担当者・期限付き）`,
      contract: `契約書の要約として、以下を含めてください:
- 契約の概要と目的
- 重要な条項（金額、期間、条件など）
- リスク要因
- 承認が必要な事項`,
      chat: `チャットログの要約として、以下を含めてください:
- 主要な話題と結論
- 決定事項
- 懸念事項や課題
- 次のアクション`
    },
    sales: {
      base: `あなたは営業担当者向けの要約を作成する専門家です。以下の文書を要約してください。

要約の要件:
- 顧客や案件に関する情報を重視
- 商談の進捗状況を明確に
- 次アクションやフォローアップ事項を明確に
- 競合情報や市場動向があれば記載
- 営業活動に直接役立つ情報を優先`,
      meeting: `議事録の要約として、以下を含めてください:
- 顧客名・案件名
- 商談の進捗状況
- 顧客の要望や懸念事項
- 次回のアポイントやフォローアップ事項
- 競合情報（あれば）`,
      contract: `契約書の要約として、以下を含めてください:
- 顧客情報
- 契約内容の概要
- 重要な条件（金額、期間、支払条件など）
- 注意すべき条項
- 営業活動への影響`,
      chat: `チャットログの要約として、以下を含めてください:
- 顧客や案件に関する話題
- 商談の進捗や決定事項
- 次アクション
- チーム内での情報共有事項`
    },
    backoffice: {
      base: `あなたはバックオフィス担当者向けの要約を作成する専門家です。以下の文書を要約してください。

要約の要件:
- 業務プロセスや手順に関する情報を重視
- 法的・規制に関する事項を明確に
- データや数値の正確性を重視
- 実務的な詳細情報を含める
- チェックリストや確認事項を明確に`,
      meeting: `議事録の要約として、以下を含めてください:
- 会議の目的と議題
- 決定事項の詳細
- 業務プロセスや手順の変更点
- 確認事項やチェックリスト
- 期限やスケジュール`,
      contract: `契約書の要約として、以下を含めてください:
- 契約の詳細な内容
- 法的条項の要点
- 業務プロセスへの影響
- 確認・承認が必要な事項
- 管理すべき期限や条件`,
      chat: `チャットログの要約として、以下を含めてください:
- 業務に関する話題
- 手順やプロセスの変更
- 確認事項
- 共有すべき情報`
    }
  };

  const rolePrompt = rolePrompts[role];
  const typeSpecificPrompt = rolePrompt[documentType as keyof typeof rolePrompt] || rolePrompt.base;

  return `${typeSpecificPrompt}

【要約する文書】
${content}

上記の要件に従って要約を作成してください。`;
}

// 要約を生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('要約リクエスト:', { 
      documentType: body.documentType, 
      role: body.role,
      contentLength: body.content?.length || 0
    });
    
    const { 
      content, 
      documentType, 
      role,
      documentId,
      sourceType // 'document' | 'chat' | 'progressNote'
    } = body;

    if (!content || !documentType || !role) {
      return NextResponse.json(
        { error: 'content、documentType、roleは必須です' },
        { status: 400 }
      );
    }

    // コンテンツが長すぎる場合は警告
    if (content.length > 50000) {
      console.warn('コンテンツが長すぎます:', content.length);
      // 長すぎる場合は最初の50000文字のみを使用
      const truncatedContent = content.substring(0, 50000) + '\n\n[以下、内容が長いため省略]';
      // ただし、エラーにはしない
    }

    // 認証トークンを検証
    let decodedToken;
    try {
      const authHeader = request.headers.get('Authorization');
      decodedToken = await verifyAuthToken(authHeader);
    } catch (authError: any) {
      console.error('認証エラー:', authError);
      return NextResponse.json(
        { error: '認証に失敗しました', details: authError.message },
        { status: 401 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OpenAI APIキーが設定されていません');
      return NextResponse.json(
        { error: 'OpenAI APIキーが設定されていません。.env.localファイルにOPENAI_API_KEYを設定してください。' },
        { status: 500 }
      );
    }

    // コンテンツが長すぎる場合は切り詰め
    const contentToSummarize = content.length > 50000 
      ? content.substring(0, 50000) + '\n\n[以下、内容が長いため省略しました]'
      : content;

    // ロール別のプロンプトを生成
    const systemPrompt = getSummaryPrompt(
      role as 'executive' | 'sales' | 'backoffice',
      documentType,
      contentToSummarize
    );

    console.log('要約プロンプト生成完了:', { 
      role, 
      documentType, 
      promptLength: systemPrompt.length 
    });

    // OpenAI APIで要約を生成
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: systemPrompt
            },
            {
              role: 'user',
              content: '上記の文書を要約してください。'
            }
          ],
          max_tokens: 2000,
          temperature: 0.3, // 要約なので低めの温度で一貫性を保つ
        }),
      });
    } catch (fetchError: any) {
      console.error('OpenAI API リクエストエラー:', fetchError);
      return NextResponse.json(
        { error: 'OpenAI APIへのリクエストに失敗しました', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', response.status, errorData);
      
      let errorMessage = 'OpenAI API呼び出しに失敗しました';
      try {
        const errorJson = JSON.parse(errorData);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch (e) {
        // JSONパースに失敗した場合はそのまま使用
      }
      
      return NextResponse.json(
        { error: errorMessage, details: `HTTP ${response.status}: ${errorData.substring(0, 200)}` },
        { status: response.status >= 500 ? 500 : 400 }
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('OpenAI API レスポンス解析エラー:', parseError);
      return NextResponse.json(
        { error: 'OpenAI APIからのレスポンスを解析できませんでした' },
        { status: 500 }
      );
    }

    const summary = data.choices[0]?.message?.content || '要約を生成できませんでした。';
    
    if (!summary || summary.trim().length === 0) {
      console.error('要約が空です:', data);
      return NextResponse.json(
        { error: '要約が生成されませんでした' },
        { status: 500 }
      );
    }
    
    console.log('要約生成成功:', { summaryLength: summary.length });

    // 要約をFirestoreに保存（オプション）
    if (documentId) {
      try {
        const db = initAdmin();
        const summaryData = {
          documentId,
          sourceType: sourceType || 'document',
          role,
          documentType,
          summary,
          createdAt: new Date(),
          createdBy: decodedToken.uid
        };
        
        await db.collection('summaries').add(summaryData);
      } catch (saveError) {
        console.error('要約の保存エラー:', saveError);
        // 保存エラーは無視して要約を返す
      }
    }

    return NextResponse.json({
      success: true,
      summary,
      role,
      documentType
    });

  } catch (error) {
    console.error('要約生成エラー詳細:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        error: '要約の生成に失敗しました', 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

// 保存された要約を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const role = searchParams.get('role');

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentIdは必須です' },
        { status: 400 }
      );
    }

    // 認証トークンを検証
    const authHeader = request.headers.get('Authorization');
    await verifyAuthToken(authHeader);

    const db = initAdmin();
    let queryRef: any = db.collection('summaries').where('documentId', '==', documentId);

    if (role) {
      queryRef = queryRef.where('role', '==', role);
    }

    queryRef = queryRef.orderBy('createdAt', 'desc');

    const querySnapshot = await queryRef.get();
    const summaries: any[] = [];

    querySnapshot.forEach((doc: any) => {
      const data = doc.data();
      summaries.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
      });
    });

    return NextResponse.json({
      success: true,
      summaries
    });

  } catch (error) {
    console.error('要約取得エラー:', error);
    return NextResponse.json(
      { 
        error: '要約の取得に失敗しました', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

