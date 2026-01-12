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
  
  // タブと表示モード
  const [activeTab, setActiveTab] = useState<'everyone' | 'favorites' | 'shared'>('everyone');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // チームメンバー
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; displayName: string; email: string }>>([]);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; displayName: string; email: string }>>([]);
  
  // 共有者選択
  const [showShareSection, setShowShareSection] = useState(false);
  const [selectedShareMembers, setSelectedShareMembers] = useState<string[]>([]);
  const [shareToAll, setShareToAll] = useState(false);

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

  // チームメンバーを取得
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!user) return;
      
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          const currentUser = data.users.find((u: any) => u.id === user.uid);
          const currentCompanyName = currentUser?.companyName || '';
          
          const allUsersData = data.users
            .filter((u: any) => u.companyName === currentCompanyName)
            .map((u: any) => ({
              id: u.id,
              displayName: u.displayName,
              email: u.email
            }));
          setAllUsers(allUsersData);
          
          const members = data.users
            .filter((u: any) => 
              u.id !== user.uid && 
              u.companyName === currentCompanyName
            )
            .map((u: any) => ({
              id: u.id,
              displayName: u.displayName,
              email: u.email
            }));
          setTeamMembers(members);
        }
      } catch (error) {
        console.error('チームメンバー取得エラー:', error);
      }
    };
    
    loadTeamMembers();
  }, [user]);

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
    setShowShareSection(false);
    setSelectedShareMembers([]);
    setShareToAll(false);
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

      // 共有者を決定（全員共有の場合は全メンバー、そうでない場合は選択されたメンバー）
      let sharedWith: string[] = [];
      if (shareToAll) {
        sharedWith = allUsers.map(u => u.id);
      } else {
        sharedWith = selectedShareMembers;
      }

      const payload = {
        ...formData,
        userId: user.uid,
        date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
        sharedWith: sharedWith,
        isFavorite: false // 新規作成時はfalse
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


  // 検索でフィルターされたメモ
  const filteredNotes = notes.filter(note => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      note.participants?.some(p => p.toLowerCase().includes(query))
    );
  });

  // タブでフィルタリング
  const tabFilteredNotes = filteredNotes.filter(note => {
    if (activeTab === 'favorites') {
      return (note as any).isFavorite === true;
    } else if (activeTab === 'shared') {
      // 共有されたメモ（自分が作成したもの、または自分が共有されているもの）
      return (note as any).sharedWith && 
             ((note as any).sharedWith.includes(user?.uid || '') || note.userId === user?.uid);
    }
    return true; // 'everyone' の場合はすべて表示
  });

  // ソート
  const sortedNotes = [...tabFilteredNotes].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    return 0;
  });

  // お気に入り切り替え
  const toggleFavorite = async (noteId: string, currentFavorite: boolean) => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/sales/progress-notes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: noteId,
          isFavorite: !currentFavorite
        })
      });

      if (response.ok) {
        fetchNotes();
      }
    } catch (error) {
      console.error('お気に入り更新エラー:', error);
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gray-50">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 p-4 lg:p-6">
            {/* 左側: メインコンテンツ */}
            <div className="flex-1 min-w-0">
              {/* 検索バー */}
              <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="メモを検索..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <button
                    onClick={handleOpenModal}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    新規メモ
                  </button>
                </div>
              </div>

              {/* タブ */}
              <div className="bg-white rounded-lg shadow-sm mb-4">
                <div className="flex items-center justify-between border-b border-gray-200">
                  <div className="flex">
                    {(['everyone', 'favorites', 'shared'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === tab
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {tab === 'everyone' ? 'すべて' : tab === 'favorites' ? 'お気に入り' : '共有'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            {/* メモ一覧 */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#005eb2]"></div>
                <p className="mt-2 text-gray-600">読み込み中...</p>
              </div>
            ) : sortedNotes.length === 0 ? (
              <div className="text-center bg-white rounded-lg border border-gray-200 flex flex-col items-center justify-center" style={{ minHeight: '400px' }}>
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
                {sortedNotes.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      {sortedNotes.length}件のメモ
                    </p>
                  </div>
                )}
                {/* カードグリッド */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {sortedNotes.map((note) => (
                      <div
                        key={note.id}
                        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all"
                      >
                        {/* アバターとアイコン */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white font-semibold">
                            {note.title.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex gap-2">
                            <button className="p-1.5 text-gray-400 hover:text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                            </button>
                            <button className="p-1.5 text-gray-400 hover:text-yellow-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* タイトル */}
                        <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-1">
                          {note.title}
                        </h3>

                        {/* 日付 */}
                        <p className="text-xs text-gray-500 mb-2">
                          {new Date(note.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>

                        {/* 参加者情報 */}
                        {note.participants && note.participants.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-600 mb-1">参加者 ({note.participants.length})</p>
                            <div className="flex flex-wrap gap-1">
                              {note.participants.slice(0, 2).map((p, idx) => (
                                <span key={idx} className="text-xs text-gray-700">
                                  {p}
                                </span>
                              ))}
                              {note.participants.length > 2 && (
                                <span className="text-xs text-gray-500">+{note.participants.length - 2}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* アクティビティアイコン */}
                        <div className="flex gap-2 mb-3">
                          <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                            <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                            </svg>
                          </div>
                          <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>

                        {/* アクションボタン */}
                        <div className="flex gap-2 pt-3 border-t border-gray-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(note);
                            }}
                            className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(note.id);
                            }}
                            className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                          >
                            削除
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(note.id, (note as any).isFavorite || false);
                            }}
                            className={`px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors ${
                              (note as any).isFavorite ? 'text-yellow-500 border-yellow-300' : 'text-gray-400'
                            }`}
                          >
                            <svg className="w-4 h-4" fill={((note as any).isFavorite ? 'currentColor' : 'none')} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sortedNotes.map((note) => (
                      <div
                        key={note.id}
                        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {note.title.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-gray-900 mb-1">{note.title}</h3>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{note.content}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{new Date(note.date).toLocaleDateString('ja-JP')}</span>
                              {note.participants && note.participants.length > 0 && (
                                <span>参加者: {note.participants.length}名</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(note);
                              }}
                              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
                            >
                              編集
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(note.id);
                              }}
                              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
                            >
                              削除
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(note.id, (note as any).isFavorite || false);
                              }}
                              className={`px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 ${
                                (note as any).isFavorite ? 'text-yellow-500 border-yellow-300' : 'text-gray-400'
                              }`}
                            >
                              <svg className="w-4 h-4" fill={((note as any).isFavorite ? 'currentColor' : 'none')} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            </div>

            {/* 右側: フィルターサイドバー */}
            <div className="w-64 flex-shrink-0">
              {/* 使い方セクション */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">メモとは？</h2>
                <p className="text-xs text-gray-700 leading-relaxed mb-3">
                自由に使えるメモ機能です。<br />
                個人のメモとしても、チームで共有するメモとしても使えます。
                </p>
                <div className="text-xs text-gray-700 space-y-1">
                  <p className="font-medium">使い方：</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>「新規メモ」ボタンからメモを作成</li>
                    <li>検索バーでキーワード検索が可能</li>
                    <li>タブで「すべて」「お気に入り」<br />「共有」を切り替え</li>
                  </ul>
                </div>
              </div>

              {/* 統計情報 */}
              <div className="bg-white rounded-lg shadow-sm p-4 mb-4 sticky top-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">統計</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">今月のメモ</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {notes.filter(note => {
                        const noteDate = new Date(note.date);
                        const now = new Date();
                        return noteDate.getMonth() === now.getMonth() && 
                               noteDate.getFullYear() === now.getFullYear();
                      }).length}件
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">お気に入り</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {notes.filter(note => (note as any).isFavorite).length}件
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">共有中</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {notes.filter(note => (note as any).sharedWith && (note as any).sharedWith.length > 0).length}件
                    </span>
                  </div>
                </div>
              </div>

              {/* 最近のメモ */}
              <div className="bg-white rounded-lg shadow-sm p-4 sticky top-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">最近のメモ</h3>
                
                {notes.length === 0 ? (
                  <p className="text-xs text-gray-500">メモがありません</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notes
                      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
                      .slice(0, 5)
                      .map((note) => (
                        <button
                          key={note.id}
                          onClick={() => handleEdit(note)}
                          className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                        >
                          <p className="text-xs font-medium text-gray-900 line-clamp-1 mb-1">
                            {note.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(note.updatedAt || note.createdAt).toLocaleDateString('ja-JP', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

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

                    {/* 日付 */}
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

                    {/* 共有者 */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowShareSection(!showShareSection)}
                        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <label className="block text-sm font-medium text-gray-700">
                          共有者
                        </label>
                        <svg
                          className={`w-5 h-5 text-gray-500 transition-transform ${showShareSection ? 'transform rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showShareSection && (
                        <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                          <div className="mb-3">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={shareToAll}
                                onChange={(e) => {
                                  setShareToAll(e.target.checked);
                                  if (e.target.checked) {
                                    setSelectedShareMembers([]);
                                  }
                                }}
                                className="mr-2"
                              />
                              <span className="text-sm text-gray-700">全員に共有する</span>
                            </label>
                          </div>
                          
                          {!shareToAll && (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {teamMembers.map((member) => (
                                <label key={member.id} className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedShareMembers.includes(member.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedShareMembers([...selectedShareMembers, member.id]);
                                      } else {
                                        setSelectedShareMembers(selectedShareMembers.filter(id => id !== member.id));
                                      }
                                    }}
                                    className="mr-2"
                                  />
                                  <span className="text-sm text-gray-700">{member.displayName}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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
      </Layout>
    </ProtectedRoute>
  );
}
