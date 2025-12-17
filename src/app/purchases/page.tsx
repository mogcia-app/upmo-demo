'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierName: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  orderDate: string;
  expectedDeliveryDate: string;
  receivedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export default function PurchasesPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [formData, setFormData] = useState<Omit<Purchase, 'id' | 'totalAmount' | 'createdAt' | 'updatedAt' | 'receivedDate'>>({
    purchaseNumber: '',
    supplierName: '',
    itemName: '',
    quantity: 0,
    unit: '個',
    unitPrice: 0,
    status: 'draft',
    orderDate: '',
    expectedDeliveryDate: ''
  });

  useEffect(() => {
    if (user) {
      loadPurchases();
    }
  }, [user]);

  const loadPurchases = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/purchases', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPurchases(data.purchases || []);
      }
    } catch (error) {
      console.error('発注の読み込みエラー:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.purchaseNumber || !formData.supplierName || !formData.itemName) {
      alert('発注番号、仕入先名、商品名は必須です');
      return;
    }
    try {
      const token = await user.getIdToken();
      const method = editingPurchase ? 'PUT' : 'POST';
      const body = editingPurchase 
        ? { id: editingPurchase.id, ...formData }
        : formData;
      
      const response = await fetch('/api/purchases', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setShowModal(false);
        setEditingPurchase(null);
        setFormData({
          purchaseNumber: '',
          supplierName: '',
          itemName: '',
          quantity: 0,
          unit: '個',
          unitPrice: 0,
          status: 'draft',
          orderDate: '',
          expectedDeliveryDate: ''
        });
        loadPurchases();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '発注の保存に失敗しました');
      }
    } catch (error) {
      console.error('発注の保存エラー:', error);
      alert('発注の保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('この発注を削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/purchases?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadPurchases();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '発注の削除に失敗しました');
      }
    } catch (error) {
      console.error('発注の削除エラー:', error);
      alert('発注の削除に失敗しました');
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">発注管理</h1>
            <button
              onClick={() => {
                setEditingPurchase(null);
                setFormData({
                  purchaseNumber: '',
                  supplierName: '',
                  itemName: '',
                  quantity: 0,
                  unit: '個',
                  unitPrice: 0,
                  status: 'draft',
                  orderDate: '',
                  expectedDeliveryDate: ''
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              発注を追加
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">発注番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">仕入先</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">単価</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">合計金額</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">発注日</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                        発注がありません
                      </td>
                    </tr>
                  ) : (
                    purchases.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{purchase.purchaseNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purchase.supplierName}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{purchase.itemName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purchase.quantity} {purchase.unit}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">¥{purchase.unitPrice.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">¥{purchase.totalAmount.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            purchase.status === 'received' ? 'bg-green-100 text-green-800' :
                            purchase.status === 'ordered' ? 'bg-blue-100 text-blue-800' :
                            purchase.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {purchase.status === 'draft' ? '下書き' :
                             purchase.status === 'ordered' ? '発注済み' :
                             purchase.status === 'received' ? '入荷済み' :
                             'キャンセル'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purchase.orderDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setEditingPurchase(purchase);
                              setFormData({
                                purchaseNumber: purchase.purchaseNumber,
                                supplierName: purchase.supplierName,
                                itemName: purchase.itemName,
                                quantity: purchase.quantity,
                                unit: purchase.unit,
                                unitPrice: purchase.unitPrice,
                                status: purchase.status,
                                orderDate: purchase.orderDate,
                                expectedDeliveryDate: purchase.expectedDeliveryDate
                              });
                              setShowModal(true);
                            }}
                            className="text-[#005eb2] hover:text-[#004a96] mr-4"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(purchase.id)}
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
                  {editingPurchase ? '発注を編集' : '発注を追加'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">発注番号</label>
                    <input
                      type="text"
                      value={formData.purchaseNumber}
                      onChange={(e) => setFormData({ ...formData, purchaseNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">仕入先</label>
                    <input
                      type="text"
                      value={formData.supplierName}
                      onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">商品名</label>
                    <input
                      type="text"
                      value={formData.itemName}
                      onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
                      <input
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">単位</label>
                      <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="個">個</option>
                        <option value="本">本</option>
                        <option value="枚">枚</option>
                        <option value="箱">箱</option>
                        <option value="kg">kg</option>
                        <option value="L">L</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">単価</label>
                      <input
                        type="number"
                        value={formData.unitPrice}
                        onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Purchase['status'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="draft">下書き</option>
                      <option value="ordered">発注済み</option>
                      <option value="received">入荷済み</option>
                      <option value="cancelled">キャンセル</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">発注日</label>
                      <input
                        type="date"
                        value={formData.orderDate}
                        onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">納期予定</label>
                      <input
                        type="date"
                        value={formData.expectedDeliveryDate}
                        onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingPurchase(null);
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


