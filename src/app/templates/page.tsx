'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Template } from '@/types/template';

export default function TemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // フィルター・検索
  const [searchQuery, setSearchQuery] = useState('');
  const [customTabs, setCustomTabs] = useState<Array<{ id: string; name: string; filter: (t: Template) => boolean }>>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'views' | 'uses'>('date');
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());


  // フォームデータ
  const [formData, setFormData] = useState<Partial<Template>>({
    title: '',
    description: '',
    type: 'document',
    status: 'active',
    category: '',
    tags: [],
    content: '',
    fields: [],
    scheduledStart: undefined,
    scheduledEnd: undefined,
    fromRSS: false,
  });


  // テンプレート一覧を取得
  const fetchTemplates = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      const params = new URLSearchParams();
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/templates?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('テンプレートの取得に失敗しました');
      }

      const data = await response.json();
      const fetchedTemplates = (data.templates || []).map((t: any) => ({
        ...t,
        createdAt: t.createdAt ? (typeof t.createdAt === 'string' ? new Date(t.createdAt) : t.createdAt) : new Date(),
        updatedAt: t.updatedAt ? (typeof t.updatedAt === 'string' ? new Date(t.updatedAt) : t.updatedAt) : new Date(),
        scheduledStart: t.scheduledStart ? (typeof t.scheduledStart === 'string' ? new Date(t.scheduledStart) : t.scheduledStart) : undefined,
        scheduledEnd: t.scheduledEnd ? (typeof t.scheduledEnd === 'string' ? new Date(t.scheduledEnd) : t.scheduledEnd) : undefined,
      }));


      // ソート
      fetchedTemplates.sort((a: Template, b: Template) => {
        switch (sortBy) {
          case 'title':
            return (a.title || '').localeCompare(b.title || '');
          case 'views':
            return (b.views || 0) - (a.views || 0);
          case 'uses':
            return (b.uses || 0) - (a.uses || 0);
          case 'date':
          default:
            const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0);
            const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0);
            return dateB - dateA;
        }
      });

      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error('テンプレート取得エラー:', error);
      alert('テンプレートの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // カスタムタブを取得
  const fetchCustomTabs = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/templates/tabs', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('カスタムタブの取得に失敗しました');
      }

      const data = await response.json();
      const tabs = (data.tabs || []).map((tab: any) => ({
        id: tab.id,
        name: tab.name,
        filter: (t: Template) => true, // デフォルトはすべて表示（後でカスタマイズ可能）
      }));
      setCustomTabs(tabs);
    } catch (error) {
      console.error('カスタムタブ取得エラー:', error);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchCustomTabs();
  }, [user, searchQuery, sortBy]);

  // カスタムタブでフィルター
  const getFilteredTemplates = () => {
    if (activeTab === 'all') {
      return templates;
    }
    // 選択されたタブに属するテンプレートのみを表示
    return templates.filter((t: Template) => t.tabId === activeTab);
  };

  const filteredTemplates = getFilteredTemplates();

  // カスタムタブを追加
  const handleAddTab = async () => {
    if (!user || !newTabName.trim()) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/templates/tabs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newTabName.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('カスタムタブの作成に失敗しました');
      }

      const newTab = await response.json();
      const tab = {
        id: newTab.id,
        name: newTab.name,
        filter: (t: Template) => true, // デフォルトはすべて表示（後でカスタマイズ可能）
      };
      setCustomTabs([...customTabs, tab]);
      setActiveTab(tab.id);
      setNewTabName('');
      setShowAddTabModal(false);
    } catch (error) {
      console.error('カスタムタブ作成エラー:', error);
      alert('カスタムタブの作成に失敗しました');
    }
  };

  // カスタムタブを削除
  const handleDeleteTab = async (tabId: string) => {
    if (!user || !confirm('このタブを削除しますか？')) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/templates/tabs?id=${tabId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('カスタムタブの削除に失敗しました');
      }

      setCustomTabs(customTabs.filter((tab) => tab.id !== tabId));
      if (activeTab === tabId) {
        setActiveTab('all');
      }
    } catch (error) {
      console.error('カスタムタブ削除エラー:', error);
      alert('カスタムタブの削除に失敗しました');
    }
  };

  // モーダルを開く
  const handleOpenModal = () => {
    setEditingTemplate(null);
    setFormData({
      title: '',
      description: '',
      type: 'document',
      status: 'active',
      category: '',
      tags: [],
      content: '',
      fields: [],
      scheduledStart: undefined,
      scheduledEnd: undefined,
      fromRSS: false,
      tabId: activeTab !== 'all' ? activeTab : undefined, // 現在選択中のタブをデフォルトに
    });
    setShowModal(true);
  };

  // 編集モーダルを開く
  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      title: template.title,
      description: template.description,
      type: template.type,
      status: template.status,
      category: template.category,
      tags: template.tags || [],
      content: template.content,
      fields: template.fields || [],
      scheduledStart: template.scheduledStart,
      scheduledEnd: template.scheduledEnd,
      fromRSS: template.fromRSS,
      tabId: template.tabId,
    });
    setShowModal(true);
  };

  // テンプレートを保存
  const handleSave = async () => {
    if (!user || !formData.title || !formData.content) {
      alert('タイトルと内容は必須です');
      return;
    }

    try {
      setIsSaving(true);
      const token = await user.getIdToken();

      const url = editingTemplate ? '/api/templates' : '/api/templates';
      const method = editingTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...(editingTemplate && { id: editingTemplate.id }),
          ...formData,
        }),
      });

      if (!response.ok) {
        throw new Error('テンプレートの保存に失敗しました');
      }

      await fetchTemplates();
      setShowModal(false);
      alert(editingTemplate ? 'テンプレートを更新しました' : 'テンプレートを作成しました');
    } catch (error) {
      console.error('テンプレート保存エラー:', error);
      alert('テンプレートの保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // テンプレートを削除
  const handleDelete = async (id: string) => {
    if (!user || !confirm('このテンプレートを削除しますか？')) return;

    try {
      const token = await user.getIdToken();

      const response = await fetch(`/api/templates?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('テンプレートの削除に失敗しました');
      }

      await fetchTemplates();
      alert('テンプレートを削除しました');
    } catch (error) {
      console.error('テンプレート削除エラー:', error);
      alert('テンプレートの削除に失敗しました');
    }
  };

  // テンプレートを選択/選択解除
  const toggleTemplateSelection = (id: string) => {
    setSelectedTemplates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // すべて選択/選択解除
  const toggleSelectAll = () => {
    if (selectedTemplates.size === templates.length) {
      setSelectedTemplates(new Set());
    } else {
      setSelectedTemplates(new Set(templates.map((t) => t.id)));
    }
  };



  // タイプラベル
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      document: 'ドキュメント',
      form: 'フォーム',
      email: 'メール',
      contract: '契約書',
      other: 'その他',
    };
    return labels[type] || type;
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
          <div className="max-w-7xl mx-auto">
            {/* ヘッダー */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-gray-900">テンプレート</h1>
                <button
                  onClick={handleOpenModal}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  テンプレートを追加
                </button>
              </div>

              {/* 検索・ソート */}
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    表示中: 1-{Math.min(20, filteredTemplates.length)} / {filteredTemplates.length}
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="date">日付順</option>
                    <option value="title">タイトル順</option>
                    <option value="views">閲覧数順</option>
                    <option value="uses">使用数順</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button className="p-1.5 text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* タブ */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'all'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  すべて ({templates.length})
                </button>
                {customTabs.map((tab) => (
                  <div key={tab.id} className="flex items-center gap-1">
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {tab.name} ({templates.filter((t: Template) => t.tabId === tab.id).length})
                    </button>
                    <button
                      onClick={() => handleDeleteTab(tab.id)}
                      className="text-gray-400 hover:text-red-600 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setShowAddTabModal(true)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  タブを追加
                </button>
              </div>
            </div>

            {/* テンプレートグリッド */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">読み込み中...</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center bg-white rounded-lg border border-gray-200 p-12">
                <p className="text-gray-600 mb-4">
                  {searchQuery ? '検索結果が見つかりませんでした' : 'テンプレートがありません'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={handleOpenModal}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    最初のテンプレートを作成
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 sm:mb-6">
                  {/* 追加カード */}
                          <button
                    onClick={handleOpenModal}
                    className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center"
                  >
                    <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">テンプレートを追加</span>
                  </button>

                  {/* テンプレートカード */}
                  {filteredTemplates.slice(0, 11).map((template) => (
                    <div
                      key={template.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
                    >
                      {/* ヘッダー */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedTemplates.has(template.id)}
                            onChange={() => toggleTemplateSelection(template.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700">
                            {getTypeLabel(template.type)}
                          </span>
                          {template.status === 'active' && (
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="p-1 text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* 日付 */}
                      <p className="text-xs text-gray-500 mb-2">
                        {template.createdAt
                          ? new Date(template.createdAt).toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                            })
                          : ''}
                      </p>

                      {/* タイトル */}
                      <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">
                        {template.title}
                      </h3>

                      {/* タグ */}
                      {template.tags && template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {template.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {template.tags.length > 3 && (
                            <span className="text-xs text-gray-500">+{template.tags.length - 3}</span>
                          )}
                        </div>
                      )}

                      {/* エンゲージメント指標 */}
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            {template.views || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            {template.uses || 0}
                          </span>
                        </div>
                        <span className="text-gray-400">{template.createdByName || 'ユーザー'}</span>
                      </div>

                      {/* アクションボタン */}
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleEditTemplate(template)}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                        >
                          詳細
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
                          >
                            削除
                          </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ページネーション */}
                {filteredTemplates.length > 12 && (
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                      さらに読み込む
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-600">または</span>
                      {[1, 2, 3, 4, 5].map((page) => (
                        <button
                          key={page}
                          className="px-3 py-1 text-sm text-gray-700 hover:text-blue-600"
                        >
                          {page}
                        </button>
                      ))}
                      <span className="text-sm text-gray-600">...</span>
                    </div>
                  </div>
                )}

                {/* 一括操作バー */}
                {selectedTemplates.size > 0 && (
                  <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          checked={selectedTemplates.size === templates.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{selectedTemplates.size}件選択中</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">送信</button>
                        <button className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">アーカイブ</button>
                        <button className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">複製</button>
                        <button className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">フォルダー</button>
                        <button className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">エクスポート</button>
                        <button className="px-4 py-2 text-sm text-red-600 hover:text-red-700">削除</button>
                      </div>
                      <span className="text-xs text-gray-500">shift+選択で範囲選択、escで選択解除</span>
                    </div>
                  </div>
                )}
              </>
            )}
            </div>
          </div>

        {/* モーダル */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingTemplate ? 'テンプレートを編集' : '新しいテンプレート'}
                </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
                    <input
                      type="text"
                      value={formData.title || ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="テンプレートのタイトル"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="テンプレートの説明"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                    <input
                      type="text"
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="カテゴリ名"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">タブ</label>
                    <select
                      value={formData.tabId || ''}
                      onChange={(e) => setFormData({ ...formData, tabId: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">タブを選択しない</option>
                      {customTabs.map((tab) => (
                        <option key={tab.id} value={tab.id}>
                          {tab.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      テンプレートを特定のタブに分類できます
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">内容 *</label>
                    <textarea
                      value={formData.content || ''}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={10}
                      placeholder="テンプレートの内容"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-4 mt-6">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                </div>
                </div>
              </div>
            </div>
          )}

        {/* カスタムタブ追加モーダル */}
        {showAddTabModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full mx-4 p-4 sm:p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">タブを追加</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">タブ名</label>
                <input
                  type="text"
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="タブ名を入力"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTab();
                    }
                  }}
                />
              </div>
              <div className="flex items-center justify-end gap-4">
                <button
                  onClick={() => {
                    setShowAddTabModal(false);
                    setNewTabName('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddTab}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

