'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

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
  userId: string;
  sharedWith?: string[]; // 共有先のユーザーIDの配列
}

interface TeamMember {
  id: string;
  displayName: string;
  email: string;
}

export default function TodoPage() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [status, setStatus] = useState<'shared' | 'todo' | 'in-progress'>('todo');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'gantt'>('board');
  const [sharingTodoId, setSharingTodoId] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<TeamMember[]>([]); // 全ユーザー情報（ID、名前、メール）
  const [aiMessage, setAiMessage] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'ai'; content: string }>>([]);
  const [isAILoading, setIsAILoading] = useState(false);

  // チームメンバーと全ユーザー情報を取得
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!user) return;
      
      try {
        // 認証トークンを取得
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          // 全ユーザー情報を保存（TODOのユーザー情報表示用）
          const allUsersData = data.users.map((u: any) => ({
            id: u.id,
            displayName: u.displayName,
            email: u.email
          }));
          setAllUsers(allUsersData);
          
          // 自分以外のユーザー（role: 'user'）をチームメンバーとして取得
          const members = data.users
            .filter((u: any) => u.id !== user.uid && u.role === 'user')
            .map((u: any) => ({
              id: u.id,
              displayName: u.displayName,
              email: u.email
            }));
          setTeamMembers(members);
        }
      } catch (error) {
        console.error('チームメンバーの読み込みエラー:', error);
      }
    };

    loadTeamMembers();
  }, [user]);

  // FirestoreからTODOを読み込み（自分のTODO + 共有されたTODO）
  useEffect(() => {
    const loadTodos = async () => {
      if (!user) return;
      
      try {
        // 自分のTODOを取得
        const myTodosQuery = query(
          collection(db, 'todos'),
          where('userId', '==', user.uid)
        );
        const myTodosSnapshot = await getDocs(myTodosQuery);
        
        // 共有されたTODOを取得
        const sharedTodosQuery = query(
          collection(db, 'todos'),
          where('sharedWith', 'array-contains', user.uid)
        );
        const sharedTodosSnapshot = await getDocs(sharedTodosQuery);
        
        // 両方の結果をマージ
        const allDocs = [...myTodosSnapshot.docs, ...sharedTodosSnapshot.docs];
        
        // 重複を除去（同じIDのTODOが複数ある場合）
        const uniqueDocs = Array.from(
          new Map(allDocs.map(doc => [doc.id, doc])).values()
        );
        
        // クライアント側でソート
        const loadedTodos = uniqueDocs
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              text: data.text,
              completed: data.completed || false,
              createdAt: data.createdAt?.toDate() || new Date(),
              priority: data.priority || 'medium',
              status: data.status || 'todo',
              assignee: data.assignee,
              dueDate: data.dueDate?.toDate(),
              tags: data.tags || [],
              description: data.description || '',
              userId: data.userId,
              sharedWith: data.sharedWith || []
            } as TodoItem;
          })
          .sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
            const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
            return dateB.getTime() - dateA.getTime();
          });
        
        setTodos(loadedTodos);
      } catch (error: any) {
        console.error('Error loading todos:', error);
        // ネットワークエラーの場合は詳細をログに記録
        if (error?.code === 'unavailable' || error?.message?.includes('network')) {
          console.warn('Firestore network error - operating in offline mode');
        }
        // エラー時は空配列を設定（オフラインモードで動作）
        setTodos([]);
      }
    };

    loadTodos();
  }, [user]);

  // 新しいTODOを追加
  const addTodo = async () => {
    if (newTodo.trim() && user) {
      try {
        const todoData = {
          userId: user.uid,
          text: newTodo.trim(),
          completed: false,
          createdAt: new Date(),
          priority,
          status,
          assignee: user.displayName || user.email || 'Unknown',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1週間後
          tags: [priority === 'high' ? '優先度:高' : priority === 'medium' ? '優先度:中' : '優先度:低'],
          description: '',
          sharedWith: [] // 初期状態では共有なし
        };

        const docRef = await addDoc(collection(db, 'todos'), todoData);
        const newTodoItem: TodoItem = {
          id: docRef.id,
          ...todoData,
          sharedWith: []
        };
        
        const updatedTodos = [newTodoItem, ...todos];
        setTodos(updatedTodos);
        setNewTodo('');
        setShowAddForm(false);
      } catch (error) {
        console.error('Error adding todo:', error);
        alert('タスクの追加に失敗しました。');
      }
    }
  };

  // TODOのステータスを変更
  const changeStatus = async (id: string, newStatus: 'shared' | 'todo' | 'in-progress') => {
    try {
      await updateDoc(doc(db, 'todos', id), {
        status: newStatus
      });
      
      const updatedTodos = todos.map(todo =>
        todo.id === id ? { ...todo, status: newStatus } : todo
      );
      setTodos(updatedTodos);
    } catch (error) {
      console.error('Error updating todo status:', error);
      alert('ステータスの更新に失敗しました。');
    }
  };

  // TODOを削除
  const deleteTodo = async (id: string) => {
    if (!confirm('このタスクを削除しますか？')) return;
    
    try {
      await deleteDoc(doc(db, 'todos', id));
      const updatedTodos = todos.filter(todo => todo.id !== id);
      setTodos(updatedTodos);
    } catch (error) {
      console.error('Error deleting todo:', error);
      alert('タスクの削除に失敗しました。');
    }
  };

  // TODOを編集開始
  const startEditing = (id: string, text: string) => {
    setEditingId(id);
    setEditingText(text);
  };

  // TODOを編集完了
  const finishEditing = async () => {
    if (editingId && editingText.trim()) {
      try {
        await updateDoc(doc(db, 'todos', editingId), {
          text: editingText.trim()
        });
        
        const updatedTodos = todos.map(todo =>
          todo.id === editingId ? { ...todo, text: editingText.trim() } : todo
        );
        setTodos(updatedTodos);
      } catch (error) {
        console.error('Error updating todo:', error);
        alert('タスクの更新に失敗しました。');
      }
    }
    setEditingId(null);
    setEditingText('');
  };

  // TODOを編集キャンセル
  const cancelEditing = () => {
    setEditingId(null);
    setEditingText('');
  };

  // TODOを共有
  const shareTodo = async (todoId: string) => {
    if (!user) return;
    
    try {
      await updateDoc(doc(db, 'todos', todoId), {
        sharedWith: selectedMembers
      });
      
      const updatedTodos = todos.map(todo =>
        todo.id === todoId ? { ...todo, sharedWith: selectedMembers } : todo
      );
      setTodos(updatedTodos);
      setSharingTodoId(null);
      setSelectedMembers([]);
      alert('タスクを共有しました。');
    } catch (error) {
      console.error('Error sharing todo:', error);
      alert('タスクの共有に失敗しました。');
    }
  };

  // 共有モーダルを開く
  const openShareModal = (todoId: string) => {
    const todo = todos.find(t => t.id === todoId);
    if (todo) {
      setSelectedMembers(todo.sharedWith || []);
      setSharingTodoId(todoId);
    }
  };

  // AIチャットでTODOを作成
  const handleAISubmit = async () => {
    if (!aiMessage.trim() || !user || isAILoading) return;

    const userMessage = aiMessage.trim();
    setAiMessage('');
    setAiMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsAILoading(true);

    try {
      const response = await fetch('/api/todo/create-from-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();

      if (data.error) {
        setAiMessages(prev => [...prev, { role: 'ai', content: data.error }]);
        setIsAILoading(false);
        return;
      }

      // AIの返答を表示
      const aiResponse = data.message || 'TODOを作成しました。';
      setAiMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);

      // TODOを作成
      if (data.todos && data.todos.length > 0) {
        for (const todoData of data.todos) {
          const dueDate = todoData.dueDate 
            ? new Date(todoData.dueDate) 
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // デフォルトは1週間後

          const todoItem = {
            userId: user.uid,
            text: todoData.text,
            completed: false,
            createdAt: new Date(),
            priority: todoData.priority || 'medium',
            status: todoData.status || 'todo',
            assignee: user.displayName || user.email || 'Unknown',
            dueDate: dueDate,
            tags: [todoData.priority === 'high' ? '優先度:高' : todoData.priority === 'medium' ? '優先度:中' : '優先度:低'],
            description: todoData.description || '',
            sharedWith: []
          };

          const docRef = await addDoc(collection(db, 'todos'), todoItem);
          const newTodoItem: TodoItem = {
            id: docRef.id,
            ...todoItem
          };
          setTodos(prev => [newTodoItem, ...prev]);
        }
      }
    } catch (error) {
      console.error('AI TODO作成エラー:', error);
      setAiMessages(prev => [...prev, { role: 'ai', content: 'エラーが発生しました。もう一度お試しください。' }]);
    } finally {
      setIsAILoading(false);
    }
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

  // ガントチャート用のデータを生成（Firestoreから取得したTODOデータを使用）
  const getGanttData = () => {
    return todos.map(todo => {
      // 開始日は作成日
      const startDate = todo.createdAt instanceof Date ? todo.createdAt : new Date(todo.createdAt);
      
      // 終了日は期限日、なければ作成日から7日後
      const endDate = todo.dueDate 
        ? (todo.dueDate instanceof Date ? todo.dueDate : new Date(todo.dueDate))
        : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      // 進捗率をステータスから計算
      let progress = 0;
      if (todo.status === 'shared') {
        progress = 0;
      } else if (todo.status === 'todo') {
        progress = 0;
      } else if (todo.status === 'in-progress') {
        progress = 50;
      } else if (todo.completed) {
        progress = 100;
      }

      return {
        ...todo,
        startDate,
        endDate,
        progress
      };
    });
  };

  // ガントチャートコンポーネント
  const GanttChart = () => {
    const ganttData = getGanttData();
    const today = new Date();
    
    // データがある場合は、開始日と終了日を動的に計算
    let startDate = new Date(today);
    let endDate = new Date(today);
    
    if (ganttData.length > 0) {
      // すべてのタスクの開始日と終了日から範囲を計算
      const allStartDates = ganttData.map(task => task.startDate.getTime());
      const allEndDates = ganttData.map(task => task.endDate.getTime());
      const minStartDate = Math.min(...allStartDates);
      const maxEndDate = Math.max(...allEndDates);
      
      startDate = new Date(minStartDate);
      startDate.setDate(startDate.getDate() - 7); // 1週間前から表示
      endDate = new Date(maxEndDate);
      endDate.setDate(endDate.getDate() + 7); // 1週間後まで表示
    } else {
      // データがない場合はデフォルト範囲
      startDate.setDate(startDate.getDate() - 14);
      endDate.setDate(endDate.getDate() + 21);
    }
    
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
            {today >= startDate && today <= endDate && (
              <div
                className="absolute w-0.5 bg-red-500 z-10 pointer-events-none"
                style={{
                  left: `${getDatePosition(today)}px`,
                  top: '0',
                  height: `${Math.max(ganttData.length * 100 + 40, 200)}px`
                }}
              >
                <div className="absolute -top-6 -left-8 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  今日
                </div>
              </div>
            )}

            {ganttData.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-sm">ガントチャートに表示するTODOがありません</p>
                <p className="text-xs mt-2">TODOを作成すると、ここに表示されます</p>
              </div>
            ) : (
              ganttData.map((task, index) => {
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
                      {(() => {
                        const creator = allUsers.find(u => u.id === task.userId);
                        const isShared = task.userId !== user?.uid;
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {creator?.displayName || task.assignee || 'Unknown'}
                            </span>
                            {isShared && (
                              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                共有
                              </span>
                            )}
                          </div>
                        );
                      })()}
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
              })
            )}
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
    const isOwner = todo.userId === user?.uid;
    const isSharedWithMe = todo.sharedWith && todo.sharedWith.includes(user?.uid || '');
    const isShared = todo.sharedWith && todo.sharedWith.length > 0;
    
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
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 text-sm leading-tight">
                #{todo.id.slice(-2)} {todo.text}
              </h3>
              {!isOwner && (
                <p className="text-xs text-gray-500 mt-1">
                  共有されたタスク
                </p>
              )}
              {isShared && (
                <div className="flex items-center gap-1 mt-1">
                  <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-xs text-blue-600">
                    {todo.sharedWith?.length}人と共有中
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-1">
              {isOwner && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openShareModal(todo.id);
                  }}
                  className="p-1 text-gray-400 hover:text-green-500 transition-colors"
                  title="共有"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
              )}
              {(isOwner || isSharedWithMe) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(todo.id, todo.text);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                  title="編集"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {isOwner && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(todo.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="削除"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
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
            {/* 作成者 */}
            {(() => {
              const creator = allUsers.find(u => u.id === todo.userId);
              return (
                <div
                  className="w-6 h-6 bg-blue-500 rounded-full border border-white flex items-center justify-center text-white text-xs font-medium"
                  title={creator?.displayName || todo.assignee || '作成者'}
                >
                  {creator?.displayName?.charAt(0).toUpperCase() || todo.assignee?.charAt(0).toUpperCase() || 'U'}
                </div>
              );
            })()}
            {/* 共有先のユーザー */}
            {todo.sharedWith && todo.sharedWith.length > 0 && todo.sharedWith.slice(0, 2).map((sharedUserId, index) => {
              const sharedUser = allUsers.find(u => u.id === sharedUserId);
              const colors = ['bg-green-500', 'bg-purple-500', 'bg-pink-500'];
              if (!sharedUser) return null;
              return (
                <div
                  key={sharedUserId}
                  className={`w-6 h-6 ${colors[index % colors.length]} rounded-full border border-white flex items-center justify-center text-white text-xs font-medium`}
                  title={sharedUser.displayName}
                >
                  {sharedUser.displayName.charAt(0).toUpperCase()}
                </div>
              );
            })}
            {todo.sharedWith && todo.sharedWith.length > 2 && (
              <div className="w-6 h-6 bg-gray-400 rounded-full border border-white flex items-center justify-center text-white text-xs font-medium">
                +{todo.sharedWith.length - 2}
              </div>
            )}
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
                <h1 className="text-2xl font-bold text-gray-900">TODOリスト</h1>
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
                {/* チームメンバーアバター */}
                <div className="flex -space-x-2">
                  {teamMembers.slice(0, 3).map((member, index) => {
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500'];
                    return (
                      <div
                        key={member.id}
                        className={`w-8 h-8 ${colors[index % colors.length]} rounded-full border-2 border-white flex items-center justify-center text-white text-sm font-medium`}
                        title={member.displayName}
                      >
                        {member.displayName.charAt(0).toUpperCase()}
                      </div>
                    );
                  })}
                  {teamMembers.length > 3 && (
                    <div className="w-8 h-8 bg-gray-400 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium">
                      +{teamMembers.length - 3}
                    </div>
                  )}
                  {teamMembers.length === 0 && (
                    <div className="w-8 h-8 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* AI検索バー */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAISubmit();
                    }
                  }}
                  placeholder="自然言語でTODOを作成...（例：来週の月曜日までにレポートを提出する）"
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={isAILoading}
                />
                <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <button
                onClick={handleAISubmit}
                disabled={!aiMessage.trim() || isAILoading}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
              >
                {isAILoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>作成中...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>AIに聞く</span>
                  </>
                )}
              </button>
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

          {/* AI結果表示（成功時のみ） */}
          {aiMessages.length > 0 && aiMessages[aiMessages.length - 1].role === 'ai' && (
            <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-md z-50 animate-slide-up">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="font-semibold text-gray-900">TODOを作成しました</h4>
                </div>
                <button
                  onClick={() => setAiMessages([])}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-sm text-gray-600">
                <p className="whitespace-pre-wrap">{aiMessages[aiMessages.length - 1].content}</p>
              </div>
            </div>
          )}

          {/* 共有モーダル */}
          {sharingTodoId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">タスクを共有</h3>
                  <button
                    onClick={() => {
                      setSharingTodoId(null);
                      setSelectedMembers([]);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">共有するチームメンバーを選択してください</p>
                  {teamMembers.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">チームメンバーがいません</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {teamMembers.map((member) => (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(member.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMembers([...selectedMembers, member.id]);
                              } else {
                                setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{member.displayName}</div>
                            <div className="text-sm text-gray-500">{member.email}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => shareTodo(sharingTodoId)}
                      disabled={selectedMembers.length === 0}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      共有
                    </button>
                    <button
                      onClick={() => {
                        setSharingTodoId(null);
                        setSelectedMembers([]);
                      }}
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
