"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSidebarConfig } from "../hooks/useSidebarConfig";
import { useAuth } from "../contexts/AuthContext";
import { CATEGORY_NAMES, MenuCategory } from "../types/sidebar";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onClose }) => {
  const { getEnabledCommonMenuItems, getEnabledAdminMenuItems, getEnabledAdditionalMenuItems } = useSidebarConfig();
  const { user, userRole, logout } = useAuth();

  // Firestoreから取得した設定を使用（有効なもののみ、order順にソート済み）
  const commonMenuItems = getEnabledCommonMenuItems();
  const adminMenuItems = getEnabledAdminMenuItems();
  const additionalMenuItems = getEnabledAdditionalMenuItems();

  // 管理者のみに表示するメニューアイテム
  const isAdmin = userRole?.role === 'admin';

  // カテゴリの折りたたみ状態を管理
  const [expandedCategories, setExpandedCategories] = useState<Set<MenuCategory>>(new Set());
  // 共通メニューの折りたたみ状態を管理
  const [isCommonMenuExpanded, setIsCommonMenuExpanded] = useState(true); // デフォルトで展開

  // カテゴリの展開/折りたたみを切り替え
  const toggleCategory = (category: MenuCategory) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };


  return (
    <>
      {/* オーバーレイ（モバイル用） */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* サイドバー */}
      <div
        className={`
          fixed top-0 left-0 h-full bg-gradient-to-b from-[#005eb2] to-[#004a96] shadow-lg z-50 transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:shadow-none
          w-20 lg:w-64
          flex flex-col
        `}
      >
        {/* ヘッダー */}
        <div className="p-4 lg:p-6 border-b border-blue-400/30">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-white hover:text-blue-100 transition-colors cursor-pointer hidden lg:block">
              upmo
            </Link>
            <Link href="/" className="text-2xl font-bold text-white hover:text-blue-100 transition-colors cursor-pointer lg:hidden">
              U
            </Link>
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded-md hover:bg-blue-600/50 text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ナビゲーションメニュー */}
        <nav className="mt-4 flex-1 overflow-y-auto min-h-0 px-2 lg:px-4">
          {/* 共通メニュー */}
          <div className="mb-4">
            <button
              onClick={() => setIsCommonMenuExpanded(!isCommonMenuExpanded)}
              className="w-full hidden lg:flex items-center justify-between px-2 lg:px-4 py-2 text-white/80 text-xs lg:text-sm font-semibold hover:bg-white/10 rounded-lg transition-colors"
            >
              <div className="flex items-center">
                <span>メインメニュー</span>
                <span className="ml-2 text-xs text-white/60">({commonMenuItems.length})</span>
              </div>
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${isCommonMenuExpanded ? 'transform rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            {isCommonMenuExpanded && (
              <ul className="space-y-2 mt-2">
                {commonMenuItems.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      className="
                        flex flex-col lg:flex-row items-center justify-center lg:justify-start px-2 lg:px-4 py-3 lg:py-2 rounded-xl lg:rounded-lg text-white hover:bg-white/20
                        transition-all duration-200 ease-in-out
                        group text-xs lg:text-sm
                      "
                      title={item.name}
                    >
                      <span className="text-xl lg:text-base mb-1 lg:mb-0 lg:mr-3 group-hover:scale-110 transition-transform duration-200">
                        {item.icon}
                      </span>
                      <span className="font-medium hidden lg:inline">{item.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 有効化された追加メニュー項目（カテゴリごとに表示） */}
          {additionalMenuItems.length > 0 && (
            <>
              {/* セパレーター */}
              <div className="mx-2 lg:mx-4 my-4 border-t border-white/20"></div>
              
              {/* カテゴリごとにグループ化して表示 */}
              {(() => {
                // カテゴリの順序を固定
                const categoryOrder: MenuCategory[] = ['sales', 'customer', 'inventory', 'finance', 'pdca', 'document', 'project', 'analytics', 'other'];
                
                // カテゴリごとにグループ化
                const groupedByCategory = additionalMenuItems.reduce((acc, item) => {
                  if (!acc[item.category]) {
                    acc[item.category] = [];
                  }
                  acc[item.category].push(item);
                  return acc;
                }, {} as Record<MenuCategory, typeof additionalMenuItems>);
                
                // カテゴリ順にソートして、空でないカテゴリのみ表示
                return categoryOrder
                  .filter(category => groupedByCategory[category] && groupedByCategory[category].length > 0)
                  .map((category) => {
                    const items = groupedByCategory[category];
                    const isExpanded = expandedCategories.has(category);
                    return (
                      <div key={category} className="mb-2">
                      <button
                          onClick={() => toggleCategory(category)}
                          className="w-full hidden lg:flex items-center justify-between px-2 lg:px-4 py-2 text-white/80 text-xs lg:text-sm font-semibold hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <div className="flex items-center">
                            <span>{CATEGORY_NAMES[category]}</span>
                            <span className="ml-2 text-xs text-white/60">({items.length})</span>
                          </div>
                          <svg
                            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'transform rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                        {isExpanded && (
                          <ul className="space-y-2 mt-2">
                            {items.map((item) => (
                              <li key={item.id}>
                                <a
                                  href={item.href}
                                  className="
                                    flex flex-col lg:flex-row items-center justify-center lg:justify-start px-2 lg:px-4 py-3 lg:py-2 rounded-xl lg:rounded-lg text-white hover:bg-white/20
                                    transition-all duration-200 ease-in-out
                                    group text-xs lg:text-sm
                                  "
                                  title={item.name}
                                >
                                  <span className="text-xl lg:text-base mb-1 lg:mb-0 lg:mr-3 group-hover:scale-110 transition-transform duration-200">
                                    {item.icon}
                                  </span>
                                  <span className="font-medium hidden lg:inline">{item.name}</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                    )}
                  </div>
              );
                  });
              })()}
            </>
            )}

          {/* セパレーター */}
          <div className="mx-2 lg:mx-4 my-4 border-t border-white/20"></div>

          {/* Admin セクション - 管理者のみ表示 */}
          {isAdmin && (
            <>
              <div className="px-2 lg:px-4 mb-2 hidden lg:block">
                <div className="flex items-center px-2 lg:px-4 py-2 text-white/80 text-xs lg:text-sm font-semibold">
                  Admin
                </div>
              </div>
              
              <ul className="space-y-2 mb-4">
                {adminMenuItems.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      className="
                        flex flex-col lg:flex-row items-center justify-center lg:justify-start px-2 lg:px-4 py-3 lg:py-2 rounded-xl lg:rounded-lg text-white hover:bg-white/20
                        transition-all duration-200 ease-in-out
                        group text-xs lg:text-sm
                      "
                      title={item.name}
                    >
                      <span className="text-xl lg:text-base mb-1 lg:mb-0 lg:mr-3 group-hover:scale-110 transition-transform duration-200">
                        {item.icon}
                      </span>
                      <span className="font-medium hidden lg:inline">{item.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

        </nav>

        {/* フッター */}
        <div className="p-4 lg:p-6 border-t border-white/20 bg-blue-600/50">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 lg:space-x-3 justify-center lg:justify-start">
                <div className="w-10 h-10 lg:w-8 lg:h-8 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/30">
                  <span className="text-white text-sm font-medium">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0 hidden lg:block">
                  <p className="text-sm font-medium text-white truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full px-3 py-2 text-xs lg:text-sm text-white hover:text-red-200 hover:bg-white/10 rounded-lg transition-colors border border-white/20"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <div className="text-center">
              <a
                href="/login"
                className="text-sm text-white hover:text-blue-100 font-medium"
              >
                ログイン
              </a>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-white/20 hidden lg:block">
            <p className="text-xs text-white/60 text-center">© 2024 Upmo Demo</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
