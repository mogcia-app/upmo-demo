'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface InventoryItem {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  location: string;
  minStock: number;
  maxStock: number;
  supplier: string;
  createdAt: string;
  updatedAt: string;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>>({
    itemCode: '',
    itemName: '',
    category: '',
    quantity: 0,
    unit: '個',
    unitPrice: 0,
    location: '',
    minStock: 0,
    maxStock: 0,
    supplier: ''
  });

  useEffect(() => {
    if (user) {
      loadItems();
    }
  }, [user]);

  const loadItems = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/inventory', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('在庫の読み込みエラー:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.itemCode || !formData.itemName) {
      alert('商品コード、商品名は必須です');
      return;
    }
    try {
      const token = await user.getIdToken();
      const method = editingItem ? 'PUT' : 'POST';
      const body = editingItem 
        ? { id: editingItem.id, ...formData }
        : formData;
      
      const response = await fetch('/api/inventory', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setShowModal(false);
        setEditingItem(null);
        setFormData({
          itemCode: '',
          itemName: '',
          category: '',
          quantity: 0,
          unit: '個',
          unitPrice: 0,
          location: '',
          minStock: 0,
          maxStock: 0,
          supplier: ''
        });
        loadItems();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '在庫の保存に失敗しました');
      }
    } catch (error) {
      console.error('在庫の保存エラー:', error);
      alert('在庫の保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('この在庫を削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/inventory?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadItems();
      } else {
        const errorData = await response.json();
        alert(errorData.error || '在庫の削除に失敗しました');
      }
    } catch (error) {
      console.error('在庫の削除エラー:', error);
      alert('在庫の削除に失敗しました');
    }
  };

  const getStockStatus = (quantity: number, minStock: number, maxStock: number) => {
    if (quantity <= minStock) return { label: '在庫不足', color: 'bg-red-100 text-red-800' };
    if (quantity >= maxStock) return { label: '在庫過多', color: 'bg-yellow-100 text-yellow-800' };
    return { label: '正常', color: 'bg-green-100 text-green-800' };
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">在庫管理</h1>
            <button
              onClick={() => {
                setEditingItem(null);
                setFormData({
                  itemCode: '',
                  itemName: '',
                  category: '',
                  quantity: 0,
                  unit: '個',
                  unitPrice: 0,
                  location: '',
                  minStock: 0,
                  maxStock: 0,
                  supplier: ''
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              在庫を追加
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品コード</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">カテゴリ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">在庫数</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">単価</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">保管場所</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        在庫がありません
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const status = getStockStatus(item.quantity, item.minStock, item.maxStock);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.itemCode}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{item.itemName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.category}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity} {item.unit}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">¥{item.unitPrice.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.location}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setFormData({
                                  itemCode: item.itemCode,
                                  itemName: item.itemName,
                                  category: item.category,
                                  quantity: item.quantity,
                                  unit: item.unit,
                                  unitPrice: item.unitPrice,
                                  location: item.location,
                                  minStock: item.minStock,
                                  maxStock: item.maxStock,
                                  supplier: item.supplier
                                });
                                setShowModal(true);
                              }}
                              className="text-[#005eb2] hover:text-[#004a96] mr-4"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {editingItem ? '在庫を編集' : '在庫を追加'}
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">商品コード</label>
                      <input
                        type="text"
                        value={formData.itemCode}
                        onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
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
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">在庫数</label>
                      <input
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">最小在庫</label>
                      <input
                        type="number"
                        value={formData.minStock}
                        onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">最大在庫</label>
                      <input
                        type="number"
                        value={formData.maxStock}
                        onChange={(e) => setFormData({ ...formData, maxStock: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">単価</label>
                      <input
                        type="number"
                        value={formData.unitPrice}
                        onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">保管場所</label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">仕入先</label>
                    <input
                      type="text"
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingItem(null);
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


