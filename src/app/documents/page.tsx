'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Document {
  id: string;
  documentNumber: string;
  title: string;
  category: string;
  tags: string[];
  description: string;
  fileUrl?: string;
  sharedWith: string[];
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [formData, setFormData] = useState<Omit<Document, 'id' | 'createdAt' | 'updatedAt'>>({
    documentNumber: '',
    title: '',
    category: '',
    tags: [],
    description: '',
    fileUrl: '',
    sharedWith: [],
    status: 'draft'
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (user) {
      loadDocuments();
    }
  }, [user]);

  const loadDocuments = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      // TODO: API実装後に接続
    } catch (error) {
      console.error('ドキュメントの読み込みエラー:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      // TODO: API実装後に接続
      setShowModal(false);
      setEditingDocument(null);
      setFormData({
        documentNumber: '',
        title: '',
        category: '',
        tags: [],
        description: '',
        fileUrl: '',
        sharedWith: [],
        status: 'draft'
      });
      loadDocuments();
    } catch (error) {
      console.error('ドキュメントの保存エラー:', error);
      alert('ドキュメントの保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('このドキュメントを削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      // TODO: API実装後に接続
      loadDocuments();
    } catch (error) {
      console.error('ドキュメントの削除エラー:', error);
      alert('ドキュメントの削除に失敗しました');
    }
  };

  const addTag = () => {
    if (tagInput.trim()) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    setFormData({ ...formData, tags: formData.tags.filter((_, i) => i !== index) });
  };

  const categories = ['契約書', '見積書', '請求書', '議事録', '報告書', 'マニュアル', 'その他'];

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">ドキュメント管理</h1>
            <button
              onClick={() => {
                setEditingDocument(null);
                setFormData({
                  documentNumber: '',
                  title: '',
                  category: '',
                  tags: [],
                  description: '',
                  fileUrl: '',
                  sharedWith: [],
                  status: 'draft'
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              ドキュメントを追加
            </button>
          </div>

          <div className="mb-4 flex gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="検索..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">すべてのカテゴリ</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ドキュメント番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイトル</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">カテゴリ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タグ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新日</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        ドキュメントがありません
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doc.documentNumber}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{doc.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.category}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {doc.tags.slice(0, 3).map((tag, index) => (
                              <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                                {tag}
                              </span>
                            ))}
                            {doc.tags.length > 3 && (
                              <span className="px-2 py-1 text-xs text-gray-500">+{doc.tags.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            doc.status === 'published' ? 'bg-green-100 text-green-800' :
                            doc.status === 'archived' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {doc.status === 'draft' ? '下書き' :
                             doc.status === 'published' ? '公開中' :
                             'アーカイブ'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.updatedAt}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setEditingDocument(doc);
                              setFormData({
                                documentNumber: doc.documentNumber,
                                title: doc.title,
                                category: doc.category,
                                tags: doc.tags,
                                description: doc.description,
                                fileUrl: doc.fileUrl || '',
                                sharedWith: doc.sharedWith,
                                status: doc.status
                              });
                              setShowModal(true);
                            }}
                            className="text-[#005eb2] hover:text-[#004a96] mr-4"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {editingDocument ? 'ドキュメントを編集' : 'ドキュメントを追加'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ドキュメント番号</label>
                    <input
                      type="text"
                      value={formData.documentNumber}
                      onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">選択してください</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ファイルURL</label>
                    <input
                      type="text"
                      value={formData.fileUrl}
                      onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">タグ</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="タグを入力してEnter"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        追加
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(index)}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Document['status'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="draft">下書き</option>
                      <option value="published">公開中</option>
                      <option value="archived">アーカイブ</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingDocument(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
                  >
                    保存
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


