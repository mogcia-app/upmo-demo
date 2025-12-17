'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user, selectedPeriod]);

  const loadAnalytics = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      // TODO: API実装後に接続
      // サンプルデータ
      setAnalyticsData({
        sales: {
          total: 0,
          growth: 0,
          topCustomers: []
        },
        revenue: {
          total: 0,
          growth: 0
        },
        expenses: {
          total: 0,
          growth: 0
        },
        inventory: {
          totalItems: 0,
          lowStock: 0
        }
      });
    } catch (error) {
      console.error('分析データの読み込みエラー:', error);
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">分析ダッシュボード</h1>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="week">週</option>
              <option value="month">月</option>
              <option value="quarter">四半期</option>
              <option value="year">年</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">売上</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    ¥{analyticsData?.sales?.total?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    {analyticsData?.sales?.growth >= 0 ? '+' : ''}{analyticsData?.sales?.growth || 0}%
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">収益</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    ¥{analyticsData?.revenue?.total?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    {analyticsData?.revenue?.growth >= 0 ? '+' : ''}{analyticsData?.revenue?.growth || 0}%
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">経費</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    ¥{analyticsData?.expenses?.total?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    {analyticsData?.expenses?.growth >= 0 ? '+' : ''}{analyticsData?.expenses?.growth || 0}%
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-xl">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">在庫アイテム</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {analyticsData?.inventory?.totalItems || 0}
                  </p>
                  <p className="text-sm text-red-600 mt-2">
                    在庫不足: {analyticsData?.inventory?.lowStock || 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">売上推移</h2>
              <div className="h-64 flex items-center justify-center text-gray-400">
                グラフ表示エリア（実装予定）
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">カテゴリ別売上</h2>
              <div className="h-64 flex items-center justify-center text-gray-400">
                グラフ表示エリア（実装予定）
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}


