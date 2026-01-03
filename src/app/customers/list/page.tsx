"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../../components/Layout";
import { ProtectedRoute } from "../../../components/ProtectedRoute";
import { useAuth } from "../../../contexts/AuthContext";

interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  website?: string;
  status: 'active' | 'inactive' | 'prospect';
  priority: 'low' | 'medium' | 'high';
  lastContact: string | Date;
  contractDate?: string | Date;
  notes: any;
  createdAt: string | Date;
}

export default function CustomerListPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
          createdAt: new Date(c.createdAt),
          contractDate: c.contractDate ? new Date(c.contractDate) : undefined
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

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.company.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* ヘッダーと検索 */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            {/* ヘッダー */}
            <div className="mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">顧客リスト</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">顧客情報の一覧表示</p>
            </div>

            {/* 検索 */}
            <div className="border-t border-gray-200 pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSearchTerm("");
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    リセット
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 顧客リスト */}
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
                <p className="mt-1 text-sm text-gray-500">検索条件を変更してみてください</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">顧客情報</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">連絡先</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">契約日</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">メモ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                            <div className="text-sm text-gray-500">{customer.company}</div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4">
                          <div className="space-y-1">
                            {customer.email && (
                              <div className="text-sm text-gray-900">
                                <a href={`mailto:${customer.email}`} className="text-[#005eb2] hover:underline">
                                  {customer.email}
                                </a>
                              </div>
                            )}
                            {customer.phone && (
                              <div className="text-sm text-gray-900">
                                <a href={`tel:${customer.phone}`} className="text-[#005eb2] hover:underline">
                                  {customer.phone}
                                </a>
                              </div>
                            )}
                            {customer.website && (
                              <div className="text-sm text-gray-900">
                                <a href={customer.website.startsWith('http') ? customer.website : `https://${customer.website}`} target="_blank" rel="noopener noreferrer" className="text-[#005eb2] hover:underline">
                                  {customer.website}
                                </a>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.contractDate 
                            ? (customer.contractDate instanceof Date 
                                ? customer.contractDate.toLocaleDateString('ja-JP')
                                : new Date(customer.contractDate).toLocaleDateString('ja-JP'))
                            : '-'}
                        </td>
                        <td className="px-3 sm:px-6 py-4">
                          <div className="text-sm text-gray-700">
                            {Array.isArray(customer.notes) && customer.notes.length > 0
                              ? `${customer.notes.length}件のメモ`
                              : typeof customer.notes === 'string' && customer.notes
                                ? '1件のメモ'
                                : '-'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

