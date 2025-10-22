import { NextRequest, NextResponse } from 'next/server';

// 手動で自然な回答を生成する関数
function generateNaturalResponseManually(prompt: string): string {
  try {
    // プロンプトから質問と手動入力データを抽出
    const lines = prompt.split('\n');
    let query = '';
    let manualData = '';
    
    for (const line of lines) {
      if (line.startsWith('質問: ')) {
        query = line.replace('質問: ', '').trim();
      } else if (line.startsWith('手動入力データ: ')) {
        manualData = line.replace('手動入力データ: ', '').trim();
      }
    }
    
    if (!query || !manualData) {
      return prompt; // 抽出できない場合は元のプロンプトを返す
    }
    
    // 質問からキーワードを抽出
    const keyword = query.replace(/について教えて/g, '').replace(/について/g, '').trim();
    
    // 自然な回答を生成
    const naturalResponse = `${keyword}についてのご質問ですね！\n\n${keyword}では、${manualData}。`;
    
    return naturalResponse;
  } catch (error) {
    console.error('手動回答生成エラー:', error);
    return prompt;
  }
}

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
    
    console.log('OpenAI API Key exists:', !!openaiApiKey);
    console.log('Prompt received:', prompt);
    
    if (!openaiApiKey) {
      console.log('No OpenAI API key found, using manual generation');
      // APIキーがない場合は、手動で自然な回答を生成
      const naturalResponse = generateNaturalResponseManually(prompt);
      return NextResponse.json({
        response: naturalResponse
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
    
    // エラー時は手動で自然な回答を生成
    try {
      const { prompt } = await request.json();
      const naturalResponse = generateNaturalResponseManually(prompt);
      return NextResponse.json({
        response: naturalResponse
      });
    } catch (fallbackError) {
      console.error('フォールバック処理エラー:', fallbackError);
      return NextResponse.json({
        response: "申し訳ございません。エラーが発生しました。"
      });
    }
  }
}
