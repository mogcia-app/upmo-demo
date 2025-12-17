'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Report {
  id: string;
  reportNumber: string;
  title: string;
  type: 'sales' | 'financial' | 'inventory' | 'pdca' | 'other';
  period: string;
  status: 'draft' | 'generating' | 'completed' | 'error';
  generatedAt?: string;
  fileUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'generatedAt' | 'fileUrl'>>({
    reportNumber: '',
    title: '',
    type: 'sales',
    period: '',
    status: 'draft'
  });

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user]);

  const loadReports = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      // TODO: API実装後に接続
    } catch (error) {
      console.error('レポートの読み込みエラー:', error);
    }
  };

  const handleGenerate = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      // TODO: API実装後に接続
      setShowModal(false);
      setFormData({
        reportNumber: '',
        title: '',
        type: 'sales',
        period: '',
        status: 'draft'
      });
      loadReports();
    } catch (error) {
      console.error('レポート生成エラー:', error);
      alert('レポートの生成に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('このレポートを削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      // TODO: API実装後に接続
      loadReports();
    } catch (error) {
      console.error('レポートの削除エラー:', error);
      alert('レポートの削除に失敗しました');
    }
  };

  const reportTypes = [
    { value: 'sales', label: '営業レポート' },
    { value: 'financial', label: '財務レポート' },
    { value: 'inventory', label: '在庫レポート' },
    { value: 'pdca', label: 'PDCAレポート' },
    { value: 'other', label: 'その他' }
  ];

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">レポート</h1>
            <button
              onClick={() => {
                setFormData({
                  reportNumber: '',
                  title: '',
                  type: 'sales',
                  period: '',
                  status: 'draft'
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              レポートを生成
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">レポート番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイトル</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">種類</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">期間</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">生成日時</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        レポートがありません
                      </td>
                    </tr>
                  ) : (
                    reports.map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{report.reportNumber}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{report.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {reportTypes.find(t => t.value === report.type)?.label || report.type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.period}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            report.status === 'completed' ? 'bg-green-100 text-green-800' :
                            report.status === 'generating' ? 'bg-blue-100 text-blue-800' :
                            report.status === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {report.status === 'draft' ? '下書き' :
                             report.status === 'generating' ? '生成中' :
                             report.status === 'completed' ? '完了' :
                             'エラー'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.generatedAt || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {report.fileUrl && (
                            <a
                              href={report.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#005eb2] hover:text-[#004a96] mr-4"
                            >
                              ダウンロード
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(report.id)}
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
                <h2 className="text-xl font-bold text-gray-900 mb-4">レポートを生成</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">レポート番号</label>
                    <input
                      type="text"
                      value={formData.reportNumber}
                      onChange={(e) => setFormData({ ...formData, reportNumber: e.target.value })}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">種類</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as Report['type'] })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {reportTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">期間</label>
                      <input
                        type="text"
                        value={formData.period}
                        onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="例: 2025年1月"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
                  >
                    生成
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


