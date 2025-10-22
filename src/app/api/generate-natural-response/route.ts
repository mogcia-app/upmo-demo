import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'プロンプトが必要です' },
        { status: 400 }
      );
    }

    // OpenAI APIを使用して自然な回答を生成
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      // APIキーがない場合は、プロンプトをそのまま返す
      return NextResponse.json({
        response: prompt
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'あなたは親しみやすいAIアシスタントです。手動入力データを基に、自然で分かりやすい回答を作成してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI API呼び出しに失敗しました');
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || prompt;

    return NextResponse.json({
      response: aiResponse
    });

  } catch (error) {
    console.error('AI回答生成エラー:', error);
    
    // エラー時はプロンプトをそのまま返す
    const { prompt } = await request.json();
    return NextResponse.json({
      response: prompt
    });
  }
}
