'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
  priority: 'low' | 'medium' | 'high';
}

export default function TodoPage() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // ローカルストレージからTODOを読み込み
  useEffect(() => {
    if (user) {
      const savedTodos = localStorage.getItem(`todos_${user.uid}`);
      if (savedTodos) {
        const parsedTodos = JSON.parse(savedTodos).map((todo: any) => ({
          ...todo,
          createdAt: new Date(todo.createdAt)
        }));
        setTodos(parsedTodos);
      }
    }
  }, [user]);

  // TODOをローカルストレージに保存
  const saveTodos = (todosToSave: TodoItem[]) => {
    if (user) {
      localStorage.setItem(`todos_${user.uid}`, JSON.stringify(todosToSave));
    }
  };

  // 新しいTODOを追加
  const addTodo = () => {
    if (newTodo.trim() && user) {
      const todo: TodoItem = {
        id: Date.now().toString(),
        text: newTodo.trim(),
        completed: false,
        createdAt: new Date(),
        priority
      };
      const updatedTodos = [...todos, todo];
      setTodos(updatedTodos);
      saveTodos(updatedTodos);
      setNewTodo('');
    }
  };

  // TODOの完了状態を切り替え
  const toggleTodo = (id: string) => {
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updatedTodos);
    saveTodos(updatedTodos);
  };

  // TODOを削除
  const deleteTodo = (id: string) => {
    const updatedTodos = todos.filter(todo => todo.id !== id);
    setTodos(updatedTodos);
    saveTodos(updatedTodos);
  };

  // TODOを編集開始
  const startEditing = (id: string, text: string) => {
    setEditingId(id);
    setEditingText(text);
  };

  // TODOを編集完了
  const finishEditing = () => {
    if (editingId && editingText.trim()) {
      const updatedTodos = todos.map(todo =>
        todo.id === editingId ? { ...todo, text: editingText.trim() } : todo
      );
      setTodos(updatedTodos);
      saveTodos(updatedTodos);
    }
    setEditingId(null);
    setEditingText('');
  };

  // TODOを編集キャンセル
  const cancelEditing = () => {
    setEditingId(null);
    setEditingText('');
  };

  // フィルタリングされたTODOを取得
  const filteredTodos = todos.filter(todo => {
    switch (filter) {
      case 'active':
        return !todo.completed;
      case 'completed':
        return todo.completed;
      default:
        return true;
    }
  });

  // 優先度に応じた色とアイコンを取得
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'high':
        return {
          color: 'text-red-600 bg-red-50 border-red-200',
          icon: '🔴',
          label: '高',
          gradient: 'from-red-50 to-red-100'
        };
      case 'medium':
        return {
          color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
          icon: '🟡',
          label: '中',
          gradient: 'from-yellow-50 to-yellow-100'
        };
      case 'low':
        return {
          color: 'text-green-600 bg-green-50 border-green-200',
          icon: '🟢',
          label: '低',
          gradient: 'from-green-50 to-green-100'
        };
      default:
        return {
          color: 'text-gray-600 bg-gray-50 border-gray-200',
          icon: '⚪',
          label: '中',
          gradient: 'from-gray-50 to-gray-100'
        };
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
          <div className="max-w-4xl mx-auto p-6">
            {/* ヘッダー */}
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
                <span className="text-2xl">📝</span>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                TODOリスト
              </h1>
              <p className="text-gray-600 text-lg">タスクを管理して、効率的に作業を進めましょう ✨</p>
            </div>

            {/* TODO追加フォーム */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8 hover:shadow-xl transition-all duration-300">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                    placeholder="新しいタスクを入力..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="low">🟢 低</option>
                    <option value="medium">🟡 中</option>
                    <option value="high">🔴 高</option>
                  </select>
                  <button
                    onClick={addTodo}
                    disabled={!newTodo.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    <span className="flex items-center gap-2">
                      <span>+</span>
                      <span>追加</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* フィルターボタン */}
            <div className="flex flex-wrap gap-3 mb-8 justify-center">
              {(['all', 'active', 'completed'] as const).map((filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`px-6 py-3 rounded-full transition-all duration-200 font-medium ${
                    filter === filterType
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300 shadow-md hover:shadow-lg'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {filterType === 'all' && <span>📋</span>}
                    {filterType === 'active' && <span>⏳</span>}
                    {filterType === 'completed' && <span>✅</span>}
                    <span>
                      {filterType === 'all' && 'すべて'}
                      {filterType === 'active' && '未完了'}
                      {filterType === 'completed' && '完了済み'}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {/* TODOリスト */}
            <div className="space-y-4">
              {filteredTodos.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-8xl mb-6 opacity-50">📝</div>
                  <p className="text-xl font-medium mb-2">
                    {filter === 'all' && 'まだタスクがありません'}
                    {filter === 'active' && '未完了のタスクがありません'}
                    {filter === 'completed' && '完了済みのタスクがありません'}
                  </p>
                  <p className="text-gray-400">
                    {filter === 'all' && '新しいタスクを追加してみましょう！'}
                    {filter === 'active' && 'すべてのタスクが完了しています 🎉'}
                    {filter === 'completed' && 'まだ完了したタスクがありません'}
                  </p>
                </div>
              ) : (
                filteredTodos.map((todo, index) => {
                  const priorityStyle = getPriorityStyle(todo.priority);
                  const isEditing = editingId === todo.id;
                  
                  return (
                    <div
                      key={todo.id}
                      className={`bg-white rounded-xl shadow-lg border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                        todo.completed ? 'opacity-70 bg-gray-50' : ''
                      }`}
                      style={{
                        animationDelay: `${index * 100}ms`,
                        animation: 'fadeInUp 0.5s ease-out forwards'
                      }}
                    >
                      <div className="flex items-center gap-4">
                        {/* チェックボックス */}
                        <button
                          onClick={() => toggleTodo(todo.id)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                            todo.completed
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                          }`}
                        >
                          {todo.completed && (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>

                        {/* タスク内容 */}
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') finishEditing();
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                                className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                autoFocus
                              />
                              <button
                                onClick={finishEditing}
                                className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <p className={`text-lg font-medium ${todo.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                {todo.text}
                              </p>
                              <button
                                onClick={() => startEditing(todo.id, todo.text)}
                                className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                title="編集"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                          )}
                          <p className="text-sm text-gray-500 mt-1">
                            {todo.createdAt.toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>

                        {/* 優先度とアクション */}
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${priorityStyle.color}`}>
                            <span className="flex items-center gap-1">
                              <span>{priorityStyle.icon}</span>
                              <span>{priorityStyle.label}</span>
                            </span>
                          </span>
                          <button
                            onClick={() => deleteTodo(todo.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110"
                            title="削除"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 統計情報 */}
            {todos.length > 0 && (
              <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">📊 タスク統計</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="text-center bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                    <div className="text-3xl font-bold text-gray-800 mb-2">{todos.length}</div>
                    <div className="text-sm text-gray-600 font-medium">総タスク数</div>
                    <div className="text-xs text-gray-500 mt-1">📋 すべてのタスク</div>
                  </div>
                  <div className="text-center bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                    <div className="text-3xl font-bold text-blue-600 mb-2">{todos.filter(t => !t.completed).length}</div>
                    <div className="text-sm text-gray-600 font-medium">未完了</div>
                    <div className="text-xs text-gray-500 mt-1">⏳ 進行中</div>
                  </div>
                  <div className="text-center bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                    <div className="text-3xl font-bold text-green-600 mb-2">{todos.filter(t => t.completed).length}</div>
                    <div className="text-sm text-gray-600 font-medium">完了済み</div>
                    <div className="text-xs text-gray-500 mt-1">✅ 達成済み</div>
                  </div>
                </div>
                
                {/* 進捗バー */}
                {todos.length > 0 && (
                  <div className="mt-6">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>進捗率</span>
                      <span>{Math.round((todos.filter(t => t.completed).length / todos.length) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${(todos.filter(t => t.completed).length / todos.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
