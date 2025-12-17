'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Template {
  id: string;
  templateNumber: string;
  name: string;
  category: string;
  description: string;
  content: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<Omit<Template, 'id' | 'createdAt' | 'updatedAt'>>({
    templateNumber: '',
    name: '',
    category: '',
    description: '',
    content: '',
    variables: []
  });
  const [variableInput, setVariableInput] = useState('');

  useEffect(() => {
    if (user) {
      loadTemplates();
    }
  }, [user]);

  const loadTemplates = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      // TODO: API実装後に接続
    } catch (error) {
      console.error('テンプレートの読み込みエラー:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      // TODO: API実装後に接続
      setShowModal(false);
      setEditingTemplate(null);
      setFormData({
        templateNumber: '',
        name: '',
        category: '',
        description: '',
        content: '',
        variables: []
      });
      loadTemplates();
    } catch (error) {
      console.error('テンプレートの保存エラー:', error);
      alert('テンプレートの保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('このテンプレートを削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      // TODO: API実装後に接続
      loadTemplates();
    } catch (error) {
      console.error('テンプレートの削除エラー:', error);
      alert('テンプレートの削除に失敗しました');
    }
  };

  const addVariable = () => {
    if (variableInput.trim()) {
      setFormData({ ...formData, variables: [...formData.variables, variableInput.trim()] });
      setVariableInput('');
    }
  };

  const removeVariable = (index: number) => {
    setFormData({ ...formData, variables: formData.variables.filter((_, i) => i !== index) });
  };

  const categories = ['契約書', '見積書', '請求書', '議事録', '報告書', 'その他'];

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">テンプレート管理</h1>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setFormData({
                  templateNumber: '',
                  name: '',
                  category: '',
                  description: '',
                  content: '',
                  variables: []
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
            >
              テンプレートを追加
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">テンプレート番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名前</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">カテゴリ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">説明</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">変数数</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {templates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        テンプレートがありません
                      </td>
                    </tr>
                  ) : (
                    templates.map((template) => (
                      <tr key={template.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{template.templateNumber}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{template.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{template.category}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{template.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{template.variables.length}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setEditingTemplate(template);
                              setFormData({
                                templateNumber: template.templateNumber,
                                name: template.name,
                                category: template.category,
                                description: template.description,
                                content: template.content,
                                variables: template.variables
                              });
                              setShowModal(true);
                            }}
                            className="text-[#005eb2] hover:text-[#004a96] mr-4"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
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
              <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {editingTemplate ? 'テンプレートを編集' : 'テンプレートを追加'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">テンプレート番号</label>
                    <input
                      type="text"
                      value={formData.templateNumber}
                      onChange={(e) => setFormData({ ...formData, templateNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder="テンプレートの内容を入力。変数は {{変数名}} の形式で記述してください。"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">変数</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={variableInput}
                        onChange={(e) => setVariableInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addVariable();
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="変数名を入力してEnter"
                      />
                      <button
                        type="button"
                        onClick={addVariable}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        追加
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.variables.map((variable, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                        >
                          {variable}
                          <button
                            type="button"
                            onClick={() => removeVariable(index)}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingTemplate(null);
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


