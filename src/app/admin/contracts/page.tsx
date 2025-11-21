'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface ManualDocument {
  id: string;
  title: string;
  type: 'meeting' | 'policy' | 'contract' | 'manual' | 'other';
  description: string;
  sections: {
    overview: string;
    features: string[];
    pricing: string[];
    procedures: string[];
    support?: string[];
    rules?: string[];
    terms?: string[];
  };
  tags: string[];
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  lastUpdated: Date;
}

export default function ContractsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ManualDocument[]>([]);
  const [editingDocument, setEditingDocument] = useState<ManualDocument | null>(null);
  const [showInputModal, setShowInputModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newDocument, setNewDocument] = useState<ManualDocument>({
    id: '',
    title: '',
    description: '',
    type: 'meeting',
    sections: {
      overview: '',
      features: [],
      pricing: [],
      procedures: []
    },
    tags: [],
    priority: 'medium',
    createdAt: new Date(),
    lastUpdated: new Date()
  });
  const [currentSection, setCurrentSection] = useState<'overview' | 'features' | 'pricing' | 'procedures' | 'support' | 'rules' | 'terms'>('overview');
  const [sectionInput, setSectionInput] = useState('');
  
  // AI解析用の状態
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiInputText, setAiInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiParsedDocument, setAiParsedDocument] = useState<ManualDocument | null>(null);

  const handleSaveDocument = async () => {
    if (!newDocument.title || !user) {
      alert('タイトルを入力してください。');
      return;
    }

    try {
      setIsSaving(true);
      
      // 認証トークンを取得
      const token = await user.getIdToken();
      
      // Firestoreに保存
      const response = await fetch('/api/admin/save-manual-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newDocument
        })
      });

      if (!response.ok) {
        throw new Error('文書の保存に失敗しました');
      }

      const result = await response.json();
      
      console.log('Document saved successfully:', result);
      
      // 成功メッセージ
      alert(`文書が正常に保存されました！\n文書名: ${newDocument.title}\nタイプ: ${newDocument.type}`);
      
      // フォームリセット
      setNewDocument({
        id: '',
        title: '',
        description: '',
        type: 'meeting',
        sections: {
          overview: '',
          features: [],
          pricing: [],
          procedures: []
        },
        tags: [],
        priority: 'medium',
        createdAt: new Date(),
        lastUpdated: new Date()
      });
      setShowInputModal(false);
      setCurrentSection('overview');
      setSectionInput('');
      
      // ドキュメントリストを更新
      await fetchDocumentsFromFirestore();
      
    } catch (error) {
      console.error('Save error:', error);
      alert(`保存に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToSection = () => {
    if (!sectionInput.trim()) return;

    const currentValue = newDocument.sections?.[currentSection] || [];
    const updatedValue = Array.isArray(currentValue) 
      ? [...currentValue, sectionInput.trim()]
      : [sectionInput.trim()];

    setNewDocument(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [currentSection]: updatedValue
      }
    }));

    setSectionInput('');
  };

  // 複数項目を一括追加（改行区切り）
  const handleBulkAddToSection = (text: string) => {
    if (!text.trim()) return;

    // 改行で分割し、空行を除外
    const items = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (items.length === 0) return;

    const currentValue = newDocument.sections?.[currentSection] || [];
    const updatedValue = Array.isArray(currentValue) 
      ? [...currentValue, ...items]
      : items;

    setNewDocument(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [currentSection]: updatedValue
      }
    }));
  };

  const handleRemoveFromSection = (index: number) => {
    const currentValue = newDocument.sections?.[currentSection] || [];
    if (Array.isArray(currentValue)) {
      const updatedValue = currentValue.filter((_, i) => i !== index);
      setNewDocument(prev => ({
        ...prev,
        sections: {
          ...prev.sections,
          [currentSection]: updatedValue
        }
      }));
    }
  };

  // AI解析関数（独立した機能）
  const handleAIAnalysis = async () => {
    if (!aiInputText.trim()) {
      alert('解析するテキストを入力してください。');
      return;
    }

    try {
      if (!user) {
        alert('ログインが必要です');
        return;
      }
      
      setIsAnalyzing(true);
      
      // 認証トークンを取得
      const token = await user.getIdToken();
      
      const response = await fetch('/api/admin/parse-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: aiInputText,
          documentType: 'contract' // デフォルトタイプ
        })
      });

      if (!response.ok) {
        throw new Error('AI解析に失敗しました');
      }

      const result = await response.json();
      
      if (result.success && result.parsedDocument) {
        const parsed = result.parsedDocument;
        
        // AI解析結果を独立したドキュメントとして保存
        const parsedDocument: ManualDocument = {
          id: '',
          title: parsed.title || 'AI解析された文書',
          description: parsed.description || '',
          type: parsed.type || 'contract',
          sections: {
            overview: parsed.sections.overview || '',
            features: parsed.sections.features || [],
            pricing: parsed.sections.pricing || [],
            procedures: parsed.sections.procedures || [],
            support: parsed.sections.support || [],
            rules: parsed.sections.rules || [],
            terms: parsed.sections.terms || []
          },
          tags: parsed.tags || [],
          priority: parsed.priority || 'medium',
          createdAt: new Date(),
          lastUpdated: new Date()
        };
        
        setAiParsedDocument(parsedDocument);
        setAiInputText('');
        alert('AI解析が完了しました！結果を確認して保存してください。');
      } else {
        throw new Error('AI解析の結果が取得できませんでした');
      }
      
    } catch (error) {
      console.error('AI analysis error:', error);
      alert(`AI解析に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // AI解析結果を保存
  const handleSaveAIDocument = async () => {
    if (!aiParsedDocument || !user) {
      alert('保存する文書がありません。');
      return;
    }

    try {
      setIsSaving(true);
      
      // 認証トークンを取得
      const token = await user.getIdToken();
      
      const response = await fetch('/api/admin/save-manual-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...aiParsedDocument
        })
      });

      if (!response.ok) {
        throw new Error('文書の保存に失敗しました');
      }

      const result = await response.json();
      
      console.log('AI Document saved successfully:', result);
      
      alert(`AI解析された文書が正常に保存されました！\n文書名: ${aiParsedDocument.title}`);
      
      // リセット
      setAiParsedDocument(null);
      setShowAIModal(false);
      
      // ドキュメントリストを更新
      await fetchDocumentsFromFirestore();
      
    } catch (error) {
      console.error('Save AI document error:', error);
      alert(`保存に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    const tagInput = document.getElementById('tagInput') as HTMLInputElement;
    if (tagInput && tagInput.value.trim()) {
      setNewDocument(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.value.trim()]
      }));
      tagInput.value = '';
    }
  };

  const handleRemoveTag = (index: number) => {
    setNewDocument(prev => ({
      ...prev,
      tags: prev.tags?.filter((_, i) => i !== index) || []
    }));
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('この文書を削除しますか？')) return;
    
    try {
      // TODO: 削除APIを実装
      console.log('Delete document:', documentId);
      alert('削除機能は実装中です');
    } catch (error) {
      console.error('Delete error:', error);
      alert('削除に失敗しました');
    }
  };

  // Firestoreからドキュメントを取得
  const fetchDocumentsFromFirestore = async () => {
    if (!user) return;
    
    try {
      // 認証トークンを取得
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/get-manual-documents?userId=${user.uid}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        // 日付を確実にDateオブジェクトに変換
        const documents = (data.documents || []).map((doc: any) => ({
          ...doc,
          createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
          lastUpdated: doc.lastUpdated instanceof Date ? doc.lastUpdated : new Date(doc.lastUpdated)
        }));
        setDocuments(documents);
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

  const getTypeColor = (type: ManualDocument['type']) => {
    switch (type) {
      case 'meeting': return 'bg-blue-100 text-blue-800';
      case 'policy': return 'bg-green-100 text-green-800';
      case 'contract': return 'bg-purple-100 text-purple-800';
      case 'manual': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: ManualDocument['type']) => {
    switch (type) {
      case 'meeting': return '打ち合わせ';
      case 'policy': return '規則';
      case 'contract': return '契約';
      case 'manual': return 'マニュアル';
      default: return 'その他';
    }
  };

  const getPriorityColor = (priority: ManualDocument['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityLabel = (priority: ManualDocument['priority']) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '中';
    }
  };

  const getSectionLabel = (section: string) => {
    switch (section) {
      case 'overview': return '概要';
      case 'features': return '機能';
      case 'pricing': return '料金';
      case 'procedures': return '手順';
      case 'support': return 'サポート';
      case 'rules': return '規則';
      case 'terms': return '条項';
      default: return section;
    }
  };

  return (
    <ProtectedRoute adminOnly={true}>
      <Layout>
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">文書管理</h1>
            
            {/* 目立つ追加ボタン */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">新しい文書を追加</h2>
                <p className="text-gray-600 text-sm">構造化された手動入力で、高精度な検索・回答が可能な文書を作成できます</p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                  <button
                    onClick={() => setShowAIModal(true)}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors font-medium shadow-lg hover:shadow-xl transform hover:scale-105 text-sm sm:text-base"
                  >
                    <span className="flex items-center">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      AI文書解析
                    </span>
                  </button>
                  <button
                    onClick={() => setShowInputModal(true)}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors font-medium shadow-lg hover:shadow-xl transform hover:scale-105 text-sm sm:text-base"
                  >
                    <span className="flex items-center">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      手動入力
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ドキュメントリスト */}
          <div className="space-y-4">
            {documents.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">文書がありません</h3>
                <p className="mt-1 text-sm text-gray-500">最初の文書を追加して始めましょう</p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowInputModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#005eb2] hover:bg-[#004a96] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    文書を追加
                  </button>
                </div>
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="bg-white rounded-lg shadow-md p-4 sm:p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-4">
                    <div className="flex-1">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">{doc.title}</h3>
                      <p className="text-gray-600 text-sm mb-2">{doc.description}</p>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0 text-sm text-gray-500">
                        <span>作成日: {doc.createdAt instanceof Date ? doc.createdAt.toLocaleDateString('ja-JP') : new Date(doc.createdAt).toLocaleDateString('ja-JP')}</span>
                        <span>更新日: {doc.lastUpdated instanceof Date ? doc.lastUpdated.toLocaleDateString('ja-JP') : new Date(doc.lastUpdated).toLocaleDateString('ja-JP')}</span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(doc.type)}`}>
                        {getTypeLabel(doc.type)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(doc.priority)}`}>
                        優先度: {getPriorityLabel(doc.priority)}
                      </span>
                    </div>
                  </div>
                  
                  {/* タグ */}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2">
                        {doc.tags.map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* セクション内容 */}
                  <div className="mt-4">
                    {Object.entries(doc.sections).map(([key, value]) => (
                      <div key={key} className="mb-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">{getSectionLabel(key)}:</h4>
                        <div className="bg-gray-50 rounded-md p-3">
                          {Array.isArray(value) ? (
                            <ul className="text-sm text-gray-600 space-y-1">
                              {value.map((item, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-gray-400 mr-2">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-600">{value}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* アクションボタン */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setEditingDocument(doc);
                        setShowInputModal(true);
                      }}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 手動入力モーダル */}
          {showInputModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">文書を手動入力</h2>
                  <button
                    onClick={() => setShowInputModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* 基本情報セクション */}
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        タイトル <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newDocument.title || ''}
                        onChange={(e) => setNewDocument(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="例: 有給休暇取得規則"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent text-base"
                        required
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        説明
                      </label>
                      <textarea
                        value={newDocument.description || ''}
                        onChange={(e) => setNewDocument(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="この文書の概要や目的を入力してください"
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent text-base"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        文書タイプ
                      </label>
                      <select
                        value={newDocument.type || 'meeting'}
                        onChange={(e) => setNewDocument(prev => ({ 
                          ...prev, 
                          type: e.target.value as ManualDocument['type'] 
                        }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent text-base"
                      >
                        <option value="meeting">打ち合わせ</option>
                        <option value="policy">規則</option>
                        <option value="contract">契約</option>
                        <option value="manual">マニュアル</option>
                        <option value="other">その他</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        優先度
                      </label>
                      <select
                        value={newDocument.priority || 'medium'}
                        onChange={(e) => setNewDocument(prev => ({ 
                          ...prev, 
                          priority: e.target.value as ManualDocument['priority'] 
                        }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent text-base"
                      >
                        <option value="high">高</option>
                        <option value="medium">中</option>
                        <option value="low">低</option>
                      </select>
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        タグ（検索用）
                      </label>
                      <div className="flex space-x-2 mb-2">
                        <input
                          id="tagInput"
                          type="text"
                          placeholder="例: 有給、休暇、規則"
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent text-base"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                        />
                        <button
                          onClick={handleAddTag}
                          className="px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                        >
                          追加
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {newDocument.tags?.map((tag, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center">
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(index)}
                              className="ml-2 text-blue-600 hover:text-blue-800 font-bold"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* セクション入力エリア */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">文書内容</h3>
                  
                  {/* セクションタブ */}
                  <div className="border-b border-gray-200 mb-6">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'overview', label: '概要', desc: '文書の全体像を説明' },
                        { key: 'features', label: '特徴・機能', desc: '主な特徴や機能を箇条書き' },
                        { key: 'pricing', label: '料金・費用', desc: '料金や費用に関する情報' },
                        { key: 'procedures', label: '手順・プロセス', desc: '手順やプロセスを箇条書き' },
                        { key: 'support', label: 'サポート', desc: 'サポート情報' },
                        { key: 'rules', label: '規則・ルール', desc: '規則やルールを箇条書き' },
                        { key: 'terms', label: '条件・条項', desc: '条件や条項を箇条書き' }
                      ].map((section) => (
                        <button
                          key={section.key}
                          onClick={() => setCurrentSection(section.key as any)}
                          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                            currentSection === section.key
                              ? 'bg-[#005eb2] text-white border-b-2 border-[#005eb2]'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          title={section.desc}
                        >
                          {section.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* 現在のセクション入力 */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getSectionLabel(currentSection)}
                        <span className="text-gray-500 text-xs ml-2">（自由に長文を入力できます）</span>
                      </label>
                      
                      <textarea
                        value={
                          currentSection === 'overview' 
                            ? (newDocument.sections?.overview || '')
                            : (Array.isArray(newDocument.sections?.[currentSection]) 
                                ? (newDocument.sections?.[currentSection] as string[]).join('\n')
                                : '')
                        }
                        onChange={(e) => {
                          if (currentSection === 'overview') {
                            setNewDocument(prev => ({
                              ...prev,
                              sections: {
                                ...prev.sections,
                                overview: e.target.value
                              }
                            }));
                          } else {
                            // 配列セクションの場合、改行で分割して配列として保存
                            const lines = e.target.value.split('\n').filter(line => line.trim().length > 0);
                            setNewDocument(prev => ({
                              ...prev,
                              sections: {
                                ...prev.sections,
                                [currentSection]: lines.length > 0 ? lines : []
                              }
                            }));
                          }
                        }}
                        placeholder={`${getSectionLabel(currentSection)}の内容を自由に入力してください...\n\n改行も自由に使えます。\n箇条書きにしたい場合は、1行ずつ入力してください。`}
                        rows={12}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent text-base leading-relaxed"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        💡 自由に長文を入力できます。改行も自由に使えます。箇条書きにしたい場合は、1行ずつ入力してください。
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setShowInputModal(false)}
                    className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSaveDocument}
                    disabled={!newDocument.title || isSaving}
                    className="px-6 py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md"
                  >
                    {isSaving ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        保存中...
                      </span>
                    ) : (
                      '保存'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI解析モーダル */}
          {showAIModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    AI文書解析
                  </h3>
                  <button
                    onClick={() => {
                      setShowAIModal(false);
                      setAiParsedDocument(null);
                      setAiInputText('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {!aiParsedDocument ? (
                  // 入力画面
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        解析する文書（契約書・規約・マニュアルなど）
                      </label>
                      <textarea
                        value={aiInputText}
                        onChange={(e) => setAiInputText(e.target.value)}
                        placeholder="契約書、規約、マニュアル、手順書などの文書をコピペしてください。AIが自動で項目ごとに振り分けます。"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
                      />
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-800 mb-2">AI文書解析の機能</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• 契約条件・料金情報を自動で「料金」セクションに振り分け</li>
                        <li>• サービス内容・機能を「機能」セクションに分類</li>
                        <li>• 手順・プロセスを「手順」セクションに整理</li>
                        <li>• サポート・問い合わせ情報を「サポート」セクションに分類</li>
                        <li>• 規約・ルールを「規則」セクションに整理</li>
                        <li>• タイトルと概要を自動生成</li>
                        <li>• 関連タグを自動付与</li>
                      </ul>
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => {
                          setShowAIModal(false);
                          setAiInputText('');
                        }}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleAIAnalysis}
                        disabled={!aiInputText.trim() || isAnalyzing}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-md hover:from-blue-600 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAnalyzing ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            解析中...
                          </span>
                        ) : (
                          'AI解析を実行'
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  // 結果表示画面
                  <div className="space-y-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-green-800 mb-2">✅ AI解析完了</h4>
                      <p className="text-sm text-green-700">文書が正常に解析されました。内容を確認して保存してください。</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">文書情報</h4>
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs text-gray-500">タイトル</label>
                            <p className="text-sm font-medium">{aiParsedDocument.title}</p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">概要</label>
                            <p className="text-sm">{aiParsedDocument.description}</p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">タグ</label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {aiParsedDocument.tags.map((tag, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">解析結果</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-500">料金情報:</span>
                            <span className="ml-2">{aiParsedDocument.sections.pricing.length}件</span>
                          </div>
                          <div>
                            <span className="text-gray-500">機能:</span>
                            <span className="ml-2">{aiParsedDocument.sections.features.length}件</span>
                          </div>
                          <div>
                            <span className="text-gray-500">手順:</span>
                            <span className="ml-2">{aiParsedDocument.sections.procedures.length}件</span>
                          </div>
                          <div>
                            <span className="text-gray-500">サポート:</span>
                            <span className="ml-2">{aiParsedDocument.sections.support?.length || 0}件</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => {
                          setAiParsedDocument(null);
                          setAiInputText('');
                        }}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        再解析
                      </button>
                      <button
                        onClick={handleSaveAIDocument}
                        disabled={isSaving}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-md hover:from-blue-600 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? '保存中...' : '文書を保存'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}