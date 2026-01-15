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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewingNote, setViewingNote] = useState<ProgressNote | null>(null);
  const [editingNote, setEditingNote] = useState<ProgressNote | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyingToNote, setReplyingToNote] = useState<ProgressNote | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyUserName, setReplyUserName] = useState('');
  
  // 検索・フィルター
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('date');
  const [selectedNote, setSelectedNote] = useState<ProgressNote | null>(null);
  
  // タブと表示モード
  const [activeTab, setActiveTab] = useState<'everyone' | 'favorites' | 'shared' | 'private'>('everyone');
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

  // 詳細モーダルを開く（表示のみ）
  const handleViewDetail = (note: ProgressNote) => {
    setViewingNote(note);
    setShowDetailModal(true);
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
    setShowDetailModal(false);
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

  // 返信モーダルを開く
  const handleOpenReplyModal = (note: ProgressNote) => {
    setReplyingToNote(note);
    setReplyContent('');
    const currentUser = allUsers.find(u => u.id === user?.uid);
    setReplyUserName(currentUser?.displayName || '');
    setShowReplyModal(true);
  };

  // 返信を保存
  const handleSaveReply = async () => {
    if (!user || !replyingToNote || !replyContent.trim() || !replyUserName.trim()) {
      alert('返信内容と担当者名を入力してください');
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/sales/progress-notes/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          noteId: replyingToNote.id,
          content: replyContent.trim(),
          userName: replyUserName.trim()
        })
      });

      if (response.ok) {
        await fetchNotes();
        // 詳細モーダルが開いている場合は、最新のメモを再取得
        if (showDetailModal && viewingNote?.id === replyingToNote.id) {
          const updatedResponse = await fetch(`/api/sales/progress-notes?userId=${user.uid}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (updatedResponse.ok) {
            const data = await updatedResponse.json();
            const updatedNote = data.notes.find((n: ProgressNote) => n.id === replyingToNote.id);
            if (updatedNote) {
              setViewingNote(updatedNote);
            }
          }
        }
        setShowReplyModal(false);
        setReplyingToNote(null);
        setReplyContent('');
        setReplyUserName('');
        alert('返信を追加しました');
      } else {
        throw new Error('返信の保存に失敗しました');
      }
    } catch (error) {
      console.error('返信保存エラー:', error);
      alert('返信の保存に失敗しました');
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
    } else if (activeTab === 'private') {
      // プライベートメモ（共有者がいない、または共有者が空のメモ）
      return !(note as any).sharedWith || (note as any).sharedWith.length === 0;
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
        <div className="min-h-screen bg-gray-50 -mx-4 lg:-mx-6">
          {/* ヘッダー */}
          <div className="bg-white border-b border-gray-100 px-6 sm:px-8 py-4">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">メモ</h1>
              <div className="flex items-center gap-4">
                <div className="relative max-w-md">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="メモを検索..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <button
                  onClick={handleOpenModal}
                  className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs">新規メモ</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 px-6 sm:px-8 py-6">
            {/* 左側: メインコンテンツ */}
            <div className="flex-1 min-w-0">

              {/* タブとメモ一覧 */}
              <div className="bg-white border border-gray-200">
                {/* タブ */}
                <div className="flex items-center justify-between border-b border-gray-200">
                  <div className="flex">
                    {(['everyone', 'private', 'shared', 'favorites'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === tab
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {tab === 'everyone' ? 'すべて' : tab === 'private' ? 'プライベート' : tab === 'shared' ? '共有' : 'お気に入り'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* メモ一覧 */}
                <div className="p-4">
                  {loading ? (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#005eb2]"></div>
                      <p className="mt-2 text-gray-600">読み込み中...</p>
                    </div>
                  ) : sortedNotes.length === 0 ? (
                    <div className="text-center flex flex-col items-center justify-center" style={{ minHeight: '400px' }}>
                      <p className="text-gray-600 mb-4">
                        {searchQuery ? '検索結果が見つかりませんでした' : 'メモがありません'}
                      </p>
                      {!searchQuery && (
                        <button
                          onClick={handleOpenModal}
                          className="px-4 py-2 bg-[#005eb2] text-white hover:bg-[#004a96] transition-colors"
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
                              className="bg-white border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
                              onClick={() => handleViewDetail(note)}
                            >
                        {/* タイトルとアイコン */}
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-sm font-semibold text-gray-900 flex-1 line-clamp-2 pr-2">
                            {note.title}
                          </h3>
                          <div className="flex gap-2 flex-shrink-0">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(note.id, (note as any).isFavorite || false);
                              }}
                              className={`p-1.5 transition-colors ${
                                (note as any).isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'
                              }`}
                            >
                              <svg className="w-4 h-4" fill={(note as any).isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* 日付 */}
                        <p className="text-xs text-gray-500 mb-2">
                          {new Date(note.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>

                        {/* 作成者 */}
                        {note.userId && (
                          <div className="mb-2">
                            <p className="text-xs text-gray-500">
                              作成者: {allUsers.find(u => u.id === note.userId)?.displayName || '不明'}
                            </p>
                          </div>
                        )}

                        {/* 共有者情報 */}
                        {(note as any).sharedWith && (note as any).sharedWith.length > 0 && (() => {
                          const sharedWithExcludingCreator = (note as any).sharedWith.filter((userId: string) => userId !== note.userId);
                          if (sharedWithExcludingCreator.length > 0) {
                            return (
                              <div className="mb-2">
                                <p className="text-xs text-gray-500">
                                  共有者: {sharedWithExcludingCreator
                                    .map((userId: string) => allUsers.find(u => u.id === userId)?.displayName || '不明')
                                    .filter((name: string) => name !== '不明')
                                    .join(', ')}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })()}

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

                        {/* アクションボタン */}
                        <div className="flex gap-2 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenReplyModal(note);
                            }}
                            className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                          >
                            返信
                          </button>
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
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sortedNotes.map((note) => (
                      <div
                        key={note.id}
                        className="bg-white border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => handleViewDetail(note)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-1">
                              <h3 className="text-base font-semibold text-gray-900 flex-1">{note.title}</h3>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(note.id, (note as any).isFavorite || false);
                                }}
                                className={`p-1.5 transition-colors flex-shrink-0 ${
                                  (note as any).isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'
                                }`}
                              >
                                <svg className="w-4 h-4" fill={(note as any).isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                              </button>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{new Date(note.date).toLocaleDateString('ja-JP')}</span>
                              {note.userId && (
                                <span>作成者: {allUsers.find(u => u.id === note.userId)?.displayName || '不明'}</span>
                              )}
                              {(note as any).sharedWith && (note as any).sharedWith.length > 0 && (() => {
                                const sharedWithExcludingCreator = (note as any).sharedWith.filter((userId: string) => userId !== note.userId);
                                if (sharedWithExcludingCreator.length > 0) {
                                  const sharedNames = sharedWithExcludingCreator
                                    .map((userId: string) => allUsers.find(u => u.id === userId)?.displayName || '不明')
                                    .filter((name: string) => name !== '不明')
                                    .slice(0, 2);
                                  return (
                                    <span>共有者: {sharedNames.join(', ')}
                                      {sharedWithExcludingCreator.length > 2 && ` +${sharedWithExcludingCreator.length - 2}`}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              {note.participants && note.participants.length > 0 && (
                                <span>参加者: {note.participants.length}名</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
                </div>
              </div>
            </div>

            {/* 右側: フィルターサイドバー */}
            <div className="w-64 flex-shrink-0">
              <div className="sticky top-6 space-y-4">
                {/* 使い方セクション */}
                <div className="bg-blue-50 border border-blue-100 p-4">
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
                <div className="bg-white border border-gray-200 p-4">
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
                <div className="bg-white border border-gray-200 p-4">
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
                            onClick={() => handleViewDetail(note)}
                            className="w-full text-left p-3 rounded hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
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
          </div>

          {/* 詳細表示モーダル */}
          {showDetailModal && viewingNote && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    {viewingNote.title}
                  </h2>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setViewingNote(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* 日付 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      日付
                    </label>
                    <p className="text-sm text-gray-900">
                      {new Date(viewingNote.date).toLocaleDateString('ja-JP', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>

                  {/* 内容 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      内容
                    </label>
                    <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                      {viewingNote.content}
                    </div>
                  </div>

                  {/* 参加者 */}
                  {viewingNote.participants && viewingNote.participants.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        参加者
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {viewingNote.participants.map((p, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 返信タイムライン */}
                  {viewingNote.replies && viewingNote.replies.length > 0 && (
                    <div className="border-t border-gray-200 pt-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">返信</h3>
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {[...viewingNote.replies].sort((a, b) => {
                          const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
                          const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
                          return dateA - dateB;
                        }).map((reply) => (
                          <div key={reply.id} className="flex gap-3 pb-4 border-b border-gray-100 last:border-b-0">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium text-blue-600">
                                {reply.userName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900">{reply.userName}</span>
                                <span className="text-xs text-gray-500">
                                  {reply.createdAt instanceof Date 
                                    ? reply.createdAt.toLocaleString('ja-JP', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })
                                    : new Date(reply.createdAt).toLocaleString('ja-JP', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setViewingNote(null);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    閉じる
                  </button>
                  <button
                    onClick={() => handleOpenReplyModal(viewingNote)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    返信
                  </button>
                  <button
                    onClick={() => handleEdit(viewingNote)}
                    className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
                  >
                    編集
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 編集モーダル */}
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
                      <label htmlFor="note-title" className="block text-sm font-medium text-gray-700 mb-1">
                        タイトル <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="note-title"
                        type="text"
                        value={formData.title || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        placeholder="メモのタイトルを入力"
                      />
                    </div>

                    {/* 内容 */}
                    <div>
                      <label htmlFor="note-content" className="block text-sm font-medium text-gray-700 mb-1">
                        内容 <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="note-content"
                        value={formData.content || ''}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        placeholder="メモの内容を入力してください"
                      />
                    </div>

                    {/* 日付 */}
                    <div>
                      <label htmlFor="note-date" className="block text-sm font-medium text-gray-700 mb-1">
                        日付
                      </label>
                      <input
                        id="note-date"
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

                    {/* 共有者 */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowShareSection(!showShareSection)}
                        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-700">
                          共有者
                        </span>
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

          {/* 返信モーダル */}
          {showReplyModal && replyingToNote && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">返信を追加</h2>
                  <p className="text-sm text-gray-600 mt-1">{replyingToNote.title}</p>
                </div>

                <div className="p-6 space-y-4">
                  {/* 担当者名 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      担当者名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={replyUserName}
                      onChange={(e) => setReplyUserName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="担当者名を入力"
                    />
                  </div>

                  {/* 返信内容 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      返信内容 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={6}
                      placeholder="返信内容を入力"
                    />
                  </div>
                </div>

                <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowReplyModal(false);
                      setReplyingToNote(null);
                      setReplyContent('');
                      setReplyUserName('');
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSaveReply}
                    className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
                  >
                    返信
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
