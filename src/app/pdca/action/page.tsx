'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Action {
  id: string;
  actionNumber: string;
  checkId: string;
  checkTitle: string;
  title: string;
  description: string;
  improvementPlan: string;
  nextPlanId?: string;
  nextPlanTitle?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo: string;
  deadline: string;
  createdAt: string;
  updatedAt: string;
}

export default function ActionPage() {
  const { user } = useAuth();
  const [actions, setActions] = useState<Action[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [formData, setFormData] = useState<Omit<Action, 'id' | 'createdAt' | 'updatedAt'>>({
    actionNumber: '',
    checkId: '',
    checkTitle: '',
    title: '',
    description: '',
    improvementPlan: '',
    nextPlanId: '',
    nextPlanTitle: '',
    priority: 'medium',
    status: 'draft',
    assignedTo: '',
    deadline: ''
  });

  useEffect(() => {
    if (user) {
      loadActions();
    }
  }, [user]);

  const loadActions = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/pdca/action', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setActions(data.actions || []);
      }
    } catch (error) {
      console.error('改善アクションの読み込みエラー:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.actionNumber || !formData.title) {
      alert('改善番号、タイトルは必須です');
      return;
    }
    try {
      const token = await user.getIdToken();
      const method = editingAction ? 'PUT' : 'POST';
      const body = editingAction 
        ? { id: editingAction.id, ...formData }
        : formData;
      
      const response = await fetch('/api/pdca/action', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setShowModal(false);
        setEditingAction(null);
        setFormData({
          actionNumber: '',
          checkId: '',
          checkTitle: '',
          title: '',
          description: '',
          improvementPlan: '',
          nextPlanId: '',
          nextPlanTitle: '',
          priority: 'medium',
          status: 'draft',
          assignedTo: '',
          deadline: ''
        });
        loadActions();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '改善アクションの保存に失敗しました');
      }
    } catch (error) {
      console.error('改善アクションの保存エラー:', error);
      alert('改善アクションの保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('この改善アクションを削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/pdca/action?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadActions();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '改善アクションの削除に失敗しました');
      }
    } catch (error) {
      console.error('改善アクションの削除エラー:', error);
      alert('改善アクションの削除に失敗しました');
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">改善管理</h1>
            <button
              onClick={() => {
                setEditingAction(null);
                setFormData({
                  actionNumber: '',
                  checkId: '',
                  checkTitle: '',
                  title: '',
                  description: '',
                  improvementPlan: '',
                  nextPlanId: '',
                  nextPlanTitle: '',
                  priority: 'medium',
                  status: 'draft',
                  assignedTo: '',
                  deadline: ''
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              改善アクションを追加
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">アクション番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">評価</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイトル</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">担当者</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">優先度</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">期限</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {actions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        改善アクションがありません
                      </td>
                    </tr>
                  ) : (
                    actions.map((action) => (
                      <tr key={action.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{action.actionNumber}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{action.checkTitle}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{action.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{action.assignedTo}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            action.priority === 'high' ? 'bg-red-100 text-red-800' :
                            action.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {action.priority === 'high' ? '高' :
                             action.priority === 'medium' ? '中' :
                             '低'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            action.status === 'completed' ? 'bg-green-100 text-green-800' :
                            action.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            action.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {action.status === 'draft' ? '下書き' :
                             action.status === 'in_progress' ? '進行中' :
                             action.status === 'completed' ? '完了' :
                             'キャンセル'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{action.deadline}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setEditingAction(action);
                              setFormData({
                                actionNumber: action.actionNumber,
                                checkId: action.checkId,
                                checkTitle: action.checkTitle,
                                title: action.title,
                                description: action.description,
                                improvementPlan: action.improvementPlan,
                                nextPlanId: action.nextPlanId || '',
                                nextPlanTitle: action.nextPlanTitle || '',
                                priority: action.priority,
                                status: action.status,
                                assignedTo: action.assignedTo,
                                deadline: action.deadline
                              });
                              setShowModal(true);
                            }}
                            className="text-[#005eb2] hover:text-[#004a96] mr-4"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(action.id)}
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
                  {editingAction ? '改善アクションを編集' : '改善アクションを追加'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">アクション番号</label>
                    <input
                      type="text"
                      value={formData.actionNumber}
                      onChange={(e) => setFormData({ ...formData, actionNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">評価ID</label>
                      <input
                        type="text"
                        value={formData.checkId}
                        onChange={(e) => setFormData({ ...formData, checkId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">評価タイトル</label>
                      <input
                        type="text"
                        value={formData.checkTitle}
                        onChange={(e) => setFormData({ ...formData, checkTitle: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">改善計画</label>
                    <textarea
                      value={formData.improvementPlan}
                      onChange={(e) => setFormData({ ...formData, improvementPlan: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">次期計画ID</label>
                      <input
                        type="text"
                        value={formData.nextPlanId}
                        onChange={(e) => setFormData({ ...formData, nextPlanId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">次期計画タイトル</label>
                      <input
                        type="text"
                        value={formData.nextPlanTitle}
                        onChange={(e) => setFormData({ ...formData, nextPlanTitle: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">優先度</label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as Action['priority'] })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="low">低</option>
                        <option value="medium">中</option>
                        <option value="high">高</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as Action['status'] })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="draft">下書き</option>
                        <option value="in_progress">進行中</option>
                        <option value="completed">完了</option>
                        <option value="cancelled">キャンセル</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">期限</label>
                      <input
                        type="date"
                        value={formData.deadline}
                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
                    <input
                      type="text"
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingAction(null);
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


