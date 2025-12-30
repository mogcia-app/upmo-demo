import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 議事録の自動分類
export async function POST(request: NextRequest) {
  try {
    const { notes, title } = await request.json();

    if (!notes || !title) {
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

    const prompt = `以下の議事録を分析して、適切なカテゴリに分類してください。

カテゴリ候補:
- 営業・商談
- プロジェクト管理
- 人事・採用
- 経営・戦略
- 技術・開発
- 顧客対応
- その他

議事録タイトル: ${title}
議事録内容:
${notes}

上記のカテゴリ候補から最も適切なカテゴリを1つ選んで、カテゴリ名のみを回答してください。`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "あなたは議事録を適切なカテゴリに分類する専門家です。カテゴリ名のみを回答してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 50,
      temperature: 0.3
    });

    const category = completion.choices[0]?.message?.content?.trim() || 'その他';

    // カテゴリ候補に含まれていない場合は「その他」に
    const validCategories = ['営業・商談', 'プロジェクト管理', '人事・採用', '経営・戦略', '技術・開発', '顧客対応', 'その他'];
    const finalCategory = validCategories.includes(category) ? category : 'その他';

    return NextResponse.json({ category: finalCategory });

  } catch (error) {
    console.error('議事録分類エラー:', error);
    return NextResponse.json(
      { error: '議事録の分類に失敗しました' },
      { status: 500 }
    );
  }
}


