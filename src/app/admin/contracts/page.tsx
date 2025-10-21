"use client";

import React, { useState } from "react";
import Layout from "../../../components/Layout";
import { ProtectedRoute } from "../../../components/ProtectedRoute";
import { addCompanyPolicy } from "../../../utils/companyPolicySearch";

interface Document {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  category: 'regulation' | 'policy' | 'manual' | 'other';
  description?: string;
  extractedText?: string; // PDFから抽出されたテキスト
}

export default function ContractsPage() {
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: '1',
      title: '就業規則',
      fileName: 'work-regulations-2024.pdf',
      fileUrl: '/sample-work-regulations.pdf',
      uploadedAt: new Date('2024-10-20'),
      category: 'regulation',
      description: '会社の就業に関する基本規則',
      extractedText: `第1章 総則
第1条（目的）
この就業規則は、労働基準法第89条に基づき、従業員の労働条件を明らかにし、会社と従業員の相互理解を深め、健全な労使関係の確立を図ることを目的とする。

第2条（適用範囲）
この規則は、会社に雇用されるすべての従業員に適用する。

第2章 労働時間・休日・休暇
第3条（労働時間）
1. 所定労働時間は1日8時間、週40時間とする。
2. 始業時刻は午前9時、終業時刻は午後6時とする。
3. 休憩時間は正午から午後1時までの1時間とする。

第4条（休日）
1. 週休日は土曜日及び日曜日とする。
2. 国民の祝日は休日とする。
3. 年末年始休暇は12月29日から1月3日までとする。`
    },
    {
      id: '2',
      title: '情報セキュリティポリシー',
      fileName: 'security-policy.pdf',
      fileUrl: '/sample-security-policy.pdf',
      uploadedAt: new Date('2024-10-18'),
      category: 'policy',
      description: '情報セキュリティに関する方針',
      extractedText: `1. 基本方針
当社は、情報資産を適切に保護し、顧客及び関係者の信頼を得るため、情報セキュリティマネジメントシステムを構築・運用する。

2. 適用範囲
このポリシーは、当社の全従業員及び委託先に適用される。

3. 情報資産の管理
3.1 機密情報の取り扱い
機密情報は適切に分類し、アクセス制御を行う。
3.2 パスワード管理
強固なパスワードを設定し、定期的に変更する。
3.3 ウイルス対策
最新のウイルス対策ソフトウェアを導入し、定期的に更新する。`
    },
    {
      id: '3',
      title: '人事マニュアル',
      fileName: 'hr-manual.pdf',
      fileUrl: '/sample-hr-manual.pdf',
      uploadedAt: new Date('2024-10-15'),
      category: 'manual',
      description: '人事業務に関する手順書',
      extractedText: `人事業務マニュアル

第1章 採用業務
1. 採用計画の策定
年度開始時に採用計画を策定し、必要な人材を確保する。

2. 面接プロセス
2.1 書類選考
応募書類を確認し、一次選考を行う。
2.2 面接実施
複数回の面接を実施し、適性を判断する。

第2章 入社手続き
1. 入社前準備
内定者に対して必要な書類の準備を依頼する。
2. 入社当日
各種手続きを行い、オンボーディングを実施する。`
    }
  ]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newDocument, setNewDocument] = useState({
    title: '',
    description: '',
    category: 'regulation' as Document['category'],
    file: null as File | null
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setNewDocument(prev => ({ ...prev, file }));
    } else {
      alert('PDFファイルのみアップロード可能です。');
    }
  };

  const handleUpload = async () => {
    if (!newDocument.title || !newDocument.file) {
      alert('タイトルとファイルを入力してください。');
      return;
    }

    try {
      // PDFからテキストを抽出（動的インポート）
      const { extractPDFText } = await import("../../../utils/pdfExtractor");
      const extractedText = await extractPDFText(newDocument.file);
      
      const document: Document = {
        id: Date.now().toString(),
        title: newDocument.title,
        fileName: newDocument.file.name,
        fileUrl: URL.createObjectURL(newDocument.file), // 一時的なURL
        uploadedAt: new Date(),
        category: newDocument.category,
        description: newDocument.description,
        extractedText: extractedText
      };

      // 社内規則検索システムに登録
      addCompanyPolicy({
        id: document.id,
        title: document.title,
        category: document.category,
        content: extractedText,
        lastUpdated: document.uploadedAt
      });

      setDocuments(prev => [document, ...prev]);
      setNewDocument({ title: '', description: '', category: 'regulation', file: null });
      setShowUploadModal(false);
      
      alert('書類のアップロードとテキスト抽出が完了しました！');
    } catch (error) {
      console.error('PDF読み込みエラー:', error);
      alert('PDFの読み込みに失敗しました。ファイル形式を確認してください。');
    }
  };

  const getCategoryColor = (category: Document['category']) => {
    switch (category) {
      case 'regulation': return 'bg-blue-100 text-blue-800';
      case 'policy': return 'bg-green-100 text-green-800';
      case 'manual': return 'bg-purple-100 text-purple-800';
      case 'other': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryText = (category: Document['category']) => {
    switch (category) {
      case 'regulation': return '規定・規則';
      case 'policy': return 'ポリシー';
      case 'manual': return 'マニュアル';
      case 'other': return 'その他';
      default: return '不明';
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* ヘッダー */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  企業規定書類管理
                </h1>
                <p className="text-gray-600">
                  企業の規定書類、ポリシー、マニュアルを管理します。
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>書類をアップロード</span>
              </button>
            </div>
          </div>


          {/* 書類一覧 - カード表示 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">書類一覧</h2>
              <div className="text-sm text-gray-500">
                全 {documents.length} 件
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((document) => (
                <div key={document.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="p-6">
                    {/* ヘッダー */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {document.title}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {document.fileName}
                        </p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(document.category)}`}>
                        {getCategoryText(document.category)}
                      </span>
                    </div>

                    {/* 説明 */}
                    {document.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {document.description}
                      </p>
                    )}

                    {/* アップロード日 */}
                    <div className="text-xs text-gray-400 mb-4">
                      アップロード日: {document.uploadedAt.toLocaleDateString('ja-JP')}
                    </div>

                    {/* 操作ボタン */}
                    <div className="flex space-x-2">
                      <a
                        href={document.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-2 bg-[#005eb2] text-white text-sm rounded-md hover:bg-[#004a96] transition-colors text-center"
                      >
                        表示
                      </a>
                      <button className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors">
                        ダウンロード
                      </button>
                      <button className="px-3 py-2 border border-red-300 text-red-700 text-sm rounded-md hover:bg-red-50 transition-colors">
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 空の状態 */}
            {documents.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-20z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  書類がありません
                </h3>
                <p className="text-gray-600 mb-6">
                  最初の書類をアップロードしてください。
                </p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 bg-[#005eb2] text-white rounded-md hover:bg-[#004a96] transition-colors"
                >
                  書類をアップロード
                </button>
              </div>
            )}
          </div>
        </div>

        {/* アップロードモーダル */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-gray-900">書類をアップロード</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    書類名
                  </label>
                  <input
                    type="text"
                    value={newDocument.title}
                    onChange={(e) => setNewDocument(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                    placeholder="例: 就業規則"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    カテゴリ
                  </label>
                  <select
                    value={newDocument.category}
                    onChange={(e) => setNewDocument(prev => ({ ...prev, category: e.target.value as Document['category'] }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                  >
                    <option value="regulation">規定・規則</option>
                    <option value="policy">ポリシー</option>
                    <option value="manual">マニュアル</option>
                    <option value="other">その他</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    説明（任意）
                  </label>
                  <textarea
                    value={newDocument.description}
                    onChange={(e) => setNewDocument(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                    rows={3}
                    placeholder="書類の詳細説明"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PDFファイル
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    PDFファイルのみアップロード可能です（最大10MB）
                  </p>
                </div>

                {newDocument.file && (
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-600">
                      選択されたファイル: <span className="font-medium">{newDocument.file.name}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      サイズ: {(newDocument.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!newDocument.title || !newDocument.file}
                  className="px-4 py-2 bg-[#005eb2] text-white rounded-md hover:bg-[#004a96] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  アップロード
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
