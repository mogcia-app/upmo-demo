'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SalesCase } from '@/types/sales';

export default function SalesOpportunitiesPage() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<SalesCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<SalesCase | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<SalesCase>>({
    title: '',
    customerName: '',
    customerCompany: '',
    status: 'prospecting',
    stage: '',
    expectedCloseDate: undefined,
    estimatedValue: undefined,
    probability: undefined,
    description: '',
    tags: [],
    assignedTo: '',
    assignedToName: ''
  });

  const [tagInput, setTagInput] = useState('');

  // 商談一覧を取得
  const fetchOpportunities = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }

      const response = await fetch(`/api/sales/opportunities?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOpportunities(data.opportunities || []);
      }
    } catch (error) {
      console.error('商談取得エラー:', error);
      alert('商談の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [user, filterStatus]);

  // フォームリセット
  const resetForm = () => {
    setFormData({
      title: '',
      customerName: '',
      customerCompany: '',
      status: 'prospecting',
      stage: '',
      expectedCloseDate: undefined,
      estimatedValue: undefined,
      probability: undefined,
      description: '',
      tags: [],
      assignedTo: '',
      assignedToName: ''
    });
    setTagInput('');
    setEditingOpportunity(null);
  };

  // モーダルを開く（新規作成）
  const handleOpenModal = () => {
    resetForm();
    setShowModal(true);
  };

  // モーダルを開く（編集）
  const handleEdit = (opportunity: SalesCase) => {
    setEditingOpportunity(opportunity);
    setFormData({
      title: opportunity.title,
      customerName: opportunity.customerName,
      customerCompany: opportunity.customerCompany || '',
      status: opportunity.status,
      stage: opportunity.stage || '',
      expectedCloseDate: opportunity.expectedCloseDate,
      estimatedValue: opportunity.estimatedValue,
      probability: opportunity.probability,
      description: opportunity.description || '',
      tags: opportunity.tags || [],
      assignedTo: opportunity.assignedTo || '',
      assignedToName: opportunity.assignedToName || ''
    });
    setShowModal(true);
  };

  // 保存
  const handleSave = async () => {
    if (!user || !formData.title || !formData.customerName) {
      alert('案件名と顧客名は必須です');
      return;
    }

    try {
      setIsSaving(true);
      const token = await user.getIdToken();

      const payload = {
        ...formData,
        expectedCloseDate: formData.expectedCloseDate 
          ? new Date(formData.expectedCloseDate).toISOString() 
          : undefined
      };

      const url = '/api/sales/opportunities';
      const method = editingOpportunity ? 'PUT' : 'POST';
      const body = editingOpportunity 
        ? { id: editingOpportunity.id, ...payload }
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

      alert(editingOpportunity ? '商談を更新しました' : '商談を作成しました');
      setShowModal(false);
      resetForm();
      fetchOpportunities();
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
    if (!confirm('この商談を削除しますか？')) return;
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/sales/opportunities?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('商談を削除しました');
        fetchOpportunities();
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

  // ステータスラベル
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'prospecting': '見込み客',
      'qualification': '見極め中',
      'proposal': '提案中',
      'negotiation': '交渉中',
      'closed_won': '成約',
      'closed_lost': '失注'
    };
    return labels[status] || status;
  };

  // ステータスバッジの色
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'prospecting': 'bg-gray-100 text-gray-800',
      'qualification': 'bg-blue-100 text-blue-800',
      'proposal': 'bg-yellow-100 text-yellow-800',
      'negotiation': 'bg-orange-100 text-orange-800',
      'closed_won': 'bg-green-100 text-green-800',
      'closed_lost': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gray-50 -mx-4 lg:-mx-6">
          {/* ヘッダー */}
          <div className="bg-white border-b border-gray-100 px-6 sm:px-8 py-4 flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900">商談管理</h1>
            <button
              onClick={handleOpenModal}
              className="px-3 py-2 bg-[#005eb2] text-white hover:bg-[#004a96] transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs">新規商談</span>
            </button>
          </div>

          {/* コンテンツエリア */}
          <div className="px-6 sm:px-8 py-6">
            {/* フィルターと商談一覧を結合 */}
            <div className="bg-white border border-gray-200">
              {/* フィルター */}
              <div className="p-4 border-b border-gray-200 flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-[#005eb2] text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                すべて
              </button>
              <button
                onClick={() => setFilterStatus('prospecting')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  filterStatus === 'prospecting'
                    ? 'bg-[#005eb2] text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                見込み客
              </button>
              <button
                onClick={() => setFilterStatus('proposal')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  filterStatus === 'proposal'
                    ? 'bg-[#005eb2] text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                提案中
            </button>
            <button
              onClick={() => setFilterStatus('negotiation')}
              className={`px-3 py-1.5 text-xs transition-colors ${
                filterStatus === 'negotiation'
                  ? 'bg-[#005eb2] text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              交渉中
            </button>
            <button
              onClick={() => setFilterStatus('closed_won')}
              className={`px-3 py-1.5 text-xs transition-colors ${
                filterStatus === 'closed_won'
                  ? 'bg-[#005eb2] text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              成約
            </button>
              </div>

              {/* 商談一覧 */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#005eb2]"></div>
                  <p className="mt-2 text-gray-600">読み込み中...</p>
                </div>
              ) : opportunities.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">商談がありません</p>
                  <button
                    onClick={handleOpenModal}
                    className="mt-4 px-3 py-2 bg-[#005eb2] text-white hover:bg-[#004a96] transition-colors text-sm font-medium"
                  >
                    最初の商談を作成
                  </button>
                </div>
              ) : (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {opportunities.map((opportunity) => (
                <div
                  key={opportunity.id}
                  className="bg-white border border-gray-200 p-6 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {opportunity.title}
                      </h3>
                      <p className="text-sm text-gray-600">{opportunity.customerName}</p>
                      {opportunity.customerCompany && (
                        <p className="text-xs text-gray-500 mt-1">{opportunity.customerCompany}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(opportunity.status)}`}>
                      {getStatusLabel(opportunity.status)}
                    </span>
                  </div>

                  {opportunity.description && (
                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                      {opportunity.description}
                    </p>
                  )}

                  <div className="space-y-2 mb-4">
                    {opportunity.estimatedValue && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium mr-2">見積:</span>
                        <span>{opportunity.estimatedValue.toLocaleString()}円</span>
                      </div>
                    )}
                    {opportunity.probability && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium mr-2">確率:</span>
                        <span>{opportunity.probability}%</span>
                      </div>
                    )}
                    {opportunity.expectedCloseDate && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium mr-2">予定日:</span>
                        <span>{new Date(opportunity.expectedCloseDate).toLocaleDateString('ja-JP')}</span>
                      </div>
                    )}
                  </div>

                  {opportunity.tags && opportunity.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {opportunity.tags.map((tag, idx) => (
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
                      onClick={() => handleEdit(opportunity)}
                      className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(opportunity.id)}
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
          </div>

          {/* モーダル */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingOpportunity ? '商談を編集' : '新規商談を作成'}
                  </h2>
                </div>

                <div className="p-4 sm:p-6 space-y-4">
                  {/* 基本情報 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      案件名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title || ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      placeholder="例: 新規システム導入案件"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        顧客名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.customerName || ''}
                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        placeholder="例: 山田太郎"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        顧客会社名
                      </label>
                      <input
                        type="text"
                        value={formData.customerCompany || ''}
                        onChange={(e) => setFormData({ ...formData, customerCompany: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        placeholder="例: 株式会社サンプル"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ステータス
                      </label>
                      <select
                        value={formData.status || 'prospecting'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      >
                        <option value="prospecting">見込み客</option>
                        <option value="qualification">見極め中</option>
                        <option value="proposal">提案中</option>
                        <option value="negotiation">交渉中</option>
                        <option value="closed_won">成約</option>
                        <option value="closed_lost">失注</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        商談ステージ
                      </label>
                      <input
                        type="text"
                        value={formData.stage || ''}
                        onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        placeholder="例: 提案準備中"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        見積金額（円）
                      </label>
                      <input
                        type="number"
                        value={formData.estimatedValue || ''}
                        onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        placeholder="1000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        成約確率（%）
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.probability || ''}
                        onChange={(e) => setFormData({ ...formData, probability: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                        placeholder="50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        予定クロージング日
                      </label>
                      <input
                        type="date"
                        value={formData.expectedCloseDate 
                          ? new Date(formData.expectedCloseDate).toISOString().split('T')[0]
                          : ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          expectedCloseDate: e.target.value ? new Date(e.target.value) : undefined 
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      案件概要
                    </label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                      placeholder="案件の詳細を入力してください"
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
                    {isSaving ? '保存中...' : editingOpportunity ? '更新' : '作成'}
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

