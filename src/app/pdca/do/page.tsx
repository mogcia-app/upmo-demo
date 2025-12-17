'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface DoActivity {
  id: string;
  activityNumber: string;
  planId: string;
  planTitle: string;
  title: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  assignedTo: string;
  startDate: string;
  endDate: string;
  progress: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export default function DoPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<DoActivity[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<DoActivity | null>(null);
  const [formData, setFormData] = useState<Omit<DoActivity, 'id' | 'createdAt' | 'updatedAt'>>({
    activityNumber: '',
    planId: '',
    planTitle: '',
    title: '',
    description: '',
    status: 'not_started',
    assignedTo: '',
    startDate: '',
    endDate: '',
    progress: 0,
    notes: ''
  });

  useEffect(() => {
    if (user) {
      loadActivities();
    }
  }, [user]);

  const loadActivities = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/pdca/do', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('活動の読み込みエラー:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.activityNumber || !formData.title) {
      alert('活動番号、タイトルは必須です');
      return;
    }
    try {
      const token = await user.getIdToken();
      const method = editingActivity ? 'PUT' : 'POST';
      const body = editingActivity 
        ? { id: editingActivity.id, ...formData }
        : formData;
      
      const response = await fetch('/api/pdca/do', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setShowModal(false);
        setEditingActivity(null);
        setFormData({
          activityNumber: '',
          planId: '',
          planTitle: '',
          title: '',
          description: '',
          status: 'not_started',
          assignedTo: '',
          startDate: '',
          endDate: '',
          progress: 0,
          notes: ''
        });
        loadActivities();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '活動の保存に失敗しました');
      }
    } catch (error) {
      console.error('活動の保存エラー:', error);
      alert('活動の保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('この活動を削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/pdca/do?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadActivities();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '活動の削除に失敗しました');
      }
    } catch (error) {
      console.error('活動の削除エラー:', error);
      alert('活動の削除に失敗しました');
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">実行管理</h1>
            <button
              onClick={() => {
                setEditingActivity(null);
                setFormData({
                  activityNumber: '',
                  planId: '',
                  planTitle: '',
                  title: '',
                  description: '',
                  status: 'not_started',
                  assignedTo: '',
                  startDate: '',
                  endDate: '',
                  progress: 0,
                  notes: ''
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              活動を追加
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">活動番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">計画</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイトル</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">担当者</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">進捗</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">期間</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        活動がありません
                      </td>
                    </tr>
                  ) : (
                    activities.map((activity) => (
                      <tr key={activity.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{activity.activityNumber}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{activity.planTitle}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{activity.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{activity.assignedTo}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${activity.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-600">{activity.progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                            activity.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            activity.status === 'blocked' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {activity.status === 'not_started' ? '未開始' :
                             activity.status === 'in_progress' ? '進行中' :
                             activity.status === 'completed' ? '完了' :
                             'ブロック'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {activity.startDate} ～ {activity.endDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setEditingActivity(activity);
                              setFormData({
                                activityNumber: activity.activityNumber,
                                planId: activity.planId,
                                planTitle: activity.planTitle,
                                title: activity.title,
                                description: activity.description,
                                status: activity.status,
                                assignedTo: activity.assignedTo,
                                startDate: activity.startDate,
                                endDate: activity.endDate,
                                progress: activity.progress,
                                notes: activity.notes
                              });
                              setShowModal(true);
                            }}
                            className="text-[#005eb2] hover:text-[#004a96] mr-4"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(activity.id)}
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
                  {editingActivity ? '活動を編集' : '活動を追加'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">活動番号</label>
                    <input
                      type="text"
                      value={formData.activityNumber}
                      onChange={(e) => setFormData({ ...formData, activityNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">計画ID</label>
                    <input
                      type="text"
                      value={formData.planId}
                      onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">計画タイトル</label>
                    <input
                      type="text"
                      value={formData.planTitle}
                      onChange={(e) => setFormData({ ...formData, planTitle: e.target.value })}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
                      <input
                        type="text"
                        value={formData.assignedTo}
                        onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">進捗 (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.progress}
                        onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as DoActivity['status'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="not_started">未開始</option>
                      <option value="in_progress">進行中</option>
                      <option value="completed">完了</option>
                      <option value="blocked">ブロック</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingActivity(null);
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


