'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ProgressNote } from '@/types/sales';

export default function ProgressNotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<ProgressNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<ProgressNote | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // 検索・フィルター
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('date');
  const [selectedNote, setSelectedNote] = useState<ProgressNote | null>(null);

  const [formData, setFormData] = useState<Partial<ProgressNote>>({
    title: '',
    content: '',
    date: new Date(),
    participants: [],
    priority: 'medium'
  });

  const [participantInput, setParticipantInput] = useState('');

  // メモ一覧を取得
  const fetchNotes = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();
      const params = new URLSearchParams({ userId: user.uid });

      const response = await fetch(`/api/sales/progress-notes?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error('メモ取得エラー:', error);
      alert('メモの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [user]);

  // フォームリセット
  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      date: new Date(),
      participants: [],
      priority: 'medium'
    });
    setParticipantInput('');
    setEditingNote(null);
  };

  // モーダルを開く（新規作成）
  const handleOpenModal = () => {
    resetForm();
    setShowModal(true);
  };

  // モーダルを開く（編集）
  const handleEdit = (note: ProgressNote) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      date: note.date,
      participants: note.participants || [],
      priority: note.priority || 'medium'
    });
    setShowModal(true);
  };

  // 保存
  const handleSave = async () => {
    if (!user || !formData.title || !formData.content) {
      alert('タイトルと内容は必須です');
      return;
    }

    try {
      setIsSaving(true);
      const token = await user.getIdToken();

      const payload = {
        ...formData,
        userId: user.uid,
        date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString()
      };

      const url = '/api/sales/progress-notes';
      const method = editingNote ? 'PUT' : 'POST';
      const body = editingNote 
        ? { id: editingNote.id, ...payload }
        : payload;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.details || '保存に失敗しました';
        throw new Error(errorMessage);
      }

      alert(editingNote ? 'メモを更新しました' : 'メモを作成しました');
      setShowModal(false);
      resetForm();
      fetchNotes();
    } catch (error) {
      console.error('保存エラー:', error);
      const errorMessage = error instanceof Error ? error.message : '保存に失敗しました';
      alert(`保存に失敗しました: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 削除
  const handleDelete = async (id: string) => {
    if (!confirm('このメモを削除しますか？')) return;
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/sales/progress-notes?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('メモを削除しました');
        fetchNotes();
      } else {
        throw new Error('削除に失敗しました');
      }
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  // 参加者追加
  const handleAddParticipant = () => {
    if (participantInput.trim() && !formData.participants?.includes(participantInput.trim())) {
      setFormData({
        ...formData,
        participants: [...(formData.participants || []), participantInput.trim()]
      });
      setParticipantInput('');
    }
  };

  // 参加者削除
  const handleRemoveParticipant = (participant: string) => {
    setFormData({
      ...formData,
      participants: formData.participants?.filter(p => p !== participant) || []
    });
  };

  // 優先度ラベル
  const getPriorityLabel = (priority?: string) => {
    const labels: Record<string, string> = {
      'high': '高',
      'medium': '中',
      'low': '低'
    };
    return labels[priority || 'medium'] || '中';
  };

  // 優先度バッジの色
  const getPriorityColor = (priority?: string) => {
    const colors: Record<string, string> = {
      'high': 'bg-red-100 text-red-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'low': 'bg-green-100 text-green-800'
    };
    return colors[priority || 'medium'] || 'bg-yellow-100 text-yellow-800';
  };

  // フィルターされたメモ
  const filteredNotes = notes.filter(note => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      note.participants?.some(p => p.toLowerCase().includes(query))
    );
  });

  // ソート
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    return 0;
  });


  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 py-8">
            {/* ヘッダー */}
            <div className="mb-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 p-4 sm:p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">自由にメモを管理できます</h2>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      営業活動や商談の進捗、重要な情報などを記録・管理できます。検索機能で素早く目的のメモを見つけられます。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 検索バー */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="メモを検索..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <button
                  onClick={handleOpenModal}
                  className="px-6 py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors font-medium whitespace-nowrap"
                >
                  + 新規メモ
                </button>
              </div>

              {/* フィルター */}
              <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">並び替え:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'relevance' | 'date')}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] text-sm"
                  >
                    <option value="date">日付</option>
                    <option value="relevance">関連度</option>
                  </select>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-sm text-[#005eb2] hover:underline"
                  >
                    すべてクリア
                  </button>
                )}
              </div>
            </div>

            {/* メモ一覧 */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#005eb2]"></div>
                <p className="mt-2 text-gray-600">読み込み中...</p>
              </div>
            ) : sortedNotes.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-600 mb-4">
                  {searchQuery ? '検索結果が見つかりませんでした' : 'メモがありません'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={handleOpenModal}
                    className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
                  >
                    最初のメモを作成
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    {sortedNotes.length}件のメモ
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {sortedNotes.map((note, index) => {
                    const isSelected = selectedNote?.id === note.id;
                    return (
                      <div
                        key={note.id}
                        onClick={() => setSelectedNote(note)}
                        className={`group bg-white rounded-lg border-2 p-4 hover:shadow-md transition-all cursor-pointer ${
                          isSelected ? 'border-[#005eb2] shadow-md' : 'border-gray-200'
                        }`}
                      >
                        {/* タイトル */}
                        <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2">
                          {note.title}
                        </h3>

                        {/* 日付と優先度 */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-gray-500">
                            {new Date(note.date).toISOString().split('T')[0]}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(note.priority)}`}>
                            {getPriorityLabel(note.priority)}
                          </span>
                        </div>

                        {/* メモ内容 */}
                        <p className="text-sm text-gray-700 mb-3 line-clamp-3 whitespace-pre-wrap">
                          {note.content}
                        </p>

                        {/* 参加者 */}
                        {note.participants && note.participants.length > 0 && (
                          <div className="mb-3 pt-3 border-t border-gray-100">
                            <div className="flex flex-wrap gap-1">
                              {note.participants.slice(0, 3).map((participant, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                                >
                                  {participant}
                                </span>
                              ))}
                              {note.participants.length > 3 && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                  +{note.participants.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* アクションボタン */}
                        <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(note);
                            }}
                            className="flex-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(note.id);
                            }}
                            className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* モーダル */}
            {showModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">
                      {editingNote ? 'メモを編集' : '新規メモを作成'}
                    </h2>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* タイトル */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        タイトル <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.title || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        placeholder="メモのタイトルを入力"
                      />
                    </div>

                    {/* 日付と優先度 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          日付
                        </label>
                        <input
                          type="date"
                          value={formData.date 
                            ? new Date(formData.date).toISOString().split('T')[0]
                            : new Date().toISOString().split('T')[0]}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            date: e.target.value ? new Date(e.target.value) : new Date() 
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          優先度
                        </label>
                        <select
                          value={formData.priority || 'medium'}
                          onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        >
                          <option value="high">高</option>
                          <option value="medium">中</option>
                          <option value="low">低</option>
                        </select>
                      </div>
                    </div>

                    {/* 内容 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        内容 <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={formData.content || ''}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        placeholder="メモの内容を入力してください"
                      />
                    </div>

                    {/* 参加者 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        参加者・関係者
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={participantInput}
                          onChange={(e) => setParticipantInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                          placeholder="参加者名を入力してEnter"
                        />
                        <button
                          onClick={handleAddParticipant}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          追加
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.participants?.map((p, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-2"
                          >
                            {p}
                            <button
                              onClick={() => handleRemoveParticipant(p)}
                              className="hover:text-gray-900"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowModal(false);
                        resetForm();
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      disabled={isSaving}
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors disabled:opacity-50"
                    >
                      {isSaving ? '保存中...' : editingNote ? '更新' : '作成'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
