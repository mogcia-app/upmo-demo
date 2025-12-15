'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  documentType: 'meeting' | 'contract' | 'chat' | 'progressNote';
  documentId?: string;
  sourceType?: 'document' | 'chat' | 'progressNote';
}

export default function SummaryModal({
  isOpen,
  onClose,
  content,
  documentType,
  documentId,
  sourceType = 'document'
}: SummaryModalProps) {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<'executive' | 'sales' | 'backoffice'>('executive');
  const [summary, setSummary] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');

  const roleLabels = {
    executive: '経営層向け',
    sales: '営業向け',
    backoffice: 'バックオフィス向け'
  };

  const handleGenerateSummary = async () => {
    if (!user || !content.trim()) {
      setError('要約する内容がありません');
      return;
    }

    try {
      setIsGenerating(true);
      setError('');
      setSummary('');

      const token = await user.getIdToken();

      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content,
          documentType,
          role: selectedRole,
          documentId,
          sourceType
        })
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: `サーバーエラー (${response.status})` };
        }
        const errorMessage = errorData.error || '要約の生成に失敗しました';
        const errorDetails = errorData.details ? `\n詳細: ${errorData.details}` : '';
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      const data = await response.json();
      setSummary(data.summary || '要約を生成できませんでした。');

    } catch (err) {
      console.error('要約生成エラー:', err);
      setError(err instanceof Error ? err.message : '要約の生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">文書要約</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* ロール選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              要約形式を選択
            </label>
            <div className="flex gap-3">
              {(['executive', 'sales', 'backoffice'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    selectedRole === role
                      ? 'bg-[#005eb2] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {roleLabels[role]}
                </button>
              ))}
            </div>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* 要約生成ボタン */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerateSummary}
              disabled={isGenerating || !content.trim()}
              className="px-6 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  要約を生成中...
                </span>
              ) : (
                '要約を生成'
              )}
            </button>
          </div>

          {/* 要約結果 */}
          {summary && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {roleLabels[selectedRole]}要約
              </h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="prose max-w-none whitespace-pre-wrap text-gray-700">
                  {summary}
                </div>
              </div>
              
              {/* コピーボタン */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(summary);
                    alert('要約をクリップボードにコピーしました');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  コピー
                </button>
              </div>
            </div>
          )}

          {/* 元のコンテンツ（折りたたみ可能） */}
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
              元のコンテンツを表示
            </summary>
            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto">
              <pre className="text-xs text-gray-600 whitespace-pre-wrap">{content}</pre>
            </div>
          </details>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

