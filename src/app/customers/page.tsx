"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../contexts/AuthContext";

interface TeamMember {
  id: string;
  displayName: string;
  email: string;
}

interface MeetingNote {
  id: string;
  customerId: string;
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
  createdAt: string;
  updatedAt: string;
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

export default function CustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDetail, setShowCustomerDetail] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showMeetingNoteModal, setShowMeetingNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null);
  const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);
  const [meetingNoteFormData, setMeetingNoteFormData] = useState<Omit<MeetingNote, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>({
    title: '',
    meetingDate: '',
    meetingTime: '',
    location: '',
    attendees: [],
    assignee: '',
    actionItems: [],
    notes: ''
  });
  const [actionItemInput, setActionItemInput] = useState({ item: '', assignee: '', deadline: '' });

  // チームメンバーを取得
  useEffect(() => {
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

    loadTeamMembers();
  }, [user]);

  // 顧客一覧を取得
  const fetchCustomers = async () => {
    if (!user) return;
    try {
      setLoading(true);
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
      } else {
        console.error('顧客取得エラー:', response.statusText);
      }
    } catch (error) {
      console.error('顧客取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCustomers();
    }
  }, [user]);

  // 顧客詳細を開く
  const handleOpenCustomerDetail = async (customer: Customer) => {
    if (!user) return;
    setSelectedCustomer(customer);
    setShowCustomerDetail(true);
    // この顧客の議事録を読み込む
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/customers/meeting-notes?customerId=${customer.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMeetingNotes(data.notes || []);
      } else {
        setMeetingNotes([]);
      }
    } catch (error) {
      console.error('議事録取得エラー:', error);
      setMeetingNotes([]);
    }
  };

  // 議事録を保存
  const handleSaveMeetingNote = async () => {
    if (!user || !selectedCustomer || !meetingNoteFormData.title) {
      alert('タイトルは必須です');
      return;
    }

    try {
      const token = await user.getIdToken();
      const url = editingNote 
        ? '/api/customers/meeting-notes'
        : '/api/customers/meeting-notes';
      const method = editingNote ? 'PUT' : 'POST';
      const body = editingNote
        ? { id: editingNote.id, ...meetingNoteFormData }
        : { customerId: selectedCustomer.id, ...meetingNoteFormData };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error('議事録の保存に失敗しました');
      }

      // 議事録一覧を再取得
      await handleOpenCustomerDetail(selectedCustomer);
      setShowMeetingNoteModal(false);
      setEditingNote(null);
      setMeetingNoteFormData({
        title: '',
        meetingDate: '',
        meetingTime: '',
        location: '',
        attendees: [],
        assignee: '',
        actionItems: [],
        notes: ''
      });
    } catch (error) {
      console.error('議事録保存エラー:', error);
      alert('議事録の保存に失敗しました');
    }
  };

  // 議事録を削除
  const handleDeleteMeetingNote = async (noteId: string) => {
    if (!user || !confirm('この議事録を削除しますか？') || !selectedCustomer) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/customers/meeting-notes?id=${noteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('議事録の削除に失敗しました');
      }

      // 議事録一覧を再取得
      await handleOpenCustomerDetail(selectedCustomer);
    } catch (error) {
      console.error('議事録削除エラー:', error);
      alert('議事録の削除に失敗しました');
    }
  };

  // 議事録を編集
  const handleEditMeetingNote = (note: MeetingNote) => {
    setEditingNote(note);
    setMeetingNoteFormData({
      title: note.title,
      meetingDate: note.meetingDate,
      meetingTime: note.meetingTime,
      location: note.location,
      attendees: note.attendees,
      assignee: note.assignee || '',
      actionItems: note.actionItems,
      notes: note.notes
    });
    setShowMeetingNoteModal(true);
  };

  // 参加者をトグル
  const toggleAttendee = (memberId: string) => {
    if (meetingNoteFormData.attendees.includes(memberId)) {
      setMeetingNoteFormData({ ...meetingNoteFormData, attendees: meetingNoteFormData.attendees.filter(id => id !== memberId) });
    } else {
      setMeetingNoteFormData({ ...meetingNoteFormData, attendees: [...meetingNoteFormData.attendees, memberId] });
    }
  };

  // アクション項目を追加
  const addActionItem = () => {
    if (actionItemInput.item.trim()) {
      setMeetingNoteFormData({
        ...meetingNoteFormData,
        actionItems: [...meetingNoteFormData.actionItems, { ...actionItemInput }]
      });
      setActionItemInput({ item: '', assignee: '', deadline: '' });
    }
  };

  // アクション項目を削除
  const removeActionItem = (index: number) => {
    setMeetingNoteFormData({
      ...meetingNoteFormData,
      actionItems: meetingNoteFormData.actionItems.filter((_, i) => i !== index)
    });
  };

  const [newCustomer, setNewCustomer] = useState<Omit<Customer, 'id' | 'createdAt'>>({
    name: "",
    email: "",
    company: "",
    phone: "",
    status: "prospect",
    priority: "medium",
    lastContact: new Date(),
    notes: ""
  });

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || customer.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleAddCustomer = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newCustomer)
      });

      if (!response.ok) {
        throw new Error('顧客の追加に失敗しました');
      }

      await fetchCustomers();
      setNewCustomer({
        name: "",
        email: "",
        company: "",
        phone: "",
        status: "prospect",
        priority: "medium",
        lastContact: new Date(),
        notes: ""
      });
      setShowAddModal(false);
    } catch (error) {
      console.error('顧客追加エラー:', error);
      alert('顧客の追加に失敗しました');
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setNewCustomer({
      name: customer.name,
      email: customer.email,
      company: customer.company,
      phone: customer.phone,
      status: customer.status,
      priority: customer.priority,
      lastContact: customer.lastContact,
      notes: customer.notes
    });
    setShowAddModal(true);
  };

  const handleUpdateCustomer = async () => {
    if (!user || !editingCustomer) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/customers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingCustomer.id,
          ...newCustomer,
          lastContact: new Date()
        })
      });

      if (!response.ok) {
        throw new Error('顧客の更新に失敗しました');
      }

      await fetchCustomers();
      setEditingCustomer(null);
      setNewCustomer({
        name: "",
        email: "",
        company: "",
        phone: "",
        status: "prospect",
        priority: "medium",
        lastContact: new Date(),
        notes: ""
      });
      setShowAddModal(false);
    } catch (error) {
      console.error('顧客更新エラー:', error);
      alert('顧客の更新に失敗しました');
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!user || !confirm("この顧客を削除しますか？")) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/customers?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('顧客の削除に失敗しました');
      }

      await fetchCustomers();
    } catch (error) {
      console.error('顧客削除エラー:', error);
      alert('顧客の削除に失敗しました');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'prospect': return 'bg-blue-100 text-blue-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'アクティブ';
      case 'prospect': return '見込み客';
      case 'inactive': return '非アクティブ';
      default: return status;
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return priority;
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* ヘッダー */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">顧客管理</h1>
              <p className="text-sm sm:text-base text-gray-600">顧客情報の管理と追跡</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors text-sm sm:text-base"
            >
              <span className="flex items-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                顧客を追加
              </span>
            </button>
          </div>

          {/* フィルター */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">検索</label>
                <input
                  type="text"
                  placeholder="名前、メール、会社名で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] text-sm sm:text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ステータス</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] text-sm sm:text-base"
                >
                  <option value="all">すべて</option>
                  <option value="active">アクティブ</option>
                  <option value="prospect">見込み客</option>
                  <option value="inactive">非アクティブ</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  リセット
                </button>
              </div>
            </div>
          </div>

          {/* 顧客一覧 */}
          <div className="bg-white rounded-lg shadow-sm">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#005eb2]"></div>
                <p className="mt-2 text-gray-600">読み込み中...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">顧客がありません</h3>
                <p className="mt-1 text-sm text-gray-500">最初の顧客を追加して始めましょう</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">顧客情報</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">会社</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">最終連絡</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                            <div className="text-sm text-gray-500">{customer.email}</div>
                            <div className="text-sm text-gray-500">{customer.phone}</div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{customer.company}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(customer.status)}`}>
                            {getStatusText(customer.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.lastContact instanceof Date 
                            ? customer.lastContact.toLocaleDateString('ja-JP')
                            : new Date(customer.lastContact).toLocaleDateString('ja-JP')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleOpenCustomerDetail(customer)}
                              className="text-[#005eb2] hover:text-[#004a96]"
                            >
                              詳細
                            </button>
                            <button
                              onClick={() => handleEditCustomer(customer)}
                              className="text-[#005eb2] hover:text-[#004a96]"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDeleteCustomer(customer.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 追加/編集モーダル */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingCustomer ? '顧客を編集' : '顧客を追加'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">会社名</label>
                    <input
                      type="text"
                      value={newCustomer.company}
                      onChange={(e) => setNewCustomer({...newCustomer, company: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                    <input
                      type="text"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                    <input
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                    <input
                      type="tel"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                    <textarea
                      value={newCustomer.notes}
                      onChange={(e) => setNewCustomer({...newCustomer, notes: e.target.value})}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] text-sm sm:text-base"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingCustomer(null);
                      setNewCustomer({
                        name: "",
                        email: "",
                        company: "",
                        phone: "",
                        status: "prospect",
                        priority: "medium",
                        lastContact: new Date(),
                        notes: ""
                      });
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={editingCustomer ? handleUpdateCustomer : handleAddCustomer}
                    className="px-4 py-2 bg-[#005eb2] text-white rounded-md hover:bg-[#004a96] transition-colors"
                  >
                    {editingCustomer ? '更新' : '追加'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 顧客詳細モーダル */}
          {showCustomerDetail && selectedCustomer && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedCustomer.name}</h2>
                      <p className="text-sm text-gray-600 mt-1">{selectedCustomer.company}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowCustomerDetail(false);
                        setSelectedCustomer(null);
                        setMeetingNotes([]);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* 顧客情報 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">顧客情報</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">メール</label>
                        <p className="text-sm text-gray-900 mt-1">{selectedCustomer.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">電話</label>
                        <p className="text-sm text-gray-900 mt-1">{selectedCustomer.phone}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">ステータス</label>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${getStatusColor(selectedCustomer.status)}`}>
                          {getStatusText(selectedCustomer.status)}
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">優先度</label>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${getPriorityColor(selectedCustomer.priority)}`}>
                          {getPriorityText(selectedCustomer.priority)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 議事録セクション */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">議事録</h3>
                      <button
                        onClick={() => {
                          setEditingNote(null);
                          setMeetingNoteFormData({
                            title: '',
                            meetingDate: '',
                            meetingTime: '',
                            location: '',
                            attendees: [],
                            assignee: '',
                            actionItems: [],
                            notes: ''
                          });
                          setShowAttendeeDropdown(false);
                          setShowMeetingNoteModal(true);
                        }}
                        className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors text-sm"
                      >
                        + 議事録を追加
                      </button>
                    </div>

                    {meetingNotes.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">議事録がありません</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {meetingNotes.map((note) => (
                          <div key={note.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{note.title}</h4>
                                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                  {note.meetingDate && (
                                    <span>{new Date(note.meetingDate).toLocaleDateString('ja-JP')}</span>
                                  )}
                                  {note.meetingTime && <span>{note.meetingTime}</span>}
                                  {note.location && <span>{note.location}</span>}
                                  {note.assignee && <span>担当者: {note.assignee}</span>}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditMeetingNote(note)}
                                  className="text-[#005eb2] hover:text-[#004a96] text-sm"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={() => handleDeleteMeetingNote(note.id)}
                                  className="text-red-600 hover:text-red-900 text-sm"
                                >
                                  削除
                                </button>
                              </div>
                            </div>
                            {note.notes && (
                              <p className="text-sm text-gray-700 mt-2">{note.notes}</p>
                            )}
                            {note.attendees.length > 0 && (
                              <div className="mt-2">
                                <span className="text-xs text-gray-600">参加者: </span>
                                {note.attendees.map((attendeeId) => {
                                  const member = teamMembers.find(m => m.id === attendeeId);
                                  return (
                                    <span key={attendeeId} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded mr-1">
                                      {member?.displayName || attendeeId}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {note.actionItems.length > 0 && (
                              <div className="mt-2">
                                <span className="text-xs text-gray-600">アクション項目:</span>
                                <ul className="mt-1 space-y-1">
                                  {note.actionItems.map((item, idx) => (
                                    <li key={idx} className="text-xs text-gray-700">
                                      • {item.item} {item.assignee && `(担当: ${item.assignee})`} {item.deadline && `(期限: ${item.deadline})`}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 議事録追加/編集モーダル */}
          {showMeetingNoteModal && selectedCustomer && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900">
                    {editingNote ? '議事録を編集' : '議事録を追加'}
                  </h3>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">タイトル <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={meetingNoteFormData.title}
                      onChange={(e) => setMeetingNoteFormData({ ...meetingNoteFormData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005eb2]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
                      <input
                        type="date"
                        value={meetingNoteFormData.meetingDate}
                        onChange={(e) => setMeetingNoteFormData({ ...meetingNoteFormData, meetingDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005eb2]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">時間</label>
                      <input
                        type="time"
                        value={meetingNoteFormData.meetingTime}
                        onChange={(e) => setMeetingNoteFormData({ ...meetingNoteFormData, meetingTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005eb2]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">場所</label>
                      <input
                        type="text"
                        value={meetingNoteFormData.location}
                        onChange={(e) => setMeetingNoteFormData({ ...meetingNoteFormData, location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005eb2]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">参加者</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAttendeeDropdown(!showAttendeeDropdown)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left flex items-center justify-between bg-white"
                      >
                        <span className="text-gray-700">
                          {meetingNoteFormData.attendees.length > 0
                            ? `${meetingNoteFormData.attendees.length}名選択中`
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
                                  checked={meetingNoteFormData.attendees.includes(member.id)}
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
                    {meetingNoteFormData.attendees.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {meetingNoteFormData.attendees.map((attendeeId) => {
                          const member = teamMembers.find(m => m.id === attendeeId);
                          return (
                            <span
                              key={attendeeId}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                            >
                              {member?.displayName || attendeeId}
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
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005eb2]"
                      />
                      <input
                        type="text"
                        value={actionItemInput.assignee}
                        onChange={(e) => setActionItemInput({ ...actionItemInput, assignee: e.target.value })}
                        placeholder="担当者"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005eb2]"
                      />
                      <input
                        type="date"
                        value={actionItemInput.deadline}
                        onChange={(e) => setActionItemInput({ ...actionItemInput, deadline: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005eb2]"
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
                      {meetingNoteFormData.actionItems.map((item, index) => (
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                    <textarea
                      value={meetingNoteFormData.notes}
                      onChange={(e) => setMeetingNoteFormData({ ...meetingNoteFormData, notes: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005eb2]"
                    />
                  </div>
                </div>

                <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowMeetingNoteModal(false);
                      setEditingNote(null);
                      setMeetingNoteFormData({
                        title: '',
                        meetingDate: '',
                        meetingTime: '',
                        location: '',
                        attendees: [],
                        assignee: '',
                        actionItems: [],
                        notes: ''
                      });
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSaveMeetingNote}
                    className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
                  >
                    {editingNote ? '更新' : '保存'}
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
