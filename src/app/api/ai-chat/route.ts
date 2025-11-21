import { NextRequest, NextResponse } from 'next/server';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

    // まず文書管理の内容を検索
    let documentContext = '';
    try {
      // 文書管理の内容を直接検索（Firestoreから）
      const searchQuery = message.toLowerCase();
      const keywords = searchQuery
        .replace(/[のをについて教えてとは]/g, ' ')
        .replace(/[、。！？]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter((word: string) => word.length > 1);
      
      const q = query(collection(db, 'manualDocuments'), orderBy('lastUpdated', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const relevantDocs: any[] = [];
      for (const doc of querySnapshot.docs) {
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
      
      if (relevantDocs.length > 0) {
        // 最も関連性の高い文書の内容を取得
        const bestDoc = relevantDocs[0];
        const sections = bestDoc.sections || {};
        
        // セクションの内容を結合
        const sectionTexts: string[] = [];
        for (const [key, value] of Object.entries(sections)) {
          if (Array.isArray(value)) {
            sectionTexts.push(`${key}: ${value.join('\n')}`);
          } else if (typeof value === 'string') {
            sectionTexts.push(`${key}: ${value}`);
          }
        }
        
        documentContext = `${bestDoc.title}\n\n${sectionTexts.join('\n\n')}`;
      }
    } catch (error) {
      console.error('文書検索エラー:', error);
    }

    // OpenAI APIで回答生成
    const systemPrompt = documentContext
      ? `あなたは企業の社内AIアシスタントです。以下の文書管理システムに保存されている情報を参考にして、ユーザーの質問に正確で分かりやすい回答をしてください。

参考文書:
${documentContext}

回答のガイドライン:
- 文書の内容に基づいて回答してください
- 不明な点がある場合は「文書に記載がありません」と明記してください
- 分かりやすい日本語で回答してください
- 必要に応じて文書の該当箇所を引用してください
- 文書にない情報については、一般的な知識として回答してください`
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
        max_tokens: 1000,
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
      hasDocumentContext: !!documentContext
    });

  } catch (error) {
    console.error('AIチャットエラー:', error);
    return NextResponse.json(
      { error: 'エラーが発生しました', response: '申し訳ございません。エラーが発生しました。もう一度お試しください。' },
      { status: 500 }
    );
  }
}

