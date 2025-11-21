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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  // 新規ユーザー作成用の状態
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'user' as 'admin' | 'user' | 'viewer',
    department: '',
    position: ''
  });

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
        // APIから取得した日付文字列をDateオブジェクトに変換
        const usersWithDates = data.users.map((user: any) => ({
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

  // 新規ユーザーを作成
  const createUser = async () => {
    if (!user) {
      alert('ログインが必要です');
      return;
    }
    
    if (!newUser.email || !newUser.password) {
      alert('メールアドレスとパスワードは必須です');
      return;
    }

    try {
      setIsCreating(true);
      // 認証トークンを取得
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();

      if (response.ok) {
        // ユーザー一覧を再取得
        await fetchUsers();
        setShowCreateModal(false);
        setNewUser({
          email: '',
          password: '',
          displayName: '',
          role: 'user',
          department: '',
          position: ''
        });
        alert('ユーザーが正常に作成されました');
      } else {
        alert(`エラー: ${data.error}`);
      }
    } catch (error) {
      console.error('ユーザー作成エラー:', error);
      alert('ユーザー作成に失敗しました');
    } finally {
      setIsCreating(false);
    }
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
          department: updatedUser.department,
          position: updatedUser.position,
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
    <ProtectedRoute adminOnly={true}>
      <Layout>
        <div className="min-h-screen bg-gray-50">
          {/* ヘッダー */}
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">ユーザー管理</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-2">システムユーザーの管理と権限設定</p>
              </div>
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{users.length}</div>
                  <div className="text-sm text-gray-500">総ユーザー数</div>
                </div>
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    ユーザーを追加
                  </span>
                </button>
              </div>
            </div>
          </div>


          {/* ユーザー一覧 */}
          <div className="p-4 sm:p-6">
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
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
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

          {/* ユーザー作成モーダル */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">新しいユーザーを作成</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス *</label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="user@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">パスワード *</label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="6文字以上"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">表示名</label>
                    <input
                      type="text"
                      value={newUser.displayName}
                      onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="田中太郎"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">部署</label>
                    <input
                      type="text"
                      value={newUser.department}
                      onChange={(e) => setNewUser({...newUser, department: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="営業部"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">役職</label>
                    <input
                      type="text"
                      value={newUser.position}
                      onChange={(e) => setNewUser({...newUser, position: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="マネージャー"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={createUser}
                    disabled={isCreating || !newUser.email || !newUser.password}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isCreating ? '作成中...' : '作成'}
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ユーザー詳細モーダル */}
          {showUserModal && selectedUser && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
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

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">部署</label>
                      <input
                        type="text"
                        value={selectedUser.department || ''}
                        onChange={(e) => setSelectedUser({...selectedUser, department: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="部署名を入力"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">役職</label>
                      <input
                        type="text"
                        value={selectedUser.position || ''}
                        onChange={(e) => setSelectedUser({...selectedUser, position: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="役職を入力"
                      />
                    </div>
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
