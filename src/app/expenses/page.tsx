'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Expense {
  id: string;
  expenseNumber: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'other';
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  expenseDate: string;
  receipt?: string;
  approver?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState<Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'receipt' | 'approver'>>({
    expenseNumber: '',
    category: '',
    description: '',
    amount: 0,
    paymentMethod: 'cash',
    status: 'pending',
    expenseDate: ''
  });

  useEffect(() => {
    if (user) {
      loadExpenses();
    }
  }, [user]);

  const loadExpenses = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/expenses', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setExpenses(data.expenses || []);
      }
    } catch (error) {
      console.error('経費の読み込みエラー:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.expenseNumber || !formData.category || !formData.description) {
      alert('経費番号、カテゴリ、内容は必須です');
      return;
    }
    try {
      const token = await user.getIdToken();
      const method = editingExpense ? 'PUT' : 'POST';
      const body = editingExpense 
        ? { id: editingExpense.id, ...formData }
        : formData;
      
      const response = await fetch('/api/expenses', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setShowModal(false);
        setEditingExpense(null);
        setFormData({
          expenseNumber: '',
          category: '',
          description: '',
          amount: 0,
          paymentMethod: 'cash',
          status: 'pending',
          expenseDate: ''
        });
        loadExpenses();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '経費の保存に失敗しました');
      }
    } catch (error) {
      console.error('経費の保存エラー:', error);
      alert('経費の保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('この経費を削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/expenses?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadExpenses();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '経費の削除に失敗しました');
      }
    } catch (error) {
      console.error('経費の削除エラー:', error);
      alert('経費の削除に失敗しました');
    }
  };

  const categories = ['交通費', '会議費', '交際費', '通信費', '消耗品', 'その他'];

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">経費管理</h1>
            <button
              onClick={() => {
                setEditingExpense(null);
                setFormData({
                  expenseNumber: '',
                  category: '',
                  description: '',
                  amount: 0,
                  paymentMethod: 'cash',
                  status: 'pending',
                  expenseDate: ''
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              経費を追加
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">経費番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">カテゴリ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">内容</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金額</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">支払方法</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日付</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        経費がありません
                      </td>
                    </tr>
                  ) : (
                    expenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{expense.expenseNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{expense.category}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{expense.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">¥{expense.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {expense.paymentMethod === 'cash' ? '現金' :
                           expense.paymentMethod === 'card' ? 'カード' :
                           expense.paymentMethod === 'transfer' ? '振込' :
                           'その他'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                            expense.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                            expense.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {expense.status === 'pending' ? '承認待ち' :
                             expense.status === 'approved' ? '承認済み' :
                             expense.status === 'paid' ? '支払済み' :
                             '却下'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{expense.expenseDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setEditingExpense(expense);
                              setFormData({
                                expenseNumber: expense.expenseNumber,
                                category: expense.category,
                                description: expense.description,
                                amount: expense.amount,
                                paymentMethod: expense.paymentMethod,
                                status: expense.status,
                                expenseDate: expense.expenseDate
                              });
                              setShowModal(true);
                            }}
                            className="text-[#005eb2] hover:text-[#004a96] mr-4"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(expense.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {editingExpense ? '経費を編集' : '経費を追加'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">経費番号</label>
                    <input
                      type="text"
                      value={formData.expenseNumber}
                      onChange={(e) => setFormData({ ...formData, expenseNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">選択してください</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">支払方法</label>
                      <select
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as Expense['paymentMethod'] })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="cash">現金</option>
                        <option value="card">カード</option>
                        <option value="transfer">振込</option>
                        <option value="other">その他</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">金額</label>
                      <input
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as Expense['status'] })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="pending">承認待ち</option>
                        <option value="approved">承認済み</option>
                        <option value="paid">支払済み</option>
                        <option value="rejected">却下</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
                    <input
                      type="date"
                      value={formData.expenseDate}
                      onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingExpense(null);
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


