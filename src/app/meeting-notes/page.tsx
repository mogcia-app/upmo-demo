'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface TeamMember {
  id: string;
  displayName: string;
  email: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  status: 'active' | 'inactive' | 'prospect';
  priority: 'low' | 'medium' | 'high';
  lastContact: string | Date;
  notes: string;
  createdAt: string | Date;
}

interface MeetingNote {
  id: string;
  customerId?: string;
  title: string;
  meetingDate: string;
  meetingTime: string;
  location: string;
  attendees: string[]; // 利用者IDの配列
  assignee?: string; // 担当者
  actionItems: Array<{
    item: string;
    assignee: string;
    deadline: string;
  }>;
  notes: string;
  summary?: string; // AI生成の要約
  category?: string; // カテゴリ（AI自動分類）
  tags?: string[]; // タグ
  status: 'draft' | 'completed'; // 下書き or 完了
  createdAt: string;
  updatedAt: string;
}

export default function MeetingNotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null);
  const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerForNote, setSelectedCustomerForNote] = useState<Customer | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formData, setFormData] = useState<Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt'>>({
    title: '',
    meetingDate: '',
    meetingTime: '',
    location: '',
    attendees: [],
    assignee: '',
    actionItems: [],
    notes: '',
    summary: '',
    category: '',
    tags: [],
    status: 'draft'
  });
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [actionItemInput, setActionItemInput] = useState({ item: '', assignee: '', deadline: '' });

  useEffect(() => {
    if (user) {
      loadNotes();
      loadTeamMembers();
      loadCustomers();
    }
  }, [user]);

  const loadCustomers = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/customers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const customersData = data.customers.map((c: any) => ({
          ...c,
          lastContact: new Date(c.lastContact),
          createdAt: new Date(c.createdAt)
        }));
        setCustomers(customersData);
      }
    } catch (error) {
      console.error('顧客取得エラー:', error);
    }
  };

  const loadTeamMembers = async () => {
    if (!user) return;
    try {
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
        
        const members = data.users
          .filter((u: any) => 
            u.role === 'user' && 
            u.companyName === currentCompanyName
          )
          .map((u: any) => ({
            id: u.id,
            displayName: u.displayName || u.email,
            email: u.email
          }));
        setTeamMembers(members);
      }
    } catch (error) {
      console.error('チームメンバーの読み込みエラー:', error);
    }
  };

  const loadNotes = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/meeting-notes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error('議事録の読み込みエラー:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.title) {
      alert('タイトルは必須です');
      return;
    }
    try {
      const token = await user.getIdToken();
      const payload = {
        ...formData,
        customerId: selectedCustomerForNote?.id || undefined
      };
      
      const url = '/api/meeting-notes';
      const method = editingNote ? 'PUT' : 'POST';
      const body = editingNote
        ? { id: editingNote.id, ...payload }
        : payload;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '議事録の保存に失敗しました');
      }

      setShowModal(false);
      setEditingNote(null);
      setSelectedCustomerForNote(null);
      setFormData({
        title: '',
        meetingDate: '',
        meetingTime: '',
        location: '',
        attendees: [],
        assignee: '',
        actionItems: [],
        notes: '',
        summary: '',
        category: '',
        tags: [],
        status: 'draft'
      });
      setShowAttendeeDropdown(false);
      setShowCustomerDropdown(false);
      loadNotes();
    } catch (error) {
      console.error('議事録の保存エラー:', error);
      alert('議事録の保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('この議事録を削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/meeting-notes?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '議事録の削除に失敗しました');
      }
      
      loadNotes();
    } catch (error) {
      console.error('議事録の削除エラー:', error);
      alert(error instanceof Error ? error.message : '議事録の削除に失敗しました');
    }
  };

  const toggleAttendee = (memberId: string) => {
    if (formData.attendees.includes(memberId)) {
      setFormData({ ...formData, attendees: formData.attendees.filter(id => id !== memberId) });
    } else {
      setFormData({ ...formData, attendees: [...formData.attendees, memberId] });
    }
  };

  const getAttendeeName = (memberId: string) => {
    const member = teamMembers.find(m => m.id === memberId);
    return member?.displayName || memberId;
  };

  const addActionItem = () => {
    if (actionItemInput.item.trim()) {
      setFormData({ ...formData, actionItems: [...formData.actionItems, { ...actionItemInput }] });
      setActionItemInput({ item: '', assignee: '', deadline: '' });
    }
  };

  const removeActionItem = (index: number) => {
    setFormData({ ...formData, actionItems: formData.actionItems.filter((_, i) => i !== index) });
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">議事録管理</h1>
            <div className="flex items-center gap-4">
              {/* カテゴリフィルター */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">すべてのカテゴリ</option>
                <option value="営業・商談">営業・商談</option>
                <option value="プロジェクト管理">プロジェクト管理</option>
                <option value="人事・採用">人事・採用</option>
                <option value="経営・戦略">経営・戦略</option>
                <option value="技術・開発">技術・開発</option>
                <option value="顧客対応">顧客対応</option>
                <option value="その他">その他</option>
                <option value="未分類">未分類</option>
              </select>
              <button
              onClick={() => {
                setEditingNote(null);
                setSelectedCustomerForNote(null);
                setFormData({
                  title: '',
                  meetingDate: '',
                  meetingTime: '',
                  location: '',
                  attendees: [],
                  assignee: '',
                  actionItems: [],
                  notes: '',
                  summary: '',
                  category: '',
                  tags: [],
                  status: 'draft'
                });
                setShowAttendeeDropdown(false);
                setShowCustomerDropdown(false);
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              議事録を追加
            </button>
            </div>
          </div>

          {notes.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <p className="text-gray-500 text-lg">議事録がありません</p>
              <p className="text-gray-400 text-sm mt-2">「議事録を追加」ボタンから新しい議事録を作成してください</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {notes
                .filter(note => {
                  if (categoryFilter === 'all') return true;
                  if (categoryFilter === '未分類') return !note.category || note.category === '';
                  return note.category === categoryFilter;
                })
                .map((note) => (
                  <div
                    key={note.id}
                    className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border-l-4 border-blue-500 p-6 relative"
                  >
                  {/* ヘッダー */}
                  <div className="mb-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-bold text-gray-900 line-clamp-2">{note.title}</h3>
                      <div className="flex gap-2 ml-2">
                        <button
                          onClick={() => {
                            setEditingNote(note);
                            // 顧客を検索
                            const customer = note.customerId ? customers.find(c => c.id === note.customerId) : null;
                            setSelectedCustomerForNote(customer || null);
                            setFormData({
                              title: note.title,
                              meetingDate: note.meetingDate,
                              meetingTime: note.meetingTime,
                              location: note.location,
                              attendees: note.attendees,
                              assignee: note.assignee || '',
                              actionItems: note.actionItems,
                              notes: note.notes,
                              summary: note.summary || '',
                              category: note.category || '',
                              tags: note.tags || [],
                              status: note.status || 'completed'
                            });
                            setShowAttendeeDropdown(false);
                            setShowCustomerDropdown(false);
                            setShowModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-[#005eb2] transition-colors"
                          title="編集"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          title="削除"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{note.meetingDate}</span>
                      {note.meetingTime && (
                        <>
                          <span>•</span>
                          <span>{note.meetingTime}</span>
                        </>
                      )}
                    </div>
                    {note.location && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{note.location}</span>
                      </div>
                    )}
                  </div>

                  {/* 参加者 */}
                  {note.attendees.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="text-xs font-medium text-gray-600">参加者 ({note.attendees.length}名)</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {note.attendees.slice(0, 5).map((attendeeId, index) => {
                          const member = teamMembers.find(m => m.id === attendeeId);
                          const displayName = member?.displayName || attendeeId;
                          return (
                            <span
                              key={index}
                              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded"
                            >
                              {displayName}
                            </span>
                          );
                        })}
                        {note.attendees.length > 5 && (
                          <span className="px-2 py-1 text-xs text-gray-500">+{note.attendees.length - 5}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* アクション項目 */}
                  {note.actionItems.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span className="text-xs font-medium text-gray-600">アクション項目 ({note.actionItems.length}件)</span>
                      </div>
                      <div className="space-y-1">
                        {note.actionItems.slice(0, 2).map((item, index) => (
                          <div key={index} className="text-xs bg-orange-50 p-2 rounded">
                            <div className="font-medium text-gray-700">{item.item}</div>
                            <div className="text-gray-500 mt-1">
                              {item.assignee && <span>担当: {item.assignee}</span>}
                              {item.assignee && item.deadline && <span> • </span>}
                              {item.deadline && <span>期限: {item.deadline}</span>}
                            </div>
                          </div>
                        ))}
                        {note.actionItems.length > 2 && (
                          <div className="text-xs text-gray-500">他 {note.actionItems.length - 2} 件</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 要約 */}
                  {note.summary && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-xs font-medium text-blue-600">AI要約</span>
                      </div>
                      <p className="text-sm text-gray-700">{note.summary}</p>
                    </div>
                  )}

                  {/* 備考 */}
                  {note.notes && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-700 line-clamp-3">{note.notes}</p>
                    </div>
                  )}

                  {/* カテゴリ・タグ */}
                  {(note.category || (note.tags && note.tags.length > 0)) && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {note.category && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                          {note.category}
                        </span>
                      )}
                      {note.tags && note.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* ステータス */}
                  {note.status === 'draft' && (
                    <div className="mb-2">
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                        下書き
                      </span>
                    </div>
                  )}

                  {/* フッター */}
                  <div className="pt-4 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      {new Date(note.updatedAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {editingNote ? '議事録を編集' : '議事録を追加'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">顧客（会社名）</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left flex items-center justify-between bg-white"
                        >
                          <span className="text-gray-700">
                            {selectedCustomerForNote ? selectedCustomerForNote.company : '顧客を選択'}
                          </span>
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${showCustomerDropdown ? 'transform rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {showCustomerDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {customers.length === 0 ? (
                              <div className="px-4 py-2 text-sm text-gray-500">顧客がありません</div>
                            ) : (
                              customers.map((customer) => (
                                <button
                                  key={customer.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomerForNote(customer);
                                    setShowCustomerDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                  <div className="text-sm text-gray-700 font-medium">{customer.company}</div>
                                  <div className="text-xs text-gray-500">{customer.name}</div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
                      <input
                        type="text"
                        value={formData.assignee || ''}
                        onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="担当者名を入力"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
                      <input
                        type="date"
                        value={formData.meetingDate}
                        onChange={(e) => setFormData({ ...formData, meetingDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">時間</label>
                      <input
                        type="time"
                        value={formData.meetingTime}
                        onChange={(e) => setFormData({ ...formData, meetingTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">場所</label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">参加者</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAttendeeDropdown(!showAttendeeDropdown)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between bg-white"
                      >
                        <span className="text-gray-700">
                          {formData.attendees.length > 0
                            ? `${formData.attendees.length}名選択中`
                            : '参加者を選択'}
                        </span>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${showAttendeeDropdown ? 'transform rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showAttendeeDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {teamMembers.length === 0 ? (
                            <div className="px-4 py-2 text-sm text-gray-500">利用者がいません</div>
                          ) : (
                            teamMembers.map((member) => (
                              <label
                                key={member.id}
                                className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.attendees.includes(member.id)}
                                  onChange={() => toggleAttendee(member.id)}
                                  className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-700">{member.displayName}</span>
                                <span className="ml-2 text-xs text-gray-500">({member.email})</span>
                              </label>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    {formData.attendees.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {formData.attendees.map((attendeeId) => {
                          const member = teamMembers.find(m => m.id === attendeeId);
                          const displayName = member?.displayName || attendeeId;
                          return (
                            <span
                              key={attendeeId}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                            >
                              {displayName}
                              <button
                                type="button"
                                onClick={() => toggleAttendee(attendeeId)}
                                className="ml-2 text-blue-600 hover:text-blue-800"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">アクション項目</label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      <input
                        type="text"
                        value={actionItemInput.item}
                        onChange={(e) => setActionItemInput({ ...actionItemInput, item: e.target.value })}
                        placeholder="項目"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={actionItemInput.assignee}
                        onChange={(e) => setActionItemInput({ ...actionItemInput, assignee: e.target.value })}
                        placeholder="担当者"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="date"
                        value={actionItemInput.deadline}
                        onChange={(e) => setActionItemInput({ ...actionItemInput, deadline: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={addActionItem}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        追加
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.actionItems.map((item, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                            <span className="text-gray-700">{item.item}</span>
                            <span className="text-gray-600">{item.assignee}</span>
                            <span className="text-gray-600">{item.deadline}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeActionItem(index)}
                            className="text-red-600 hover:text-red-800 ml-2"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">備考</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!formData.notes.trim()) {
                              alert('要約する内容を入力してください');
                              return;
                            }
                            setIsGeneratingSummary(true);
                            try {
                              const token = await user?.getIdToken();
                              const response = await fetch('/api/meeting-notes/summarize', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                  notes: formData.notes,
                                  title: formData.title,
                                  actionItems: formData.actionItems
                                })
                              });
                              if (response.ok) {
                                const data = await response.json();
                                setFormData({ ...formData, summary: data.summary });
                              } else {
                                alert('要約の生成に失敗しました');
                              }
                            } catch (error) {
                              console.error('要約生成エラー:', error);
                              alert('要約の生成に失敗しました');
                            } finally {
                              setIsGeneratingSummary(false);
                            }
                          }}
                          disabled={isGeneratingSummary || !formData.notes.trim()}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isGeneratingSummary ? '生成中...' : '🤖 AI要約生成'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!formData.notes.trim() && !formData.title.trim()) {
                              alert('分類する内容を入力してください');
                              return;
                            }
                            setIsCategorizing(true);
                            try {
                              const token = await user?.getIdToken();
                              const response = await fetch('/api/meeting-notes/classify', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                  notes: formData.notes,
                                  title: formData.title
                                })
                              });
                              if (response.ok) {
                                const data = await response.json();
                                setFormData({ ...formData, category: data.category });
                              } else {
                                alert('分類に失敗しました');
                              }
                            } catch (error) {
                              console.error('分類エラー:', error);
                              alert('分類に失敗しました');
                            } finally {
                              setIsCategorizing(false);
                            }
                          }}
                          disabled={isCategorizing || (!formData.notes.trim() && !formData.title.trim())}
                          className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isCategorizing ? '分類中...' : '🤖 AI分類'}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={6}
                      placeholder="会議中のポイントをバーっと書いてください。後でAIに要約・分類してもらえます。"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* AI要約表示 */}
                  {formData.summary && (
                    <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-xs font-medium text-blue-600">AI要約</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, summary: '' })}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          削除
                        </button>
                      </div>
                      <p className="text-sm text-gray-700">{formData.summary}</p>
                    </div>
                  )}

                  {/* カテゴリ選択 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                    <select
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">カテゴリを選択</option>
                      <option value="営業・商談">営業・商談</option>
                      <option value="プロジェクト管理">プロジェクト管理</option>
                      <option value="人事・採用">人事・採用</option>
                      <option value="経営・戦略">経営・戦略</option>
                      <option value="技術・開発">技術・開発</option>
                      <option value="顧客対応">顧客対応</option>
                      <option value="その他">その他</option>
                    </select>
                  </div>

                  {/* タグ入力 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">タグ</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && tagInput.trim()) {
                            e.preventDefault();
                            if (!formData.tags?.includes(tagInput.trim())) {
                              setFormData({ ...formData, tags: [...(formData.tags || []), tagInput.trim()] });
                            }
                            setTagInput('');
                          }
                        }}
                        placeholder="タグを入力してEnter"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
                            setFormData({ ...formData, tags: [...(formData.tags || []), tagInput.trim()] });
                            setTagInput('');
                          }
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        追加
                      </button>
                    </div>
                    {formData.tags && formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700"
                          >
                            #{tag}
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, tags: formData.tags?.filter((_, i) => i !== index) });
                              }}
                              className="ml-2 text-gray-500 hover:text-gray-700"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ステータス選択 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'draft' | 'completed' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="draft">下書き</option>
                      <option value="completed">完了</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingNote(null);
                      setSelectedCustomerForNote(null);
                      setFormData({
                        title: '',
                        meetingDate: '',
                        meetingTime: '',
                        location: '',
                        attendees: [],
                        assignee: '',
                        actionItems: [],
                        notes: '',
                        summary: '',
                        category: '',
                        tags: [],
                        status: 'draft'
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

