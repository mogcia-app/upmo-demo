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
  startDate?: Date;
  tags?: string[];
  description?: string;
  userId: string;
  sharedWith?: string[]; // 共有先のユーザーIDの配列
  completionMemo?: string; // 完了時のメモ
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
  const [newTodoAssignee, setNewTodoAssignee] = useState('');
  const [newTodoDescription, setNewTodoDescription] = useState('');
  const [hasPeriod, setHasPeriod] = useState(false);
  const [newTodoStartDate, setNewTodoStartDate] = useState('');
  const [newTodoEndDate, setNewTodoEndDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [status, setStatus] = useState<'shared' | 'todo' | 'in-progress'>('todo');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [sharingTodoId, setSharingTodoId] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<TeamMember[]>([]); // 全ユーザー情報（ID、名前、メール）
  const [aiMessage, setAiMessage] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'ai'; content: string }>>([]);
  const [isAILoading, setIsAILoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date()); // 選択中の月
  const [showCompletionMemoModal, setShowCompletionMemoModal] = useState(false);
  const [completingTodoId, setCompletingTodoId] = useState<string | null>(null);
  const [completionMemo, setCompletionMemo] = useState('');

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
          // 現在のユーザーのcompanyNameを取得
          const currentUser = data.users.find((u: any) => u.id === user.uid);
          const currentCompanyName = currentUser?.companyName || '';
          
          // 全ユーザー情報を保存（TODOのユーザー情報表示用）- 同じcompanyNameのユーザーのみ
          const allUsersData = data.users
            .filter((u: any) => u.companyName === currentCompanyName)
            .map((u: any) => ({
              id: u.id,
              displayName: u.displayName,
              email: u.email
            }));
          setAllUsers(allUsersData);
          
          // 自分以外のユーザー（role: 'user' かつ同じcompanyName）をチームメンバーとして取得
          const members = data.users
            .filter((u: any) => 
              u.id !== user.uid && 
              u.role === 'user' && 
              u.companyName === currentCompanyName
            )
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
              startDate: data.startDate?.toDate(),
              tags: data.tags || [],
              description: data.description || '',
              userId: data.userId,
              sharedWith: data.sharedWith || [],
              completionMemo: data.completionMemo || undefined
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
        const todoData: any = {
          userId: user.uid,
          text: newTodo.trim(),
          completed: false,
          createdAt: new Date(),
          priority,
          status,
          assignee: newTodoAssignee || user.displayName || user.email || 'Unknown',
          description: newTodoDescription || '',
          sharedWith: [] // 初期状態では共有なし
        };

        // 期間がある場合のみ日付を設定
        if (hasPeriod) {
          if (newTodoStartDate) {
            todoData.startDate = new Date(newTodoStartDate);
          }
          if (newTodoEndDate) {
            todoData.dueDate = new Date(newTodoEndDate);
          }
        }

        const docRef = await addDoc(collection(db, 'todos'), todoData);
        const newTodoItem: TodoItem = {
          id: docRef.id,
          ...todoData,
          sharedWith: []
        };
        
        const updatedTodos = [newTodoItem, ...todos];
        setTodos(updatedTodos);
        setNewTodo('');
        setNewTodoAssignee('');
        setNewTodoDescription('');
        setHasPeriod(false);
        setNewTodoStartDate('');
        setNewTodoEndDate('');
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        setAiMessages(prev => [...prev, { role: 'ai', content: 'エラーが発生しました。もう一度お試しください。' }]);
        setIsAILoading(false);
        return;
      }

      const data = await response.json();
      console.log('AI Response Data:', data);

      if (data.error) {
        setAiMessages(prev => [...prev, { role: 'ai', content: data.error }]);
        setIsAILoading(false);
        return;
      }

      // AIの返答を表示
      const aiResponse = data.message || 'TODOを作成しました。';
      setAiMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);

      // TODOを作成
      if (data.todos && Array.isArray(data.todos) && data.todos.length > 0) {
        console.log('Creating TODOs from AI response:', data.todos);
        for (const todoData of data.todos) {
          if (!todoData.text || !todoData.text.trim()) {
            console.warn('Skipping todo with empty text:', todoData);
            continue;
          }

          const todoItem: any = {
            userId: user.uid,
            text: todoData.text.trim(),
            completed: false,
            createdAt: new Date(),
            priority: todoData.priority || 'medium',
            status: todoData.status || 'todo',
            assignee: todoData.assignee || user.uid,
            description: (todoData.description || '') + (todoData.description ? ' ' : '') + '[AI生成]',
            sharedWith: []
          };

          // 期間がある場合のみ日付を設定
          if (todoData.startDate) {
            todoItem.startDate = new Date(todoData.startDate);
          }
          if (todoData.dueDate) {
            todoItem.dueDate = new Date(todoData.dueDate);
          }

          const docRef = await addDoc(collection(db, 'todos'), todoItem);
          const newTodoItem: TodoItem = {
            id: docRef.id,
            ...todoItem
          };
          setTodos(prev => [newTodoItem, ...prev]);
        }
      } else {
        console.warn('No todos found in AI response:', data);
        setAiMessages(prev => [...prev, { role: 'ai', content: 'TODOを抽出できませんでした。もう少し具体的に記述してください。' }]);
      }
    } catch (error) {
      console.error('AI TODO作成エラー:', error);
      setAiMessages(prev => [...prev, { role: 'ai', content: 'エラーが発生しました。もう一度お試しください。' }]);
    } finally {
      setIsAILoading(false);
    }
  };

  // 選択した月のTODOをフィルタリング
  const getFilteredTodos = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    
    return todos.filter(todo => {
      const todoDate = todo.createdAt instanceof Date ? todo.createdAt : new Date(todo.createdAt);
      return todoDate >= startDate && todoDate <= endDate;
    });
  };

  // ステータス別にTODOを分類
  const getTodosByStatus = (status: 'shared' | 'todo' | 'in-progress') => {
    const filtered = getFilteredTodos();
    return filtered.filter(todo => todo.status === status && !todo.completed);
  };

  // 完了したTODOを取得
  const getCompletedTodos = () => {
    const filtered = getFilteredTodos();
    return filtered.filter(todo => todo.completed);
  };

  // 月を変更
  const changeMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  // 現在の月に戻る
  const goToCurrentMonth = () => {
    setSelectedMonth(new Date());
  };

  // TODOの完了状態を切り替え
  const toggleComplete = async (id: string) => {
    try {
      const todo = todos.find(t => t.id === id);
      if (!todo) return;

      // 未完了から完了にする場合、メモ入力モーダルを表示
      if (!todo.completed) {
        setCompletingTodoId(id);
        setCompletionMemo('');
        setShowCompletionMemoModal(true);
        return;
      }

      // 完了から未完了に戻す場合
      await updateDoc(doc(db, 'todos', id), {
        completed: false,
        completionMemo: null
      });
      
      const updatedTodos = todos.map(t =>
        t.id === id ? { ...t, completed: false, completionMemo: undefined } : t
      );
      setTodos(updatedTodos);
    } catch (error) {
      console.error('Error toggling todo completion:', error);
      alert('完了状態の更新に失敗しました。');
    }
  };

  // 完了メモを保存
  const saveCompletionMemo = async () => {
    if (!completingTodoId) return;

    try {
      await updateDoc(doc(db, 'todos', completingTodoId), {
        completed: true,
        completionMemo: completionMemo.trim() || null
      });
      
      const updatedTodos = todos.map(t =>
        t.id === completingTodoId 
          ? { ...t, completed: true, completionMemo: completionMemo.trim() || undefined } 
          : t
      );
      setTodos(updatedTodos);
      
      setShowCompletionMemoModal(false);
      setCompletingTodoId(null);
      setCompletionMemo('');
    } catch (error) {
      console.error('Error saving completion memo:', error);
      alert('完了メモの保存に失敗しました。');
    }
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

  // TaskCardコンポーネント
  const TaskCard = ({ todo, index, onEdit, onDelete, onStatusChange, onToggleComplete }: {
    todo: TodoItem;
    index: number;
    onEdit: (id: string, text: string) => void;
    onDelete: (id: string) => void;
    onStatusChange: (id: string, status: 'shared' | 'todo' | 'in-progress') => void;
    onToggleComplete?: (id: string) => void;
  }) => {
    const isEditing = editingId === todo.id;
    const isOwner = todo.userId === user?.uid;
    const isSharedWithMe = todo.sharedWith && todo.sharedWith.includes(user?.uid || '');
    const isShared = todo.sharedWith && todo.sharedWith.length > 0;
    // 議事録から作成されたTODOの場合、担当者または同じ会社のメンバーが削除可能
    const isFromMeetingNote = todo.description?.includes('議事録');
    const isAssignee = todo.assignee === user?.uid;
    const isCompanyMember = allUsers.some(u => u.id === user?.uid);
    const canDelete = isOwner || (isFromMeetingNote && (isAssignee || isCompanyMember));
    
    return (
      <div
        className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
        style={{
          animationDelay: `${index * 100}ms`,
          animation: 'fadeInUp 0.5s ease-out forwards'
        }}
      >
        <div className="space-y-2 sm:space-y-3">
          {/* タスクタイトル */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 text-xs sm:text-sm leading-tight break-words">
                {!todo.description?.includes('議事録') && !todo.description?.includes('[AI生成]') && (
                  <span className="hidden sm:inline">#{todo.id.slice(-2)} </span>
                )}
                {todo.text}
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
            <div className="flex gap-1 flex-shrink-0">
              {isOwner && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openShareModal(todo.id);
                  }}
                  className="p-1 sm:p-1.5 text-gray-400 hover:text-green-500 transition-colors"
                  title="共有"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="p-1 sm:p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                  title="編集"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(todo.id);
                  }}
                  className="p-1 sm:p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  title="削除"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {/* 完了メモ */}
          {todo.completed && todo.completionMemo && (
            <div className="bg-green-50 border-l-4 border-green-500 p-2 sm:p-3 rounded">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex-1">
                  <p className="text-xs font-medium text-green-800 mb-1">完了メモ</p>
                  <p className="text-xs text-green-700 leading-relaxed">{todo.completionMemo}</p>
                </div>
              </div>
            </div>
          )}

          {/* 担当者アバター */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {(() => {
              // 議事録から作成されたTODOの場合は担当者のみを表示
              const isFromMeetingNote = todo.description?.includes('議事録');
              
              if (isFromMeetingNote && todo.assignee) {
                // 担当者を表示
                const assigneeUser = allUsers.find(u => u.id === todo.assignee);
                return (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-xs text-gray-500">担当者:</span>
                    <div
                      className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 rounded-full border border-white flex items-center justify-center text-white text-xs font-medium"
                      title={assigneeUser?.displayName || todo.assignee || '担当者'}
                    >
                      {assigneeUser?.displayName?.charAt(0).toUpperCase() || todo.assignee?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    {assigneeUser && (
                      <span className="text-xs text-gray-700">{assigneeUser.displayName}</span>
                    )}
                  </div>
                );
              } else {
                // 通常のTODOの場合は作成者と共有先を表示
                const creator = allUsers.find(u => u.id === todo.userId);
                return (
                  <>
                    {/* 作成者 */}
                    <div
                      className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 rounded-full border border-white flex items-center justify-center text-white text-xs font-medium"
                      title={creator?.displayName || todo.assignee || '作成者'}
                    >
                      {creator?.displayName?.charAt(0).toUpperCase() || todo.assignee?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    {/* 共有先のユーザー */}
                    {todo.sharedWith && todo.sharedWith.length > 0 && todo.sharedWith.slice(0, 2).map((sharedUserId, index) => {
                      const sharedUser = allUsers.find(u => u.id === sharedUserId);
                      const colors = ['bg-green-500', 'bg-purple-500', 'bg-pink-500'];
                      if (!sharedUser) return null;
                      return (
                        <div
                          key={sharedUserId}
                          className={`w-5 h-5 sm:w-6 sm:h-6 ${colors[index % colors.length]} rounded-full border border-white flex items-center justify-center text-white text-xs font-medium`}
                          title={sharedUser.displayName}
                        >
                          {sharedUser.displayName.charAt(0).toUpperCase()}
                        </div>
                      );
                    })}
                    {todo.sharedWith && todo.sharedWith.length > 2 && (
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-400 rounded-full border border-white flex items-center justify-center text-white text-xs font-medium">
                        +{todo.sharedWith.length - 2}
                      </div>
                    )}
                  </>
                );
              }
            })()}
          </div>

          {/* 日付とタグ */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-0">
            {(todo.startDate || todo.dueDate) && (
              <div className="text-xs text-gray-500 whitespace-nowrap">
                {todo.startDate && todo.dueDate ? (
                  <>
                    {todo.startDate.toLocaleDateString('ja-JP', {
                      month: '2-digit',
                      day: '2-digit'
                    })} - {todo.dueDate.toLocaleDateString('ja-JP', {
                      month: '2-digit',
                      day: '2-digit'
                    })}
                  </>
                ) : todo.startDate ? (
                  <>開始: {todo.startDate.toLocaleDateString('ja-JP', {
                    month: '2-digit',
                    day: '2-digit'
                  })}</>
                ) : todo.dueDate ? (
                  <>終了: {todo.dueDate.toLocaleDateString('ja-JP', {
                    month: '2-digit',
                    day: '2-digit'
                  })}</>
                ) : null}
              </div>
            )}
            <div className="flex gap-1 flex-wrap">
              {todo.tags?.map((tag, tagIndex) => (
                <span
                  key={tagIndex}
                  className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium ${getTagColor(tag)}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* ステータス変更ボタンと完了ボタン */}
          <div className="flex gap-1.5 sm:gap-2 pt-2 border-t border-gray-100 flex-wrap">
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
                  <span className="hidden sm:inline">{statusStyle.icon} </span>
                  {statusStyle.text}
                </button>
              );
            })}
            {onToggleComplete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleComplete(todo.id);
                }}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  todo.completed
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={todo.completed ? '未完了に戻す' : '完了にする'}
              >
                <span className="hidden sm:inline">✅ </span>
                完了
              </button>
            )}
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
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">TODOリスト</h1>
              </div>
              {/* 月切り替えコントロール */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeMonth('prev')}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="前月"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="month"
                    value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
                    onChange={(e) => {
                      const [year, month] = e.target.value.split('-').map(Number);
                      setSelectedMonth(new Date(year, month - 1));
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {selectedMonth.getFullYear() !== new Date().getFullYear() || selectedMonth.getMonth() !== new Date().getMonth() ? (
                    <button
                      onClick={goToCurrentMonth}
                      className="px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="今月に戻る"
                    >
                      今月
                    </button>
                  ) : null}
                </div>
                <button
                  onClick={() => changeMonth('next')}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="次月"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-4">
                {/* チームメンバーアバター */}
                <div className="flex -space-x-2">
                  {teamMembers.slice(0, 3).map((member, index) => {
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500'];
                    return (
                      <div
                        key={member.id}
                        className={`w-7 h-7 sm:w-8 sm:h-8 ${colors[index % colors.length]} rounded-full border-2 border-white flex items-center justify-center text-white text-xs sm:text-sm font-medium`}
                        title={member.displayName}
                      >
                        {member.displayName.charAt(0).toUpperCase()}
                      </div>
                    );
                  })}
                  {teamMembers.length > 3 && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-400 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium">
                      +{teamMembers.length - 3}
                    </div>
                  )}
                  {teamMembers.length === 0 && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* AI検索バー */}
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
                  placeholder="自然言語でTODOを作成..."
                  className="w-full px-4 py-3 pl-12 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isAILoading}
                />
                <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <button
                onClick={handleAISubmit}
                disabled={!aiMessage.trim() || isAILoading}
                className="px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium text-sm sm:text-base"
              >
                {isAILoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>作成中...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="hidden sm:inline">AIに聞く</span>
                    <span className="sm:hidden">作成</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* カンバンボード */}
          <div className="p-2 sm:p-4 lg:p-6">
            <div className="space-y-4 sm:space-y-6">
              {/* 共有事項 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full"></div>
                    <h2 className="text-xs sm:text-sm lg:text-base font-semibold text-gray-900">
                      <span className="hidden sm:inline">共有事項</span>
                      <span className="sm:hidden">共有</span> {getTodosByStatus('shared').length}
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-xs sm:text-sm px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    <span className="hidden sm:inline">+ タスクを追加</span>
                    <span className="sm:hidden">+</span>
                  </button>
                </div>
                <div className="p-2 sm:p-3 lg:p-4 overflow-x-auto todo-horizontal-scroll" style={{ scrollbarWidth: 'thin' }}>
                  <div className="flex gap-3 sm:gap-4 min-w-max">
                    {getTodosByStatus('shared').map((todo, index) => (
                      <div key={todo.id} className="w-[280px] sm:w-[320px] flex-shrink-0">
                        <TaskCard todo={todo} index={index} onEdit={startEditing} onDelete={deleteTodo} onStatusChange={changeStatus} onToggleComplete={toggleComplete} />
                      </div>
                    ))}
                    {getTodosByStatus('shared').length === 0 && (
                      <div className="text-center py-6 sm:py-8 text-gray-500 w-full">
                        <div className="text-3xl sm:text-4xl mb-2">📋</div>
                        <p className="text-xs sm:text-sm">共有事項がありません</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ToDoリスト */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                    <h2 className="text-xs sm:text-sm lg:text-base font-semibold text-gray-900">
                      <span className="hidden sm:inline">ToDoリスト</span>
                      <span className="sm:hidden">ToDo</span> {getTodosByStatus('todo').length}
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="text-green-600 hover:text-green-700 font-medium text-xs sm:text-sm px-2 py-1 rounded hover:bg-green-50 transition-colors"
                  >
                    <span className="hidden sm:inline">+ タスクを追加</span>
                    <span className="sm:hidden">+</span>
                  </button>
                </div>
                <div className="p-2 sm:p-3 lg:p-4 overflow-x-auto todo-horizontal-scroll" style={{ scrollbarWidth: 'thin' }}>
                  <div className="flex gap-3 sm:gap-4 min-w-max">
                    {getTodosByStatus('todo').map((todo, index) => (
                      <div key={todo.id} className="w-[280px] sm:w-[320px] flex-shrink-0">
                        <TaskCard todo={todo} index={index} onEdit={startEditing} onDelete={deleteTodo} onStatusChange={changeStatus} onToggleComplete={toggleComplete} />
                      </div>
                    ))}
                    {getTodosByStatus('todo').length === 0 && (
                      <div className="text-center py-6 sm:py-8 text-gray-500 w-full">
                        <div className="text-3xl sm:text-4xl mb-2">📝</div>
                        <p className="text-xs sm:text-sm">ToDoがありません</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 進行中 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-pink-500 rounded-full"></div>
                    <h2 className="text-xs sm:text-sm lg:text-base font-semibold text-gray-900">
                      <span className="hidden sm:inline">進行中</span>
                      <span className="sm:hidden">進行</span> {getTodosByStatus('in-progress').length}
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="text-pink-600 hover:text-pink-700 font-medium text-xs sm:text-sm px-2 py-1 rounded hover:bg-pink-50 transition-colors"
                  >
                    <span className="hidden sm:inline">+ タスクを追加</span>
                    <span className="sm:hidden">+</span>
                  </button>
                </div>
                <div className="p-2 sm:p-3 lg:p-4 overflow-x-auto todo-horizontal-scroll" style={{ scrollbarWidth: 'thin' }}>
                  <div className="flex gap-3 sm:gap-4 min-w-max">
                    {getTodosByStatus('in-progress').map((todo, index) => (
                      <div key={todo.id} className="w-[280px] sm:w-[320px] flex-shrink-0">
                        <TaskCard todo={todo} index={index} onEdit={startEditing} onDelete={deleteTodo} onStatusChange={changeStatus} onToggleComplete={toggleComplete} />
                      </div>
                    ))}
                    {getTodosByStatus('in-progress').length === 0 && (
                      <div className="text-center py-6 sm:py-8 text-gray-500 w-full">
                        <div className="text-3xl sm:text-4xl mb-2">🚀</div>
                        <p className="text-xs sm:text-sm">進行中のタスクがありません</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 完了 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-gray-500 rounded-full"></div>
                    <h2 className="text-xs sm:text-sm lg:text-base font-semibold text-gray-900">
                      <span className="hidden sm:inline">完了</span>
                      <span className="sm:hidden">完了</span> {getCompletedTodos().length}
                    </h2>
                  </div>
                </div>
                <div className="p-2 sm:p-3 lg:p-4 overflow-x-auto todo-horizontal-scroll" style={{ scrollbarWidth: 'thin' }}>
                  <div className="flex gap-3 sm:gap-4 min-w-max">
                    {getCompletedTodos().map((todo, index) => (
                      <div key={todo.id} className="w-[280px] sm:w-[320px] flex-shrink-0">
                        <TaskCard todo={todo} index={index} onEdit={startEditing} onDelete={deleteTodo} onStatusChange={changeStatus} onToggleComplete={toggleComplete} />
                      </div>
                    ))}
                    {getCompletedTodos().length === 0 && (
                      <div className="text-center py-6 sm:py-8 text-gray-500 w-full">
                        <div className="text-3xl sm:text-4xl mb-2">✅</div>
                        <p className="text-xs sm:text-sm">完了したタスクがありません</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* タスク追加フォーム */}
          {showAddForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">新しいタスクを追加</h3>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                    <input
                      type="text"
                      value={newTodo}
                      onChange={(e) => setNewTodo(e.target.value)}
                      placeholder="タスクのタイトルを入力..."
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
                    <select
                      value={newTodoAssignee}
                      onChange={(e) => setNewTodoAssignee(e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">選択してください</option>
                      {allUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                    <textarea
                      value={newTodoDescription}
                      onChange={(e) => setNewTodoDescription(e.target.value)}
                      placeholder="タスクの詳細を入力..."
                      rows={4}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={hasPeriod}
                        onChange={(e) => setHasPeriod(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">期間を設定する</span>
                    </label>
                    {hasPeriod && (
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">開始日</label>
                          <input
                            type="date"
                            value={newTodoStartDate}
                            onChange={(e) => setNewTodoStartDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">終了日</label>
                          <input
                            type="date"
                            value={newTodoEndDate}
                            onChange={(e) => setNewTodoEndDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}
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
                      onClick={() => {
                        setShowAddForm(false);
                        setNewTodo('');
                        setNewTodoAssignee('');
                        setNewTodoDescription('');
                        setHasPeriod(false);
                        setNewTodoStartDate('');
                        setNewTodoEndDate('');
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

          {/* AI結果表示（成功時のみ） */}
          {aiMessages.length > 0 && aiMessages[aiMessages.length - 1].role === 'ai' && (
            <div className="fixed bottom-2 sm:bottom-4 right-2 sm:right-4 left-2 sm:left-auto bg-white rounded-lg shadow-lg border border-gray-200 p-3 sm:p-4 max-w-md z-50 animate-slide-up">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">TODOを作成しました</h4>
                </div>
                <button
                  onClick={() => setAiMessages([])}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-xs sm:text-sm text-gray-600">
                <p className="whitespace-pre-wrap break-words">{aiMessages[aiMessages.length - 1].content}</p>
              </div>
            </div>
          )}

          {/* 共有モーダル */}
          {sharingTodoId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-semibold">タスクを共有</h3>
                  <button
                    onClick={() => {
                      setSharingTodoId(null);
                      setSelectedMembers([]);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  <p className="text-xs sm:text-sm text-gray-600">共有するチームメンバーを選択してください</p>
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

          {/* 完了メモ入力モーダル */}
          {showCompletionMemoModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base sm:text-lg font-semibold">タスク完了</h3>
                  <button
                    onClick={() => {
                      setShowCompletionMemoModal(false);
                      setCompletingTodoId(null);
                      setCompletionMemo('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      チームへのメモ（任意）
                    </label>
                    <textarea
                      value={completionMemo}
                      onChange={(e) => setCompletionMemo(e.target.value)}
                      placeholder="完了した内容や結果をチームに伝えたいことがあれば記入してください..."
                      rows={5}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={saveCompletionMemo}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      完了する
                    </button>
                    <button
                      onClick={() => {
                        setShowCompletionMemoModal(false);
                        setCompletingTodoId(null);
                        setCompletionMemo('');
                      }}
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
