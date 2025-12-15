import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { searchSalesCases, searchProgressNotes } from '@/utils/salesSearch';

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

export async function POST(request: NextRequest) {
  try {
    const { message, userId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'メッセージが必要です' },
        { status: 400 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI APIキーが設定されていません' },
        { status: 500 }
      );
    }

    // 文書、案件、進捗メモを統合検索
    let documentContext = '';
    let salesCaseContext = '';
    let progressNoteContext = '';
    
    try {
      const searchQuery = message.toLowerCase();
      
      // 1. 文書管理の内容を検索（Admin SDKを使用）
      const snapshot = await adminDb.collection('manualDocuments').get();
      
      const relevantDocs: any[] = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const titleMatch = data.title?.toLowerCase().includes(searchQuery);
        const contentMatch = JSON.stringify(data.sections || {}).toLowerCase().includes(searchQuery);
        
        if (titleMatch || contentMatch) {
          relevantDocs.push({
            title: data.title,
            sections: data.sections
          });
        }
      }
      
      // 更新日順でソート
      relevantDocs.sort((a, b) => {
        // ここでは簡易的にタイトルでソート（必要に応じてlastUpdatedを追加）
        return 0;
      });
      
      if (relevantDocs.length > 0) {
        const bestDoc = relevantDocs[0];
        const sections = bestDoc.sections || {};
        
        const sectionTexts: string[] = [];
        for (const [key, value] of Object.entries(sections)) {
          if (Array.isArray(value)) {
            sectionTexts.push(`${key}: ${value.join('\n')}`);
          } else if (typeof value === 'string') {
            sectionTexts.push(`${key}: ${value}`);
          }
        }
        
        documentContext = `【社内ドキュメント】\n${bestDoc.title}\n\n${sectionTexts.join('\n\n')}`;
      }
      
      // 2. 営業案件を検索
      try {
        const salesCases = await searchSalesCases(message, userId, 3);
        if (salesCases.length > 0) {
          const caseTexts = salesCases.map(c => {
            let text = `案件名: ${c.title}\n顧客: ${c.customerName}`;
            if (c.customerCompany) text += ` (${c.customerCompany})`;
            text += `\nステータス: ${getStatusLabel(c.status)}`;
            if (c.description) text += `\n概要: ${c.description}`;
            if (c.estimatedValue) text += `\n見積金額: ${c.estimatedValue.toLocaleString()}円`;
            if (c.probability) text += `\n成約確率: ${c.probability}%`;
            if (c.expectedCloseDate) text += `\n予定クロージング日: ${c.expectedCloseDate.toLocaleDateString('ja-JP')}`;
            return text;
          });
          salesCaseContext = `【営業案件】\n${caseTexts.join('\n\n---\n\n')}`;
        }
      } catch (error) {
        console.error('案件検索エラー:', error);
      }
      
      // 3. 進捗メモを検索
      try {
        const progressNotes = await searchProgressNotes(message, userId, undefined, 3);
        if (progressNotes.length > 0) {
          const noteTexts = progressNotes.map(n => {
            let text = `タイトル: ${n.title}\n日付: ${n.date.toLocaleDateString('ja-JP')}`;
            if (n.caseTitle) text += `\n関連案件: ${n.caseTitle}`;
            text += `\n内容: ${n.content}`;
            if (n.nextActions && n.nextActions.length > 0) {
              text += `\n次アクション: ${n.nextActions.join(', ')}`;
            }
            if (n.risks && n.risks.length > 0) {
              text += `\nリスク・懸念: ${n.risks.join(', ')}`;
            }
            return text;
          });
          progressNoteContext = `【進捗メモ】\n${noteTexts.join('\n\n---\n\n')}`;
        }
      } catch (error) {
        console.error('進捗メモ検索エラー:', error);
      }
    } catch (error) {
      console.error('検索エラー:', error);
    }

    // 統合されたコンテキストを構築
    const allContexts: string[] = [];
    if (documentContext) allContexts.push(documentContext);
    if (salesCaseContext) allContexts.push(salesCaseContext);
    if (progressNoteContext) allContexts.push(progressNoteContext);
    
    const combinedContext = allContexts.join('\n\n');
    const hasContext = allContexts.length > 0;

    // OpenAI APIで回答生成
    const systemPrompt = hasContext
      ? `あなたは企業の社内AIアシスタントです。以下の情報源から、ユーザーの質問に正確で分かりやすい回答をしてください。

情報源:
${combinedContext}

回答のガイドライン:
- 提供された情報（社内ドキュメント、営業案件、進捗メモ）に基づいて回答してください
- 複数の情報源がある場合は、それらを統合して包括的な回答をしてください
- 案件や進捗メモに関する質問の場合は、最新の状況を反映してください
- 不明な点がある場合は「情報が見つかりませんでした」と明記してください
- 分かりやすい日本語で回答してください
- 必要に応じて情報源の該当箇所を引用してください
- 情報源にない情報については、一般的な知識として回答してください`
      : `あなたは親しみやすいAIアシスタントです。ユーザーの質問に分かりやすく、丁寧に回答してください。

回答のガイドライン:
- 分かりやすい日本語で回答してください
- 専門的な内容でも理解しやすく説明してください
- 不明な点がある場合は正直に伝えてください`;

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
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', errorData);
      throw new Error('OpenAI API呼び出しに失敗しました');
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '申し訳ございません。回答を生成できませんでした。';

    return NextResponse.json({
      response: aiResponse,
      hasDocumentContext: !!documentContext,
      hasSalesCaseContext: !!salesCaseContext,
      hasProgressNoteContext: !!progressNoteContext,
      contextSources: {
        documents: !!documentContext,
        salesCases: !!salesCaseContext,
        progressNotes: !!progressNoteContext
      }
    });

  } catch (error) {
    console.error('AIチャットエラー:', error);
    return NextResponse.json(
      { error: 'エラーが発生しました', response: '申し訳ございません。エラーが発生しました。もう一度お試しください。' },
      { status: 500 }
    );
  }
}

// 案件ステータスのラベルを取得
function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    'prospecting': '見込み客',
    'qualification': '見極め中',
    'proposal': '提案中',
    'negotiation': '交渉中',
    'closed_won': '成約',
    'closed_lost': '失注'
  };
  return statusMap[status] || status;
}

