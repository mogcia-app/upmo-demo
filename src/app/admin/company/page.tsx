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

interface CustomGroup {
  id: string;
  name: string;
  items: CustomItem[];
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
  customGroups?: CustomGroup[];
}

// URL判定関数
const isUrl = (str: string): boolean => {
  if (!str || str.trim() === '') return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    // http:// や https:// で始まる場合はURLとして扱う
    return /^https?:\/\/.+/.test(str.trim());
  }
};

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
    customGroups: [],
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
      
      // 会社情報取得APIから取得
      const response = await fetch('/api/admin/company', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('会社情報の取得に失敗しました');
      }
      
      const data = await response.json();
      if (data.success && data.companyInfo) {
        setCompanyInfo(data.companyInfo);
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
      
      // URL自動判定: カスタムグループの各項目の値をチェック
      const updatedCompanyInfo = { ...companyInfo };
      if (updatedCompanyInfo.customGroups) {
        updatedCompanyInfo.customGroups = updatedCompanyInfo.customGroups.map(group => ({
          ...group,
          items: group.items.map(item => ({
            ...item,
            fields: item.fields.map(field => {
              // 値がURL形式の場合は、typeをurlに変更（ただし、既にurlタイプの場合はそのまま）
              if (field.type !== 'url' && field.value && isUrl(field.value)) {
                return { ...field, type: 'url' };
              }
              return field;
            })
          }))
        }));
      }
      
      // 会社情報保存APIに送信
      const response = await fetch('/api/admin/company', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedCompanyInfo),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '会社情報の保存に失敗しました');
      }
      
      const data = await response.json();
      if (data.success) {
        setCompanyInfo(updatedCompanyInfo);
        setIsEditing(false);
        alert('会社情報を保存しました');
      }
    } catch (error: any) {
      console.error('会社情報保存エラー:', error);
      alert(error.message || '会社情報の保存に失敗しました');
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
        <div className="min-h-screen bg-gray-50 -mx-4 lg:-mx-6">
          {/* ヘッダー */}
          <div className="bg-white border-b border-gray-100 px-6 sm:px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">会社情報</h1>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {isSaving ? '保存中...' : '保存'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        fetchCompanyInfo();
                      }}
                      className="px-3 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors text-sm font-medium"
                    >
                      キャンセル
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    編集
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* コンテンツ */}
          <div className="px-6 sm:px-8 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">読み込み中...</span>
              </div>
            ) : (
              <div>
                <div className="bg-white border border-gray-200 p-6 sm:p-8">
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
                            className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        ) : (
                          <p className="px-4 py-2 bg-gray-50 text-gray-900">{companyInfo.name || '未設定'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">会社名（カナ）</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={companyInfo.nameKana || ''}
                            onChange={(e) => handleChange('nameKana', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
                            className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
                            className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
                            className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
                            className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
                            className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
                            className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
                            className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
                            className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
                            className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            rows={4}
                          />
                        ) : (
                          <p className="px-4 py-2 bg-gray-50 text-gray-900 whitespace-pre-wrap">{companyInfo.businessDescription || '未設定'}</p>
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
                            const newGroup: CustomGroup = {
                              id: Date.now().toString(),
                              name: '',
                              items: [],
                            };
                            setCompanyInfo({
                              ...companyInfo,
                              customGroups: [...(companyInfo.customGroups || []), newGroup],
                            });
                          }}
                          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          グループを追加
                        </button>
                      )}
                    </div>
                    {/* カスタムグループ */}
                    {companyInfo.customGroups && companyInfo.customGroups.length > 0 ? (
                      <div className="space-y-6">
                        {companyInfo.customGroups.map((group, groupIndex) => (
                          <div key={group.id} className="border border-gray-200 p-4 bg-white">
                            {isEditing ? (
                              <div className="space-y-4">
                                {/* グループ名 */}
                                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                                  <input
                                    type="text"
                                    value={group.name}
                                    onChange={(e) => {
                                      const newGroups = [...(companyInfo.customGroups || [])];
                                      newGroups[groupIndex].name = e.target.value;
                                      setCompanyInfo({ ...companyInfo, customGroups: newGroups });
                                    }}
                                    placeholder="グループ名"
                                    className="flex-1 px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
                                  />
                                  <button
                                    onClick={() => {
                                      const newGroups = companyInfo.customGroups?.filter((_, i) => i !== groupIndex) || [];
                                      setCompanyInfo({ ...companyInfo, customGroups: newGroups });
                                    }}
                                    className="ml-3 p-2 text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>

                                {/* 項目一覧 */}
                                <div className="space-y-4">
                                  {group.items.map((item, itemIndex) => {
                                    const titleField = item.fields.find(f => f.label === 'タイトル');
                                    const contentFields = item.fields.filter(f => f.label !== 'タイトル');
                                    return (
                                      <div key={item.id} className="border border-gray-200 p-4 bg-white">
                                        <div className="space-y-3">
                                          {/* タイトル */}
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                              タイトル
                                            </label>
                                            <input
                                              type="text"
                                              value={titleField?.value || ''}
                                              onChange={(e) => {
                                                const newGroups = [...(companyInfo.customGroups || [])];
                                                const titleFieldIndex = newGroups[groupIndex].items[itemIndex].fields.findIndex(f => f.label === 'タイトル');
                                                if (titleFieldIndex >= 0) {
                                                  newGroups[groupIndex].items[itemIndex].fields[titleFieldIndex] = { ...newGroups[groupIndex].items[itemIndex].fields[titleFieldIndex], value: e.target.value };
                                                } else {
                                                  newGroups[groupIndex].items[itemIndex].fields.unshift({ id: Date.now().toString(), label: 'タイトル', value: e.target.value, type: 'text' });
                                                }
                                                setCompanyInfo({ ...companyInfo, customGroups: newGroups });
                                              }}
                                              className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                                              placeholder="項目タイトル"
                                            />
                                          </div>

                                          {/* コンテンツフィールド */}
                                          <div className="space-y-3 pl-4 border-l-2 border-gray-200">
                                            {contentFields.map((field, fieldIndex) => {
                                              const actualFieldIndex = item.fields.findIndex(f => f.id === field.id);
                                              return (
                                                <div key={field.id} className="flex items-start gap-2">
                                                  <div className="flex-1">
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                      {field.label}
                                                    </label>
                                                    {field.type === 'text' && (
                                                      <input
                                                        type="text"
                                                        value={field.value}
                                                        onChange={(e) => {
                                                          const newGroups = [...(companyInfo.customGroups || [])];
                                                          newGroups[groupIndex].items[itemIndex].fields[actualFieldIndex] = { ...field, value: e.target.value };
                                                          setCompanyInfo({ ...companyInfo, customGroups: newGroups });
                                                        }}
                                                        className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                                                      />
                                                    )}
                                                    {field.type === 'url' && (
                                                      <input
                                                        type="url"
                                                        value={field.value}
                                                        onChange={(e) => {
                                                          const newGroups = [...(companyInfo.customGroups || [])];
                                                          newGroups[groupIndex].items[itemIndex].fields[actualFieldIndex] = { ...field, value: e.target.value };
                                                          setCompanyInfo({ ...companyInfo, customGroups: newGroups });
                                                        }}
                                                        className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                                                        placeholder="https://example.com"
                                                      />
                                                    )}
                                                    {field.type === 'textarea' && (
                                                      <textarea
                                                        value={field.value}
                                                        onChange={(e) => {
                                                          const newGroups = [...(companyInfo.customGroups || [])];
                                                          newGroups[groupIndex].items[itemIndex].fields[actualFieldIndex] = { ...field, value: e.target.value };
                                                          setCompanyInfo({ ...companyInfo, customGroups: newGroups });
                                                        }}
                                                        className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                                                        rows={3}
                                                      />
                                                    )}
                                                  </div>
                                                  <button
                                                    onClick={() => {
                                                      const newGroups = [...(companyInfo.customGroups || [])];
                                                      newGroups[groupIndex].items[itemIndex].fields = newGroups[groupIndex].items[itemIndex].fields.filter((_, i) => i !== actualFieldIndex);
                                                      setCompanyInfo({ ...companyInfo, customGroups: newGroups });
                                                    }}
                                                    className="mt-7 p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                                                  >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                  </button>
                                                </div>
                                              );
                                            })}

                                            {/* コンテンツ追加ボタン */}
                                            <div className="flex gap-2 pt-2">
                                              <button
                                                onClick={() => {
                                                  const newGroups = [...(companyInfo.customGroups || [])];
                                                  const newField: CustomField = {
                                                    id: Date.now().toString(),
                                                    label: 'テキスト',
                                                    value: '',
                                                    type: 'text',
                                                  };
                                                  newGroups[groupIndex].items[itemIndex].fields.push(newField);
                                                  setCompanyInfo({ ...companyInfo, customGroups: newGroups });
                                                }}
                                                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                                              >
                                                テキストを追加
                                              </button>
                                              <button
                                                onClick={() => {
                                                  const newGroups = [...(companyInfo.customGroups || [])];
                                                  const newField: CustomField = {
                                                    id: Date.now().toString(),
                                                    label: 'URL',
                                                    value: '',
                                                    type: 'url',
                                                  };
                                                  newGroups[groupIndex].items[itemIndex].fields.push(newField);
                                                  setCompanyInfo({ ...companyInfo, customGroups: newGroups });
                                                }}
                                                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                                              >
                                                URLを追加
                                              </button>
                                            </div>
                                          </div>

                                          {/* 項目削除ボタン */}
                                          <div className="flex justify-end pt-2 border-t border-gray-200">
                                            <button
                                              onClick={() => {
                                                const newGroups = [...(companyInfo.customGroups || [])];
                                                newGroups[groupIndex].items = newGroups[groupIndex].items.filter((_, i) => i !== itemIndex);
                                                setCompanyInfo({ ...companyInfo, customGroups: newGroups });
                                              }}
                                              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                                            >
                                              項目を削除
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* 項目を追加ボタン */}
                                <button
                                  onClick={() => {
                                    const newItem: CustomItem = {
                                      id: Date.now().toString(),
                                      fields: [
                                        { id: Date.now().toString(), label: 'タイトル', value: '', type: 'text' },
                                      ],
                                    };
                                    const newGroups = [...(companyInfo.customGroups || [])];
                                    newGroups[groupIndex].items.push(newItem);
                                    setCompanyInfo({ ...companyInfo, customGroups: newGroups });
                                  }}
                                  className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors border border-gray-300"
                                >
                                  + 項目を追加
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <h3 className="text-base font-semibold text-gray-900 pb-2 border-b border-gray-200">{group.name || 'グループ名未設定'}</h3>
                                {group.items.length > 0 ? (
                                  <div className="space-y-4">
                                    {group.items.map((item) => {
                                      const titleField = item.fields.find(f => f.label === 'タイトル');
                                      const contentFields = item.fields.filter(f => f.label !== 'タイトル');
                                      return (
                                        <div key={item.id} className="border border-gray-200 p-4 bg-white">
                                          {/* タイトル */}
                                          {titleField && titleField.value && (
                                            <h4 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                                              {titleField.value}
                                            </h4>
                                          )}
                                          {/* コンテンツ */}
                                          {contentFields.length > 0 ? (
                                            <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                                              {contentFields.map((field) => (
                                                <div key={field.id} className={`${field.type === 'textarea' ? 'flex flex-col' : ''}`}>
                                                  <span className={`text-sm text-gray-900 ${field.type === 'textarea' ? 'whitespace-pre-wrap' : ''}`}>
                                                    {(field.type === 'url' || isUrl(field.value)) && field.value ? (
                                                      <a
                                                        href={field.value.startsWith('http') ? field.value : `https://${field.value}`}
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
                                          ) : (
                                            <p className="text-sm text-gray-500 pl-4">コンテンツがありません</p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">項目がありません</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        {isEditing ? (
                          <p className="text-sm">「グループを追加」ボタンからグループを作成してください</p>
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

