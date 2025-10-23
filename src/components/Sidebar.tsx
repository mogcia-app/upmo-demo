"use client";

import React, { useState } from "react";
import { useCustomTabs } from "../hooks/useCustomTabs";
import AddTabModal from "./AddTabModal";
import { useAuth } from "../contexts/AuthContext";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onClose }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const { customTabs, addCustomTab, deleteCustomTab } = useCustomTabs();
  const { user, userRole, logout } = useAuth();

  const commonMenuItems = [
    { name: "ダッシュボード", icon: "•", href: "/" },
    { name: "個人チャット", icon: "•", href: "/personal-chat" },
    { name: "TODOリスト", icon: "•", href: "/todo" },
    { name: "顧客管理", icon: "•", href: "/customers" },
  ];

  const adminMenuItems = [
    { name: "契約書", icon: "•", href: "/admin/contracts" },
    { name: "ユーザー管理", icon: "•", href: "/admin/users" },
  ];

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
            {commonMenuItems.map((item, index) => (
              <li key={index}>
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

          {/* カスタムタブセクション */}
          <div className="px-4 mb-2">
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center text-gray-500 text-sm font-semibold">
                <span className="text-lg mr-3 text-blue-500">•</span>
                カスタム
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="w-6 h-6 rounded-full bg-[#005eb2] text-white flex items-center justify-center hover:bg-[#004a96] transition-colors"
                title="新しいタブを追加"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          <ul className="space-y-1 px-4 mb-4">
            {customTabs.map((tab) => (
              <li key={tab.id} className="group">
                <div className="flex items-center">
                  <a
                    href={tab.route}
                    className="flex-1 flex items-center px-8 py-2 rounded-lg text-gray-600 hover:bg-[#005eb2] hover:text-white transition-colors duration-200 ease-in-out text-sm"
                  >
                    <span className="text-sm mr-3 group-hover:scale-110 transition-transform duration-200 text-blue-500">
                      {tab.icon}
                    </span>
                    <span className="font-medium">{tab.title}</span>
                  </a>
                  <button
                    onClick={() => deleteCustomTab(tab.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-red-600 transition-all duration-200 ml-2"
                    title="タブを削除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
            
            {/* カスタムタブがない場合の表示 */}
            {customTabs.length === 0 && (
              <li className="px-8 py-2 text-gray-400 text-sm">
                まだカスタムタブがありません
              </li>
            )}
          </ul>

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
                {adminMenuItems.map((item, index) => (
                  <li key={index}>
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

      {/* タブ追加モーダル */}
      <AddTabModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddTab={addCustomTab}
      />
    </>
  );
};

export default Sidebar;
