"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Layout from "../../../components/Layout";
import { ProtectedRoute } from "../../../components/ProtectedRoute";
import { useAuth } from "../../../contexts/AuthContext";
import { CustomerListTab, Column, CustomerListRow, ColumnType, DropdownOption } from "@/types/customer-list";

interface SelectedCell {
  rowId: string;
  columnId: string;
}

export default function CustomerListPage() {
  const { user } = useAuth();
  const [tabs, setTabs] = useState<CustomerListTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<ColumnType>("text");
  const [newColumnOptions, setNewColumnOptions] = useState<DropdownOption[]>([]);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [editingCell, setEditingCell] = useState<SelectedCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [localRows, setLocalRows] = useState<CustomerListRow[]>([]);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  // タブ一覧を取得
  const fetchTabs = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const response = await fetch('/api/customers/list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTabs(data.tabs || []);
        if (data.tabs && data.tabs.length > 0 && !activeTabId) {
          setActiveTabId(data.tabs[0].id);
        }
      } else {
        console.error('タブ取得エラー:', response.statusText);
      }
    } catch (error) {
      console.error('タブ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTabs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // アクティブタブが変更されたらローカル行を更新（1000行まで空行を追加）
  useEffect(() => {
    if (activeTab) {
      const rows = [...activeTab.rows];
      // 1000行になるまで空行を追加
      while (rows.length < 1000) {
        const newRow: CustomerListRow = {
          id: `row_${Date.now()}_${rows.length}`,
        };
        activeTab.columns.forEach(col => {
          newRow[col.id] = '';
        });
        rows.push(newRow);
      }
      setLocalRows(rows.slice(0, 1000));
    }
  }, [activeTab]);

  // 手動保存
  const handleSave = async () => {
    if (!user || !activeTab) return;

    setIsSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/customers/list', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: activeTab.id,
          rows: localRows.filter(row => {
            // 空行を除外（すべての列が空の行）
            return activeTab.columns.some(col => {
              const value = row[col.id];
              return value !== undefined && value !== null && String(value).trim() !== '';
            });
          })
        })
      });

      if (response.ok) {
        await fetchTabs();
        setDuplicateError(null);
        alert('保存しました');
      } else {
        const error = await response.json();
        if (error.duplicates) {
          setDuplicateError('重複する行が見つかりました');
        } else {
          alert('保存に失敗しました');
        }
      }
    } catch (error) {
      console.error('行保存エラー:', error);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // セルをクリック
  const handleCellClick = (rowId: string, columnId: string) => {
    setSelectedCell({ rowId, columnId });
    setEditingCell(null);
  };

  // セルをダブルクリック（編集モード）
  const handleCellDoubleClick = (rowId: string, columnId: string) => {
    const row = localRows.find(r => r.id === rowId);
    const value = row ? row[columnId] || '' : '';
    setEditingCell({ rowId, columnId });
    setEditValue(String(value));
    setSelectedCell({ rowId, columnId });
  };

  // セルの値を更新
  const handleCellValueChange = (value: string) => {
    setEditValue(value);
    
    if (!editingCell) return;
    
    const updatedRows = localRows.map(row => {
      if (row.id === editingCell.rowId) {
        return { ...row, [editingCell.columnId]: value };
      }
      return row;
    });
    
    setLocalRows(updatedRows);
  };

  // 編集を終了
  const handleCellBlur = () => {
    setEditingCell(null);
    setEditValue("");
  };

  // キーボードナビゲーション
  const handleKeyDown = (e: React.KeyboardEvent, rowId: string, columnId: string) => {
    if (!activeTab) return;

    const rowIndex = localRows.findIndex(r => r.id === rowId);
    const columnIndex = activeTab.columns.findIndex(c => c.id === columnId);

    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      handleCellDoubleClick(rowId, columnId);
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      const newRowId = localRows[rowIndex - 1].id;
      setSelectedCell({ rowId: newRowId, columnId });
    } else if (e.key === 'ArrowDown' && rowIndex < localRows.length - 1) {
      e.preventDefault();
      const newRowId = localRows[rowIndex + 1].id;
      setSelectedCell({ rowId: newRowId, columnId });
    } else if (e.key === 'ArrowLeft' && columnIndex > 0) {
      e.preventDefault();
      const newColumnId = activeTab.columns[columnIndex - 1].id;
      setSelectedCell({ rowId, columnId: newColumnId });
    } else if (e.key === 'ArrowRight' && columnIndex < activeTab.columns.length - 1) {
      e.preventDefault();
      const newColumnId = activeTab.columns[columnIndex + 1].id;
      setSelectedCell({ rowId, columnId: newColumnId });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: 左へ
        if (columnIndex > 0) {
          const newColumnId = activeTab.columns[columnIndex - 1].id;
          setSelectedCell({ rowId, columnId: newColumnId });
        } else if (rowIndex > 0) {
          const newColumnId = activeTab.columns[activeTab.columns.length - 1].id;
          const newRowId = localRows[rowIndex - 1].id;
          setSelectedCell({ rowId: newRowId, columnId: newColumnId });
        }
      } else {
        // Tab: 右へ
        if (columnIndex < activeTab.columns.length - 1) {
          const newColumnId = activeTab.columns[columnIndex + 1].id;
          setSelectedCell({ rowId, columnId: newColumnId });
        } else if (rowIndex < localRows.length - 1) {
          const newColumnId = activeTab.columns[0].id;
          const newRowId = localRows[rowIndex + 1].id;
          setSelectedCell({ rowId: newRowId, columnId: newColumnId });
        }
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const updatedRows = localRows.map(row => {
        if (row.id === rowId) {
          return { ...row, [columnId]: '' };
        }
        return row;
      });
      setLocalRows(updatedRows);
    }
  };

  // 編集モード時のキーボード操作
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellBlur();
      // 次の行へ移動
      if (selectedCell && activeTab) {
        const rowIndex = localRows.findIndex(r => r.id === selectedCell.rowId);
        if (rowIndex < localRows.length - 1) {
          const newRowId = localRows[rowIndex + 1].id;
          setSelectedCell({ rowId: newRowId, columnId: selectedCell.columnId });
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellBlur();
    }
  };

  // 編集モードのフォーカス
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editingCell]);

  // タブを追加
  const handleAddTab = async () => {
    if (!user || !newTabName.trim()) return;
    
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/customers/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newTabName,
          columns: [],
          rows: []
        })
      });

      if (response.ok) {
        const newTab = await response.json();
        setTabs([...tabs, newTab]);
        setActiveTabId(newTab.id);
        setNewTabName("");
        setShowAddTabModal(false);
      } else {
        const error = await response.json();
        if (error.duplicates) {
          setDuplicateError('重複する行が見つかりました');
        } else {
          alert('タブの作成に失敗しました');
        }
      }
    } catch (error) {
      console.error('タブ作成エラー:', error);
      alert('タブの作成に失敗しました');
    }
  };

  // 列を追加
  const handleAddColumn = async () => {
    if (!user || !activeTab || !newColumnName.trim()) return;
    
    try {
      const newColumn: Column = {
        id: `col_${Date.now()}`,
        name: newColumnName,
        type: newColumnType,
        options: newColumnType === 'dropdown' ? newColumnOptions : undefined,
        order: activeTab.columns.length
      };

      const updatedColumns = [...activeTab.columns, newColumn];
      
      const token = await user.getIdToken();
      const response = await fetch('/api/customers/list', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: activeTab.id,
          columns: updatedColumns
        })
      });

      if (response.ok) {
        await fetchTabs();
        setNewColumnName("");
        setNewColumnType("text");
        setNewColumnOptions([]);
        setShowAddColumnModal(false);
        setDuplicateError(null);
      } else {
        const error = await response.json();
        if (error.duplicates) {
          setDuplicateError('重複する行が見つかりました');
        } else {
          alert('列の追加に失敗しました');
        }
      }
    } catch (error) {
      console.error('列追加エラー:', error);
      alert('列の追加に失敗しました');
    }
  };

  // オプションを追加
  const handleAddOption = () => {
    if (!newOptionLabel.trim()) return;
    const newOption: DropdownOption = {
      id: `opt_${Date.now()}`,
      label: newOptionLabel
    };
    setNewColumnOptions([...newColumnOptions, newOption]);
    setNewOptionLabel("");
  };

  // オプションを削除
  const handleRemoveOption = (optionId: string) => {
    setNewColumnOptions(newColumnOptions.filter(opt => opt.id !== optionId));
  };

  // 行を追加（1000行未満の場合のみ）
  const handleAddRow = async () => {
    if (!user || !activeTab) return;
    
    // 既に1000行ある場合は何もしない
    if (localRows.length >= 1000) {
      return;
    }
    
    const newRow: CustomerListRow = {
      id: `row_${Date.now()}`,
    };
    
    activeTab.columns.forEach(col => {
      newRow[col.id] = '';
    });

    const updatedRows = [...localRows, newRow].slice(0, 1000);
    setLocalRows(updatedRows);
  };

  // 行を削除
  const handleDeleteRow = async (rowId: string) => {
    if (!user || !activeTab) return;
    
    if (!confirm('この行を削除しますか？')) return;

    const updatedRows = localRows.filter(row => row.id !== rowId);
    setLocalRows(updatedRows);
  };

  // 列を削除
  const handleDeleteColumn = async (columnId: string) => {
    if (!user || !activeTab) return;
    
    if (!confirm('この列を削除しますか？')) return;

    const updatedColumns = activeTab.columns.filter(col => col.id !== columnId);
    
    const updatedRows = localRows.map(row => {
      const newRow = { ...row };
      delete newRow[columnId];
      return newRow;
    });

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/customers/list', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: activeTab.id,
          columns: updatedColumns,
          rows: updatedRows
        })
      });

      if (response.ok) {
        await fetchTabs();
        setDuplicateError(null);
      } else {
        const error = await response.json();
        if (error.duplicates) {
          setDuplicateError('重複する行が見つかりました');
        } else {
          alert('列の削除に失敗しました');
        }
      }
    } catch (error) {
      console.error('列削除エラー:', error);
      alert('列の削除に失敗しました');
    }
  };

  // タブを削除
  const handleDeleteTab = async (tabId: string) => {
    if (!user) return;
    
    if (!confirm('このタブを削除しますか？')) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/customers/list?tabId=${tabId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const updatedTabs = tabs.filter(t => t.id !== tabId);
        setTabs(updatedTabs);
        if (activeTabId === tabId && updatedTabs.length > 0) {
          setActiveTabId(updatedTabs[0].id);
        } else if (updatedTabs.length === 0) {
          setActiveTabId(null);
        }
      } else {
        alert('タブの削除に失敗しました');
      }
    } catch (error) {
      console.error('タブ削除エラー:', error);
      alert('タブの削除に失敗しました');
    }
  };

  // タブ名を更新
  const handleUpdateTabName = async (tabId: string, newName: string) => {
    if (!user || !newName.trim()) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/customers/list', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: tabId,
          name: newName
        })
      });

      if (response.ok) {
        await fetchTabs();
      } else {
        alert('タブ名の更新に失敗しました');
      }
    } catch (error) {
      console.error('タブ名更新エラー:', error);
      alert('タブ名の更新に失敗しました');
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="h-screen flex flex-col bg-gray-50 py-4">
          <div className="max-w-[95%] mx-auto w-full flex flex-col flex-1 min-h-0">
          {/* ヘッダー */}
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0 rounded-t-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">顧客リスト</h1>
                <p className="text-sm text-gray-600 mt-1">エクセル風の表で顧客情報を管理</p>
              </div>
              {activeTab && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddColumnModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    + 列を追加
                  </button>
                  <button
                    onClick={handleAddRow}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    + 行を追加
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 重複エラー表示 */}
          {duplicateError && (
            <div className="bg-red-50 border-b border-red-200 px-4 sm:px-6 py-2 sm:py-3 flex-shrink-0">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-red-800 font-medium text-sm">{duplicateError}</p>
                <button
                  onClick={() => setDuplicateError(null)}
                  className="ml-auto text-red-600 hover:text-red-800"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* タブ管理 */}
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2 flex-shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap ${
                    activeTabId === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <input
                    type="text"
                    value={tab.name}
                    onChange={(e) => handleUpdateTabName(tab.id, e.target.value)}
                    onBlur={(e) => handleUpdateTabName(tab.id, e.target.value)}
                    className={`bg-transparent border-none outline-none ${
                      activeTabId === tab.id ? 'text-white' : 'text-gray-700'
                    }`}
                    style={{ width: `${tab.name.length + 2}ch`, minWidth: '80px' }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTab(tab.id);
                    }}
                    className="ml-2 hover:bg-black/10 rounded px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => setShowAddTabModal(true)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 whitespace-nowrap text-sm"
              >
                + タブを追加
              </button>
            </div>
          </div>

          {/* メインコンテンツ */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-white rounded-b-lg shadow-sm">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">読み込み中...</p>
              </div>
            </div>
          ) : activeTab ? (
            <div className="flex-1 overflow-hidden bg-white rounded-b-lg shadow-sm min-h-0">
              <div 
                className="h-full overflow-auto custom-scrollbar" 
                style={{ 
                  maxHeight: 'calc(100vh - 200px)'
                }}
              >
                <table className="border-collapse" style={{ minWidth: '100%', width: 'max-content' }}>
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 w-12">
                        #
                      </th>
                      {activeTab.columns.map(column => (
                        <th
                          key={column.id}
                          className="border border-gray-300 bg-gray-100 px-4 py-2 text-left font-semibold text-gray-700 min-w-[150px]"
                        >
                          <div className="flex items-center justify-between">
                            <span>{column.name}</span>
                            <button
                              onClick={() => handleDeleteColumn(column.id)}
                              className="ml-2 text-red-600 hover:text-red-800 text-xs"
                              title="列を削除"
                            >
                              ×
                            </button>
                          </div>
                        </th>
                      ))}
                      <th className="border border-gray-300 bg-gray-100 px-2 py-1 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {localRows.slice(0, 1000).map((row, index) => (
                      <tr key={row.id} className="hover:bg-blue-50">
                        <td className="border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-600 text-center">
                          {index + 1}
                        </td>
                        {activeTab.columns.map(column => {
                          const isSelected = selectedCell?.rowId === row.id && selectedCell?.columnId === column.id;
                          const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id;
                          const cellValue = row[column.id] || '';
                          
                          return (
                            <td
                              key={column.id}
                              className={`border border-gray-300 px-2 py-1 ${
                                isSelected ? 'bg-blue-100 ring-2 ring-blue-500' : ''
                              }`}
                              onClick={() => {
                                if (column.type === 'dropdown') {
                                  // ドロップダウンの場合はクリックで直接編集モード
                                  handleCellDoubleClick(row.id, column.id);
                                } else {
                                  handleCellClick(row.id, column.id);
                                }
                              }}
                              onDoubleClick={() => handleCellDoubleClick(row.id, column.id)}
                              onKeyDown={(e) => handleKeyDown(e, row.id, column.id)}
                              tabIndex={0}
                            >
                              {column.type === 'dropdown' ? (
                                // ドロップダウンの場合は常にselectを表示
                                <select
                                  value={cellValue}
                                  onChange={(e) => {
                                    const updatedRows = localRows.map(r => {
                                      if (r.id === row.id) {
                                        return { ...r, [column.id]: e.target.value };
                                      }
                                      return r;
                                    });
                                    setLocalRows(updatedRows);
                                  }}
                                  className="w-full border-none outline-none bg-transparent"
                                  onFocus={() => setSelectedCell({ rowId: row.id, columnId: column.id })}
                                >
                                  <option value="">選択してください</option>
                                  {column.options?.map(opt => (
                                    <option key={opt.id} value={opt.label}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : isEditing ? (
                                // テキスト列の編集モード
                                <input
                                  ref={inputRef as React.RefObject<HTMLInputElement>}
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => handleCellValueChange(e.target.value)}
                                  onBlur={handleCellBlur}
                                  onKeyDown={handleEditKeyDown}
                                  className="w-full border-none outline-none bg-transparent"
                                  style={{ minWidth: '120px' }}
                                />
                              ) : (
                                // テキスト列の表示モード
                                <div className="min-h-[24px] py-1">
                                  {cellValue ? (
                                    (() => {
                                      // URLパターンを検出
                                      const urlPattern = /(https?:\/\/[^\s]+)/g;
                                      const parts = String(cellValue).split(urlPattern);
                                      return parts.map((part, index) => {
                                        if (part.match(urlPattern)) {
                                          return (
                                            <a
                                              key={index}
                                              href={part}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:text-blue-800 underline"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {part}
                                            </a>
                                          );
                                        }
                                        return <span key={index}>{part}</span>;
                                      });
                                    })()
                                  ) : (
                                    <span className="text-gray-400">空白</span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="border border-gray-300 px-2 py-1">
                          <div className="flex gap-2">
                            <button
                              onClick={handleSave}
                              disabled={isSaving}
                              className="text-blue-600 hover:text-blue-800 text-xs disabled:opacity-50"
                              title="保存"
                            >
                              {isSaving ? '保存中...' : '保存'}
                            </button>
                            <button
                              onClick={() => handleDeleteRow(row.id)}
                              className="text-red-600 hover:text-red-800 text-xs"
                              title="行を削除"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white rounded-b-lg shadow-sm">
              <div className="text-center">
                <p className="text-gray-600">タブがありません。タブを追加してください。</p>
              </div>
            </div>
          )}
          </div>

          {/* タブ追加モーダル */}
          {showAddTabModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-4 sm:p-6 w-full mx-4 max-w-md">
                <h2 className="text-xl font-bold mb-4">タブを追加</h2>
                <input
                  type="text"
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  placeholder="タブ名を入力"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTab();
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddTab}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    追加
                  </button>
                  <button
                    onClick={() => {
                      setShowAddTabModal(false);
                      setNewTabName("");
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 列追加モーダル */}
          {showAddColumnModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">列を追加</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">列名</label>
                    <input
                      type="text"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      placeholder="列名を入力"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">タイプ</label>
                    <select
                      value={newColumnType}
                      onChange={(e) => {
                        setNewColumnType(e.target.value as ColumnType);
                        if (e.target.value === 'text') {
                          setNewColumnOptions([]);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="text">テキスト</option>
                      <option value="dropdown">開閉式（ドロップダウン）</option>
                    </select>
                  </div>
                  {newColumnType === 'dropdown' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">選択肢</label>
                      <div className="space-y-2">
                        {newColumnOptions.map(opt => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <span className="flex-1 px-3 py-2 bg-gray-100 rounded">{opt.label}</span>
                            <button
                              onClick={() => handleRemoveOption(opt.id)}
                              className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              削除
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newOptionLabel}
                            onChange={(e) => setNewOptionLabel(e.target.value)}
                            placeholder="選択肢を入力"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleAddOption();
                              }
                            }}
                          />
                          <button
                            onClick={handleAddOption}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            追加
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={handleAddColumn}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    追加
                  </button>
                  <button
                    onClick={() => {
                      setShowAddColumnModal(false);
                      setNewColumnName("");
                      setNewColumnType("text");
                      setNewColumnOptions([]);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
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
