"use client";

import React, { useState } from "react";
import Layout from "../../components/Layout";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../contexts/AuthContext";

interface Extension {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  status: 'available' | 'coming-soon' | 'beta';
  features: string[];
  industry: string[];
  pricing: 'free' | 'premium' | 'enterprise';
  documentation?: string;
  setupRequired?: boolean;
}

export default function ExtensionsPage() {
  const { userRole } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 拡張機能データ
  const extensions: Extension[] = [
    // AI・分析機能
    {
      id: 'ai-chat',
      name: 'AIチャット',
      description: '自然言語での質問応答システム',
      icon: '🤖',
      category: 'ai',
      status: 'available',
      features: ['自然言語処理', '業種別最適化', 'リアルタイム回答'],
      industry: ['all'],
      pricing: 'free',
      documentation: '/docs/ai-chat'
    },
    {
      id: 'sales-prediction',
      name: '売上予測',
      description: '機械学習による売上予測分析',
      icon: '📈',
      category: 'ai',
      status: 'beta',
      features: ['時系列分析', '季節変動考慮', '信頼区間表示'],
      industry: ['retail', 'services'],
      pricing: 'premium',
      setupRequired: true
    },
    {
      id: 'customer-analytics',
      name: '顧客分析',
      description: 'RFM分析と顧客セグメンテーション',
      icon: '👥',
      category: 'ai',
      status: 'coming-soon',
      features: ['RFM分析', 'セグメンテーション', '行動予測'],
      industry: ['retail', 'services'],
      pricing: 'premium'
    },

    // システム連携
    {
      id: 'sap-integration',
      name: 'SAP連携',
      description: 'SAP ERPシステムとのデータ同期',
      icon: '🏭',
      category: 'integration',
      status: 'available',
      features: ['生産計画同期', '在庫管理', '品質データ'],
      industry: ['manufacturing'],
      pricing: 'enterprise',
      setupRequired: true
    },
    {
      id: 'pos-integration',
      name: 'POS連携',
      description: 'POSシステムとの売上データ同期',
      icon: '🛒',
      category: 'integration',
      status: 'available',
      features: ['売上データ', '在庫管理', '顧客情報'],
      industry: ['retail'],
      pricing: 'premium',
      setupRequired: true
    },
    {
      id: 'crm-integration',
      name: 'CRM連携',
      description: 'Salesforce、HubSpotとの連携',
      icon: '📊',
      category: 'integration',
      status: 'beta',
      features: ['顧客データ同期', '商談管理', '活動記録'],
      industry: ['all'],
      pricing: 'premium',
      setupRequired: true
    },
    {
      id: 'accounting-integration',
      name: '会計システム連携',
      description: 'QuickBooks、弥生会計との連携',
      icon: '💰',
      category: 'integration',
      status: 'coming-soon',
      features: ['売上データ', '請求管理', '財務レポート'],
      industry: ['all'],
      pricing: 'premium',
      setupRequired: true
    },

    // ワークフロー・自動化
    {
      id: 'approval-workflow',
      name: '承認ワークフロー',
      description: '文書・請求の承認プロセス自動化',
      icon: '✅',
      category: 'workflow',
      status: 'coming-soon',
      features: ['多段階承認', '通知機能', '承認履歴'],
      industry: ['all'],
      pricing: 'premium'
    },
    {
      id: 'task-automation',
      name: 'タスク自動化',
      description: '繰り返しタスクの自動実行',
      icon: '⚙️',
      category: 'workflow',
      status: 'beta',
      features: ['スケジュール実行', '条件分岐', 'エラーハンドリング'],
      industry: ['all'],
      pricing: 'premium'
    },
    {
      id: 'notification-system',
      name: '通知システム',
      description: 'メール・Slack・Teams通知',
      icon: '🔔',
      category: 'workflow',
      status: 'available',
      features: ['メール通知', 'Slack連携', 'Teams連携'],
      industry: ['all'],
      pricing: 'free'
    },

    // データ可視化
    {
      id: 'advanced-charts',
      name: '高度なチャート',
      description: 'インタラクティブなデータ可視化',
      icon: '📊',
      category: 'visualization',
      status: 'available',
      features: ['3Dチャート', 'ドリルダウン', 'リアルタイム更新'],
      industry: ['all'],
      pricing: 'free'
    },
    {
      id: 'dashboard-builder',
      name: 'ダッシュボードビルダー',
      description: 'ドラッグ&ドロップでダッシュボード作成',
      icon: '🎨',
      category: 'visualization',
      status: 'coming-soon',
      features: ['ドラッグ&ドロップ', 'ウィジェット', 'レスポンシブ'],
      industry: ['all'],
      pricing: 'premium'
    },
    {
      id: 'report-generator',
      name: 'レポート生成',
      description: '自動レポート生成と配信',
      icon: '📄',
      category: 'visualization',
      status: 'beta',
      features: ['テンプレート', '自動配信', 'PDF出力'],
      industry: ['all'],
      pricing: 'premium'
    },

    // セキュリティ・コンプライアンス
    {
      id: 'audit-log',
      name: '監査ログ',
      description: '全操作の詳細ログ記録',
      icon: '🔍',
      category: 'security',
      status: 'available',
      features: ['操作ログ', 'アクセス履歴', 'エクスポート'],
      industry: ['all'],
      pricing: 'free'
    },
    {
      id: 'data-encryption',
      name: 'データ暗号化',
      description: '保存データの完全暗号化',
      icon: '🔐',
      category: 'security',
      status: 'available',
      features: ['AES-256', '転送暗号化', 'キー管理'],
      industry: ['all'],
      pricing: 'premium'
    },
    {
      id: 'compliance-tools',
      name: 'コンプライアンスツール',
      description: 'GDPR、HIPAA対応ツール',
      icon: '⚖️',
      category: 'security',
      status: 'coming-soon',
      features: ['GDPR対応', 'HIPAA対応', 'データ削除'],
      industry: ['healthcare', 'services'],
      pricing: 'enterprise'
    },

    // モバイル・アクセス
    {
      id: 'mobile-app',
      name: 'モバイルアプリ',
      description: 'iOS・Android ネイティブアプリ',
      icon: '📱',
      category: 'mobile',
      status: 'coming-soon',
      features: ['オフライン対応', 'プッシュ通知', '生体認証'],
      industry: ['all'],
      pricing: 'premium'
    },
    {
      id: 'api-access',
      name: 'API アクセス',
      description: 'RESTful API による外部連携',
      icon: '🔌',
      category: 'mobile',
      status: 'available',
      features: ['REST API', 'Webhook', 'SDK'],
      industry: ['all'],
      pricing: 'premium'
    }
  ];

  // カテゴリ一覧
  const categories = [
    { id: 'all', name: 'すべて', icon: '📦' },
    { id: 'ai', name: 'AI・分析', icon: '🤖' },
    { id: 'integration', name: 'システム連携', icon: '🔌' },
    { id: 'workflow', name: 'ワークフロー', icon: '⚙️' },
    { id: 'visualization', name: 'データ可視化', icon: '📊' },
    { id: 'security', name: 'セキュリティ', icon: '🔐' },
    { id: 'mobile', name: 'モバイル・API', icon: '📱' }
  ];

  // 業種一覧
  const industries = [
    { id: 'all', name: 'すべて' },
    { id: 'manufacturing', name: '製造業' },
    { id: 'retail', name: '小売業' },
    { id: 'services', name: 'サービス業' },
    { id: 'construction', name: '建設業' },
    { id: 'healthcare', name: '医療業' }
  ];

  // フィルタリング
  const filteredExtensions = extensions.filter(extension => {
    const matchesCategory = selectedCategory === 'all' || extension.category === selectedCategory;
    const matchesIndustry = selectedIndustry === 'all' || extension.industry.includes(selectedIndustry) || extension.industry.includes('all');
    const matchesSearch = extension.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          extension.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesIndustry && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'beta': return 'bg-yellow-100 text-yellow-800';
      case 'coming-soon': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '利用可能';
      case 'beta': return 'ベータ版';
      case 'coming-soon': return '近日公開';
      default: return status;
    }
  };

  const getPricingColor = (pricing: string) => {
    switch (pricing) {
      case 'free': return 'bg-green-100 text-green-800';
      case 'premium': return 'bg-blue-100 text-blue-800';
      case 'enterprise': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPricingText = (pricing: string) => {
    switch (pricing) {
      case 'free': return '無料';
      case 'premium': return 'プレミアム';
      case 'enterprise': return 'エンタープライズ';
      default: return pricing;
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* ヘッダー */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">拡張機能</h1>
                <p className="text-gray-600">Upmoの機能を拡張して、より強力なビジネスプラットフォームに</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">利用可能</div>
                <div className="text-2xl font-bold text-green-600">
                  {extensions.filter(e => e.status === 'available').length}
                </div>
              </div>
            </div>
          </div>

          {/* フィルター */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">検索</label>
                <input
                  type="text"
                  placeholder="機能名で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリ</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">業種</label>
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
                >
                  {industries.map(industry => (
                    <option key={industry.id} value={industry.id}>
                      {industry.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                    setSelectedIndustry('all');
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  リセット
                </button>
              </div>
            </div>
          </div>

          {/* 拡張機能一覧 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExtensions.map((extension) => (
              <div key={extension.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-3xl">{extension.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{extension.name}</h3>
                      <p className="text-sm text-gray-600">{extension.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(extension.status)}`}>
                      {getStatusText(extension.status)}
                    </span>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPricingColor(extension.pricing)}`}>
                      {getPricingText(extension.pricing)}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">主な機能</h4>
                  <div className="flex flex-wrap gap-2">
                    {extension.features.map((feature) => (
                      <span key={feature} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">対応業種</h4>
                  <div className="flex flex-wrap gap-2">
                    {extension.industry.map((ind) => {
                      const industryName = industries.find(i => i.id === ind)?.name || ind;
                      return (
                        <span key={ind} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {industryName}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex space-x-2">
                    {extension.status === 'available' && (
                      <button className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors text-sm">
                        有効化
                      </button>
                    )}
                    {extension.status === 'beta' && (
                      <button className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm">
                        ベータ版を試す
                      </button>
                    )}
                    {extension.status === 'coming-soon' && (
                      <button disabled className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed text-sm">
                        近日公開
                      </button>
                    )}
                  </div>
                  
                  {extension.documentation && (
                    <a
                      href={extension.documentation}
                      className="text-sm text-[#005eb2] hover:text-[#004a96] transition-colors"
                    >
                      詳細 →
                    </a>
                  )}
                </div>

                {extension.setupRequired && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-xs text-yellow-800">
                      ⚠️ 設定が必要です
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 空状態 */}
          {filteredExtensions.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">該当する拡張機能がありません</h3>
              <p className="mt-1 text-sm text-gray-500">検索条件を変更してお試しください</p>
            </div>
          )}

          {/* 管理者向け情報 */}
          {userRole?.role === 'admin' && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">管理者向け機能</h3>
                  <p className="text-gray-600">
                    新しい拡張機能の追加や、既存機能の設定を行えます
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors">
                    拡張機能を追加
                  </button>
                  <button className="px-4 py-2 border border-[#005eb2] text-[#005eb2] rounded-lg hover:bg-[#005eb2] hover:text-white transition-colors">
                    設定管理
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
