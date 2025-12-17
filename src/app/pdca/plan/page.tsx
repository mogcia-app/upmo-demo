'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Plan {
  id: string;
  planNumber: string;
  title: string;
  description: string;
  target: string;
  deadline: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  assignedTo: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

export default function PlanPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState<Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>>({
    planNumber: '',
    title: '',
    description: '',
    target: '',
    deadline: '',
    status: 'draft',
    assignedTo: '',
    priority: 'medium'
  });

  useEffect(() => {
    if (user) {
      loadPlans();
    }
  }, [user]);

  const loadPlans = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/pdca/plan', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error('計画の読み込みエラー:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.planNumber || !formData.title) {
      alert('計画番号、タイトルは必須です');
      return;
    }
    try {
      const token = await user.getIdToken();
      const method = editingPlan ? 'PUT' : 'POST';
      const body = editingPlan 
        ? { id: editingPlan.id, ...formData }
        : formData;
      
      const response = await fetch('/api/pdca/plan', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setShowModal(false);
        setEditingPlan(null);
        setFormData({
          planNumber: '',
          title: '',
          description: '',
          target: '',
          deadline: '',
          status: 'draft',
          assignedTo: '',
          priority: 'medium'
        });
        loadPlans();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '計画の保存に失敗しました');
      }
    } catch (error) {
      console.error('計画の保存エラー:', error);
      alert('計画の保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('この計画を削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/pdca/plan?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadPlans();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '計画の削除に失敗しました');
      }
    } catch (error) {
      console.error('計画の削除エラー:', error);
      alert('計画の削除に失敗しました');
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">計画管理</h1>
            <button
              onClick={() => {
                setEditingPlan(null);
                setFormData({
                  planNumber: '',
                  title: '',
                  description: '',
                  target: '',
                  deadline: '',
                  status: 'draft',
                  assignedTo: '',
                  priority: 'medium'
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              計画を追加
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">計画番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイトル</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目標</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">期限</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">担当者</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">優先度</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {plans.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        計画がありません
                      </td>
                    </tr>
                  ) : (
                    plans.map((plan) => (
                      <tr key={plan.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{plan.planNumber}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{plan.title}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{plan.target}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{plan.deadline}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{plan.assignedTo}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            plan.priority === 'high' ? 'bg-red-100 text-red-800' :
                            plan.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {plan.priority === 'high' ? '高' :
                             plan.priority === 'medium' ? '中' :
                             '低'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            plan.status === 'completed' ? 'bg-green-100 text-green-800' :
                            plan.status === 'active' ? 'bg-blue-100 text-blue-800' :
                            plan.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {plan.status === 'draft' ? '下書き' :
                             plan.status === 'active' ? '実行中' :
                             plan.status === 'completed' ? '完了' :
                             'キャンセル'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setEditingPlan(plan);
                              setFormData({
                                planNumber: plan.planNumber,
                                title: plan.title,
                                description: plan.description,
                                target: plan.target,
                                deadline: plan.deadline,
                                status: plan.status,
                                assignedTo: plan.assignedTo,
                                priority: plan.priority
                              });
                              setShowModal(true);
                            }}
                            className="text-[#005eb2] hover:text-[#004a96] mr-4"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(plan.id)}
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
                  {editingPlan ? '計画を編集' : '計画を追加'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">計画番号</label>
                    <input
                      type="text"
                      value={formData.planNumber}
                      onChange={(e) => setFormData({ ...formData, planNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">目標</label>
                    <input
                      type="text"
                      value={formData.target}
                      onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">期限</label>
                      <input
                        type="date"
                        value={formData.deadline}
                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">優先度</label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as Plan['priority'] })}
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
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as Plan['status'] })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="draft">下書き</option>
                        <option value="active">実行中</option>
                        <option value="completed">完了</option>
                        <option value="cancelled">キャンセル</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingPlan(null);
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


