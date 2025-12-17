'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Quote {
  id: string;
  quoteNumber: string;
  customerName: string;
  title: string;
  amount: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
  validUntil: string;
  createdAt: string;
  updatedAt: string;
}

export default function QuotesPage() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [formData, setFormData] = useState<Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>>({
    quoteNumber: '',
    customerName: '',
    title: '',
    amount: 0,
    status: 'draft',
    validUntil: ''
  });

  useEffect(() => {
    if (user) {
      loadQuotes();
    }
  }, [user]);

  const loadQuotes = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/sales/quotes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setQuotes(data.quotes || []);
      }
    } catch (error) {
      console.error('見積の読み込みエラー:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.quoteNumber || !formData.customerName || !formData.title) {
      alert('見積番号、顧客名、タイトルは必須です');
      return;
    }
    try {
      const token = await user.getIdToken();
      const url = editingQuote 
        ? '/api/sales/quotes'
        : '/api/sales/quotes';
      const method = editingQuote ? 'PUT' : 'POST';
      const body = editingQuote 
        ? { id: editingQuote.id, ...formData }
        : formData;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setShowModal(false);
        setEditingQuote(null);
        setFormData({
          quoteNumber: '',
          customerName: '',
          title: '',
          amount: 0,
          status: 'draft',
          validUntil: ''
        });
        loadQuotes();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '見積の保存に失敗しました');
      }
    } catch (error) {
      console.error('見積の保存エラー:', error);
      alert('見積の保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('この見積を削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/sales/quotes?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadQuotes();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '見積の削除に失敗しました');
      }
    } catch (error) {
      console.error('見積の削除エラー:', error);
      alert('見積の削除に失敗しました');
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">見積管理</h1>
            <button
              onClick={() => {
                setEditingQuote(null);
                setFormData({
                  quoteNumber: '',
                  customerName: '',
                  title: '',
                  amount: 0,
                  status: 'draft',
                  validUntil: ''
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              見積を追加
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">見積番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">顧客名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイトル</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金額</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">有効期限</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quotes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        見積がありません
                      </td>
                    </tr>
                  ) : (
                    quotes.map((quote) => (
                      <tr key={quote.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{quote.quoteNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{quote.customerName}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{quote.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">¥{quote.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            quote.status === 'approved' ? 'bg-green-100 text-green-800' :
                            quote.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            quote.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                            quote.status === 'expired' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {quote.status === 'draft' ? '下書き' :
                             quote.status === 'sent' ? '送信済み' :
                             quote.status === 'approved' ? '承認済み' :
                             quote.status === 'rejected' ? '却下' :
                             '期限切れ'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{quote.validUntil}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setEditingQuote(quote);
                              setFormData({
                                quoteNumber: quote.quoteNumber,
                                customerName: quote.customerName,
                                title: quote.title,
                                amount: quote.amount,
                                status: quote.status,
                                validUntil: quote.validUntil
                              });
                              setShowModal(true);
                            }}
                            className="text-[#005eb2] hover:text-[#004a96] mr-4"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(quote.id)}
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
                  {editingQuote ? '見積を編集' : '見積を追加'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">見積番号</label>
                    <input
                      type="text"
                      value={formData.quoteNumber}
                      onChange={(e) => setFormData({ ...formData, quoteNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">顧客名</label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
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
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Quote['status'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="draft">下書き</option>
                      <option value="sent">送信済み</option>
                      <option value="approved">承認済み</option>
                      <option value="rejected">却下</option>
                      <option value="expired">期限切れ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">有効期限</label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingQuote(null);
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


