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
  status: 'shared' | 'todo' | 'in-progress';
  assignee?: string;
  dueDate?: Date;
  tags?: string[];
  description?: string;
}

export default function TodoPage() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [status, setStatus] = useState<'shared' | 'todo' | 'in-progress'>('todo');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'gantt'>('board');

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
        priority,
        status,
        assignee: user.displayName || user.email || 'Unknown',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1週間後
        tags: [priority === 'high' ? '優先度:高' : priority === 'medium' ? '優先度:中' : '優先度:低'],
        description: ''
      };
      const updatedTodos = [...todos, todo];
      setTodos(updatedTodos);
      saveTodos(updatedTodos);
      setNewTodo('');
      setShowAddForm(false);
    }
  };

  // TODOのステータスを変更
  const changeStatus = (id: string, newStatus: 'shared' | 'todo' | 'in-progress') => {
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { ...todo, status: newStatus } : todo
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

  // ステータス別にTODOを分類
  const getTodosByStatus = (status: 'shared' | 'todo' | 'in-progress') => {
    return todos.filter(todo => todo.status === status);
  };

  // タグの色を取得
  const getTagColor = (tag: string) => {
    if (tag.includes('優先度:高')) return 'bg-red-100 text-red-700';
    if (tag.includes('優先度:中')) return 'bg-yellow-100 text-yellow-700';
    if (tag.includes('優先度:低')) return 'bg-green-100 text-green-700';
    if (tag.includes('開発')) return 'bg-pink-100 text-pink-700';
    if (tag.includes('情報')) return 'bg-blue-100 text-blue-700';
    if (tag.includes('メモ')) return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
  };

  // ステータス別の色とアイコンを取得
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'shared':
        return {
          color: 'bg-blue-500',
          text: '共有事項',
          icon: '📋'
        };
      case 'todo':
        return {
          color: 'bg-green-500',
          text: 'ToDoリスト',
          icon: '📝'
        };
      case 'in-progress':
        return {
          color: 'bg-pink-500',
          text: '進行中',
          icon: '🚀'
        };
      default:
        return {
          color: 'bg-gray-500',
          text: '未分類',
          icon: '❓'
        };
    }
  };

  // ガントチャート用のデモデータを生成
  const getGanttData = () => {
    const now = new Date();
    const ganttTodos = todos.length > 0 ? todos : [
      {
        id: '1',
        text: 'プロジェクト企画',
        createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        dueDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        status: 'shared' as const,
        priority: 'high' as const,
        assignee: '田中',
        description: '新規プロジェクトの企画と要件定義'
      },
      {
        id: '2',
        text: 'デザイン作成',
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        status: 'in-progress' as const,
        priority: 'high' as const,
        assignee: '佐藤',
        description: 'UI/UXデザインの作成'
      },
      {
        id: '3',
        text: '開発実装',
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: 'in-progress' as const,
        priority: 'medium' as const,
        assignee: '山田',
        description: 'フロントエンド・バックエンドの実装'
      },
      {
        id: '4',
        text: 'テスト実施',
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        status: 'todo' as const,
        priority: 'medium' as const,
        assignee: '鈴木',
        description: '単体テスト・結合テストの実施'
      },
      {
        id: '5',
        text: 'リリース準備',
        createdAt: new Date(now.getTime()),
        dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        status: 'todo' as const,
        priority: 'low' as const,
        assignee: '高橋',
        description: 'リリースノート作成とデプロイ準備'
      }
    ];

    return ganttTodos.map(todo => ({
      ...todo,
      startDate: todo.createdAt,
      endDate: todo.dueDate || new Date(todo.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
      progress: todo.status === 'shared' ? 0 : todo.status === 'todo' ? 0 : todo.status === 'in-progress' ? 50 : 100
    }));
  };

  // ガントチャートコンポーネント
  const GanttChart = () => {
    const ganttData = getGanttData();
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 14);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 21);
    
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dayWidth = 40; // 1日の幅（px）

    const getDatePosition = (date: Date) => {
      const diffDays = Math.ceil((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays * dayWidth;
    };

    const getTaskWidth = (task: any) => {
      const duration = Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(duration * dayWidth, 100);
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'shared': return 'bg-blue-500';
        case 'todo': return 'bg-green-500';
        case 'in-progress': return 'bg-pink-500';
        default: return 'bg-gray-500';
      }
    };

    const getPriorityColor = (priority: string) => {
      switch (priority) {
        case 'high': return 'border-l-4 border-red-500';
        case 'medium': return 'border-l-4 border-yellow-500';
        case 'low': return 'border-l-4 border-green-500';
        default: return 'border-l-4 border-gray-500';
      }
    };

    // 日付ラベルの生成
    const dateLabels = [];
    for (let i = 0; i <= days; i += 7) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dateLabels.push(date);
    }

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">ガントチャート</h2>
          <div className="flex gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>共有事項</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>ToDo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-pink-500 rounded"></div>
              <span>進行中</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-x-auto">
          {/* 日付ヘッダー */}
          <div className="flex border-b border-gray-200 mb-4 sticky top-0 bg-white z-20" style={{ minWidth: `${days * dayWidth}px` }}>
            {dateLabels.map((date, index) => (
              <div
                key={index}
                className="flex-shrink-0 text-xs text-gray-600 border-r border-gray-200 px-2 py-2"
                style={{ width: `${7 * dayWidth}px` }}
              >
                <div className="font-medium">{date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</div>
                <div className="text-gray-400">{date.toLocaleDateString('ja-JP', { weekday: 'short' })}</div>
              </div>
            ))}
          </div>

          {/* タスクバー */}
          <div className="relative space-y-4" style={{ minWidth: `${days * dayWidth}px` }}>
            {/* 今日のマーカー */}
            <div
              className="absolute w-0.5 bg-red-500 z-10 pointer-events-none"
              style={{
                left: `${getDatePosition(today)}px`,
                top: '0',
                height: `${ganttData.length * 100 + 40}px`
              }}
            >
              <div className="absolute -top-6 -left-8 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                今日
              </div>
            </div>

            {ganttData.map((task, index) => {
              const left = getDatePosition(task.startDate);
              const width = getTaskWidth(task);
              const isPast = task.endDate < today;
              const isCurrent = task.startDate <= today && task.endDate >= today;

              return (
                <div key={task.id} className={`relative ${getPriorityColor(task.priority)} bg-white border border-gray-200 rounded p-3 hover:shadow-md transition-shadow mb-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(task.status)}`}></div>
                      <h3 className="font-medium text-gray-900">{task.text}</h3>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{task.assignee}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {task.startDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })} - {task.endDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  
                  <div className="relative" style={{ height: '40px', background: '#f3f4f6', borderRadius: '4px', overflow: 'visible' }}>
                    {/* タスクバー */}
                    <div
                      className={`absolute top-0 h-full ${getStatusColor(task.status)} rounded flex items-center justify-center text-white text-xs font-medium shadow-sm`}
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        opacity: isPast ? 0.6 : isCurrent ? 1 : 0.8,
                        minWidth: '80px'
                      }}
                    >
                      {task.progress > 0 && (
                        <div className="absolute inset-0 bg-black bg-opacity-20 rounded" style={{ width: `${task.progress}%` }}></div>
                      )}
                      <span className="relative z-10 px-2 truncate font-medium">{task.text}</span>
                    </div>
                  </div>
                  
                  {task.description && (
                    <p className="text-xs text-gray-600 mt-3">{task.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // TaskCardコンポーネント
  const TaskCard = ({ todo, index, onEdit, onDelete, onStatusChange }: {
    todo: TodoItem;
    index: number;
    onEdit: (id: string, text: string) => void;
    onDelete: (id: string) => void;
    onStatusChange: (id: string, status: 'shared' | 'todo' | 'in-progress') => void;
  }) => {
    const isEditing = editingId === todo.id;
    
    return (
      <div
        className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
        style={{
          animationDelay: `${index * 100}ms`,
          animation: 'fadeInUp 0.5s ease-out forwards'
        }}
      >
        <div className="space-y-3">
          {/* タスクタイトル */}
          <div className="flex items-start justify-between">
            <h3 className="font-medium text-gray-900 text-sm leading-tight">
              #{todo.id.slice(-2)} {todo.text}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => onEdit(todo.id, todo.text)}
                className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                title="編集"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(todo.id)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                title="削除"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* 説明文 */}
          {todo.description && (
            <p className="text-xs text-gray-600 leading-relaxed">
              {todo.description}
            </p>
          )}

          {/* 担当者アバター */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded-full border border-white flex items-center justify-center text-white text-xs font-medium">
              {todo.assignee?.charAt(0) || 'U'}
            </div>
            <div className="w-6 h-6 bg-green-500 rounded-full border border-white flex items-center justify-center text-white text-xs font-medium">
              M
            </div>
            <div className="w-6 h-6 bg-purple-500 rounded-full border border-white flex items-center justify-center text-white text-xs font-medium">
              O
            </div>
          </div>

          {/* 日付とタグ */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {todo.createdAt.toLocaleDateString('ja-JP', {
                month: '2-digit',
                day: '2-digit'
              })} - {todo.dueDate?.toLocaleDateString('ja-JP', {
                month: '2-digit',
                day: '2-digit'
              })}
            </div>
            <div className="flex gap-1">
              {todo.tags?.map((tag, tagIndex) => (
                <span
                  key={tagIndex}
                  className={`px-2 py-1 rounded text-xs font-medium ${getTagColor(tag)}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* ステータス変更ボタン */}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            {(['shared', 'todo', 'in-progress'] as const).map((status) => {
              const statusStyle = getStatusStyle(status);
              return (
                <button
                  key={status}
                  onClick={() => onStatusChange(todo.id, status)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    todo.status === status
                      ? `${statusStyle.color} text-white`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {statusStyle.icon} {statusStyle.text}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gray-50">
          {/* ヘッダー */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Upmo</h1>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('board')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      viewMode === 'board'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    ボード
                  </button>
                  <button
                    onClick={() => setViewMode('gantt')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      viewMode === 'gantt'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    ガントチャート
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-white text-sm font-medium">
                    U
                  </div>
                  <div className="w-8 h-8 bg-green-500 rounded-full border-2 border-white flex items-center justify-center text-white text-sm font-medium">
                    M
                  </div>
                  <div className="w-8 h-8 bg-purple-500 rounded-full border-2 border-white flex items-center justify-center text-white text-sm font-medium">
                    O
                  </div>
                </div>
                <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 1 0-15 0v5h5l-5 5-5-5h5v-5a7.5 7.5 0 1 1 15 0v5z" />
                  </svg>
                </button>
                <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* カンバンボードまたはガントチャート */}
          <div className="p-4 sm:p-6">
            {viewMode === 'gantt' ? (
              <GanttChart />
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* 共有事項 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <h2 className="text-sm sm:text-base font-semibold text-gray-900">共有事項 {getTodosByStatus('shared').length}</h2>
                  </div>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-xs sm:text-sm"
                  >
                    + タスクを追加
                  </button>
                </div>
                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-[300px] sm:min-h-[400px]">
                  {getTodosByStatus('shared').map((todo, index) => (
                    <TaskCard key={todo.id} todo={todo} index={index} onEdit={startEditing} onDelete={deleteTodo} onStatusChange={changeStatus} />
                  ))}
                  {getTodosByStatus('shared').length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">📋</div>
                      <p className="text-sm">共有事項がありません</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ToDoリスト */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <h2 className="text-sm sm:text-base font-semibold text-gray-900">ToDoリスト {getTodosByStatus('todo').length}</h2>
                  </div>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="text-green-600 hover:text-green-700 font-medium text-xs sm:text-sm"
                  >
                    + タスクを追加
                  </button>
                </div>
                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-[300px] sm:min-h-[400px]">
                  {getTodosByStatus('todo').map((todo, index) => (
                    <TaskCard key={todo.id} todo={todo} index={index} onEdit={startEditing} onDelete={deleteTodo} onStatusChange={changeStatus} />
                  ))}
                  {getTodosByStatus('todo').length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">📝</div>
                      <p className="text-sm">ToDoがありません</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 進行中 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
                    <h2 className="text-sm sm:text-base font-semibold text-gray-900">進行中 {getTodosByStatus('in-progress').length}</h2>
                  </div>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="text-pink-600 hover:text-pink-700 font-medium text-xs sm:text-sm"
                  >
                    + タスクを追加
                  </button>
                </div>
                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-[300px] sm:min-h-[400px]">
                  {getTodosByStatus('in-progress').map((todo, index) => (
                    <TaskCard key={todo.id} todo={todo} index={index} onEdit={startEditing} onDelete={deleteTodo} onStatusChange={changeStatus} />
                  ))}
                  {getTodosByStatus('in-progress').length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">🚀</div>
                      <p className="text-sm">進行中のタスクがありません</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}
          </div>

          {/* タスク追加フォーム */}
          {showAddForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <h3 className="text-lg font-semibold mb-4">新しいタスクを追加</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    placeholder="タスクのタイトルを入力..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'shared' | 'todo' | 'in-progress')}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="shared">共有事項</option>
                      <option value="todo">ToDoリスト</option>
                      <option value="in-progress">進行中</option>
                    </select>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">優先度: 低</option>
                      <option value="medium">優先度: 中</option>
                      <option value="high">優先度: 高</option>
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={addTodo}
                      disabled={!newTodo.trim()}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      追加
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
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
