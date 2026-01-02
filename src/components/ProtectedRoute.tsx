"use client";

import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminOnly = false }) => {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('ProtectedRoute state:', { 
      loading, 
      hasUser: !!user, 
      userId: user?.uid,
      userRole, 
      adminOnly 
    });
    
    if (!loading && !user) {
      console.log('ProtectedRoute: No user, redirecting to login');
      router.push("/login");
    } else if (!loading && user && adminOnly) {
      // userRoleがnullの場合は、まだ読み込み中の可能性があるので待つ
      if (userRole === null) {
        console.warn('ProtectedRoute: userRole is null, waiting for role to be loaded...');
        return;
      }
      if (userRole?.role !== 'admin') {
        console.warn('ProtectedRoute: User does not have admin role. Current role:', userRole?.role);
      router.push("/");
      } else {
        console.log('ProtectedRoute: User has admin role, allowing access');
      }
    }
  }, [user, userRole, loading, router, adminOnly]);

  // ローディング中、またはuserRoleがnullでadminOnlyの場合は待つ
  if (loading || (adminOnly && user && userRole === null)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#005eb2] mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // リダイレクト中
  }

  if (adminOnly && userRole?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">アクセス権限がありません</h1>
          <p className="text-gray-600 mb-4">このページにアクセスするには管理者権限が必要です。</p>
          <p className="text-sm text-gray-500 mb-4">現在のロール: {userRole?.role || '未設定'}</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
