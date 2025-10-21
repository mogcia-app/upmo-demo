"use client";

import React, { useState } from "react";
import Layout from "../../../components/Layout";
import { ProtectedRoute } from "../../../components/ProtectedRoute";

interface Contract {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  description?: string;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([
    {
      id: '1',
      title: 'サービス利用契約書',
      fileName: 'service-contract-2024.pdf',
      fileUrl: '/sample-contract.pdf',
      uploadedAt: new Date('2024-10-20'),
      status: 'approved',
      description: 'メインサービスの利用に関する契約書'
    },
    {
      id: '2',
      title: '秘密保持契約書',
      fileName: 'nda-agreement.pdf',
      fileUrl: '/sample-nda.pdf',
      uploadedAt: new Date('2024-10-18'),
      status: 'pending',
      description: '機密情報の取り扱いに関する契約'
    }
  ]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newContract, setNewContract] = useState({
    title: '',
    description: '',
    file: null as File | null
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setNewContract(prev => ({ ...prev, file }));
    } else {
      alert('PDFファイルのみアップロード可能です。');
    }
  };

  const handleUpload = () => {
    if (!newContract.title || !newContract.file) {
      alert('タイトルとファイルを入力してください。');
      return;
    }

    // 実際のアプリケーションでは、ここでFirebase Storageなどにアップロード
    const contract: Contract = {
      id: Date.now().toString(),
      title: newContract.title,
      fileName: newContract.file.name,
      fileUrl: URL.createObjectURL(newContract.file), // 一時的なURL
      uploadedAt: new Date(),
      status: 'draft',
      description: newContract.description
    };

    setContracts(prev => [contract, ...prev]);
    setNewContract({ title: '', description: '', file: null });
    setShowUploadModal(false);
  };

  const getStatusColor = (status: Contract['status']) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: Contract['status']) => {
    switch (status) {
      case 'approved': return '承認済み';
      case 'pending': return '承認待ち';
      case 'rejected': return '却下';
      case 'draft': return '下書き';
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
                  契約書管理
                </h1>
                <p className="text-gray-600">
                  契約書のアップロード、管理、承認を行います。
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>契約書をアップロード</span>
              </button>
            </div>
          </div>

          {/* 統計カード */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-20z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">総契約書数</p>
                  <p className="text-2xl font-bold text-gray-900">{contracts.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">承認済み</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {contracts.filter(c => c.status === 'approved').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">承認待ち</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {contracts.filter(c => c.status === 'pending').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">下書き</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {contracts.filter(c => c.status === 'draft').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 契約書一覧 */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">契約書一覧</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      契約書名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      アップロード日
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contracts.map((contract) => (
                    <tr key={contract.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {contract.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            {contract.fileName}
                          </div>
                          {contract.description && (
                            <div className="text-xs text-gray-400 mt-1">
                              {contract.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(contract.status)}`}>
                          {getStatusText(contract.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {contract.uploadedAt.toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <a
                            href={contract.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#005eb2] hover:text-[#004a96]"
                          >
                            表示
                          </a>
                          <button className="text-gray-500 hover:text-gray-700">
                            ダウンロード
                          </button>
                          <button className="text-red-600 hover:text-red-800">
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* アップロードモーダル */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-gray-900">契約書をアップロード</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    契約書名
                  </label>
                  <input
                    type="text"
                    value={newContract.title}
                    onChange={(e) => setNewContract(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                    placeholder="例: サービス利用契約書"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    説明（任意）
                  </label>
                  <textarea
                    value={newContract.description}
                    onChange={(e) => setNewContract(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                    rows={3}
                    placeholder="契約書の詳細説明"
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

                {newContract.file && (
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-600">
                      選択されたファイル: <span className="font-medium">{newContract.file.name}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      サイズ: {(newContract.file.size / 1024 / 1024).toFixed(2)} MB
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
                  disabled={!newContract.title || !newContract.file}
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
