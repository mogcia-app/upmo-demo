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
ユーザーのメッセージから、目標を達成するための具体的なプロセス・手順をTODOタスクとして抽出してJSON形式で返してください。

返答形式（JSON）:
{
  "todos": [
    {
      "text": "タスクのタイトル（必須）",
      "priority": "low" | "medium" | "high",
      "status": "todo" | "in-progress" | "shared",
      "description": "タスクの詳細説明（任意）",
      "dueDate": "YYYY-MM-DD形式の日付（任意、指定がない場合はnull）",
      "startDate": "YYYY-MM-DD形式の日付（任意、指定がない場合はnull）"
    }
  ],
  "message": "ユーザーへの返答メッセージ"
}

重要な注意事項:
1. 目標からプロセスを具体化:
   - ユーザーが提示した目標（例：「会員サイトを作る」「打ち合わせ資料を作る」）を達成するための一般的な開発手順・プロセスを具体化してください
   - 目標そのものではなく、目標達成までのステップをTODOとして抽出してください
   - 例：「会員サイトを作る」→ 要件定義、設計、実装、テスト、デプロイなどの開発プロセス
   - 例：「打ち合わせ資料を作る」→ 目次を決める、内容をまとめる、デザインする、レビューするなどの作業手順

2. タスクの順序と優先度:
   - タスクは時系列順（最初にやるべきことから）に並べてください
   - 優先度は、プロセスの初期段階ほど高く設定してください（要件定義 > 実装 > テストなど）
   - 各タスクは独立して実行可能な単位にしてください

3. 日付の処理:
   - ユーザーが期限を指定している場合（例：「来週の金曜日までに」）、その期限を最終タスクのdueDateに設定してください
   - 中間タスクの日付は、期限から逆算して適切に設定してください（期限がない場合はnull）
   - 開始日が指定されている場合は、最初のタスクのstartDateに設定してください

4. その他の注意事項:
   - タスクは最低でも3つ以上、通常は5-8個程度に分解してください
- ステータスは通常"todo"にしてください
   - textフィールドは必須です。空のタスクは作成しないでください
   - 必ず有効なJSON形式で返答してください。JSON以外のテキストは含めないでください

例1:
入力: "会員サイトを作る上で必要なことをまとめて"
出力: {
  "todos": [
    {"text": "要件定義書の作成", "priority": "high", "status": "todo", "description": "会員サイトの機能要件、非機能要件を整理", "dueDate": null, "startDate": null},
    {"text": "システム設計書の作成", "priority": "high", "status": "todo", "description": "データベース設計、API設計、画面設計", "dueDate": null, "startDate": null},
    {"text": "開発環境の構築", "priority": "high", "status": "todo", "description": "開発サーバー、データベース、各種ツールのセットアップ", "dueDate": null, "startDate": null},
    {"text": "会員登録機能の実装", "priority": "medium", "status": "todo", "description": "新規会員登録フォームとバックエンドAPIの実装", "dueDate": null, "startDate": null},
    {"text": "ログイン機能の実装", "priority": "medium", "status": "todo", "description": "ログインフォームと認証処理の実装", "dueDate": null, "startDate": null},
    {"text": "会員情報管理機能の実装", "priority": "medium", "status": "todo", "description": "会員情報の閲覧・編集機能", "dueDate": null, "startDate": null},
    {"text": "テストの実施", "priority": "medium", "status": "todo", "description": "単体テスト、結合テスト、動作確認", "dueDate": null, "startDate": null},
    {"text": "本番環境へのデプロイ", "priority": "low", "status": "todo", "description": "本番サーバーへのデプロイと動作確認", "dueDate": null, "startDate": null}
  ],
  "message": "会員サイト作成のための8つのタスクを作成しました。"
}

例2:
入力: "来週の金曜日までに打ち合わせ資料を作る"
出力: {
  "todos": [
    {"text": "資料の目次構成を決める", "priority": "high", "status": "todo", "description": "資料の章立てと流れを決定", "dueDate": null, "startDate": null},
    {"text": "各セクションの内容をまとめる", "priority": "high", "status": "todo", "description": "各章の詳細内容を執筆", "dueDate": null, "startDate": null},
    {"text": "図表やグラフを作成する", "priority": "medium", "status": "todo", "description": "必要な図表、グラフ、フローチャートの作成", "dueDate": null, "startDate": null},
    {"text": "資料のデザイン・レイアウトを整える", "priority": "medium", "status": "todo", "description": "フォント、色、レイアウトの調整", "dueDate": null, "startDate": null},
    {"text": "内容のレビュー・校正", "priority": "medium", "status": "todo", "description": "誤字脱字、内容の整合性チェック", "dueDate": null, "startDate": null},
    {"text": "最終確認と提出準備", "priority": "low", "status": "todo", "description": "最終チェックとPDF化、提出", "dueDate": "2025-01-10", "startDate": null}
  ],
  "message": "打ち合わせ資料作成のための6つのタスクを作成しました。来週の金曜日（2025-01-10）を最終期限に設定しました。"
}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 2000,
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

