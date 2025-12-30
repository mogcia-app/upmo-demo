import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 議事録の要約生成
export async function POST(request: NextRequest) {
  try {
    const { notes, title, actionItems } = await request.json();

    if (!notes) {
      return NextResponse.json(
        { error: '議事録の内容が必要です' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI APIキーが設定されていません' },
        { status: 500 }
      );
    }

    const actionItemsText = actionItems && actionItems.length > 0
      ? `\n\nアクション項目:\n${actionItems.map((item: any, index: number) => 
          `${index + 1}. ${item.item} (担当: ${item.assignee}, 期限: ${item.deadline})`
        ).join('\n')}`
      : '';

    const prompt = `以下の議事録を要約してください。

議事録タイトル: ${title || 'タイトルなし'}
議事録内容:
${notes}${actionItemsText}

要約の要件:
- 会議の目的と主要な決定事項を明確に
- 重要なポイントを箇条書きで整理
- アクション項目があれば含める
- 簡潔で読みやすく（200文字程度）
- 日本語で回答`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "あなたは議事録を要約する専門家です。簡潔で分かりやすい要約を作成してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.5
    });

    const summary = completion.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({ summary });

  } catch (error) {
    console.error('議事録要約エラー:', error);
    return NextResponse.json(
      { error: '議事録の要約生成に失敗しました' },
      { status: 500 }
    );
  }
}


