"use client";

import React, { useState } from "react";
import { DataTableComponent as DataTableComponentType } from "../types/components";

interface DataTableComponentProps {
  component: DataTableComponentType;
  onUpdate: (component: DataTableComponentType) => void;
}

const DataTableComponent: React.FC<DataTableComponentProps> = ({ component, onUpdate }) => {
  const [data, setData] = useState(component.config.data || []);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const handleCellEdit = (rowIndex: number, columnId: string, value: string | number) => {
    const newData = [...data];
    if (!newData[rowIndex]) {
      newData[rowIndex] = {};
    }
    newData[rowIndex][columnId] = value;
    setData(newData);
    
    // Firestoreに保存
    onUpdate({
      ...component,
      config: { ...component.config, data: newData }
    });
  };

  const startEditing = (rowIndex: number, columnId: string) => {
    console.log("Starting edit:", { rowIndex, columnId, currentData: data[rowIndex] });
    setEditingCell({ row: rowIndex, col: columnId });
    setEditingValue(String(data[rowIndex]?.[columnId] || ""));
  };

  const finishEditing = () => {
    if (editingCell) {
      handleCellEdit(editingCell.row, editingCell.col, editingValue);
    }
    setEditingCell(null);
    setEditingValue("");
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditingValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, columnId: string) => {
    if (e.key === 'Enter' && !editingCell) {
      e.preventDefault();
      startEditing(rowIndex, columnId);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      // キーボードナビゲーション（今後実装可能）
    }
  };

  const addRow = () => {
    const newRow: Record<string, string | number> = {};
    component.config.columns.forEach(col => {
      newRow[col.id] = "";
    });
    const newData = [...data, newRow];
    setData(newData);
    
    onUpdate({
      ...component,
      config: { ...component.config, data: newData }
    });
  };

  const addSampleData = () => {
    const sampleData = [
      { [component.config.columns[0]?.id || 'col1']: "サンプル1", [component.config.columns[1]?.id || 'col2']: "データ1" },
      { [component.config.columns[0]?.id || 'col1']: "サンプル2", [component.config.columns[1]?.id || 'col2']: "データ2" }
    ];
    setData(sampleData);
    
    onUpdate({
      ...component,
      config: { ...component.config, data: sampleData }
    });
  };

  const deleteRow = (rowIndex: number) => {
    const newData = data.filter((_, index) => index !== rowIndex);
    setData(newData);
    
    onUpdate({
      ...component,
      config: { ...component.config, data: newData }
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{component.title}</h3>
          <div className="flex space-x-2">
            <button
              onClick={addSampleData}
              className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
            >
              サンプルデータ
            </button>
            <button
              onClick={addRow}
              className="px-3 py-1 bg-[#005eb2] text-white text-sm rounded hover:bg-[#004a96] transition-colors"
            >
              + 行を追加
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {component.config.columns.map((column, index) => (
                <th
                  key={`column-${column.id || index}`}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200"
                >
                  {column.name}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length > 0 ? (
              data.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`} className="hover:bg-gray-50">
                  {component.config.columns.map((column, colIndex) => (
                    <td
                      key={`cell-${rowIndex}-${column.id || colIndex}`}
                      className="px-1 py-1 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200"
                    >
                      {editingCell?.row === rowIndex && editingCell?.col === column.id ? (
                        <input
                          type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={finishEditing}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              finishEditing();
                            } else if (e.key === 'Escape') {
                              cancelEditing();
                            }
                          }}
                          className="w-full px-2 py-1 border-2 border-[#005eb2] rounded focus:outline-none bg-white"
                          autoFocus
                          style={{ minWidth: '120px' }}
                        />
                      ) : (
                        <div
                          onClick={() => startEditing(rowIndex, column.id)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, column.id)}
                          tabIndex={0}
                          className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border border-transparent hover:border-blue-200 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:ring-opacity-50"
                          style={{ minHeight: '32px', minWidth: '120px' }}
                        >
                          {column.type === 'select' && column.options ? (
                            <select
                              value={String(row[column.id] || '')}
                              onChange={(e) => handleCellEdit(rowIndex, column.id, e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#005eb2] bg-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="">選択してください</option>
                              {column.options.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="block">
                              {String(row[column.id] || "") || (
                                <span className="text-gray-400 italic">クリックして編集</span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => deleteRow(rowIndex)}
                      className="text-red-600 hover:text-red-800"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={component.config.columns.length + 1} className="text-center py-8 text-gray-500">
                  データがありません。行を追加してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTableComponent;
