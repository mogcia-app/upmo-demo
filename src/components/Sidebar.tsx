"use client";

import React from "react";
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
          fixed top-0 left-0 h-full bg-white shadow-lg z-50 transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:shadow-none
          w-64
          flex flex-col
        `}
      >
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-[#005eb2]">Upmo</h1>
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded-md hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ナビゲーションメニュー */}
        <nav className="mt-6 flex-1 overflow-y-auto min-h-0">
          {/* 共通メニュー */}
          <ul className="space-y-1 px-4">
            {commonMenuItems.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  className="
                    flex items-center px-4 py-3 rounded-lg text-gray-700 hover:bg-[#005eb2] hover:text-white
                    transition-colors duration-200 ease-in-out
                    group
                  "
                >
                  <span className="text-lg mr-3 group-hover:scale-110 transition-transform duration-200 text-blue-500">
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.name}</span>
                </a>
              </li>
            ))}
          </ul>

          {/* 有効化された追加メニュー項目（カテゴリごとに表示） */}
          {additionalMenuItems.length > 0 && (
            <>
              {/* セパレーター */}
              <div className="mx-4 my-4 border-t border-gray-200"></div>
              
              {/* カテゴリごとにグループ化して表示 */}
              {Object.entries(
                additionalMenuItems.reduce((acc, item) => {
                  if (!acc[item.category]) {
                    acc[item.category] = [];
                  }
                  acc[item.category].push(item);
                  return acc;
                }, {} as Record<MenuCategory, typeof additionalMenuItems>)
              ).map(([category, items]) => (
                <div key={category} className="mb-4">
                  <div className="px-4 mb-2">
                    <div className="flex items-center px-4 py-2 text-gray-500 text-sm font-semibold">
                      <span className="text-lg mr-3 text-blue-500">•</span>
                      {CATEGORY_NAMES[category as MenuCategory]}
                    </div>
                  </div>
                  <ul className="space-y-1 px-4">
                    {items.map((item) => (
                      <li key={item.id}>
                        <a
                          href={item.href}
                          className="
                            flex items-center px-4 py-3 rounded-lg text-gray-700 hover:bg-[#005eb2] hover:text-white
                            transition-colors duration-200 ease-in-out
                            group
                          "
                        >
                          <span className="text-lg mr-3 group-hover:scale-110 transition-transform duration-200">
                            {item.icon}
                          </span>
                          <span className="font-medium">{item.name}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}

          {/* セパレーター */}
          <div className="mx-4 my-4 border-t border-gray-200"></div>

          {/* Admin セクション - 管理者のみ表示 */}
          {isAdmin && (
            <>
              <div className="px-4 mb-2">
                <div className="flex items-center px-4 py-2 text-gray-500 text-sm font-semibold">
                  <span className="text-lg mr-3 text-blue-500">•</span>
                  Admin
                </div>
              </div>
              
              <ul className="space-y-1 px-4 mb-4">
                {adminMenuItems.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      className="
                        flex items-center px-8 py-2 rounded-lg text-gray-600 hover:bg-[#005eb2] hover:text-white
                        transition-colors duration-200 ease-in-out
                        group text-sm
                      "
                    >
                      <span className="text-sm mr-3 group-hover:scale-110 transition-transform duration-200 text-blue-500">
                        {item.icon}
                      </span>
                      <span className="font-medium">{item.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

        </nav>

        {/* フッター */}
        <div className="p-6 border-t border-gray-200 bg-white">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-[#005eb2] rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <div className="text-center">
              <a
                href="/login"
                className="text-sm text-[#005eb2] hover:text-[#004a96] font-medium"
              >
                ログイン
              </a>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">© 2024 Upmo Demo</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
