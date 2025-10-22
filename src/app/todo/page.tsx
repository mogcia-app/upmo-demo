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

  // TODOを編集
  const editTodo = (id: string, newText: string) => {
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { ...todo, text: newText } : todo
    );
    setTodos(updatedTodos);
    saveTodos(updatedTodos);
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

  // 優先度に応じた色を取得
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  // 優先度の日本語表示
  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return '中';
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">TODOリスト</h1>
            <p className="text-gray-600">タスクを管理して、効率的に作業を進めましょう</p>
          </div>

          {/* TODO追加フォーム */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex gap-4">
              <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                placeholder="新しいタスクを入力..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">優先度: 低</option>
                <option value="medium">優先度: 中</option>
                <option value="high">優先度: 高</option>
              </select>
              <button
                onClick={addTodo}
                disabled={!newTodo.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                追加
              </button>
            </div>
          </div>

          {/* フィルターボタン */}
          <div className="flex gap-2 mb-6">
            {(['all', 'active', 'completed'] as const).map((filterType) => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filter === filterType
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {filterType === 'all' && 'すべて'}
                {filterType === 'active' && '未完了'}
                {filterType === 'completed' && '完了済み'}
              </button>
            ))}
          </div>

          {/* TODOリスト */}
          <div className="space-y-3">
            {filteredTodos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">📝</div>
                <p className="text-lg">
                  {filter === 'all' && 'まだタスクがありません'}
                  {filter === 'active' && '未完了のタスクがありません'}
                  {filter === 'completed' && '完了済みのタスクがありません'}
                </p>
              </div>
            ) : (
              filteredTodos.map((todo) => (
                <div
                  key={todo.id}
                  className={`bg-white rounded-lg shadow-md p-4 transition-all duration-200 ${
                    todo.completed ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className={`text-lg ${todo.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {todo.text}
                      </p>
                      <p className="text-sm text-gray-500">
                        {todo.createdAt.toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(todo.priority)}`}>
                        {getPriorityLabel(todo.priority)}
                      </span>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="削除"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 統計情報 */}
          {todos.length > 0 && (
            <div className="mt-8 bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{todos.length}</p>
                  <p className="text-sm text-gray-600">総タスク数</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{todos.filter(t => !t.completed).length}</p>
                  <p className="text-sm text-gray-600">未完了</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{todos.filter(t => t.completed).length}</p>
                  <p className="text-sm text-gray-600">完了済み</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
