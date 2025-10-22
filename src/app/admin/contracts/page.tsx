'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Document {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  category: 'regulation' | 'contract' | 'manual' | 'other';
  description: string;
  extractedText: string;
}

export default function ContractsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newDocument, setNewDocument] = useState({
    title: '',
    description: '',
    category: 'regulation' as Document['category'],
    file: null as File | null
  });
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown'
    ];
    
    if (files && files.length > 0) {
      // 複数ファイル対応
      if (files.length === 1) {
        const file = files[0];
        if (allowedTypes.includes(file.type)) {
          setNewDocument(prev => ({ ...prev, file }));
        } else {
          alert('PDF、Word、テキスト、Markdownファイルのみアップロード可能です。');
        }
      } else {
        // 複数ファイルの場合は最初のファイルのみ
        const file = files[0];
        if (allowedTypes.includes(file.type)) {
          setNewDocument(prev => ({ ...prev, file }));
          alert(`${files.length}個のファイルが選択されましたが、1つずつアップロードしてください。最初のファイル「${file.name}」を選択しました。`);
        } else {
          alert('PDF、Word、テキスト、Markdownファイルのみアップロード可能です。');
        }
      }
    }
  };

  const handleUpload = async () => {
    if (!newDocument.title || !newDocument.file || !user) {
      alert('タイトルとファイルを選択してください。');
      return;
    }

    // ファイルサイズチェック (2MB制限 - テスト用に緩和)
    if (newDocument.file.size > 2 * 1024 * 1024) {
      alert('ファイルサイズが大きすぎます。2MB以下のファイルを選択してください。');
      return;
    }

    try {
      setIsUploading(true);
      
      // 新しいAPIを使用してPDF処理
      const formData = new FormData();
      formData.append('file', newDocument.file);
      formData.append('title', newDocument.title);
      formData.append('description', newDocument.description);
      formData.append('category', newDocument.category);
      
      const response = await fetch('/api/admin/process-document', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        if (response.status === 413) {
          throw new Error('ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。');
        }
        const errorData = await response.json().catch(() => ({ error: 'PDF処理に失敗しました' }));
        throw new Error(errorData.error || 'PDF処理に失敗しました');
      }
      
      const result = await response.json();
      
      console.log('Document processed successfully:', result);
      
      // 成功メッセージ
      alert(`ファイルが正常に処理されました！\n文書名: ${newDocument.title}\n文書タイプ: ${result.type}\nセクション数: ${result.sections.length}`);
      
      // フォームリセット
      setNewDocument({
        title: '',
        description: '',
        category: 'regulation',
        file: null
      });
      setShowUploadModal(false);
      
      // ドキュメントリストを更新
      await fetchDocumentsFromFirestore();
      
    } catch (error) {
      console.error('Upload error:', error);
      alert(`アップロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Firestoreからドキュメントを取得
  const fetchDocumentsFromFirestore = async () => {
    if (!user) return;
    
    try {
      // 新しい構造化文書コレクションから取得
      const response = await fetch('/api/search?q=*');
      if (response.ok) {
        const data = await response.json();
        // 構造化データをDocument形式に変換
        const formattedDocs = data.results?.map((doc: any) => ({
          id: doc.id,
          title: doc.name,
          fileName: doc.name,
          fileUrl: '', // 新しいAPIではファイルURLは不要
          uploadedAt: new Date(doc.lastUpdated),
          category: doc.type === 'meeting' ? 'regulation' : 'other',
          description: `文書タイプ: ${doc.type}`,
          extractedText: Object.values(doc.sections).join('\n')
        })) || [];
        
        setDocuments(formattedDocs);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  // ユーザー認証時にFirestoreからドキュメントを取得
  useEffect(() => {
    if (user) {
      fetchDocumentsFromFirestore();
    }
  }, [user]);

  const getCategoryColor = (category: Document['category']) => {
    switch (category) {
      case 'regulation': return 'bg-blue-100 text-blue-800';
      case 'contract': return 'bg-green-100 text-green-800';
      case 'manual': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryLabel = (category: Document['category']) => {
    switch (category) {
      case 'regulation': return '規則';
      case 'contract': return '契約';
      case 'manual': return 'マニュアル';
      default: return 'その他';
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">書類管理</h1>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-md hover:bg-[#004a96] transition-colors"
            >
              書類をアップロード
            </button>
          </div>

          {/* ドキュメントリスト */}
          <div className="grid gap-4">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{doc.title}</h3>
                    <p className="text-gray-600 text-sm mb-2">{doc.description}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>ファイル名: {doc.fileName}</span>
                      <span>アップロード日: {doc.uploadedAt.toLocaleDateString('ja-JP')}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(doc.category)}`}>
                    {getCategoryLabel(doc.category)}
                  </span>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">抽出されたテキスト:</h4>
                  <div className="bg-gray-50 rounded-md p-3 max-h-32 overflow-y-auto">
                    <p className="text-sm text-gray-600">
                      {doc.extractedText.substring(0, 200)}
                      {doc.extractedText.length > 200 && '...'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {documents.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">アップロードされた書類がありません。</p>
              </div>
            )}
          </div>

          {/* アップロードモーダル */}
          {showUploadModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-xl font-semibold mb-4">書類をアップロード</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      タイトル <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newDocument.title}
                      onChange={(e) => setNewDocument(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="文書のタイトルを入力してください"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      説明
                    </label>
                    <textarea
                      value={newDocument.description}
                      onChange={(e) => setNewDocument(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="文書の説明を入力してください（任意）"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ファイル <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      accept=".pdf,.docx,.doc,.txt,.md"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">対応形式: PDF, Word, テキスト, Markdown (最大2MB)</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      カテゴリ
                    </label>
                    <select
                      value={newDocument.category}
                      onChange={(e) => setNewDocument(prev => ({ 
                        ...prev, 
                        category: e.target.value as Document['category'] 
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                    >
                      <option value="regulation">規則</option>
                      <option value="contract">契約</option>
                      <option value="manual">マニュアル</option>
                      <option value="other">その他</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!newDocument.title || !newDocument.file || isUploading}
                    className="px-4 py-2 bg-[#005eb2] text-white rounded-md hover:bg-[#004a96] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? 'アップロード中...' : 'アップロード'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
