'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../../../components/Layout';
import { ProtectedRoute } from '../../../components/ProtectedRoute';
import { useAuth } from '../../../contexts/AuthContext';

interface CustomField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'number' | 'url' | 'date' | 'textarea';
}

interface CustomItem {
  id: string;
  fields: CustomField[];
}

interface CompanyInfo {
  name: string;
  nameKana?: string;
  postalCode?: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  website?: string;
  representative?: string;
  establishedDate?: string;
  businessDescription?: string;
  customItems?: CustomItem[];
}

export default function CompanyPage() {
  const { user } = useAuth();
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: '',
    nameKana: '',
    postalCode: '',
    address: '',
    phone: '',
    fax: '',
    email: '',
    website: '',
    representative: '',
    establishedDate: '',
    businessDescription: '',
    customItems: [],
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 会社情報を取得
  useEffect(() => {
    if (user) {
      fetchCompanyInfo();
    }
  }, [user]);

  const fetchCompanyInfo = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const token = await user.getIdToken();
      // TODO: 会社情報取得APIを実装
      // 現在はローカルストレージから取得（暫定）
      const saved = localStorage.getItem('companyInfo');
      if (saved) {
        setCompanyInfo(JSON.parse(saved));
      } else {
        // デフォルト値（ユーザーのcompanyNameから取得）
        const userDoc = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const userData = await userDoc.json();
        const currentUser = userData.users?.find((u: any) => u.id === user.uid);
        if (currentUser?.companyName) {
          setCompanyInfo({ ...companyInfo, name: currentUser.companyName });
        }
      }
    } catch (error) {
      console.error('会社情報取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    try {
      setIsSaving(true);
      const token = await user.getIdToken();
      
      // TODO: 会社情報保存APIを実装
      // 現在はローカルストレージに保存（暫定）
      localStorage.setItem('companyInfo', JSON.stringify(companyInfo));
      
      setIsEditing(false);
      alert('会社情報を保存しました');
    } catch (error) {
      console.error('会社情報保存エラー:', error);
      alert('会社情報の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof CompanyInfo, value: string) => {
    setCompanyInfo({ ...companyInfo, [field]: value });
  };


  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gray-50">
          {/* ヘッダー */}
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">会社情報</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-2">会社の基本情報を管理します</p>
              </div>
              <div className="flex items-center gap-3">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base disabled:opacity-50"
                    >
                      {isSaving ? '保存中...' : '保存'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        fetchCompanyInfo();
                      }}
                      className="px-4 sm:px-6 py-2 sm:py-3 bg-gray-300 text-gray-700 rounded-xl hover:bg-gray-400 transition-all duration-200 text-sm sm:text-base"
                    >
                      キャンセル
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base"
                  >
                    編集
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* コンテンツ */}
          <div className="p-4 sm:p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">読み込み中...</span>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8">
                  {/* 基本情報 */}
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">基本情報</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">会社名 *</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={companyInfo.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        ) : (
                          <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{companyInfo.name || '未設定'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">会社名（カナ）</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={companyInfo.nameKana || ''}
                            onChange={(e) => handleChange('nameKana', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{companyInfo.nameKana || '未設定'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">郵便番号</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={companyInfo.postalCode || ''}
                            onChange={(e) => handleChange('postalCode', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="123-4567"
                          />
                        ) : (
                          <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{companyInfo.postalCode || '未設定'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">住所</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={companyInfo.address || ''}
                            onChange={(e) => handleChange('address', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{companyInfo.address || '未設定'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">電話番号</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={companyInfo.phone || ''}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="03-1234-5678"
                          />
                        ) : (
                          <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{companyInfo.phone || '未設定'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">FAX</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={companyInfo.fax || ''}
                            onChange={(e) => handleChange('fax', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="03-1234-5679"
                          />
                        ) : (
                          <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{companyInfo.fax || '未設定'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">メールアドレス</label>
                        {isEditing ? (
                          <input
                            type="email"
                            value={companyInfo.email || ''}
                            onChange={(e) => handleChange('email', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{companyInfo.email || '未設定'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">ウェブサイト</label>
                        {isEditing ? (
                          <input
                            type="url"
                            value={companyInfo.website || ''}
                            onChange={(e) => handleChange('website', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="https://example.com"
                          />
                        ) : (
                          <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{companyInfo.website || '未設定'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 会社詳細 */}
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">会社詳細</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">代表者名</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={companyInfo.representative || ''}
                            onChange={(e) => handleChange('representative', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{companyInfo.representative || '未設定'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">設立日</label>
                        {isEditing ? (
                          <input
                            type="date"
                            value={companyInfo.establishedDate || ''}
                            onChange={(e) => handleChange('establishedDate', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{companyInfo.establishedDate || '未設定'}</p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">事業内容</label>
                        {isEditing ? (
                          <textarea
                            value={companyInfo.businessDescription || ''}
                            onChange={(e) => handleChange('businessDescription', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={4}
                          />
                        ) : (
                          <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900 whitespace-pre-wrap">{companyInfo.businessDescription || '未設定'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* カスタム情報管理 */}
                  <div>
                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-200">
                      <h2 className="text-xl font-semibold text-gray-900">カスタム情報</h2>
                      {isEditing && (
                        <button
                          onClick={() => {
                            const newItem: CustomItem = {
                              id: Date.now().toString(),
                              fields: [
                                { id: '1', label: '項目名', value: '', type: 'text' },
                                { id: '2', label: '説明', value: '', type: 'textarea' },
                                { id: '3', label: '値', value: '', type: 'text' },
                              ],
                            };
                            setCompanyInfo({
                              ...companyInfo,
                              customItems: [...(companyInfo.customItems || []), newItem],
                            });
                          }}
                          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          項目を追加
                        </button>
                      )}
                    </div>
                    {companyInfo.customItems && companyInfo.customItems.length > 0 ? (
                      <div className="space-y-4">
                        {companyInfo.customItems.map((item, itemIndex) => (
                          <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            {isEditing ? (
                              <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 space-y-3">
                                    {item.fields.map((field, fieldIndex) => (
                                      <div key={field.id}>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          {field.label}
                                          {(field.label === 'ツール名' || field.label === '商品名' || field.label === '資材名' || field.label === '部品名' || field.label === 'サービス名' || field.label === '項目名') && ' *'}
                                        </label>
                                        {field.type === 'text' && (
                                          <input
                                            type="text"
                                            value={field.value}
                                            onChange={(e) => {
                                              const newItems = [...(companyInfo.customItems || [])];
                                              newItems[itemIndex].fields[fieldIndex] = { ...field, value: e.target.value };
                                              setCompanyInfo({ ...companyInfo, customItems: newItems });
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            required={field.label === 'ツール名' || field.label === '商品名' || field.label === '資材名' || field.label === '部品名' || field.label === 'サービス名'}
                                          />
                                        )}
                                        {field.type === 'number' && (
                                          <input
                                            type="number"
                                            value={field.value}
                                            onChange={(e) => {
                                              const newItems = [...(companyInfo.customItems || [])];
                                              newItems[itemIndex].fields[fieldIndex] = { ...field, value: e.target.value };
                                              setCompanyInfo({ ...companyInfo, customItems: newItems });
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            min="0"
                                          />
                                        )}
                                        {field.type === 'url' && (
                                          <input
                                            type="url"
                                            value={field.value}
                                            onChange={(e) => {
                                              const newItems = [...(companyInfo.customItems || [])];
                                              newItems[itemIndex].fields[fieldIndex] = { ...field, value: e.target.value };
                                              setCompanyInfo({ ...companyInfo, customItems: newItems });
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="https://example.com"
                                            required={field.label === 'URL'}
                                          />
                                        )}
                                        {field.type === 'date' && (
                                          <input
                                            type="date"
                                            value={field.value}
                                            onChange={(e) => {
                                              const newItems = [...(companyInfo.customItems || [])];
                                              newItems[itemIndex].fields[fieldIndex] = { ...field, value: e.target.value };
                                              setCompanyInfo({ ...companyInfo, customItems: newItems });
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                          />
                                        )}
                                        {field.type === 'textarea' && (
                                          <textarea
                                            value={field.value}
                                            onChange={(e) => {
                                              const newItems = [...(companyInfo.customItems || [])];
                                              newItems[itemIndex].fields[fieldIndex] = { ...field, value: e.target.value };
                                              setCompanyInfo({ ...companyInfo, customItems: newItems });
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            rows={3}
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => {
                                      const newItems = companyInfo.customItems?.filter((_, i) => i !== itemIndex) || [];
                                      setCompanyInfo({ ...companyInfo, customItems: newItems });
                                    }}
                                    className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between">
                                <div className="flex-1 space-y-2">
                                  {item.fields.map((field) => (
                                    <div key={field.id} className={`flex items-start gap-2 ${field.type === 'textarea' ? 'flex-col' : ''}`}>
                                      <span className="text-sm font-medium text-gray-700 min-w-[100px]">{field.label}:</span>
                                      <span className={`text-sm text-gray-900 flex-1 ${field.type === 'textarea' ? 'whitespace-pre-wrap' : ''}`}>
                                        {field.type === 'url' && field.value ? (
                                          <a
                                            href={field.value}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            {field.value}
                                          </a>
                                        ) : (
                                          field.value || '未設定'
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        {isEditing ? (
                          <p className="text-sm">「項目を追加」ボタンから情報を追加してください</p>
                        ) : (
                          <p className="text-sm">登録されている情報はありません</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

