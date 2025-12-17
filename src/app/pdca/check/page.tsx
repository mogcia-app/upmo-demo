'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Check {
  id: string;
  checkNumber: string;
  planId: string;
  planTitle: string;
  activityId: string;
  activityTitle: string;
  targetValue: number;
  actualValue: number;
  achievementRate: number;
  kpi: string;
  evaluation: string;
  issues: string[];
  status: 'draft' | 'reviewed' | 'approved';
  evaluatedBy: string;
  evaluationDate: string;
  createdAt: string;
  updatedAt: string;
}

export default function CheckPage() {
  const { user } = useAuth();
  const [checks, setChecks] = useState<Check[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCheck, setEditingCheck] = useState<Check | null>(null);
  const [formData, setFormData] = useState<Omit<Check, 'id' | 'achievementRate' | 'createdAt' | 'updatedAt'>>({
    checkNumber: '',
    planId: '',
    planTitle: '',
    activityId: '',
    activityTitle: '',
    targetValue: 0,
    actualValue: 0,
    kpi: '',
    evaluation: '',
    issues: [],
    status: 'draft',
    evaluatedBy: '',
    evaluationDate: ''
  });
  const [issueInput, setIssueInput] = useState('');

  useEffect(() => {
    if (user) {
      loadChecks();
    }
  }, [user]);

  const loadChecks = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/pdca/check', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setChecks(data.checks || []);
      }
    } catch (error) {
      console.error('評価の読み込みエラー:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.checkNumber) {
      alert('評価番号は必須です');
      return;
    }
    try {
      const token = await user.getIdToken();
      const method = editingCheck ? 'PUT' : 'POST';
      const body = editingCheck 
        ? { id: editingCheck.id, ...formData }
        : formData;
      
      const response = await fetch('/api/pdca/check', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setShowModal(false);
        setEditingCheck(null);
        setFormData({
          checkNumber: '',
          planId: '',
          planTitle: '',
          activityId: '',
          activityTitle: '',
          targetValue: 0,
          actualValue: 0,
          kpi: '',
          evaluation: '',
          issues: [],
          status: 'draft',
          evaluatedBy: '',
          evaluationDate: ''
        });
        setIssueInput('');
        loadChecks();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '評価の保存に失敗しました');
      }
    } catch (error) {
      console.error('評価の保存エラー:', error);
      alert('評価の保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('この評価を削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/pdca/check?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadChecks();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '評価の削除に失敗しました');
      }
    } catch (error) {
      console.error('評価の削除エラー:', error);
      alert('評価の削除に失敗しました');
    }
  };

  const addIssue = () => {
    if (issueInput.trim()) {
      setFormData({ ...formData, issues: [...formData.issues, issueInput.trim()] });
      setIssueInput('');
    }
  };

  const removeIssue = (index: number) => {
    setFormData({ ...formData, issues: formData.issues.filter((_, i) => i !== index) });
  };

  const calculateAchievementRate = (target: number, actual: number) => {
    if (target === 0) return 0;
    return Math.round((actual / target) * 100);
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">評価管理</h1>
            <button
              onClick={() => {
                setEditingCheck(null);
                setFormData({
                  checkNumber: '',
                  planId: '',
                  planTitle: '',
                  activityId: '',
                  activityTitle: '',
                  targetValue: 0,
                  actualValue: 0,
                  kpi: '',
                  evaluation: '',
                  issues: [],
                  status: 'draft',
                  evaluatedBy: '',
                  evaluationDate: ''
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              評価を追加
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">評価番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">計画</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">活動</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目標値</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">実績値</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">達成率</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {checks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        評価がありません
                      </td>
                    </tr>
                  ) : (
                    checks.map((check) => {
                      const achievementRate = calculateAchievementRate(check.targetValue, check.actualValue);
                      return (
                        <tr key={check.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{check.checkNumber}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{check.planTitle}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{check.activityTitle}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{check.targetValue}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{check.actualValue}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${
                              achievementRate >= 100 ? 'text-green-600' :
                              achievementRate >= 80 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {achievementRate}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              check.status === 'approved' ? 'bg-green-100 text-green-800' :
                              check.status === 'reviewed' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {check.status === 'draft' ? '下書き' :
                               check.status === 'reviewed' ? 'レビュー済み' :
                               '承認済み'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => {
                                setEditingCheck(check);
                                setFormData({
                                  checkNumber: check.checkNumber,
                                  planId: check.planId,
                                  planTitle: check.planTitle,
                                  activityId: check.activityId,
                                  activityTitle: check.activityTitle,
                                  targetValue: check.targetValue,
                                  actualValue: check.actualValue,
                                  kpi: check.kpi,
                                  evaluation: check.evaluation,
                                  issues: check.issues,
                                  status: check.status,
                                  evaluatedBy: check.evaluatedBy,
                                  evaluationDate: check.evaluationDate
                                });
                                setShowModal(true);
                              }}
                              className="text-[#005eb2] hover:text-[#004a96] mr-4"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDelete(check.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {editingCheck ? '評価を編集' : '評価を追加'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">評価番号</label>
                    <input
                      type="text"
                      value={formData.checkNumber}
                      onChange={(e) => setFormData({ ...formData, checkNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">活動ID</label>
                      <input
                        type="text"
                        value={formData.activityId}
                        onChange={(e) => setFormData({ ...formData, activityId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">活動タイトル</label>
                      <input
                        type="text"
                        value={formData.activityTitle}
                        onChange={(e) => setFormData({ ...formData, activityTitle: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">目標値</label>
                      <input
                        type="number"
                        value={formData.targetValue}
                        onChange={(e) => setFormData({ ...formData, targetValue: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">実績値</label>
                      <input
                        type="number"
                        value={formData.actualValue}
                        onChange={(e) => setFormData({ ...formData, actualValue: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-gray-700">
                      達成率: {calculateAchievementRate(formData.targetValue, formData.actualValue)}%
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">KPI</label>
                    <input
                      type="text"
                      value={formData.kpi}
                      onChange={(e) => setFormData({ ...formData, kpi: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">評価</label>
                    <textarea
                      value={formData.evaluation}
                      onChange={(e) => setFormData({ ...formData, evaluation: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">課題</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={issueInput}
                        onChange={(e) => setIssueInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addIssue();
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="課題を入力してEnter"
                      />
                      <button
                        type="button"
                        onClick={addIssue}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        追加
                      </button>
                    </div>
                    <div className="space-y-1">
                      {formData.issues.map((issue, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span className="text-sm text-gray-700">{issue}</span>
                          <button
                            type="button"
                            onClick={() => removeIssue(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">評価者</label>
                      <input
                        type="text"
                        value={formData.evaluatedBy}
                        onChange={(e) => setFormData({ ...formData, evaluatedBy: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">評価日</label>
                      <input
                        type="date"
                        value={formData.evaluationDate}
                        onChange={(e) => setFormData({ ...formData, evaluationDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Check['status'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="draft">下書き</option>
                      <option value="reviewed">レビュー済み</option>
                      <option value="approved">承認済み</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingCheck(null);
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


