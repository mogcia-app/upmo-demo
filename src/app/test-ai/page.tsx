'use client';

import React, { useState } from 'react';

export default function TestAIPage() {
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testAPIKey = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/test-ai');
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const testAIResponse = async () => {
    setIsLoading(true);
    try {
      const testPrompt = `以下の手動入力データを基に、自然で親しみやすい回答を作成してください。

質問: Upmoの料金について教えて
手動入力データ: 月額3万円の1年縛り

回答形式:
- 「Upmoの料金についてのご質問ですね！」で始める
- 手動入力データの内容を自然な文章で説明
- 絵文字（✨）を適切に使用
- です・ます調で統一
- 簡潔で分かりやすく

手動入力データの内容をそのまま使用し、自然な文章にまとめてください。`;

      const response = await fetch('/api/test-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: testPrompt }),
      });
      
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">AI API テストページ</h1>
      
      <div className="space-y-4">
        <button
          onClick={testAPIKey}
          disabled={isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          APIキー確認
        </button>
        
        <button
          onClick={testAIResponse}
          disabled={isLoading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 ml-4"
        >
          AI回答テスト
        </button>
      </div>

      {isLoading && (
        <div className="mt-4 text-blue-600">テスト中...</div>
      )}

      {testResult && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <h2 className="text-lg font-semibold mb-2">テスト結果:</h2>
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
