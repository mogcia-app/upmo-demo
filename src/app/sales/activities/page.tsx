'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SalesActivity } from '@/types/sales';

export default function SalesActivitiesPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<SalesActivity | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; displayName: string; email: string }>>([]);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [companySearchResults, setCompanySearchResults] = useState<Array<{ tabId: string; tabName: string; row: any; columns: any[] }>>([]);
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [selectedCompanyData, setSelectedCompanyData] = useState<{ row: any; columns: any[] } | null>(null);

  const [formData, setFormData] = useState<Partial<SalesActivity>>({
    title: '',
    type: 'other',
    companyName: '',
    companyData: {},
    activityDate: new Date(),
    participants: [],
    description: '',
    outcome: '',
    nextAction: '',
    tags: []
  });

  const [tagInput, setTagInput] = useState('');

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
          
          const members = data.users
            .filter((u: any) => u.companyName === currentCompanyName)
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

  // 会社名で検索
  const searchCompany = async (query: string) => {
    if (!user || !query.trim()) {
      setCompanySearchResults([]);
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/customers/list?searchCompanyName=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCompanySearchResults(data.searchResults || []);
      }
    } catch (error) {
      console.error('会社名検索エラー:', error);
    }
  };

  // 会社名検索のデバウンス
  useEffect(() => {
    const timer = setTimeout(() => {
      if (companySearchQuery) {
        searchCompany(companySearchQuery);
      } else {
        setCompanySearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [companySearchQuery]);

  // 会社を選択
  const handleSelectCompany = (result: { row: any; columns: any[] }) => {
    setSelectedCompanyData(result);
    // 会社名の列を探す
    const companyNameColumn = result.columns.find((col: any) => 
      col.name === '会社名' || col.name === 'companyName' || col.name.toLowerCase().includes('会社')
    );
    const companyName = companyNameColumn ? result.row[companyNameColumn.id] : '';
    setFormData({
      ...formData,
      companyName: companyName || '',
      companyData: result.row
    });
    setCompanySearchQuery(companyName || '');
    setShowCompanySearch(false);
  };

  // 営業活動一覧を取得
  const fetchActivities = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      if (filterType !== 'all') {
        params.append('type', filterType);
      }

      const response = await fetch(`/api/sales/activities?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('営業活動取得エラー:', error);
      alert('営業活動の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [user, filterType]);

  // フォームリセット
  const resetForm = () => {
    setFormData({
      title: '',
      type: 'other',
      companyName: '',
      companyData: {},
      activityDate: new Date(),
      participants: [],
      description: '',
      outcome: '',
      nextAction: '',
      tags: []
    });
    setTagInput('');
    setCompanySearchQuery('');
    setCompanySearchResults([]);
    setSelectedCompanyData(null);
    setEditingActivity(null);
  };

  // モーダルを開く（新規作成）
  const handleOpenModal = () => {
    resetForm();
    setShowModal(true);
  };

  // モーダルを開く（編集）
  const handleEdit = (activity: SalesActivity) => {
    setEditingActivity(activity);
    setFormData({
      title: activity.title,
      type: activity.type,
      companyName: activity.companyName || '',
      companyData: activity.companyData || {},
      activityDate: activity.activityDate,
      participants: activity.participants || [],
      description: activity.description || '',
      outcome: activity.outcome || '',
      nextAction: activity.nextAction || '',
      tags: activity.tags || []
    });
    if (activity.companyData) {
      setSelectedCompanyData({ row: activity.companyData, columns: [] });
    }
    setCompanySearchQuery(activity.companyName || '');
    setShowModal(true);
  };

  // 保存
  const handleSave = async () => {
    if (!user || !formData.title || !formData.companyName || !formData.activityDate) {
      alert('タイトル、会社名、活動日は必須です');
      return;
    }

    try {
      setIsSaving(true);
      const token = await user.getIdToken();

      const payload = {
        ...formData,
        activityDate: formData.activityDate instanceof Date 
          ? formData.activityDate.toISOString()
          : new Date(formData.activityDate).toISOString()
      };

      const url = '/api/sales/activities';
      const method = editingActivity ? 'PUT' : 'POST';
      const body = editingActivity 
        ? { id: editingActivity.id, ...payload }
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

      alert(editingActivity ? '営業活動を更新しました' : '営業活動を作成しました');
      setShowModal(false);
      resetForm();
      fetchActivities();
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
    if (!confirm('この営業活動を削除しますか？')) return;
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/sales/activities?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('営業活動を削除しました');
        fetchActivities();
      } else {
        throw new Error('削除に失敗しました');
      }
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
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

  // タグ削除
  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(t => t !== tag) || []
    });
  };

  // 活動タイプラベル
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'visit': '訪問',
      'call': '電話',
      'email': 'メール',
      'meeting': '会議',
      'presentation': 'プレゼン',
      'other': 'その他'
    };
    return labels[type] || type;
  };

  // 活動タイプの色
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'visit': 'bg-blue-100 text-blue-800',
      'call': 'bg-green-100 text-green-800',
      'email': 'bg-purple-100 text-purple-800',
      'meeting': 'bg-orange-100 text-orange-800',
      'presentation': 'bg-pink-100 text-pink-800',
      'other': 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gray-50 -mx-4 lg:-mx-6">
          {/* ヘッダー */}
          <div className="bg-white border-b border-gray-100 px-6 sm:px-8 py-4">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900">営業活動管理</h1>
          </div>

          {/* コンテンツエリア */}
          <div className="px-6 sm:px-8 py-6">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={handleOpenModal}
                className="px-3 py-2 bg-[#005eb2] text-white hover:bg-[#004a96] transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs">新規活動</span>
              </button>
            </div>

            {/* フィルター */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  filterType === 'all'
                    ? 'bg-[#005eb2] text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                すべて
              </button>
              <button
                onClick={() => setFilterType('visit')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  filterType === 'visit'
                    ? 'bg-[#005eb2] text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                訪問
              </button>
              <button
                onClick={() => setFilterType('call')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  filterType === 'call'
                    ? 'bg-[#005eb2] text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                電話
            </button>
            <button
              onClick={() => setFilterType('meeting')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterType === 'meeting'
                  ? 'bg-[#005eb2] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              会議
            </button>
            <button
              onClick={() => setFilterType('email')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterType === 'email'
                  ? 'bg-[#005eb2] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              メール
            </button>
          </div>

          {/* 営業活動一覧 */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#005eb2]"></div>
              <p className="mt-2 text-gray-600">読み込み中...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-600">営業活動がありません</p>
              <button
                onClick={handleOpenModal}
                className="mt-4 px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
              >
                最初の活動を記録
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="bg-white border border-gray-200 p-6 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {activity.title}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(activity.type)}`}>
                          {getTypeLabel(activity.type)}
                        </span>
                      </div>
                      {activity.companyName && (
                        <p className="text-sm text-gray-600">{activity.companyName}</p>
                      )}
                      {activity.companyData && Object.keys(activity.companyData).length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          {Object.entries(activity.companyData).slice(0, 3).map(([key, value]) => (
                            <span key={key} className="mr-3">
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">活動日:</span>
                      <p className="text-gray-600">
                        {new Date(activity.activityDate).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                    {activity.participantNames && activity.participantNames.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700">参加者:</span>
                        <p className="text-gray-600">{activity.participantNames.join(', ')}</p>
                      </div>
                    )}
                  </div>

                  {activity.description && (
                    <p className="text-sm text-gray-700 mb-3">
                      {activity.description}
                    </p>
                  )}

                  {activity.outcome && (
                    <div className="mb-3">
                      <span className="font-medium text-gray-700 text-sm">結果:</span>
                      <p className="text-sm text-gray-600 mt-1">{activity.outcome}</p>
                    </div>
                  )}

                  {activity.nextAction && (
                    <div className="mb-3">
                      <span className="font-medium text-gray-700 text-sm">次アクション:</span>
                      <p className="text-sm text-gray-600 mt-1">{activity.nextAction}</p>
                    </div>
                  )}

                  {activity.tags && activity.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {activity.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleEdit(activity)}
                      className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(activity.id)}
                      className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>

          {/* モーダル */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingActivity ? '営業活動を編集' : '新規営業活動を記録'}
                  </h2>
                </div>

                <div className="p-4 sm:p-6 space-y-4">
                  {/* 基本情報 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      活動タイトル <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title || ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      placeholder="例: 初回訪問"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      活動タイプ
                    </label>
                    <select
                      value={formData.type || 'other'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                    >
                      <option value="visit">訪問</option>
                      <option value="call">電話</option>
                      <option value="email">メール</option>
                      <option value="meeting">会議</option>
                      <option value="presentation">プレゼン</option>
                      <option value="other">その他</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      会社名 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={companySearchQuery}
                        onChange={(e) => {
                          setCompanySearchQuery(e.target.value);
                          setShowCompanySearch(true);
                        }}
                        onFocus={() => setShowCompanySearch(true)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        placeholder="会社名を入力または検索"
                      />
                      {showCompanySearch && companySearchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {companySearchResults.map((result, idx) => {
                            const companyNameColumn = result.columns.find((col: any) => 
                              col.name === '会社名' || col.name === 'companyName' || col.name.toLowerCase().includes('会社')
                            );
                            const companyName = companyNameColumn ? result.row[companyNameColumn.id] : '';
                            return (
                              <button
                                key={idx}
                                onClick={() => handleSelectCompany(result)}
                                className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-200 last:border-b-0"
                              >
                                <div className="font-medium">{companyName}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {result.columns.slice(0, 3).map((col: any) => (
                                    <span key={col.id} className="mr-2">
                                      {col.name}: {String(result.row[col.id] || '')}
                                    </span>
                                  ))}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {selectedCompanyData && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-sm font-medium text-gray-700 mb-2">選択された会社情報:</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {selectedCompanyData.columns.map((col: any) => (
                            <div key={col.id}>
                              <span className="font-medium text-gray-600">{col.name}:</span>
                              <span className="ml-1 text-gray-700">{String(selectedCompanyData.row[col.id] || '')}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCompanyData(null);
                            setCompanySearchQuery('');
                            setFormData({ ...formData, companyName: '', companyData: {} });
                          }}
                          className="mt-2 text-xs text-red-600 hover:text-red-800"
                        >
                          選択を解除
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      活動日 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.activityDate 
                        ? (formData.activityDate instanceof Date 
                            ? formData.activityDate.toISOString().split('T')[0]
                            : new Date(formData.activityDate).toISOString().split('T')[0])
                        : ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        activityDate: e.target.value ? new Date(e.target.value) : new Date()
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      参加者
                    </label>
                    <details className="group">
                      <summary className="cursor-pointer px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50">
                        {formData.participants && formData.participants.length > 0
                          ? `${formData.participants.length}名選択中`
                          : '参加者を選択'}
                      </summary>
                      <div className="mt-2 p-3 border border-gray-300 rounded-lg bg-white max-h-48 overflow-y-auto">
                        {teamMembers.map(member => (
                          <label key={member.id} className="flex items-center py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.participants?.includes(member.id) || false}
                              onChange={(e) => {
                                const current = formData.participants || [];
                                if (e.target.checked) {
                                  setFormData({ ...formData, participants: [...current, member.id] });
                                } else {
                                  setFormData({ ...formData, participants: current.filter(id => id !== member.id) });
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">{member.displayName} ({member.email})</span>
                          </label>
                        ))}
                      </div>
                    </details>
                    {formData.participants && formData.participants.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {formData.participants.map(participantId => {
                          const member = teamMembers.find(m => m.id === participantId);
                          return member ? (
                            <span key={participantId} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              {member.displayName}
                              <button
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    participants: formData.participants?.filter(id => id !== participantId) || []
                                  });
                                }}
                                className="ml-1 hover:text-blue-900"
                              >
                                ×
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      活動内容
                    </label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      placeholder="活動の詳細を入力してください"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      結果・成果
                    </label>
                    <textarea
                      value={formData.outcome || ''}
                      onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      placeholder="活動の結果や成果を入力してください"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      次アクション
                    </label>
                    <input
                      type="text"
                      value={formData.nextAction || ''}
                      onChange={(e) => setFormData({ ...formData, nextAction: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      placeholder="例: 提案書を送付"
                    />
                  </div>

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

                <div className="p-4 sm:p-6 border-t border-gray-200 flex justify-end gap-3">
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
                    {isSaving ? '保存中...' : editingActivity ? '更新' : '作成'}
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

