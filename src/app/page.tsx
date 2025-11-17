"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../contexts/AuthContext";

interface IndustryConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  features: string[];
  templates: {
    name: string;
    description: string;
    icon: string;
    href: string;
  }[];
}

interface CompanySetup {
  companyName: string;
  industry: string;
  industries: string[]; // 複数選択対応
  selectedFeatures: string[];
  teamSize: string;
  isSetupComplete: boolean;
}

export default function Home() {
  const { user } = useAuth();
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [setupData, setSetupData] = useState<CompanySetup>({
    companyName: "",
    industry: "",
    industries: [], // 複数選択対応
    selectedFeatures: [],
    teamSize: "",
    isSetupComplete: false
  });
  const [currentStep, setCurrentStep] = useState(1);

  // 業種別設定
  const industryConfigs: IndustryConfig[] = [
    {
      id: "manufacturing",
      name: "製造業",
      icon: "🏭",
      description: "生産管理、品質管理、在庫管理に特化",
      color: "bg-blue-500",
      features: ["生産管理", "品質管理", "在庫管理", "設備管理", "安全管理"],
      templates: [
        { name: "生産計画", description: "生産スケジュール管理", icon: "📅", href: "/custom/production-planning" },
        { name: "品質管理", description: "検査記録・不良品管理", icon: "🔍", href: "/custom/quality-control" },
        { name: "在庫管理", description: "原材料・完成品管理", icon: "📦", href: "/custom/inventory-management" }
      ]
    },
    {
      id: "retail",
      name: "小売業",
      icon: "🛍️",
      description: "販売管理、顧客分析、在庫最適化に特化",
      color: "bg-green-500",
      features: ["販売管理", "顧客分析", "在庫管理", "商品管理", "プロモーション"],
      templates: [
        { name: "売上分析", description: "日次・月次売上分析", icon: "📊", href: "/custom/sales-analysis" },
        { name: "顧客管理", description: "顧客情報・購買履歴", icon: "👥", href: "/customers" },
        { name: "商品管理", description: "商品カタログ・価格管理", icon: "🛒", href: "/custom/product-management" }
      ]
    },
    {
      id: "services",
      name: "サービス業",
      icon: "💼",
      description: "予約管理、スタッフ管理、顧客満足度に特化",
      color: "bg-purple-500",
      features: ["予約管理", "スタッフ管理", "顧客管理", "サービス提供", "収益分析"],
      templates: [
        { name: "予約管理", description: "予約・スケジュール管理", icon: "📅", href: "/custom/appointment-management" },
        { name: "スタッフ管理", description: "シフト・スキル管理", icon: "👨‍💼", href: "/custom/staff-management" },
        { name: "顧客満足度", description: "フィードバック・評価管理", icon: "⭐", href: "/custom/customer-satisfaction" }
      ]
    },
    {
      id: "construction",
      name: "建設業",
      icon: "🏗️",
      description: "プロジェクト管理、資材管理、安全管理に特化",
      color: "bg-orange-500",
      features: ["プロジェクト管理", "資材管理", "安全管理", "品質管理", "工程管理"],
      templates: [
        { name: "プロジェクト管理", description: "工程・予算・品質管理", icon: "📋", href: "/custom/project-management" },
        { name: "資材管理", description: "調達・在庫・使用記録", icon: "🔧", href: "/custom/material-management" },
        { name: "安全管理", description: "事故記録・安全教育", icon: "🛡️", href: "/custom/safety-management" }
      ]
    },
    {
      id: "healthcare",
      name: "医療業",
      icon: "🏥",
      description: "患者管理、診療記録、医療機器管理に特化",
      color: "bg-red-500",
      features: ["患者管理", "診療記録", "予約管理", "医療機器管理", "薬剤管理"],
      templates: [
        { name: "患者管理", description: "カルテ・診療記録管理", icon: "👤", href: "/custom/patient-management" },
        { name: "診療予約", description: "予約・スケジュール管理", icon: "📅", href: "/custom/medical-appointments" },
        { name: "医療機器", description: "機器稼働・メンテナンス", icon: "🔬", href: "/custom/medical-equipment" }
      ]
    },
    {
      id: "other",
      name: "その他",
      icon: "🏢",
      description: "汎用的なビジネス管理機能",
      color: "bg-gray-500",
      features: ["プロジェクト管理", "顧客管理", "タスク管理", "文書管理", "チーム管理"],
      templates: [
        { name: "プロジェクト管理", description: "タスク・進捗管理", icon: "📋", href: "/todo" },
        { name: "顧客管理", description: "顧客情報・関係管理", icon: "👥", href: "/customers" },
        { name: "文書管理", description: "契約書・資料管理", icon: "📄", href: "/admin/contracts" }
      ]
    }
  ];

  useEffect(() => {
    // ユーザーの設定状況をチェック
    const checkSetupStatus = async () => {
      if (user) {
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.companySetup) {
              setSetupData(userData.companySetup);
              setIsSetupMode(!userData.companySetup.isSetupComplete);
            } else {
              setIsSetupMode(true);
            }
          } else {
            setIsSetupMode(true);
          }
        } catch (error) {
          console.error('設定状況の確認エラー:', error);
          setIsSetupMode(true);
        }
      }
    };

    checkSetupStatus();
  }, [user]);

  const handleSetupComplete = async () => {
    if (!user || !setupData.companyName || setupData.industries.length === 0) return;

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      const updatedSetupData = {
        ...setupData,
        isSetupComplete: true,
        completedAt: new Date()
      };

      await setDoc(doc(db, 'users', user.uid), {
        companySetup: updatedSetupData,
        companyName: setupData.companyName
      }, { merge: true });

      setSetupData(updatedSetupData);
      setIsSetupMode(false);
      
      // 自動カスタマイズを実行
      await applyAutoCustomization(updatedSetupData);
      
    } catch (error) {
      console.error('設定保存エラー:', error);
    }
  };

  // テンプレートごとのデフォルトコンポーネント
  const getDefaultComponents = (templateName: string, baseTimestamp: number = Date.now()) => {
    const componentMap: Record<string, any[]> = {
      "生産計画": [
        {
          id: `component_${baseTimestamp}_1`,
          type: 'data_table',
          title: '生産スケジュール',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 400 },
          config: {
            columns: [
              { id: 'col1', name: '製品名', type: 'text' },
              { id: 'col2', name: '生産数量', type: 'number' },
              { id: 'col3', name: '納期', type: 'date' },
              { id: 'col4', name: '状況', type: 'select' }
            ],
            data: []
          }
        }
      ],
      "品質管理": [
        {
          id: `component_${baseTimestamp}_2`,
          type: 'data_table',
          title: '検査記録',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 400 },
          config: {
            columns: [
              { id: 'col1', name: '検査項目', type: 'text' },
              { id: 'col2', name: '検査結果', type: 'select' },
              { id: 'col3', name: '検査日', type: 'date' },
              { id: 'col4', name: '担当者', type: 'text' }
            ],
            data: []
          }
        }
      ],
      "在庫管理": [
        {
          id: `component_${baseTimestamp}_3`,
          type: 'data_table',
          title: '在庫一覧',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 400 },
          config: {
            columns: [
              { id: 'col1', name: '品目名', type: 'text' },
              { id: 'col2', name: '在庫数量', type: 'number' },
              { id: 'col3', name: '最低在庫数', type: 'number' },
              { id: 'col4', name: '状態', type: 'select' }
            ],
            data: []
          }
        }
      ],
      "売上分析": [
        {
          id: `component_${baseTimestamp}_4`,
          type: 'data_table',
          title: '売上データ',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 400 },
          config: {
            columns: [
              { id: 'col1', name: '日付', type: 'date' },
              { id: 'col2', name: '売上額', type: 'number' },
              { id: 'col3', name: '商品名', type: 'text' },
              { id: 'col4', name: '数量', type: 'number' }
            ],
            data: []
          }
        }
      ],
      "顧客管理": [
        {
          id: `component_${baseTimestamp}_5`,
          type: 'data_table',
          title: '顧客一覧',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 400 },
          config: {
            columns: [
              { id: 'col1', name: '顧客名', type: 'text' },
              { id: 'col2', name: 'メール', type: 'text' },
              { id: 'col3', name: '登録日', type: 'date' },
              { id: 'col4', name: 'ステータス', type: 'select' }
            ],
            data: []
          }
        }
      ],
      "商品管理": [
        {
          id: `component_${baseTimestamp}_6`,
          type: 'data_table',
          title: '商品カタログ',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 400 },
          config: {
            columns: [
              { id: 'col1', name: '商品名', type: 'text' },
              { id: 'col2', name: '価格', type: 'number' },
              { id: 'col3', name: 'カテゴリ', type: 'text' },
              { id: 'col4', name: '在庫', type: 'number' }
            ],
            data: []
          }
        }
      ],
      "予約管理": [
        {
          id: `component_${baseTimestamp}_7`,
          type: 'calendar',
          title: '予約カレンダー',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 500 },
          config: {
            events: [],
            view: 'month',
            showWeekends: true
          }
        }
      ],
      "スタッフ管理": [
        {
          id: `component_${baseTimestamp}_8`,
          type: 'data_table',
          title: 'スタッフ一覧',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 400 },
          config: {
            columns: [
              { id: 'col1', name: '氏名', type: 'text' },
              { id: 'col2', name: '役職', type: 'text' },
              { id: 'col3', name: 'スキル', type: 'text' },
              { id: 'col4', name: '状況', type: 'select' }
            ],
            data: []
          }
        }
      ],
      "顧客満足度": [
        {
          id: `component_${baseTimestamp}_9`,
          type: 'data_table',
          title: 'フィードバック',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 400 },
          config: {
            columns: [
              { id: 'col1', name: '評価', type: 'number' },
              { id: 'col2', name: 'コメント', type: 'text' },
              { id: 'col3', name: '日付', type: 'date' },
              { id: 'col4', name: '担当者', type: 'text' }
            ],
            data: []
          }
        }
      ],
      "プロジェクト管理": [
        {
          id: `component_${baseTimestamp}_10`,
          type: 'data_table',
          title: 'プロジェクト一覧',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 400 },
          config: {
            columns: [
              { id: 'col1', name: 'プロジェクト名', type: 'text' },
              { id: 'col2', name: '進捗率', type: 'number' },
              { id: 'col3', name: '期限', type: 'date' },
              { id: 'col4', name: 'ステータス', type: 'select' }
            ],
            data: []
          }
        }
      ],
      "資材管理": [
        {
          id: `component_${baseTimestamp}_11`,
          type: 'data_table',
          title: '資材一覧',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 400 },
          config: {
            columns: [
              { id: 'col1', name: '資材名', type: 'text' },
              { id: 'col2', name: '数量', type: 'number' },
              { id: 'col3', name: '単価', type: 'number' },
              { id: 'col4', name: '仕入先', type: 'text' }
            ],
            data: []
          }
        }
      ],
      "安全管理": [
        {
          id: `component_${baseTimestamp}_12`,
          type: 'data_table',
          title: '安全記録',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 400 },
          config: {
            columns: [
              { id: 'col1', name: '日付', type: 'date' },
              { id: 'col2', name: '内容', type: 'text' },
              { id: 'col3', name: '担当者', type: 'text' },
              { id: 'col4', name: '状態', type: 'select' }
            ],
            data: []
          }
        }
      ],
      "患者管理": [
        {
          id: `component_${baseTimestamp}_13`,
          type: 'data_table',
          title: '患者リスト',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 400 },
          config: {
            columns: [
              { id: 'col1', name: '患者ID', type: 'text' },
              { id: 'col2', name: '氏名', type: 'text' },
              { id: 'col3', name: '生年月日', type: 'date' },
              { id: 'col4', name: '状態', type: 'select' }
            ],
            data: []
          }
        }
      ],
      "診療予約": [
        {
          id: `component_${baseTimestamp}_14`,
          type: 'calendar',
          title: '診療予約カレンダー',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 500 },
          config: {
            events: [],
            view: 'week',
            showWeekends: false
          }
        }
      ],
      "医療機器": [
        {
          id: `component_${baseTimestamp}_15`,
          type: 'data_table',
          title: '医療機器一覧',
          position: { x: 0, y: 0 },
          size: { width: 800, height: 400 },
          config: {
            columns: [
              { id: 'col1', name: '機器名', type: 'text' },
              { id: 'col2', name: '状態', type: 'select' },
              { id: 'col3', name: '最終メンテナンス', type: 'date' },
              { id: 'col4', name: '次回メンテ', type: 'date' }
            ],
            data: []
          }
        }
      ]
    };

    return componentMap[templateName] || [];
  };

  const applyAutoCustomization = async (setup: CompanySetup) => {
    if (setup.industries.length === 0) return;

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      // 複数業種のテンプレートをマージ
      const allTemplates: Array<{name: string; description: string; icon: string; href: string}> = [];
      const mainIndustry = industryConfigs.find(ind => ind.id === setup.industry);
      
      setup.industries.forEach(industryId => {
        const industry = industryConfigs.find(ind => ind.id === industryId);
        if (industry) {
          allTemplates.push(...industry.templates);
        }
      });
      
      // 重複を除去
      const uniqueTemplates = allTemplates.filter((template, index, self) => 
        index === self.findIndex(t => t.name === template.name)
      );
      
      const baseTimestamp = Date.now();
      const customTabs = uniqueTemplates.map((template, index) => {
        const components = getDefaultComponents(template.name, baseTimestamp + index);
        return {
          id: `template_${template.name}_${baseTimestamp + index}`,
          title: template.name,
          description: template.description,
          icon: template.icon,
          route: template.href,
          components: components,
          createdAt: new Date(),
          isTemplate: true
        };
      });

      await setDoc(doc(db, 'users', user!.uid), {
        customTabs: customTabs,
        industryTheme: mainIndustry ? {
          industry: mainIndustry.name,
          color: mainIndustry.color,
          icon: mainIndustry.icon,
          industries: setup.industries.map(id => industryConfigs.find(ind => ind.id === id)?.name || id)
        } : {}
      }, { merge: true });

      // ローカルストレージにも保存
      localStorage.setItem('customTabs', JSON.stringify(customTabs));
      localStorage.setItem('industryTheme', JSON.stringify({
        industry: mainIndustry?.name,
        color: mainIndustry?.color,
        icon: mainIndustry?.icon,
        industries: setup.industries.map(id => industryConfigs.find(ind => ind.id === id)?.name || id)
      }));

    } catch (error) {
      console.error('自動カスタマイズエラー:', error);
    }
  };

  const handleFeatureToggle = (feature: string) => {
    setSetupData(prev => ({
      ...prev,
      selectedFeatures: prev.selectedFeatures.includes(feature)
        ? prev.selectedFeatures.filter(f => f !== feature)
        : [...prev.selectedFeatures, feature]
    }));
  };

  if (isSetupMode) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="px-4 py-8">
              <div>
                {/* ヘッダー */}
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    🎉 Upmoへようこそ！
                  </h1>
                  <p className="text-xl text-gray-600">
                    あなたのビジネスに最適な設定を行いましょう
                  </p>
                </div>

                {/* ステップインジケーター */}
                <div className="flex justify-center mb-8">
                  <div className="flex items-center space-x-4">
                    {[1, 2, 3].map((step) => (
                      <div key={step} className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          currentStep >= step 
                            ? 'bg-[#005eb2] text-white' 
                            : 'bg-gray-300 text-gray-600'
                        }`}>
                          {step}
                        </div>
                        {step < 3 && (
                          <div className={`w-16 h-1 mx-2 ${
                            currentStep > step ? 'bg-[#005eb2]' : 'bg-gray-300'
                          }`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ステップ1: 会社情報 */}
                {currentStep === 1 && (
                  <div className="bg-white rounded-lg shadow-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">会社情報を入力</h2>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          会社名
                        </label>
                        <input
                          type="text"
                          value={setupData.companyName}
                          onChange={(e) => setSetupData(prev => ({ ...prev, companyName: e.target.value }))}
                          placeholder="例: 株式会社サンプル"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] text-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          チーム規模
                        </label>
                        <select
                          value={setupData.teamSize}
                          onChange={(e) => setSetupData(prev => ({ ...prev, teamSize: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] text-lg"
                        >
                          <option value="">選択してください</option>
                          <option value="1-10">1-10人</option>
                          <option value="11-50">11-50人</option>
                          <option value="51-200">51-200人</option>
                          <option value="200+">200人以上</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end mt-8">
                      <button
                        onClick={() => setCurrentStep(2)}
                        disabled={!setupData.companyName || !setupData.teamSize}
                        className="px-8 py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] disabled:bg-gray-300 disabled:cursor-not-allowed text-lg font-medium"
                      >
                        次へ
                      </button>
                    </div>
                  </div>
                )}

                {/* ステップ2: 業種選択 */}
                {currentStep === 2 && (
                  <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 lg:p-8">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">業種を選択</h2>
                    <p className="text-sm text-gray-600 mb-4 sm:mb-6">
                      複数の業種を選択できます。該当する業種をすべて選択してください。
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {industryConfigs.map((industry) => (
                        <label
                          key={industry.id}
                          className={`p-4 sm:p-6 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg ${
                            (setupData.industries || []).includes(industry.id)
                              ? 'border-[#005eb2] bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <input
                              type="checkbox"
                              checked={(setupData.industries || []).includes(industry.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSetupData(prev => {
                                    const currentIndustries = prev.industries || [];
                                    return {
                                      ...prev, 
                                      industries: [...currentIndustries, industry.id],
                                      industry: currentIndustries.length === 0 ? industry.id : prev.industry // 最初の選択をメインに
                                    };
                                  });
                                } else {
                                  setSetupData(prev => {
                                    const currentIndustries = prev.industries || [];
                                    return {
                                      ...prev, 
                                      industries: currentIndustries.filter(id => id !== industry.id),
                                      industry: prev.industry === industry.id && currentIndustries.length > 1 
                                        ? currentIndustries.find(id => id !== industry.id) || '' 
                                        : prev.industry
                                    };
                                  });
                                }
                              }}
                              className="mt-1 w-5 h-5 text-[#005eb2] rounded focus:ring-[#005eb2]"
                            />
                            <div className="flex-1 text-center">
                              <div className="text-4xl mb-3">{industry.icon}</div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-2">{industry.name}</h3>
                              <p className="text-sm text-gray-600 mb-4">{industry.description}</p>
                              <div className="flex flex-wrap gap-2 justify-center">
                                {industry.features.slice(0, 3).map((feature) => (
                                  <span key={feature} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                    {feature}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="flex justify-between mt-8">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-lg font-medium"
                      >
                        戻る
                      </button>
                      <button
                        onClick={() => setCurrentStep(3)}
                        disabled={setupData.industries.length === 0}
                        className="px-8 py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] disabled:bg-gray-300 disabled:cursor-not-allowed text-lg font-medium"
                      >
                        次へ ({setupData.industries.length}件選択中)
                      </button>
                    </div>
                  </div>
                )}

                {/* ステップ3: 機能選択 */}
                {currentStep === 3 && (
                  <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 lg:p-8">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">必要な機能を選択</h2>
                    <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                      選択した業種に基づいて推奨機能を表示しています。追加で必要な機能があれば選択してください。
                    </p>
                    
                    {setupData.industries.length > 0 && (
                      <div className="space-y-6">
                        {/* 選択した業種の推奨機能をすべて表示 */}
                        {setupData.industries.map((industryId) => {
                          const industry = industryConfigs.find(ind => ind.id === industryId);
                          if (!industry) return null;
                          
                          return (
                            <div key={industryId}>
                              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                {industry.icon} {industry.name} 推奨機能
                              </h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                {industry.features.map((feature) => (
                                  <label key={feature} className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={setupData.selectedFeatures.includes(feature)}
                                      onChange={() => handleFeatureToggle(feature)}
                                      className="w-5 h-5 text-[#005eb2] rounded focus:ring-[#005eb2]"
                                    />
                                    <span className="ml-3 text-gray-900 font-medium">{feature}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}

                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">その他の機能</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {["AIチャット", "文書管理", "レポート作成", "通知機能", "データ分析", "API連携"].map((feature) => (
                              <label key={feature} className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={setupData.selectedFeatures.includes(feature)}
                                  onChange={() => handleFeatureToggle(feature)}
                                  className="w-5 h-5 text-[#005eb2] rounded focus:ring-[#005eb2]"
                                />
                                <span className="ml-3 text-gray-900 font-medium">{feature}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between mt-8">
                      <button
                        onClick={() => setCurrentStep(2)}
                        className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-lg font-medium"
                      >
                        戻る
                      </button>
                      <button
                        onClick={handleSetupComplete}
                        disabled={setupData.selectedFeatures.length === 0}
                        className="px-8 py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] disabled:bg-gray-300 disabled:cursor-not-allowed text-lg font-medium"
                      >
                        設定完了
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  // 通常のダッシュボード表示
  const selectedIndustries = (setupData.industries || []).map(id => industryConfigs.find(ind => ind.id === id)).filter(Boolean);
  const mainIndustry = industryConfigs.find(ind => ind.id === setupData.industry);
  
  // すべてのテンプレートをマージ
  const allTemplates: Array<{name: string; description: string; icon: string; href: string}> = selectedIndustries.flatMap(industry => industry?.templates || []);
  const uniqueTemplates = allTemplates.filter((template, index, self) => 
    index === self.findIndex(t => t.name === template.name)
  );
  
  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* ウェルカムセクション */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                  {mainIndustry ? `${mainIndustry.icon} ${setupData.companyName}` : 'ようこそ、Upmo Demoへ！'}
                </h1>
                <p className="text-sm sm:text-base text-gray-600">
                  {mainIndustry 
                    ? `${mainIndustry.name}${selectedIndustries.length > 1 ? ` ほか ${selectedIndustries.length - 1}業種` : ''}向けに最適化されたダッシュボードです` 
                    : 'Next.js + Firebase + Vercelで構築されたモダンなダッシュボードです。'}
                </p>
                {selectedIndustries.length > 1 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedIndustries.slice(0, 3).map(industry => (
                      <span key={industry?.id} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {industry?.icon} {industry?.name}
                      </span>
                    ))}
                    {selectedIndustries.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        +{selectedIndustries.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsSetupMode(true)}
                className="px-4 py-2 text-[#005eb2] border border-[#005eb2] rounded-lg hover:bg-[#005eb2] hover:text-white transition-colors text-sm sm:text-base"
              >
                設定を変更
              </button>
            </div>
          </div>

          {/* 業種別テンプレート */}
          {uniqueTemplates.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {selectedIndustries.length === 1 
                  ? `${mainIndustry?.name} 向けテンプレート`
                  : `${selectedIndustries.length}業種向けテンプレート`}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {uniqueTemplates.map((template) => (
                  <Link
                    key={template.name}
                    href={template.href}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{template.icon}</span>
                      <div>
                        <h3 className="font-medium text-gray-900">{template.name}</h3>
                        <p className="text-sm text-gray-600">{template.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 統計カード */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-[#005eb2] rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">チームメンバー</p>
                  <p className="text-2xl font-bold text-gray-900">12</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">契約書件数</p>
                  <p className="text-2xl font-bold text-gray-900">28</p>
                </div>
              </div>
            </div>
          </div>

          {/* 最近のアクティビティ */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">最近のアクティビティ</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-[#005eb2] rounded-full"></div>
                <p className="text-gray-600">新しい契約書「ABC株式会社とのサービス契約」が追加されました</p>
                <span className="text-sm text-gray-400 ml-auto">1時間前</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-gray-600">タスク「顧客データ整理」が完了されました</p>
                <span className="text-sm text-gray-400 ml-auto">3時間前</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <p className="text-gray-600">新しいチームメンバー「田中さん」が追加されました</p>
                <span className="text-sm text-gray-400 ml-auto">5時間前</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <p className="text-gray-600">AIが「契約書の更新期限」について通知しました</p>
                <span className="text-sm text-gray-400 ml-auto">1日前</span>
              </div>
            </div>
          </div>

          {/* チーム予定とAI通知 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* チーム予定 */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">今日のチーム予定</h2>
                <Link href="/todo" className="text-sm text-[#005eb2] hover:text-[#004a96]">
                  すべて表示
                </Link>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">チーム定例会議</p>
                    <p className="text-xs text-gray-600">10:00 - 11:00</p>
                  </div>
                  <span className="text-xs text-gray-500">田中さん</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">プロジェクト進捗報告</p>
                    <p className="text-xs text-gray-600">14:00 - 15:00</p>
                  </div>
                  <span className="text-xs text-gray-500">佐藤さん</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">契約書レビュー</p>
                    <p className="text-xs text-gray-600">16:00 - 17:00</p>
                  </div>
                  <span className="text-xs text-gray-500">山田さん</span>
                </div>
              </div>
            </div>

            {/* AI通知 */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">AIからの通知</h2>
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">3件</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">契約書の更新期限が近づいています</p>
                    <p className="text-xs text-gray-600 mt-1">「ABC株式会社との契約書」の更新期限まで3日です</p>
                    <span className="text-xs text-gray-500">1時間前</span>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">新しいチームメンバーの追加を提案</p>
                    <p className="text-xs text-gray-600 mt-1">プロジェクトの進捗を考慮すると、デザイナー1名の追加をお勧めします</p>
                    <span className="text-xs text-gray-500">3時間前</span>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">データ分析レポートが完成しました</p>
                    <p className="text-xs text-gray-600 mt-1">先月の売上分析レポートが自動生成されました</p>
                    <span className="text-xs text-gray-500">6時間前</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 自由タブ作成案内 */}
          {/* <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">追加の機能が必要ですか？</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  自由タブから独自のページを作成して、さらにカスタマイズできます
                </p>
              </div>
              <Link
                href="/custom/new-page"
                className="px-4 sm:px-6 py-2 sm:py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors font-medium text-sm sm:text-base text-center"
              >
                自由タブを作成
              </Link>
            </div>
          </div> */}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
