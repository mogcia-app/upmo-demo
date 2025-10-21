"use client";

import React, { useState } from "react";
import { ComponentType, CustomComponent } from "../types/components";

interface ComponentEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onAddComponent: (component: CustomComponent) => void;
}

const ComponentEditor: React.FC<ComponentEditorProps> = ({ isOpen, onClose, onAddComponent }) => {
  const [selectedType, setSelectedType] = useState<ComponentType | null>(null);
  const [title, setTitle] = useState("");
  const [config, setConfig] = useState<Record<string, any>>({});

  const componentTypes = [
    { type: ComponentType.DATA_TABLE, name: "データテーブル", icon: "📊", description: "表形式でデータを表示・編集" },
    { type: ComponentType.CHART, name: "チャート", icon: "📈", description: "グラフでデータを可視化" },
    { type: ComponentType.FORM, name: "フォーム", icon: "📝", description: "入力フォームを作成" },
    { type: ComponentType.TEXT, name: "テキスト", icon: "📄", description: "テキストブロックを追加" },
  ];

  const handleAddComponent = () => {
    if (!selectedType || !title.trim()) return;

    const newComponent: CustomComponent = {
      id: `component_${Date.now()}`,
      type: selectedType,
      title: title.trim(),
      position: { x: 0, y: 0 },
      size: { width: 400, height: 300 },
      config: config,
    } as CustomComponent;

    onAddComponent(newComponent);
    setSelectedType(null);
    setTitle("");
    setConfig({});
    onClose();
  };

  const renderConfigForm = () => {
    switch (selectedType) {
      case ComponentType.DATA_TABLE:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                列の設定
              </label>
              <div className="space-y-2">
                {config.columns?.map((col: any, index: number) => (
                  <div key={`column-config-${index}`} className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="列名"
                      value={col.name}
                      onChange={(e) => {
                        const newColumns = [...config.columns];
                        newColumns[index] = { ...col, name: e.target.value };
                        setConfig({ ...config, columns: newColumns });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <select
                      value={col.type}
                      onChange={(e) => {
                        const newColumns = [...config.columns];
                        newColumns[index] = { ...col, type: e.target.value };
                        setConfig({ ...config, columns: newColumns });
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="text">テキスト</option>
                      <option value="number">数値</option>
                      <option value="date">日付</option>
                      <option value="select">選択</option>
                    </select>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const newColumnId = `column_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                  setConfig({
                    ...config,
                    columns: [...(config.columns || []), { id: newColumnId, name: "", type: "text" }],
                    data: []
                  });
                }}
                className="mt-2 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                + 列を追加
              </button>
            </div>
          </div>
        );

      case ComponentType.CHART:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                チャートタイプ
              </label>
              <select
                value={config.chartType || "bar"}
                onChange={(e) => setConfig({ ...config, chartType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="bar">棒グラフ</option>
                <option value="line">折れ線グラフ</option>
                <option value="pie">円グラフ</option>
                <option value="area">エリアグラフ</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                サンプルデータ（JSON形式）
              </label>
              <textarea
                placeholder='[{"label": "項目1", "value": 100}, {"label": "項目2", "value": 200}]'
                value={JSON.stringify(config.data || [], null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setConfig({ ...config, data: parsed });
                  } catch (err) {
                    // 無効なJSONの場合はそのまま保存
                    setConfig({ ...config, data: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                rows={4}
              />
            </div>
          </div>
        );

      case ComponentType.FORM:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                フォームフィールド
              </label>
              <div className="space-y-2">
                {config.fields?.map((field: any, index: number) => (
                  <div key={`field-config-${index}`} className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="フィールド名"
                      value={field.label}
                      onChange={(e) => {
                        const newFields = [...config.fields];
                        newFields[index] = { ...field, label: e.target.value };
                        setConfig({ ...config, fields: newFields });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => {
                        const newFields = [...config.fields];
                        newFields[index] = { ...field, type: e.target.value };
                        setConfig({ ...config, fields: newFields });
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="text">テキスト</option>
                      <option value="email">メール</option>
                      <option value="number">数値</option>
                      <option value="textarea">テキストエリア</option>
                      <option value="date">日付</option>
                      <option value="select">選択</option>
                    </select>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfig({
                    ...config,
                    fields: [...(config.fields || []), { label: "", type: "text", required: false }],
                    submitAction: "save"
                  });
                }}
                className="mt-2 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                + フィールドを追加
              </button>
            </div>
          </div>
        );

      case ComponentType.TEXT:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                テキスト内容
              </label>
              <textarea
                value={config.content || ""}
                onChange={(e) => setConfig({ ...config, content: e.target.value })}
                placeholder="ここにテキストを入力してください..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={4}
              />
            </div>
            <div className="grid grid-cols Manager-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  フォントサイズ
                </label>
                <input
                  type="number"
                  value={config.fontSize || 14}
                  onChange={(e) => setConfig({ ...config, fontSize: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  min="10"
                  max="48"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  配置
                </label>
                <select
                  value={config.alignment || "left"}
                  onChange={(e) => setConfig({ ...config, alignment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="left">左揃え</option>
                  <option value="center">中央揃え</option>
                  <option value="right">右揃え</option>
                </select>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">コンポーネントを追加</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!selectedType ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">コンポーネントタイプを選択</h3>
              <div className="grid grid-cols-2 gap-4">
                {componentTypes.map((comp) => (
                  <button
                    key={comp.type}
                    onClick={() => setSelectedType(comp.type)}
                    className="p-4 border border-gray-300 rounded-lg hover:border-[#005eb2] hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{comp.icon}</span>
                      <div>
                        <h4 className="font-medium text-gray-900">{comp.name}</h4>
                        <p className="text-sm text-gray-600">{comp.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSelectedType(null)}
                  className="text-[#005eb2] hover:text-[#004a96]"
                >
                  ← 戻る
                </button>
                <h3 className="text-lg font-medium text-gray-900">
                  {componentTypes.find(c => c.type === selectedType)?.name}を設定
                </h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  コンポーネント名
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="コンポーネント名を入力"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                  required
                />
              </div>

              {renderConfigForm()}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddComponent}
                  disabled={!title.trim()}
                  className="flex-1 px-4 py-2 bg-[#005eb2] text-white rounded-md hover:bg-[#004a96] focus:outline-none focus:ring-2 focus:ring-[#005eb2] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  追加
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComponentEditor;
