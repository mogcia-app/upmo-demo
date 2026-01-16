'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../../../components/Layout';
import { ProtectedRoute } from '../../../components/ProtectedRoute';
import { useAuth } from '../../../contexts/AuthContext';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface Invoice {
  id?: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  customerName: string;
  customerAddress?: string;
  customerPostalCode?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
}

export default function InvoicePage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice>({
    invoiceNumber: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    customerName: '',
    customerAddress: '',
    customerPostalCode: '',
    items: [{ id: '1', description: '', quantity: 1, unitPrice: 0, amount: 0 }],
    subtotal: 0,
    taxRate: 10,
    taxAmount: 0,
    total: 0,
    notes: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user]);

  const fetchInvoices = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const token = await user.getIdToken();
      
      // 請求書一覧取得APIから取得
      const response = await fetch('/api/admin/invoice', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('請求書一覧の取得に失敗しました');
      }
      
      const data = await response.json();
      if (data.success && data.invoices) {
        setInvoices(data.invoices);
      }
    } catch (error) {
      console.error('請求書取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAmounts = (items: InvoiceItem[], taxRate: number) => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = Math.floor(subtotal * taxRate / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...currentInvoice.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // 金額を再計算
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].amount = newItems[index].quantity * newItems[index].unitPrice;
    }
    
    const { subtotal, taxAmount, total } = calculateAmounts(newItems, currentInvoice.taxRate);
    setCurrentInvoice({
      ...currentInvoice,
      items: newItems,
      subtotal,
      taxAmount,
      total,
    });
  };

  const addItem = () => {
    setCurrentInvoice({
      ...currentInvoice,
      items: [
        ...currentInvoice.items,
        { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, amount: 0 }
      ],
    });
  };

  const removeItem = (index: number) => {
    const newItems = currentInvoice.items.filter((_, i) => i !== index);
    if (newItems.length === 0) {
      newItems.push({ id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, amount: 0 });
    }
    const { subtotal, taxAmount, total } = calculateAmounts(newItems, currentInvoice.taxRate);
    setCurrentInvoice({
      ...currentInvoice,
      items: newItems,
      subtotal,
      taxAmount,
      total,
    });
  };

  const handleSave = async () => {
    if (!user || !currentInvoice.invoiceNumber || !currentInvoice.customerName) {
      alert('請求書番号と顧客名は必須です');
      return;
    }

    try {
      setIsSaving(true);
      const token = await user.getIdToken();
      
      // 請求書保存APIに送信
      const response = await fetch('/api/admin/invoice', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(currentInvoice),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '請求書の保存に失敗しました');
      }
      
      const data = await response.json();
      if (data.success) {
        // 請求書一覧を再取得
        await fetchInvoices();
        setShowCreateModal(false);
        setCurrentInvoice({
          invoiceNumber: '',
          issueDate: new Date().toISOString().split('T')[0],
          dueDate: '',
          customerName: '',
          customerAddress: '',
          customerPostalCode: '',
          items: [{ id: '1', description: '', quantity: 1, unitPrice: 0, amount: 0 }],
          subtotal: 0,
          taxRate: 10,
          taxAmount: 0,
          total: 0,
          notes: '',
        });
        alert('請求書を保存しました');
      }
    } catch (error: any) {
      console.error('請求書保存エラー:', error);
      alert(error.message || '請求書の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    if (!user || !confirm('この請求書を削除しますか？')) return;
    
    try {
      const token = await user.getIdToken();
      
      // 請求書削除APIに送信
      const response = await fetch(`/api/admin/invoice?id=${invoiceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '請求書の削除に失敗しました');
      }
      
      const data = await response.json();
      if (data.success) {
        // 請求書一覧を再取得
        await fetchInvoices();
        alert('請求書を削除しました');
      }
    } catch (error: any) {
      console.error('請求書削除エラー:', error);
      alert(error.message || '請求書の削除に失敗しました');
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setCurrentInvoice(invoice);
    setShowCreateModal(true);
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gray-50">
          {/* ヘッダー */}
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">請求書発行</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-2">請求書の作成と管理</p>
              </div>
              <button
                onClick={() => {
                  setCurrentInvoice({
                    invoiceNumber: '',
                    issueDate: new Date().toISOString().split('T')[0],
                    dueDate: '',
                    customerName: '',
                    customerAddress: '',
                    customerPostalCode: '',
                    items: [{ id: '1', description: '', quantity: 1, unitPrice: 0, amount: 0 }],
                    subtotal: 0,
                    taxRate: 10,
                    taxAmount: 0,
                    total: 0,
                    notes: '',
                  });
                  setShowCreateModal(true);
                }}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base"
              >
                <span className="flex items-center gap-2 font-medium">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  請求書を作成
                </span>
              </button>
            </div>
          </div>

          {/* 請求書一覧 */}
          <div className="p-4 sm:p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">読み込み中...</span>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🧾</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">請求書がありません</h3>
                <p className="text-gray-500">「請求書を作成」ボタンから新しい請求書を作成してください</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{invoice.invoiceNumber}</h3>
                        <p className="text-sm text-gray-500 mt-1">{invoice.customerName}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(invoice)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => invoice.id && handleDelete(invoice.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">発行日:</span>
                        <span className="text-gray-900">{invoice.issueDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">支払期限:</span>
                        <span className="text-gray-900">{invoice.dueDate || '未設定'}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-100">
                        <span className="font-medium text-gray-900">合計金額:</span>
                        <span className="font-bold text-blue-600">¥{invoice.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 請求書作成・編集モーダル */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-lg p-4 sm:p-6 w-full mx-4 max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">請求書{currentInvoice.id ? '編集' : '作成'}</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* 基本情報 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">請求書番号 *</label>
                      <input
                        type="text"
                        value={currentInvoice.invoiceNumber}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, invoiceNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">発行日 *</label>
                      <input
                        type="date"
                        value={currentInvoice.issueDate}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, issueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">支払期限</label>
                      <input
                        type="date"
                        value={currentInvoice.dueDate}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, dueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* 顧客情報 */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">顧客情報</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">顧客名 *</label>
                        <input
                          type="text"
                          value={currentInvoice.customerName}
                          onChange={(e) => setCurrentInvoice({ ...currentInvoice, customerName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">郵便番号</label>
                        <input
                          type="text"
                          value={currentInvoice.customerPostalCode}
                          onChange={(e) => setCurrentInvoice({ ...currentInvoice, customerPostalCode: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">住所</label>
                        <input
                          type="text"
                          value={currentInvoice.customerAddress}
                          onChange={(e) => setCurrentInvoice({ ...currentInvoice, customerAddress: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 明細 */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-gray-900">明細</h4>
                      <button
                        onClick={addItem}
                        className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        + 項目を追加
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="px-3 py-2 text-left text-sm font-medium text-gray-700">項目名</th>
                            <th className="px-3 py-2 text-right text-sm font-medium text-gray-700">数量</th>
                            <th className="px-3 py-2 text-right text-sm font-medium text-gray-700">単価</th>
                            <th className="px-3 py-2 text-right text-sm font-medium text-gray-700">金額</th>
                            <th className="px-3 py-2 text-center text-sm font-medium text-gray-700">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentInvoice.items.map((item, index) => (
                            <tr key={item.id} className="border-b border-gray-100">
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="項目名"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                                  min="0"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={item.unitPrice}
                                  onChange={(e) => handleItemChange(index, 'unitPrice', parseInt(e.target.value) || 0)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                                  min="0"
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className="font-medium">¥{item.amount.toLocaleString()}</span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                {currentInvoice.items.length > 1 && (
                                  <button
                                    onClick={() => removeItem(index)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 合計 */}
                  <div className="flex justify-end">
                    <div className="w-full md:w-1/2 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">小計:</span>
                        <span className="text-gray-900">¥{currentInvoice.subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">消費税:</span>
                          <input
                            type="number"
                            value={currentInvoice.taxRate}
                            onChange={(e) => {
                              const rate = parseInt(e.target.value) || 0;
                              const { subtotal, taxAmount, total } = calculateAmounts(currentInvoice.items, rate);
                              setCurrentInvoice({ ...currentInvoice, taxRate: rate, taxAmount, total });
                            }}
                            className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                            min="0"
                            max="100"
                          />
                          <span className="text-gray-600">%</span>
                        </div>
                        <span className="text-gray-900">¥{currentInvoice.taxAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold text-lg">
                        <span className="text-gray-900">合計:</span>
                        <span className="text-blue-600">¥{currentInvoice.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* 備考 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">備考</label>
                    <textarea
                      value={currentInvoice.notes || ''}
                      onChange={(e) => setCurrentInvoice({ ...currentInvoice, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !currentInvoice.invoiceNumber || !currentInvoice.customerName}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    キャンセル
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

