'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  title: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: string;
  deliveryDate: string;
  createdAt: string;
  updatedAt: string;
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState<Omit<Order, 'id' | 'createdAt' | 'updatedAt'>>({
    orderNumber: '',
    customerName: '',
    title: '',
    amount: 0,
    status: 'pending',
    orderDate: '',
    deliveryDate: ''
  });

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  const loadOrders = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/sales/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('受注の読み込みエラー:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.orderNumber || !formData.customerName || !formData.title) {
      alert('受注番号、顧客名、タイトルは必須です');
      return;
    }
    try {
      const token = await user.getIdToken();
      const method = editingOrder ? 'PUT' : 'POST';
      const body = editingOrder 
        ? { id: editingOrder.id, ...formData }
        : formData;
      
      const response = await fetch('/api/sales/orders', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setShowModal(false);
        setEditingOrder(null);
        setFormData({
          orderNumber: '',
          customerName: '',
          title: '',
          amount: 0,
          status: 'pending',
          orderDate: '',
          deliveryDate: ''
        });
        loadOrders();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '受注の保存に失敗しました');
      }
    } catch (error) {
      console.error('受注の保存エラー:', error);
      alert('受注の保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('この受注を削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/sales/orders?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadOrders();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '受注の削除に失敗しました');
      }
    } catch (error) {
      console.error('受注の削除エラー:', error);
      alert('受注の削除に失敗しました');
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">受注管理</h1>
            <button
              onClick={() => {
                setEditingOrder(null);
                setFormData({
                  orderNumber: '',
                  customerName: '',
                  title: '',
                  amount: 0,
                  status: 'pending',
                  orderDate: '',
                  deliveryDate: ''
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              受注を追加
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">受注番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">顧客名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイトル</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金額</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">受注日</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">納期</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        受注がありません
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.orderNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.customerName}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{order.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">¥{order.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status === 'pending' ? '保留' :
                             order.status === 'confirmed' ? '確定' :
                             order.status === 'shipped' ? '出荷済み' :
                             order.status === 'delivered' ? '納品済み' :
                             'キャンセル'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.orderDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.deliveryDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setEditingOrder(order);
                              setFormData({
                                orderNumber: order.orderNumber,
                                customerName: order.customerName,
                                title: order.title,
                                amount: order.amount,
                                status: order.status,
                                orderDate: order.orderDate,
                                deliveryDate: order.deliveryDate
                              });
                              setShowModal(true);
                            }}
                            className="text-[#005eb2] hover:text-[#004a96] mr-4"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(order.id)}
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
                  {editingOrder ? '受注を編集' : '受注を追加'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">受注番号</label>
                    <input
                      type="text"
                      value={formData.orderNumber}
                      onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Order['status'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="pending">保留</option>
                      <option value="confirmed">確定</option>
                      <option value="shipped">出荷済み</option>
                      <option value="delivered">納品済み</option>
                      <option value="cancelled">キャンセル</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">受注日</label>
                    <input
                      type="date"
                      value={formData.orderDate}
                      onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">納期</label>
                    <input
                      type="date"
                      value={formData.deliveryDate}
                      onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingOrder(null);
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


