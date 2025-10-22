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

  // Firestoreからドキュメントを取得
  const fetchDocumentsFromFirestore = async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/admin/get-manual-documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
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
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">文書管理（手動入力）</h1>
            <button
              onClick={() => setShowInputModal(true)}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-md hover:bg-[#004a96] transition-colors"
            >
              文書を追加
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
                      <span>作成日: {doc.createdAt.toLocaleDateString('ja-JP')}</span>
                      <span>更新日: {doc.lastUpdated.toLocaleDateString('ja-JP')}</span>
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
              </div>
            ))}
            
            {documents.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">手動入力された文書がありません。</p>
                <p className="text-gray-400 text-sm mt-2">「文書を追加」ボタンから文書を追加してください。</p>
              </div>
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
        </div>
      </Layout>
    </ProtectedRoute>
  );
}