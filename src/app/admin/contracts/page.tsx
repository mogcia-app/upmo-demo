'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import SummaryModal from '@/components/SummaryModal';

interface SectionItem {
  title: string;
  content: string;
}

interface ManualDocument {
  id: string;
  title: string;
  type: 'meeting' | 'policy' | 'contract' | 'manual' | 'other';
  description: string;
  sections: {
    overview: string;
    features: (string | SectionItem)[];
    pricing: (string | SectionItem)[];
    procedures: (string | SectionItem)[];
    support?: (string | SectionItem)[];
    rules?: (string | SectionItem)[];
    terms?: (string | SectionItem)[];
    qa?: { question: string; answer: string }[];
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
    type: 'contract', // デフォルトを契約に変更
    sections: {
      overview: '',
      features: [],
      pricing: [],
      procedures: [],
      qa: []
    },
    tags: [],
    priority: 'low', // デフォルトを低に変更
    createdAt: new Date(),
    lastUpdated: new Date()
  });
  const [currentSection, setCurrentSection] = useState<'features' | 'pricing' | 'procedures' | 'support' | 'rules' | 'terms' | 'qa'>('features');
  const [sectionInput, setSectionInput] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['features'])); // デフォルトで特徴・機能を展開
  const [sectionInputs, setSectionInputs] = useState<Record<string, { title: string; content: string }>>({}); // 各セクションごとの入力欄の状態（タイトルと本文）
  
  // AI解析用の状態
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiInputText, setAiInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiParsedDocument, setAiParsedDocument] = useState<ManualDocument | null>(null);
  
  // 要約用の状態
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [summaryDocumentId, setSummaryDocumentId] = useState<string>('');
  const [summaryDocumentType, setSummaryDocumentType] = useState<'meeting' | 'contract' | 'chat' | 'progressNote'>('contract');
  const [selectedDocument, setSelectedDocument] = useState<ManualDocument | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

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
      const isEdit = !!editingDocument;
      alert(`文書が正常に${isEdit ? '更新' : '保存'}されました！\n文書名: ${newDocument.title}\nタイプ: ${newDocument.type}`);
      
      // フォームリセット
      setNewDocument({
        id: '',
        title: '',
        description: '',
        type: 'contract', // デフォルトを契約に変更
        sections: {
          overview: '',
          features: [],
          pricing: [],
          procedures: []
        },
        tags: [],
        priority: 'low', // デフォルトを低に変更
        createdAt: new Date(),
        lastUpdated: new Date()
      });
      setShowInputModal(false);
      setEditingDocument(null);
      setCurrentSection('features');
      setSectionInput('');
      setSectionInputs({});
      setExpandedSections(new Set(['features']));
      
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
        // 文字列配列をオブジェクト配列に変換
        const convertArrayToItems = (arr: any[]): SectionItem[] => {
          return arr.map((item: any) => {
            if (typeof item === 'string') {
              return { title: '', content: item };
            }
            return { title: item.title || '', content: item.content || '' };
          });
        };
        
        const parsedDocument: ManualDocument = {
          id: '',
          title: parsed.title || 'AI解析された文書',
          description: parsed.description || '',
          type: parsed.type || 'contract',
          sections: {
            overview: parsed.sections.overview || '',
            features: convertArrayToItems(parsed.sections.features || []),
            pricing: convertArrayToItems(parsed.sections.pricing || []),
            procedures: convertArrayToItems(parsed.sections.procedures || []),
            support: convertArrayToItems(parsed.sections.support || []),
            rules: convertArrayToItems(parsed.sections.rules || []),
            terms: convertArrayToItems(parsed.sections.terms || [])
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
    if (!confirm('この文書を削除しますか？この操作は取り消せません。')) return;
    
    if (!user) {
      alert('ログインが必要です');
      return;
    }

    try {
      const token = await user.getIdToken();
      
      const response = await fetch(`/api/admin/delete-manual-document?id=${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '文書の削除に失敗しました');
      }

      const result = await response.json();
      
      alert('文書が正常に削除されました');
      
      // ドキュメントリストを更新
      await fetchDocumentsFromFirestore();
      
    } catch (error) {
      console.error('Delete error:', error);
      alert(`削除に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

  // Firestoreからドキュメントを取得（会社全体の契約書を取得）
  const fetchDocumentsFromFirestore = async () => {
    if (!user) return;
    
    try {
      // 認証トークンを取得
      const token = await user.getIdToken();
      // userIdパラメータを削除して、同じ会社の全ユーザーの契約書を取得
      const response = await fetch(`/api/admin/get-manual-documents`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        // 日付を確実にDateオブジェクトに変換し、既存の文字列配列をオブジェクト配列に変換
        const documents = (data.documents || []).map((doc: any) => {
          const convertedSections = { ...doc.sections };
          
          // 各セクションの文字列配列をオブジェクト配列に変換
          ['features', 'pricing', 'procedures', 'support', 'rules', 'terms'].forEach((sectionKey) => {
            if (Array.isArray(convertedSections[sectionKey])) {
              convertedSections[sectionKey] = convertedSections[sectionKey].map((item: any) => {
                if (typeof item === 'string') {
                  return { title: '', content: item };
                }
                return item;
              });
            }
          });
          
          // Firestore TimestampをDateオブジェクトに変換するヘルパー関数
          const convertToDate = (dateValue: any): Date => {
            if (dateValue instanceof Date) {
              return dateValue;
            }
            // Firestore Timestampオブジェクトの場合（toDateメソッドがある）
            if (dateValue && typeof dateValue.toDate === 'function') {
              return dateValue.toDate();
            }
            // Firestore Timestampオブジェクトの場合（secondsプロパティがある）
            if (dateValue && typeof dateValue.seconds === 'number') {
              return new Date(dateValue.seconds * 1000);
            }
            // 文字列の場合
            if (typeof dateValue === 'string') {
              return new Date(dateValue);
            }
            // 数値の場合（タイムスタンプ）
            if (typeof dateValue === 'number') {
              return new Date(dateValue);
            }
            // デフォルト
            return new Date();
          };
          
          return {
            ...doc,
            sections: convertedSections,
            createdAt: convertToDate(doc.createdAt),
            lastUpdated: convertToDate(doc.lastUpdated)
          };
        });
        
        // 日付でソート（最新順）- 既にconvertToDateでDateオブジェクトに変換済みなので、そのまま使用
        const sortedDocuments = documents.sort((a: ManualDocument, b: ManualDocument) => {
          // 念のため、Dateオブジェクトであることを確認
          const dateA = a.lastUpdated instanceof Date ? a.lastUpdated.getTime() : (typeof a.lastUpdated === 'number' ? a.lastUpdated : new Date(a.lastUpdated).getTime());
          const dateB = b.lastUpdated instanceof Date ? b.lastUpdated.getTime() : (typeof b.lastUpdated === 'number' ? b.lastUpdated : new Date(b.lastUpdated).getTime());
          return dateB - dateA;
        });
        
        setDocuments(sortedDocuments);
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
      case 'qa': return 'Q&A';
      default: return section;
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gray-50 -mx-4 lg:-mx-6">
          {/* ヘッダー */}
          <div className="bg-white border-b border-gray-100 px-6 sm:px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">文書管理</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAIModal(true)}
                  className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-xs">AI文書解析</span>
                </button>
                <button
                  onClick={() => setShowInputModal(true)}
                  className="px-3 py-2 bg-[#005eb2] text-white hover:bg-[#004a96] transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs">手動入力</span>
                </button>
              </div>
            </div>
          </div>

          {/* コンテンツエリア */}
          <div className="px-6 sm:px-8 py-6">
            {/* ドキュメントリスト */}
          {documents.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-300">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">文書がありません</h3>
              <p className="mt-1 text-sm text-gray-500">最初の文書を追加して始めましょう</p>
              <div className="mt-6">
                <button
                  onClick={() => setShowInputModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium text-white bg-[#005eb2] hover:bg-[#004a96] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  文書を追加
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                >
                  <div
                    onClick={() => {
                      setSelectedDocument(doc);
                      setShowDetailModal(true);
                    }}
                    className="cursor-pointer mb-3"
                  >
                    <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2">{doc.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-3">{doc.description || '説明なし'}</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // 既存データを変換（文字列配列をオブジェクト配列に）
                        const convertedSections = { ...doc.sections };
                        ['features', 'pricing', 'procedures', 'support', 'rules', 'terms'].forEach((sectionKey) => {
                          if (Array.isArray(convertedSections[sectionKey as keyof typeof convertedSections])) {
                            convertedSections[sectionKey as keyof typeof convertedSections] = (convertedSections[sectionKey as keyof typeof convertedSections] as any[]).map((item: any) => {
                              if (typeof item === 'string') {
                                return { title: '', content: item };
                              }
                              return item;
                            }) as any;
                          }
                        });
                        
                        setEditingDocument(doc);
                        const convertToDate = (dateValue: any): Date => {
                          if (dateValue instanceof Date) {
                            return dateValue;
                          }
                          if (dateValue && typeof dateValue.toDate === 'function') {
                            return dateValue.toDate();
                          }
                          if (dateValue && typeof dateValue.seconds === 'number') {
                            return new Date(dateValue.seconds * 1000);
                          }
                          if (typeof dateValue === 'string') {
                            return new Date(dateValue);
                          }
                          if (typeof dateValue === 'number') {
                            return new Date(dateValue);
                          }
                          return new Date();
                        };
                        
                        setNewDocument({
                          ...doc,
                          sections: convertedSections,
                          createdAt: convertToDate(doc.createdAt),
                          lastUpdated: convertToDate(doc.lastUpdated)
                        });
                        const sectionsWithContent = Object.entries(convertedSections)
                          .filter(([_, value]) => {
                            if (Array.isArray(value)) return value.length > 0;
                            return typeof value === 'string' && value.trim().length > 0;
                          })
                          .map(([key]) => key);
                        setExpandedSections(new Set(sectionsWithContent.length > 0 ? sectionsWithContent : ['features']));
                        setSectionInputs({});
                        setShowInputModal(true);
                      }}
                      className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDocument(doc.id);
                      }}
                      className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>

          {/* 手動入力モーダル */}
          {showInputModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-4 sm:p-6 w-full mx-4 max-w-7xl max-h-[95vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingDocument ? '文書を編集' : '文書を手動入力'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowInputModal(false);
                      setEditingDocument(null);
                      setNewDocument({
                        id: '',
                        title: '',
                        description: '',
                        type: 'contract', // デフォルトを契約に変更
                        sections: {
                          overview: '',
                          features: [],
                          pricing: [],
                          procedures: []
                        },
                        tags: [],
                        priority: 'low', // デフォルトを低に変更
                        createdAt: new Date(),
                        lastUpdated: new Date()
                      });
                      setExpandedSections(new Set(['features']));
                      setSectionInputs({});
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* 基本情報セクション */}
                <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  </div>
                </div>
                
                {/* セクション入力エリア - 全セクションを縦に並べて表示 */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">文書内容</h3>
                  
                  {/* 全セクションを縦に並べて表示 */}
                  <div className="space-y-4">
                    {[
                      { key: 'features', label: '特徴・機能', desc: '主な特徴や機能を箇条書き', isText: false },
                      { key: 'pricing', label: '料金・費用', desc: '料金や費用に関する情報', isText: false },
                      { key: 'procedures', label: '手順・プロセス', desc: '手順やプロセスを箇条書き', isText: false },
                      { key: 'support', label: 'サポート', desc: 'サポート情報', isText: false },
                      { key: 'rules', label: '規則・ルール', desc: '規則やルールを箇条書き', isText: false },
                      { key: 'terms', label: '条件・条項', desc: '条件や条項を箇条書き', isText: false },
                      { key: 'qa', label: 'Q&A', desc: 'よくある質問と回答', isQA: true }
                    ].map((section) => {
                      const isExpanded = expandedSections.has(section.key);
                      const sectionValue = section.isText
                        ? (newDocument.sections?.overview || '')
                        : section.isQA
                        ? ''
                        : '';
                      const hasContent = section.isQA
                        ? (newDocument.sections?.qa && newDocument.sections.qa.length > 0)
                        : Array.isArray(newDocument.sections?.[section.key as keyof typeof newDocument.sections]) 
                          ? (newDocument.sections?.[section.key as keyof typeof newDocument.sections] as any[]).length > 0
                          : sectionValue.trim().length > 0;
                      
                      return (
                        <div key={section.key} className="border border-gray-200 rounded-lg overflow-hidden">
                          {/* セクションヘッダー */}
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedSections);
                              if (isExpanded) {
                                newExpanded.delete(section.key);
                              } else {
                                newExpanded.add(section.key);
                              }
                              setExpandedSections(newExpanded);
                            }}
                            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
                          >
                            <div className="flex items-center space-x-3">
                              <svg
                                className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <div>
                                <span className="font-medium text-gray-900">{section.label}</span>
                                <span className="text-xs text-gray-500 ml-2">{section.desc}</span>
                              </div>
                            </div>
                            {hasContent && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                入力済み
                              </span>
                            )}
                          </button>
                          
                          {/* セクション入力エリア */}
                          {isExpanded && (
                            <div className="p-4 bg-white">
                              {section.isQA ? (
                                // Q&Aセクション
                                <div className="space-y-4">
                                  <div className="space-y-4">
                                    {(newDocument.sections?.qa || []).map((qa, index) => (
                                      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                        <div className="flex items-start justify-between mb-2">
                                          <span className="text-sm font-medium text-gray-700">Q&A {index + 1}</span>
                                          <button
                                            onClick={() => {
                                              const currentQA = newDocument.sections?.qa || [];
                                              const updatedQA = currentQA.filter((_, i) => i !== index);
                                              setNewDocument(prev => ({
                                                ...prev,
                                                sections: {
                                                  ...prev.sections,
                                                  qa: updatedQA
                                                }
                                              }));
                                            }}
                                            className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors p-1"
                                            title="削除"
                                          >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                        <div className="space-y-3">
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                              質問
                                            </label>
                                            <input
                                              type="text"
                                              value={qa.question}
                                              onChange={(e) => {
                                                const currentQA = newDocument.sections?.qa || [];
                                                const updatedQA = [...currentQA];
                                                updatedQA[index] = { ...qa, question: e.target.value };
                                                setNewDocument(prev => ({
                                                  ...prev,
                                                  sections: {
                                                    ...prev.sections,
                                                    qa: updatedQA
                                                  }
                                                }));
                                              }}
                                              placeholder="質問を入力してください"
                                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent text-base"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                              回答
                                            </label>
                                            <textarea
                                              value={qa.answer}
                                              onChange={(e) => {
                                                const currentQA = newDocument.sections?.qa || [];
                                                const updatedQA = [...currentQA];
                                                updatedQA[index] = { ...qa, answer: e.target.value };
                                                setNewDocument(prev => ({
                                                  ...prev,
                                                  sections: {
                                                    ...prev.sections,
                                                    qa: updatedQA
                                                  }
                                                }));
                                              }}
                                              placeholder="回答を入力してください"
                                              rows={3}
                                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent text-base resize-y"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => {
                                      const currentQA = newDocument.sections?.qa || [];
                                      setNewDocument(prev => ({
                                        ...prev,
                                        sections: {
                                          ...prev.sections,
                                          qa: [...currentQA, { question: '', answer: '' }]
                                        }
                                      }));
                                    }}
                                    className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#005eb2] hover:text-[#005eb2] transition-colors flex items-center justify-center gap-2"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Q&Aを追加
                                  </button>
                                  <p className="text-xs text-gray-500">
                                    💡 「Q&Aを追加」ボタンで新しい質問と回答のペアを追加できます。
                                  </p>
                                </div>
                              ) : section.isText ? (
                                // テキストセクション（概要）
                                <>
                                  <textarea
                                    value={sectionValue}
                                    onChange={(e) => {
                                      setNewDocument(prev => ({
                                        ...prev,
                                        sections: {
                                          ...prev.sections,
                                          overview: e.target.value
                                        }
                                      }));
                                    }}
                                    placeholder={`${section.label}の内容を入力してください...`}
                                    rows={8}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent text-base leading-relaxed resize-y"
                                  />
                                  <p className="mt-2 text-xs text-gray-500">
                                    💡 自由に長文を入力できます。改行も自由に使えます。
                                  </p>
                                </>
                              ) : (
                                // 配列セクション（箇条書き）
                                <div className="space-y-4">
                                  {/* 入力欄（常に表示） */}
                                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                      新しい項目を追加
                                    </label>
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                          タイトル
                                        </label>
                                        <input
                                          type="text"
                                          value={sectionInputs[section.key]?.title || ''}
                                          onChange={(e) => {
                                            setSectionInputs(prev => ({
                                              ...prev,
                                              [section.key]: {
                                                title: e.target.value,
                                                content: prev[section.key]?.content || ''
                                              }
                                            }));
                                          }}
                                          placeholder={`${section.label}のタイトルを入力...`}
                                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent text-base"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                          本文
                                        </label>
                                        <textarea
                                          value={sectionInputs[section.key]?.content || ''}
                                          onChange={(e) => {
                                            setSectionInputs(prev => ({
                                              ...prev,
                                              [section.key]: {
                                                title: prev[section.key]?.title || '',
                                                content: e.target.value
                                              }
                                            }));
                                          }}
                                          placeholder={`${section.label}の本文を入力してください...`}
                                          rows={3}
                                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent text-base resize-y leading-relaxed"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* 既存の項目一覧 */}
                                  {Array.isArray(newDocument.sections?.[section.key as keyof typeof newDocument.sections]) && 
                                   (newDocument.sections?.[section.key as keyof typeof newDocument.sections] as any[]).length > 0 && (
                                    <div className="space-y-3">
                                      <h4 className="text-sm font-medium text-gray-700">追加済みの項目</h4>
                                      {(newDocument.sections?.[section.key as keyof typeof newDocument.sections] as any[]).map((item, index) => {
                                        // 既存データとの互換性：文字列の場合は変換
                                        const itemData = typeof item === 'string' 
                                          ? { title: '', content: item }
                                          : { title: item.title || '', content: item.content || '' };
                                        
                                        return (
                                          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
                                            <div className="flex items-start justify-between mb-3">
                                              <span className="text-sm font-medium text-gray-400">項目 {index + 1}</span>
                                              <button
                                                onClick={() => {
                                                  const currentArray = (newDocument.sections?.[section.key as keyof typeof newDocument.sections] as any[]) || [];
                                                  const updatedArray = currentArray.filter((_, i) => i !== index);
                                                  setNewDocument(prev => ({
                                                    ...prev,
                                                    sections: {
                                                      ...prev.sections,
                                                      [section.key]: updatedArray
                                                    }
                                                  }));
                                                }}
                                                className="px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                                title="削除"
                                              >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                              </button>
                                            </div>
                                            <div className="space-y-3">
                                              <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                  タイトル
                                                </label>
                                                <input
                                                  type="text"
                                                  value={itemData.title}
                                                  onChange={(e) => {
                                                    const currentArray = (newDocument.sections?.[section.key as keyof typeof newDocument.sections] as any[]) || [];
                                                    const updatedArray = [...currentArray];
                                                    updatedArray[index] = { ...itemData, title: e.target.value };
                                                    setNewDocument(prev => ({
                                                      ...prev,
                                                      sections: {
                                                        ...prev.sections,
                                                        [section.key]: updatedArray
                                                      }
                                                    }));
                                                  }}
                                                  placeholder="タイトルを入力..."
                                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent text-base"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                  本文
                                                </label>
                                                <textarea
                                                  value={itemData.content}
                                                  onChange={(e) => {
                                                    const currentArray = (newDocument.sections?.[section.key as keyof typeof newDocument.sections] as any[]) || [];
                                                    const updatedArray = [...currentArray];
                                                    updatedArray[index] = { ...itemData, content: e.target.value };
                                                    setNewDocument(prev => ({
                                                      ...prev,
                                                      sections: {
                                                        ...prev.sections,
                                                        [section.key]: updatedArray
                                                      }
                                                    }));
                                                  }}
                                                  placeholder="本文を入力してください..."
                                                  rows={3}
                                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent text-base resize-y leading-relaxed"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  
                                  {/* 項目を追加ボタン */}
                                  <button
                                    onClick={() => {
                                      const inputData = sectionInputs[section.key];
                                      if (inputData && (inputData.title.trim() || inputData.content.trim())) {
                                        const currentArray = (newDocument.sections?.[section.key as keyof typeof newDocument.sections] as any[]) || [];
                                        setNewDocument(prev => ({
                                          ...prev,
                                          sections: {
                                            ...prev.sections,
                                            [section.key]: [...currentArray, { title: inputData.title.trim(), content: inputData.content.trim() }]
                                          }
                                        }));
                                        setSectionInputs(prev => ({
                                          ...prev,
                                          [section.key]: { title: '', content: '' }
                                        }));
                                      }
                                    }}
                                    disabled={!sectionInputs[section.key]?.title?.trim() && !sectionInputs[section.key]?.content?.trim()}
                                    className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#005eb2] hover:text-[#005eb2] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    項目を追加
                                  </button>
                                  <p className="text-xs text-gray-500">
                                    💡 タイトルと本文を入力して「項目を追加」ボタンをクリックしてください。
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* クイックアクション */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setExpandedSections(new Set(['features', 'pricing', 'procedures', 'support', 'rules', 'terms', 'qa']));
                      }}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                    >
                      すべて展開
                    </button>
                    <button
                      onClick={() => {
                        setExpandedSections(new Set());
                      }}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                    >
                      すべて折りたたみ
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowInputModal(false);
                      setSectionInputs({});
                    }}
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
                        {editingDocument ? '更新中...' : '保存中...'}
                      </span>
                    ) : (
                      editingDocument ? '更新' : '保存'
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

        {/* 詳細表示モーダル */}
        {showDetailModal && selectedDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">{selectedDocument.title}</h2>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedDocument(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <p className="text-sm text-gray-600">{selectedDocument.description || '説明なし'}</p>
                </div>
                
                {/* タグ */}
                {selectedDocument.tags && selectedDocument.tags.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {selectedDocument.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* セクション内容 */}
                <div className="space-y-4">
                  {Object.entries(selectedDocument.sections)
                    .filter(([key]) => key !== 'overview')
                    .map(([key, value]) => {
                      // Q&Aセクションの特別な処理
                      if (key === 'qa' && Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && 'question' in value[0]) {
                        const qaArray = value as { question: string; answer: string }[];
                        return (
                          <div key={key} className="border border-gray-200 p-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">{getSectionLabel(key)}</h4>
                            <div className="space-y-3">
                              {qaArray.map((qa, index) => (
                                <div key={index} className="border-l-4 border-blue-500 pl-3">
                                  <p className="text-sm font-medium text-gray-800 mb-1">
                                    Q{index + 1}: {qa.question}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    A: {qa.answer}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <div key={key} className="border border-gray-200 p-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">{getSectionLabel(key)}</h4>
                          <div>
                            {Array.isArray(value) ? (
                              <ul className="text-sm text-gray-600 space-y-2">
                                {value.map((item, index) => {
                                  const itemData = typeof item === 'string' 
                                    ? { title: '', content: item }
                                    : ('title' in item && 'content' in item)
                                    ? { title: item.title || '', content: item.content || '' }
                                    : { title: '', content: '' };
                                  
                                  return (
                                    <li key={index} className="flex items-start">
                                      <span className="text-gray-400 mr-2 mt-1">•</span>
                                      <div className="flex-1">
                                        {itemData.title && (
                                          <div className="font-medium text-gray-800 mb-1">{itemData.title}</div>
                                        )}
                                        <div className="text-gray-600 whitespace-pre-wrap">{itemData.content}</div>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-600">{value}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
                
                {/* 日付情報 */}
                <div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-500">
                  <p>作成日: {selectedDocument.createdAt instanceof Date ? selectedDocument.createdAt.toLocaleDateString('ja-JP') : new Date(selectedDocument.createdAt).toLocaleDateString('ja-JP')}</p>
                  <p>更新日: {selectedDocument.lastUpdated instanceof Date ? selectedDocument.lastUpdated.toLocaleDateString('ja-JP') : new Date(selectedDocument.lastUpdated).toLocaleDateString('ja-JP')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 要約モーダル */}
        <SummaryModal
          isOpen={showSummaryModal}
          onClose={() => {
            setShowSummaryModal(false);
            setSummaryContent('');
            setSummaryDocumentId('');
          }}
          content={summaryContent}
          documentType={summaryDocumentType}
          documentId={summaryDocumentId}
          sourceType="document"
        />
      </Layout>
    </ProtectedRoute>
  );
}