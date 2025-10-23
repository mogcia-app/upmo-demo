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

  const handleSaveDocument = async () => {
    if (!newDocument.title || !user) {
      alert('タイトルを入力してください。');
      return;
    }

    try {
      setIsSaving(true);
      
      // Firestoreに保存
      const response = await fetch('/api/admin/save-manual-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newDocument,
          userId: user.uid
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

  // AI解析関数
  const handleAIAnalysis = async () => {
    if (!aiInputText.trim()) {
      alert('解析するテキストを入力してください。');
      return;
    }

    try {
      setIsAnalyzing(true);
      
      const response = await fetch('/api/admin/parse-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: aiInputText,
          documentType: newDocument.type
        })
      });

      if (!response.ok) {
        throw new Error('AI解析に失敗しました');
      }

      const result = await response.json();
      
      if (result.success && result.parsedDocument) {
        const parsed = result.parsedDocument;
        
        // AI解析結果をフォームに適用
        setNewDocument(prev => ({
          ...prev,
          title: parsed.title || prev.title,
          description: parsed.description || prev.description,
          type: parsed.type || prev.type,
          sections: {
            overview: parsed.sections.overview || prev.sections.overview,
            features: parsed.sections.features || prev.sections.features,
            pricing: parsed.sections.pricing || prev.sections.pricing,
            procedures: parsed.sections.procedures || prev.sections.procedures,
            support: parsed.sections.support || prev.sections.support || [],
            rules: parsed.sections.rules || prev.sections.rules || [],
            terms: parsed.sections.terms || prev.sections.terms || []
          },
          tags: parsed.tags || prev.tags,
          priority: parsed.priority || prev.priority
        }));
        
        setShowAIModal(false);
        setAiInputText('');
        alert('AI解析が完了しました！フォームに結果が反映されました。');
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
      const response = await fetch(`/api/admin/get-manual-documents?userId=${user.uid}`);
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
            <h1 className="text-2xl font-bold text-gray-900 mb-4">文書管理（手動入力）</h1>
            
            {/* 目立つ追加ボタン */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">新しい文書を追加</h2>
                  <p className="text-gray-600 text-sm">構造化された手動入力で、高精度な検索・回答が可能な文書を作成できます</p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowAIModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      AI解析
                    </span>
                  </button>
                  <button
                    onClick={() => setShowInputModal(true)}
                    className="px-6 py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div key={doc.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{doc.title}</h3>
                      <p className="text-gray-600 text-sm mb-2">{doc.description}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-semibold mb-4">文書を手動入力</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 左側: 基本情報 */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        タイトル <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newDocument.title || ''}
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
                        value={newDocument.description || ''}
                        onChange={(e) => setNewDocument(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="文書の説明を入力してください"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      >
                        <option value="high">高</option>
                        <option value="medium">中</option>
                        <option value="low">低</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        タグ
                      </label>
                      <div className="flex space-x-2 mb-2">
                        <input
                          id="tagInput"
                          type="text"
                          placeholder="タグを入力"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                        />
                        <button
                          onClick={handleAddTag}
                          className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                        >
                          追加
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {newDocument.tags?.map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs flex items-center">
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(index)}
                              className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* 右側: セクション入力 */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        セクション選択
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['overview', 'features', 'pricing', 'procedures', 'support', 'rules', 'terms'].map((section) => (
                          <button
                            key={section}
                            onClick={() => setCurrentSection(section as any)}
                            className={`px-3 py-2 rounded-md text-sm ${
                              currentSection === section
                                ? 'bg-[#005eb2] text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {getSectionLabel(section)}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getSectionLabel(currentSection)}の内容
                      </label>
                      <div className="space-y-2">
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={sectionInput}
                            onChange={(e) => setSectionInput(e.target.value)}
                            placeholder={`${getSectionLabel(currentSection)}の項目を入力`}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                            onKeyPress={(e) => e.key === 'Enter' && handleAddToSection()}
                          />
                          <button
                            onClick={handleAddToSection}
                            className="px-3 py-2 bg-[#005eb2] text-white rounded-md hover:bg-[#004a96]"
                          >
                            追加
                          </button>
                        </div>
                        
                        <div className="bg-gray-50 rounded-md p-3 max-h-32 overflow-y-auto">
                          {Array.isArray(newDocument.sections?.[currentSection]) ? (
                            <ul className="space-y-1">
                              {(newDocument.sections?.[currentSection] as string[])?.map((item, index) => (
                                <li key={index} className="flex items-center justify-between text-sm">
                                  <span className="flex items-start">
                                    <span className="text-gray-400 mr-2">•</span>
                                    <span>{item}</span>
                                  </span>
                                  <button
                                    onClick={() => handleRemoveFromSection(index)}
                                    className="text-red-500 hover:text-red-700 ml-2"
                                  >
                                    ×
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500">項目がありません</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowInputModal(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSaveDocument}
                    disabled={!newDocument.title || isSaving}
                    className="px-4 py-2 bg-[#005eb2] text-white rounded-md hover:bg-[#004a96] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI解析モーダル */}
          {showAIModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI文書解析
                  </h3>
                  <button
                    onClick={() => setShowAIModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      解析するテキスト（Instagramの投稿内容など）
                    </label>
                    <textarea
                      value={aiInputText}
                      onChange={(e) => setAiInputText(e.target.value)}
                      placeholder="Instagramの投稿内容や文書をコピペしてください。AIが自動で項目ごとに振り分けます。"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 h-32 resize-none"
                    />
                  </div>
                  
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-purple-800 mb-2">AI解析の機能</h4>
                    <ul className="text-sm text-purple-700 space-y-1">
                      <li>• 料金情報を自動で「料金」セクションに振り分け</li>
                      <li>• 機能・特徴を「機能」セクションに分類</li>
                      <li>• 手順・プロセスを「手順」セクションに整理</li>
                      <li>• タイトルと概要を自動生成</li>
                      <li>• 関連タグを自動付与</li>
                    </ul>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowAIModal(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleAIAnalysis}
                    disabled={!aiInputText.trim() || isAnalyzing}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-md hover:from-purple-600 hover:to-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}