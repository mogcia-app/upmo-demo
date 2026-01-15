'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../../../components/Layout';
import { ProtectedRoute } from '../../../components/ProtectedRoute';
import { useAuth } from '../../../contexts/AuthContext';

interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: Date;
  lastLoginAt?: Date;
  department?: string;
  position?: string;
}

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user' | 'viewer'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ユーザー一覧を取得
  const fetchUsers = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      // 認証トークンを取得
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (response.ok) {
        // 現在のユーザーのcompanyNameを取得
        const currentUser = data.users.find((u: any) => u.id === user.uid);
        const currentCompanyName = currentUser?.companyName || '';
        
        // 同じcompanyNameのユーザーのみをフィルタリング
        const filteredUsers = data.users.filter((u: any) => u.companyName === currentCompanyName);
        
        // APIから取得した日付文字列をDateオブジェクトに変換
        const usersWithDates = filteredUsers.map((user: any) => ({
          ...user,
          createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
          lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined
        }));
        setUsers(usersWithDates);
      } else {
        console.error('ユーザー取得エラー:', data.error);
        // エラーの場合はモックデータを表示
        const mockUsers: User[] = [
          {
            id: '1',
            email: 'admin@upmo.com',
            displayName: '管理者',
            photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face',
            role: 'admin',
            createdAt: new Date('2024-01-01'),
            lastLoginAt: new Date('2024-01-15'),
            department: 'IT',
            position: 'CTO'
          }
        ];
        setUsers(mockUsers);
      }
    } catch (error) {
      console.error('ユーザー取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user]);

  // フィルタリングされたユーザーを取得
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.department?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  // ロールの色を取得
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'user':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'viewer':
        return 'bg-green-50 text-green-700 border-green-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // ユーザー詳細を開く
  const openUserDetail = (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };


  // ユーザーを編集
  const updateUser = async (updatedUser: User) => {
    if (!user) {
      alert('ログインが必要です');
      return;
    }
    
    try {
      // 認証トークンを取得
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          uid: updatedUser.id,
          role: updatedUser.role,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchUsers();
        setShowUserModal(false);
        setSelectedUser(null);
        alert('ユーザー情報が更新されました');
      } else {
        alert(`エラー: ${data.error}`);
      }
    } catch (error) {
      console.error('ユーザー更新エラー:', error);
      alert('ユーザー情報の更新に失敗しました');
    }
  };

  // パスワードを変更
  const changePassword = async (userId: string) => {
    if (!user) {
      alert('ログインが必要です');
      return;
    }
    
    if (!newPassword || newPassword.length < 6) {
      alert('パスワードは6文字以上である必要があります');
      return;
    }

    try {
      setIsChangingPassword(true);
      // 認証トークンを取得
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          uid: userId,
          newPassword: newPassword
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setNewPassword('');
        setShowChangePassword(false);
        alert('パスワードが変更されました');
      } else {
        alert(`エラー: ${data.error}`);
      }
    } catch (error) {
      console.error('パスワード変更エラー:', error);
      alert('パスワードの変更に失敗しました');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // ユーザーを削除
  const deleteUser = async (userId: string) => {
    if (!user) {
      alert('ログインが必要です');
      return;
    }
    
    if (!confirm('このユーザーを削除しますか？')) {
      return;
    }

    try {
      // 認証トークンを取得
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid: userId }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchUsers();
        alert('ユーザーが削除されました');
      } else {
        alert(`エラー: ${data.error}`);
      }
    } catch (error) {
      console.error('ユーザー削除エラー:', error);
      alert('ユーザーの削除に失敗しました');
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gray-50 -mx-4 lg:-mx-6">
          {/* ヘッダー */}
          <div className="bg-white border-b border-gray-100 px-6 sm:px-8 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">ユーザー管理</h1>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">{users.length}</div>
                  <div className="text-xs text-gray-500">総ユーザー数</div>
                </div>
                <div className="text-xs text-gray-500 bg-blue-50 px-3 py-1.5 border border-blue-200">
                  利用者の追加は運営会社にご連絡ください
                </div>
              </div>
            </div>
          </div>

          {/* コンテンツエリア */}
          <div className="px-6 sm:px-8 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">読み込み中...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">ユーザーが見つかりません</h3>
                <p className="text-gray-500">検索条件を変更して再度お試しください</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="bg-white border border-gray-200 p-4 sm:p-5 hover:border-gray-300 transition-colors cursor-pointer group"
                    onClick={() => openUserDetail(user)}
                  >
                    {/* ヘッダー部分 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=3b82f6&color=fff&size=48`}
                            alt={user.displayName}
                            className="w-12 h-12 rounded-full border-2 border-white shadow-md"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{user.displayName}</h3>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* ロールバッジ */}
                    <div className="mb-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        <span className="w-2 h-2 rounded-full mr-1.5 bg-current opacity-60"></span>
                        {user.role === 'admin' ? '管理者' : user.role === 'user' ? '利用者' : '閲覧者'}
                      </span>
                    </div>

                    {/* 組織情報 */}
                    {(user.department || user.position) && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            {user.department && <div className="font-medium truncate">{user.department}</div>}
                            {user.position && <div className="text-xs text-gray-500 truncate">{user.position}</div>}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 日付情報 */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>登録: {user.createdAt instanceof Date ? user.createdAt.toLocaleDateString('ja-JP') : new Date(user.createdAt).toLocaleDateString('ja-JP')}</span>
                      </div>

                      {user.lastLoginAt && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>最終: {user.lastLoginAt instanceof Date ? user.lastLoginAt.toLocaleDateString('ja-JP') : new Date(user.lastLoginAt).toLocaleDateString('ja-JP')}</span>
                        </div>
                      )}
                    </div>

                    {/* アクションボタン */}
                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openUserDetail(user);
                        }}
                        className="flex-1 px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                      >
                        <span className="flex items-center justify-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          編集
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteUser(user.id);
                        }}
                        className="px-3 py-2 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


          {/* ユーザー詳細モーダル */}
          {showUserModal && selectedUser && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-4 sm:p-6 w-full mx-4 max-w-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">ユーザー詳細</h3>
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={selectedUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.displayName)}&background=3b82f6&color=fff`}
                      alt={selectedUser.displayName}
                      className="w-16 h-16 rounded-full border-2 border-gray-200"
                    />
                    <div>
                      <h4 className="font-semibold text-gray-900">{selectedUser.displayName}</h4>
                      <p className="text-sm text-gray-500">{selectedUser.email}</p>
                    </div>
                  </div>


                  {/* パスワード変更セクション */}
                  <div className="pt-4 border-t border-gray-200">
                    {!showChangePassword ? (
                      <button
                        onClick={() => setShowChangePassword(true)}
                        className="w-full px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        パスワードを変更
                      </button>
                    ) : (
                  <div className="space-y-3">
                    <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
                          <div className="relative">
                      <input
                              type={showNewPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="6文字以上"
                      />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            >
                              {showNewPassword ? (
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                              ) : (
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => changePassword(selectedUser.id)}
                            disabled={isChangingPassword || !newPassword || newPassword.length < 6}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                          >
                            {isChangingPassword ? '変更中...' : '変更'}
                          </button>
                          <button
                            onClick={() => {
                              setShowChangePassword(false);
                              setNewPassword('');
                            }}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm"
                          >
                            キャンセル
                          </button>
                    </div>
                    </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => updateUser(selectedUser)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setShowUserModal(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
