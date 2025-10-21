"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Layout from "../../../components/Layout";
import ComponentEditor from "../../../components/ComponentEditor";
import DataTableComponent from "../../../components/DataTableComponent";
import ChartComponent from "../../../components/ChartComponent";
import FormComponent from "../../../components/FormComponent";
import CalendarComponent from "../../../components/CalendarComponent";
import { CustomComponent, ComponentType } from "../../../types/components";
import { useCustomTabs, CustomTab } from "../../../hooks/useCustomTabs";
import { ProtectedRoute } from "../../../components/ProtectedRoute";
import { useAuth } from "../../../contexts/AuthContext";

export default function CustomTabPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [components, setComponents] = useState<CustomComponent[]>([]);
  const [showComponentEditor, setShowComponentEditor] = useState(false);
  const [currentTab, setCurrentTab] = useState<CustomTab | null>(null);
  const [loading, setLoading] = useState(true);
  const { getCustomTabByRoute, updateCustomTabComponents } = useCustomTabs();
  const { user } = useAuth();
  
  // スラッグからタイトルを復元する関数
  const getTitleFromSlug = (slug: string) => {
    // 英語スラッグから日本語タイトルへのマッピング
    const englishToJapanese: { [key: string]: string } = {
      'sales-progress': '営業進捗',
      'calendar': 'カレンダー',
      'sales-management': '売上管理',
      'project-management': 'プロジェクト管理',
      'task-management': 'タスク管理',
      'customer-management': '顧客管理',
      'inventory-management': '在庫管理',
      'finance-management': '財務管理',
      'hr-management': '人事管理',
      'marketing': 'マーケティング',
      'reports': 'レポート',
      'analytics': '分析',
      'settings': '設定',
      'dashboard': 'ダッシュボード',
      'notifications': '通知',
      'history': '履歴'
    };

    // URLデコードされた日本語が直接来た場合の対応
    const urlDecodedToJapanese: { [key: string]: string } = {
      '営業進捗': '営業進捗',
      'カレンダー': 'カレンダー',
      '売上管理': '売上管理',
      'プロジェクト管理': 'プロジェクト管理',
      'タスク管理': 'タスク管理',
      '顧客管理': '顧客管理',
      '在庫管理': '在庫管理',
      '財務管理': '財務管理',
      '人事管理': '人事管理',
      'マーケティング': 'マーケティング',
      'レポート': 'レポート',
      '分析': '分析',
      '設定': '設定',
      'ダッシュボード': 'ダッシュボード',
      '通知': '通知',
      '履歴': '履歴'
    };

    // マッピングにある場合は日本語タイトルを返す
    if (englishToJapanese[slug]) {
      return englishToJapanese[slug];
    }

    // URLデコードされた日本語の場合
    if (urlDecodedToJapanese[slug]) {
      return urlDecodedToJapanese[slug];
    }

    // それ以外は英語の場合はキャピタライズ
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // URL slugからタイトルを復元（URLデコードも対応）
  const title = slug ? getTitleFromSlug(decodeURIComponent(slug)) : "カスタムタブ";

  // ページロード時にコンポーネントを読み込み
  useEffect(() => {
    const loadComponents = async () => {
      if (!slug || !user) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const route = `/custom/${decodeURIComponent(slug)}`;
        const tab = await getCustomTabByRoute(route);
        
        if (tab) {
          setCurrentTab(tab);
          setComponents(tab.components || []);
        } else {
          // タブが見つからない場合、空の状態で表示
          setComponents([]);
        }
      } catch (error) {
        console.error("Error loading components:", error);
        setComponents([]);
      } finally {
        setLoading(false);
      }
    };

    loadComponents();
  }, [slug, user, getCustomTabByRoute]);

  const handleAddComponent = async (newComponent: CustomComponent) => {
    const updatedComponents = [...components, newComponent];
    setComponents(updatedComponents);
    
    // Firestoreに保存
    if (currentTab) {
      await updateCustomTabComponents(currentTab.id, updatedComponents);
    }
  };

  const handleUpdateComponent = async (updatedComponent: CustomComponent) => {
    const updatedComponents = components.map(comp => 
      comp.id === updatedComponent.id ? updatedComponent : comp
    );
    setComponents(updatedComponents);
    
    // Firestoreに保存
    if (currentTab) {
      await updateCustomTabComponents(currentTab.id, updatedComponents);
    }
  };

  const handleDeleteComponent = async (componentId: string) => {
    const updatedComponents = components.filter(comp => comp.id !== componentId);
    setComponents(updatedComponents);
    
    // Firestoreに保存
    if (currentTab) {
      await updateCustomTabComponents(currentTab.id, updatedComponents);
    }
  };

  const renderComponent = (component: CustomComponent) => {
    switch (component.type) {
      case ComponentType.DATA_TABLE:
        return (
          <DataTableComponent
            key={component.id}
            component={component as any}
            onUpdate={handleUpdateComponent}
          />
        );
      case ComponentType.CHART:
        return (
          <ChartComponent
            key={component.id}
            component={component as any}
          />
        );
      case ComponentType.FORM:
        return (
          <FormComponent
            key={component.id}
            component={component as any}
            onUpdate={handleUpdateComponent}
          />
        );
      case ComponentType.CALENDAR:
        return (
          <CalendarComponent
            key={component.id}
            component={component as any}
            onUpdate={handleUpdateComponent}
          />
        );
      default:
        return (
          <div key={component.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900">{component.title}</h3>
            <p className="text-gray-600 mt-2">未対応のコンポーネントタイプです。</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#005eb2] mx-auto mb-4"></div>
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <p className="text-gray-600">ログインが必要です。</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {currentTab ? currentTab.title : title}
              </h1>
              <p className="text-gray-600">
                カスタムコンポーネントで自由にページを構築できます。
              </p>
            </div>
            <button
              onClick={() => setShowComponentEditor(true)}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>コンポーネントを追加</span>
            </button>
          </div>
        </div>

        {/* コンポーネントエリア */}
        <div className="space-y-6">
          {components.length > 0 ? (
            components.map((component) => (
              <div key={component.id} className="relative group">
                {renderComponent(component)}
                <button
                  onClick={() => handleDeleteComponent(component.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all duration-200"
                  title="コンポーネントを削除"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                コンポーネントを追加してください
              </h3>
              <p className="text-gray-600 mb-6">
                データテーブル、チャート、フォームなどのコンポーネントを自由に追加して、カスタムページを構築できます。
              </p>
              <button
                onClick={() => setShowComponentEditor(true)}
                className="px-6 py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
              >
                最初のコンポーネントを追加
              </button>
            </div>
          )}
        </div>

        {/* コンポーネントエディター */}
        <ComponentEditor
          isOpen={showComponentEditor}
          onClose={() => setShowComponentEditor(false)}
          onAddComponent={handleAddComponent}
        />
      </div>
    </Layout>
    </ProtectedRoute>
  );
}
