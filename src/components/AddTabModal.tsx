"use client";

import React, { useState } from "react";
import { CustomTab } from "../hooks/useCustomTabs";

interface AddTabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTab: (title: string, icon: string, isShared: boolean) => Promise<CustomTab | undefined>;
}

const AddTabModal: React.FC<AddTabModalProps> = ({ isOpen, onClose, onAddTab }) => {
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("📄");
  const [isShared, setIsShared] = useState(false);
  const [loading, setLoading] = useState(false);

  const predefinedIcons = [
    "📊", "📈", "📅", "🏢", "💰", "📋", "🎯", "📝", 
    "🔔", "📁", "💼", "👥", "📉", "🎨", "⚙️", "🔍"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      await onAddTab(title.trim(), icon, isShared);
      setTitle("");
      setIcon("📄");
      setIsShared(false);
      onClose();
    } catch (error) {
      console.error("Error adding tab:", error);
      alert("タブの追加に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">新しいタブを追加</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                タブ名
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 営業進捗、カレンダー、売上管理"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                maxLength={20}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                アイコンを選択
              </label>
              <div className="grid grid-cols-8 gap-2">
                {predefinedIcons.map((iconOption) => (
                  <button
                    key={iconOption}
                    type="button"
                    onClick={() => setIcon(iconOption)}
                    className={`
                      w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg
                      ${icon === iconOption 
                        ? 'border-[#005eb2] bg-[#005eb2] text-white' 
                        : 'border-gray-300 hover:border-gray-400'
                      }
                    `}
                  >
                    {iconOption}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="w-4 h-4 text-[#005eb2] border-gray-300 rounded focus:ring-[#005eb2]"
                />
                <span className="text-sm font-medium text-gray-700">
                  チーム全体に共有する
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                チェックを入れると、チーム内の全員がこのタブを閲覧できます
              </p>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="flex-1 px-4 py-2 bg-[#005eb2] text-white rounded-md hover:bg-[#004a96] focus:outline-none focus:ring-2 focus:ring-[#005eb2] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "追加中..." : "追加"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddTabModal;
