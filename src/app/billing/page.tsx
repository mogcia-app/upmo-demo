'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerCompany: string;
  amount: number;
  tax: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
}

export default function BillingPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState<Omit<Invoice, 'id' | 'tax' | 'totalAmount' | 'createdAt' | 'updatedAt' | 'paidDate'>>({
    invoiceNumber: '',
    customerName: '',
    customerCompany: '',
    amount: 0,
    status: 'draft',
    issueDate: '',
    dueDate: ''
  });

  useEffect(() => {
    if (user) {
      loadInvoices();
    }
  }, [user]);

  const loadInvoices = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/billing', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('請求の読み込みエラー:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.invoiceNumber || !formData.customerName) {
      alert('請求書番号、顧客名は必須です');
      return;
    }
    try {
      const token = await user.getIdToken();
      const method = editingInvoice ? 'PUT' : 'POST';
      const body = editingInvoice 
        ? { id: editingInvoice.id, ...formData }
        : formData;
      
      const response = await fetch('/api/billing', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setShowModal(false);
        setEditingInvoice(null);
        setFormData({
          invoiceNumber: '',
          customerName: '',
          customerCompany: '',
          amount: 0,
          status: 'draft',
          issueDate: '',
          dueDate: ''
        });
        loadInvoices();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '請求の保存に失敗しました');
      }
    } catch (error) {
      console.error('請求の保存エラー:', error);
      alert('請求の保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('この請求を削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/billing?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadInvoices();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '請求の削除に失敗しました');
      }
    } catch (error) {
      console.error('請求の削除エラー:', error);
      alert('請求の削除に失敗しました');
    }
  };

  const calculateTax = (amount: number) => {
    return Math.floor(amount * 0.1);
  };

  const calculateTotal = (amount: number) => {
    return amount + calculateTax(amount);
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">請求管理</h1>
            <button
              onClick={() => {
                setEditingInvoice(null);
                setFormData({
                  invoiceNumber: '',
                  customerName: '',
                  customerCompany: '',
                  amount: 0,
                  status: 'draft',
                  issueDate: '',
                  dueDate: ''
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              請求を追加
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">請求番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">顧客名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">会社名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金額</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">合計金額</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">発行日</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">支払期限</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                        請求がありません
                      </td>
                    </tr>
                  ) : (
                    invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{invoice.invoiceNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{invoice.customerName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{invoice.customerCompany}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">¥{invoice.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">¥{invoice.totalAmount.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                            invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                            invoice.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {invoice.status === 'draft' ? '下書き' :
                             invoice.status === 'sent' ? '送信済み' :
                             invoice.status === 'paid' ? '入金済み' :
                             invoice.status === 'overdue' ? '期限切れ' :
                             'キャンセル'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{invoice.issueDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{invoice.dueDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setEditingInvoice(invoice);
                              setFormData({
                                invoiceNumber: invoice.invoiceNumber,
                                customerName: invoice.customerName,
                                customerCompany: invoice.customerCompany,
                                amount: invoice.amount,
                                status: invoice.status,
                                issueDate: invoice.issueDate,
                                dueDate: invoice.dueDate
                              });
                              setShowModal(true);
                            }}
                            className="text-[#005eb2] hover:text-[#004a96] mr-4"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(invoice.id)}
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
                  {editingInvoice ? '請求を編集' : '請求を追加'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">請求番号</label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">会社名</label>
                      <input
                        type="text"
                        value={formData.customerCompany}
                        onChange={(e) => setFormData({ ...formData, customerCompany: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">金額（税抜）</label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="mt-2 text-sm text-gray-600">
                      <p>消費税（10%）: ¥{calculateTax(formData.amount).toLocaleString()}</p>
                      <p className="font-medium">合計金額: ¥{calculateTotal(formData.amount).toLocaleString()}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Invoice['status'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="draft">下書き</option>
                      <option value="sent">送信済み</option>
                      <option value="paid">入金済み</option>
                      <option value="overdue">期限切れ</option>
                      <option value="cancelled">キャンセル</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">発行日</label>
                      <input
                        type="date"
                        value={formData.issueDate}
                        onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">支払期限</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingInvoice(null);
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


