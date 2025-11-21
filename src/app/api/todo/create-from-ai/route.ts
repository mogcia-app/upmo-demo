import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

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

    // OpenAI APIでTODOを解析
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
            content: `あなたはTODOリスト作成をサポートするAIアシスタントです。
ユーザーのメッセージから、TODOタスクを抽出してJSON形式で返してください。

返答形式（JSON）:
{
  "todos": [
    {
      "text": "タスクのタイトル",
      "priority": "low" | "medium" | "high",
      "status": "todo" | "in-progress" | "shared",
      "description": "タスクの詳細説明（任意）",
      "dueDate": "YYYY-MM-DD形式の日付（任意、指定がない場合はnull）"
    }
  ],
  "message": "ユーザーへの返答メッセージ"
}

注意事項:
- タスクが複数ある場合は、すべて抽出してください
- 優先度は、緊急度や重要度から推測してください
- 日付が明示されていない場合は、dueDateはnullにしてください
- ステータスは通常"todo"にしてください
- JSONのみを返答し、余計な説明は不要です`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', errorData);
      throw new Error('OpenAI API呼び出しに失敗しました');
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '';

    // JSONを抽出（コードブロックがある場合を考慮）
    let jsonStr = aiResponse.trim();
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return NextResponse.json(parsed);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('AI Response:', aiResponse);
      // パースに失敗した場合、フォールバック処理
      return NextResponse.json({
        todos: [],
        message: 'TODOの解析に失敗しました。もう一度お試しください。'
      });
    }

  } catch (error) {
    console.error('TODO作成AIエラー:', error);
    return NextResponse.json(
      { error: 'エラーが発生しました', todos: [], message: 'エラーが発生しました。もう一度お試しください。' },
      { status: 500 }
    );
  }
}

