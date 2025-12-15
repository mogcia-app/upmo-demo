'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ProgressNote, SalesCase } from '@/types/sales';
import SummaryModal from '@/components/SummaryModal';

export default function ProgressNotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<ProgressNote[]>([]);
  const [cases, setCases] = useState<SalesCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<ProgressNote | null>(null);
  const [filterCaseId, setFilterCaseId] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  
  // 要約用の状態
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [summaryDocumentId, setSummaryDocumentId] = useState<string>('');

  // URLパラメータから案件IDを取得
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const caseId = params.get('caseId');
      if (caseId) {
        setFilterCaseId(caseId);
      }
    }
  }, []);

  const [formData, setFormData] = useState<Partial<ProgressNote>>({
    caseId: undefined,
    caseTitle: '',
    title: '',
    content: '',
    type: 'meeting',
    date: new Date(),
    participants: [],
    nextActions: [],
    risks: [],
    tags: [],
    priority: 'medium'
  });

  const [participantInput, setParticipantInput] = useState('');
  const [nextActionInput, setNextActionInput] = useState('');
  const [riskInput, setRiskInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  // 案件一覧を取得
  const fetchCases = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/sales/cases?userId=${user.uid}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCases(data.cases || []);
      }
    } catch (error) {
      console.error('案件取得エラー:', error);
    }
  };

  // 進捗メモ一覧を取得
  const fetchNotes = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();
      const params = new URLSearchParams({ userId: user.uid });
      if (filterCaseId !== 'all') {
        params.append('caseId', filterCaseId);
      }

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
      console.error('進捗メモ取得エラー:', error);
      alert('進捗メモの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [user]);

  useEffect(() => {
    fetchNotes();
  }, [user, filterCaseId]);

  // フォームリセット
  const resetForm = () => {
    setFormData({
      caseId: filterCaseId !== 'all' ? filterCaseId : undefined,
      caseTitle: '',
      title: '',
      content: '',
      type: 'meeting',
      date: new Date(),
      participants: [],
      nextActions: [],
      risks: [],
      tags: [],
      priority: 'medium'
    });
    setParticipantInput('');
    setNextActionInput('');
    setRiskInput('');
    setTagInput('');
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
      caseId: note.caseId || undefined,
      caseTitle: note.caseTitle || '',
      title: note.title,
      content: note.content,
      type: note.type,
      date: note.date,
      participants: note.participants || [],
      nextActions: note.nextActions || [],
      risks: note.risks || [],
      tags: note.tags || [],
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

      // 案件タイトルを取得
      let caseTitle = formData.caseTitle;
      if (formData.caseId && !caseTitle) {
        const selectedCase = cases.find(c => c.id === formData.caseId);
        if (selectedCase) {
          caseTitle = selectedCase.title;
        }
      }

      const payload = {
        ...formData,
        caseTitle,
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

      alert(editingNote ? '進捗メモを更新しました' : '進捗メモを作成しました');
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
    if (!confirm('この進捗メモを削除しますか？')) return;
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
        alert('進捗メモを削除しました');
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

  // 次アクション追加
  const handleAddNextAction = () => {
    if (nextActionInput.trim() && !formData.nextActions?.includes(nextActionInput.trim())) {
      setFormData({
        ...formData,
        nextActions: [...(formData.nextActions || []), nextActionInput.trim()]
      });
      setNextActionInput('');
    }
  };

  // リスク追加
  const handleAddRisk = () => {
    if (riskInput.trim() && !formData.risks?.includes(riskInput.trim())) {
      setFormData({
        ...formData,
        risks: [...(formData.risks || []), riskInput.trim()]
      });
      setRiskInput('');
    }
  };

  // タグ追加
  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tagInput.trim()]
      });
      setTagInput('');
    }
  };

  // 参加者削除
  const handleRemoveParticipant = (participant: string) => {
    setFormData({
      ...formData,
      participants: formData.participants?.filter(p => p !== participant) || []
    });
  };

  // 次アクション削除
  const handleRemoveNextAction = (action: string) => {
    setFormData({
      ...formData,
      nextActions: formData.nextActions?.filter(a => a !== action) || []
    });
  };

  // リスク削除
  const handleRemoveRisk = (risk: string) => {
    setFormData({
      ...formData,
      risks: formData.risks?.filter(r => r !== risk) || []
    });
  };

  // タグ削除
  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(t => t !== tag) || []
    });
  };

  // タイプラベル
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'meeting': '打ち合わせ',
      'call': '電話',
      'email': 'メール',
      'document': '資料',
      'other': 'その他'
    };
    return labels[type] || type;
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

  return (
    <ProtectedRoute>
      <Layout>
        <div className="max-w-7xl mx-auto">
          {/* ヘッダー */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">進捗メモ管理</h1>
              <p className="text-sm text-gray-600 mt-1">進捗メモの作成・編集・管理を行います</p>
            </div>
            <div className="flex gap-3">
              <a
                href="/sales/cases"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                案件一覧
              </a>
              <button
                onClick={handleOpenModal}
                className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
              >
                + 新規メモ
              </button>
            </div>
          </div>

          {/* フィルター */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              案件でフィルター
            </label>
            <select
              value={filterCaseId}
              onChange={(e) => setFilterCaseId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
            >
              <option value="all">すべての案件</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} - {c.customerName}
                </option>
              ))}
            </select>
          </div>

          {/* 進捗メモ一覧 */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#005eb2]"></div>
              <p className="mt-2 text-gray-600">読み込み中...</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-600">進捗メモがありません</p>
              <button
                onClick={handleOpenModal}
                className="mt-4 px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
              >
                最初のメモを作成
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {note.title}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(note.priority)}`}>
                          {getPriorityLabel(note.priority)}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                          {getTypeLabel(note.type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{new Date(note.date).toLocaleDateString('ja-JP')}</span>
                        {note.caseTitle && (
                          <span className="text-[#005eb2]">案件: {note.caseTitle}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-700 mb-4 whitespace-pre-wrap">
                    {note.content}
                  </p>

                  {note.nextActions && note.nextActions.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-1">次アクション:</h4>
                      <ul className="list-disc list-inside text-sm text-gray-600">
                        {note.nextActions.map((action, idx) => (
                          <li key={idx}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {note.risks && note.risks.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-red-700 mb-1">リスク・懸念:</h4>
                      <ul className="list-disc list-inside text-sm text-red-600">
                        {note.risks.map((risk, idx) => (
                          <li key={idx}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {note.participants && note.participants.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-1">参加者:</h4>
                      <div className="flex flex-wrap gap-2">
                        {note.participants.map((participant, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                          >
                            {participant}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {note.tags && note.tags.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {note.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        // 進捗メモの内容を文字列に変換
                        const contentParts: string[] = [];
                        contentParts.push(`タイトル: ${note.title}`);
                        contentParts.push(`日付: ${new Date(note.date).toLocaleDateString('ja-JP')}`);
                        if (note.caseTitle) contentParts.push(`関連案件: ${note.caseTitle}`);
                        contentParts.push(`内容:\n${note.content}`);
                        if (note.nextActions && note.nextActions.length > 0) {
                          contentParts.push(`次アクション:\n${note.nextActions.join('\n')}`);
                        }
                        if (note.risks && note.risks.length > 0) {
                          contentParts.push(`リスク・懸念:\n${note.risks.join('\n')}`);
                        }
                        if (note.participants && note.participants.length > 0) {
                          contentParts.push(`参加者: ${note.participants.join(', ')}`);
                        }
                        const content = contentParts.join('\n\n');
                        
                        setSummaryContent(content);
                        setSummaryDocumentId(note.id);
                        setShowSummaryModal(true);
                      }}
                      className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    >
                      要約
                    </button>
                    <button
                      onClick={() => handleEdit(note)}
                      className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* モーダル */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingNote ? '進捗メモを編集' : '新規進捗メモを作成'}
                  </h2>
                </div>

                <div className="p-6 space-y-4">
                  {/* 基本情報 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      タイトル <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title || ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      placeholder="例: 初回打ち合わせ"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        関連案件
                      </label>
                      <select
                        value={formData.caseId || ''}
                        onChange={(e) => {
                          const selectedCase = cases.find(c => c.id === e.target.value);
                          setFormData({
                            ...formData,
                            caseId: e.target.value || undefined,
                            caseTitle: selectedCase?.title || ''
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      >
                        <option value="">選択なし</option>
                        {cases.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title} - {c.customerName}
                          </option>
                        ))}
                      </select>
                    </div>
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        タイプ
                      </label>
                      <select
                        value={formData.type || 'meeting'}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      >
                        <option value="meeting">打ち合わせ</option>
                        <option value="call">電話</option>
                        <option value="email">メール</option>
                        <option value="document">資料</option>
                        <option value="other">その他</option>
                      </select>
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      内容 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.content || ''}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      placeholder="進捗内容を入力してください"
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

                  {/* 次アクション */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      次アクション
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={nextActionInput}
                        onChange={(e) => setNextActionInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddNextAction()}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        placeholder="次アクションを入力してEnter"
                      />
                      <button
                        onClick={handleAddNextAction}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        追加
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.nextActions?.map((action, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm flex items-center gap-2"
                        >
                          {action}
                          <button
                            onClick={() => handleRemoveNextAction(action)}
                            className="hover:text-yellow-900"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* リスク・懸念 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      リスク・懸念事項
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={riskInput}
                        onChange={(e) => setRiskInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddRisk()}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        placeholder="リスクを入力してEnter"
                      />
                      <button
                        onClick={handleAddRisk}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        追加
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.risks?.map((risk, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm flex items-center gap-2"
                        >
                          {risk}
                          <button
                            onClick={() => handleRemoveRisk(risk)}
                            className="hover:text-red-900"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* タグ */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      タグ
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        placeholder="タグを入力してEnter"
                      />
                      <button
                        onClick={handleAddTag}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        追加
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.tags?.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-blue-900"
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

        {/* 要約モーダル */}
        <SummaryModal
          isOpen={showSummaryModal}
          onClose={() => {
            setShowSummaryModal(false);
            setSummaryContent('');
            setSummaryDocumentId('');
          }}
          content={summaryContent}
          documentType="progressNote"
          documentId={summaryDocumentId}
          sourceType="progressNote"
        />
      </Layout>
    </ProtectedRoute>
  );
}

