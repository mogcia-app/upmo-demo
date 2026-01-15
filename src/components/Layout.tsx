"use client";

import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import { useAuth } from "../contexts/AuthContext";
import { db, auth } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";

interface LayoutProps {
  children: React.ReactNode;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  pageUrl: string;
  pageName: string;
  action: string;
  createdBy: string;
  createdByName: string;
  readBy: string[];
  createdAt: string;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // 会社名を取得
  useEffect(() => {
    const fetchCompanyName = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.companyName) {
            setCompanyName(userData.companyName);
          }
        }
      } catch (error) {
        console.error('会社名の取得エラー:', error);
      }
    };

    fetchCompanyName();
  }, [user]);

  // 通知を取得
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/notifications', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error('通知取得エラー:', error);
      }
    };

    if (user) {
      fetchNotifications();
      // 30秒ごとに通知を更新
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // 通知を既読にする
  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationId }),
      });
      
      // ローカル状態を更新
      setNotifications(prev => prev.map(n => 
        n.id === notificationId 
          ? { ...n, readBy: [...(n.readBy || []), user.uid] }
          : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('通知既読エラー:', error);
    }
  };

  // 通知クリック時の処理
  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead(notification.id);
    setShowNotifications(false);
  };

  // 通知を削除
  const handleDeleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('この通知を削除しますか？')) return;
    
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        // ローカル状態を更新
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        // 未読数も更新
        const deletedNotification = notifications.find(n => n.id === notificationId);
        if (deletedNotification && !deletedNotification.readBy?.includes(user.uid)) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } else {
        alert('通知の削除に失敗しました');
      }
    } catch (error) {
      console.error('通知削除エラー:', error);
      alert('通知の削除に失敗しました');
    }
  };

  // 外側をクリックしたときに通知を閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* サイドバー */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* ヘッダー */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-4 lg:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* モバイル用メニューボタン */}
              <button
                onClick={toggleSidebar}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {companyName && (
                <h2 className="text-lg font-semibold text-gray-900">{companyName}</h2>
              )}
            </div>

            {/* 通知アイコン */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#005eb2]"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* 通知一覧ドロップダウン */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">通知</h3>
                    {unreadCount > 0 && (
                      <p className="text-sm text-gray-500 mt-1">未読: {unreadCount}件</p>
                    )}
                  </div>
                  
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <p>通知はありません</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {notifications.map((notification) => {
                        const isRead = notification.readBy?.includes(user?.uid || '');
                        const actionText = {
                          'created': '追加',
                          'updated': '編集',
                          'deleted': '削除',
                        }[notification.action] || notification.action;
                        
                        return (
                          <div
                            key={notification.id}
                            className={`relative group p-4 hover:bg-gray-50 transition-colors ${!isRead ? 'bg-blue-50' : ''}`}
                          >
                            <Link
                              href={notification.pageUrl || '#'}
                              onClick={() => handleNotificationClick(notification)}
                              className="block"
                            >
                              <div className="flex items-start space-x-3 pr-8">
                                <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${!isRead ? 'bg-blue-500' : 'bg-transparent'}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">
                                    {notification.title}
                                  </p>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {notification.createdByName}が{notification.pageName}で{actionText}しました
                                  </p>
                                  {notification.message && (
                                    <p className="text-xs text-gray-500 mt-1">{notification.message}</p>
                                  )}
                                  <p className="text-xs text-gray-400 mt-2">
                                    {new Date(notification.createdAt).toLocaleString('ja-JP')}
                                  </p>
                                </div>
                              </div>
                            </Link>
                            <button
                              onClick={(e) => handleDeleteNotification(notification.id, e)}
                              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="通知を削除"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
