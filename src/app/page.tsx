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
    if (!user || !setupData.companyName || !setupData.industry) return;

    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      const updatedSetupData = {
        ...setupData,
        isSetupComplete: true,
        completedAt: new Date()
      };

      await updateDoc(doc(db, 'users', user.uid), {
        companySetup: updatedSetupData,
        companyName: setupData.companyName
      });

      setSetupData(updatedSetupData);
      setIsSetupMode(false);
      
      // 自動カスタマイズを実行
      await applyAutoCustomization(updatedSetupData);
      
    } catch (error) {
      console.error('設定保存エラー:', error);
    }
  };

  const applyAutoCustomization = async (setup: CompanySetup) => {
    const selectedIndustry = industryConfigs.find(ind => ind.id === setup.industry);
    if (!selectedIndustry) return;

    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      // ユーザーのカスタムタブに業種別テンプレートを追加
      const customTabs = selectedIndustry.templates.map(template => ({
        id: `template_${template.name}_${Date.now()}`,
        title: template.name,
        description: template.description,
        icon: template.icon,
        route: template.href,
        components: [],
        createdAt: new Date(),
        isTemplate: true
      }));

      await updateDoc(doc(db, 'users', user!.uid), {
        customTabs: customTabs,
        industryTheme: {
          industry: selectedIndustry.name,
          color: selectedIndustry.color,
          icon: selectedIndustry.icon
        }
      });

      // ローカルストレージにも保存
      localStorage.setItem('customTabs', JSON.stringify(customTabs));
      localStorage.setItem('industryTheme', JSON.stringify({
        industry: selectedIndustry.name,
        color: selectedIndustry.color,
        icon: selectedIndustry.icon
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
            <div className="container mx-auto px-4 py-8">
              <div className="max-w-4xl mx-auto">
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
                  <div className="bg-white rounded-lg shadow-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">業種を選択</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {industryConfigs.map((industry) => (
                        <div
                          key={industry.id}
                          onClick={() => setSetupData(prev => ({ ...prev, industry: industry.id }))}
                          className={`p-6 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg ${
                            setupData.industry === industry.id
                              ? 'border-[#005eb2] bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="text-center">
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
                        disabled={!setupData.industry}
                        className="px-8 py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] disabled:bg-gray-300 disabled:cursor-not-allowed text-lg font-medium"
                      >
                        次へ
                      </button>
                    </div>
                  </div>
                )}

                {/* ステップ3: 機能選択 */}
                {currentStep === 3 && (
                  <div className="bg-white rounded-lg shadow-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">必要な機能を選択</h2>
                    <p className="text-gray-600 mb-6">
                      選択した業種に基づいて推奨機能を表示しています。追加で必要な機能があれば選択してください。
                    </p>
                    
                    {setupData.industry && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            {industryConfigs.find(ind => ind.id === setupData.industry)?.name} 推奨機能
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {industryConfigs.find(ind => ind.id === setupData.industry)?.features.map((feature) => (
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

                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">その他の機能</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
  const selectedIndustry = industryConfigs.find(ind => ind.id === setupData.industry);
  
  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* ウェルカムセクション */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {selectedIndustry ? `${selectedIndustry.icon} ${setupData.companyName}` : 'ようこそ、Upmo Demoへ！'}
                </h1>
                <p className="text-gray-600">
                  {selectedIndustry ? `${selectedIndustry.name}向けに最適化されたダッシュボードです` : 'Next.js + Firebase + Vercelで構築されたモダンなダッシュボードです。'}
                </p>
              </div>
              <button
                onClick={() => setIsSetupMode(true)}
                className="px-4 py-2 text-[#005eb2] border border-[#005eb2] rounded-lg hover:bg-[#005eb2] hover:text-white transition-colors"
              >
                設定を変更
              </button>
            </div>
          </div>

          {/* 業種別テンプレート */}
          {selectedIndustry && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {selectedIndustry.name} 向けテンプレート
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedIndustry.templates.map((template) => (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-[#005eb2] rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">ユーザー数</p>
                  <p className="text-2xl font-bold text-gray-900">1,234</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">完了タスク</p>
                  <p className="text-2xl font-bold text-gray-900">567</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">進行中</p>
                  <p className="text-2xl font-bold text-gray-900">89</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">成長率</p>
                  <p className="text-2xl font-bold text-gray-900">+12%</p>
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
                <p className="text-gray-600">新しいプロジェクト「Webアプリ開発」が作成されました</p>
                <span className="text-sm text-gray-400 ml-auto">2時間前</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-gray-600">タスク「UIデザイン」が完了されました</p>
                <span className="text-sm text-gray-400 ml-auto">4時間前</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <p className="text-gray-600">新しいチームメンバーが追加されました</p>
                <span className="text-sm text-gray-400 ml-auto">1日前</span>
              </div>
            </div>
          </div>

          {/* 自由タブ作成案内 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">追加の機能が必要ですか？</h3>
                <p className="text-gray-600">
                  自由タブから独自のページを作成して、さらにカスタマイズできます
                </p>
              </div>
              <Link
                href="/custom/new-page"
                className="px-6 py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors font-medium"
              >
                自由タブを作成
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
