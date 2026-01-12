'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Document } from '@/types/document';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'size'>('date');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    file: null as File | null,
  });

  // ドキュメント一覧を取得
  const fetchDocuments = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      const response = await fetch('/api/documents', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('ドキュメントの取得に失敗しました');
      }

      const data = await response.json();
      let fetchedDocuments = data.documents || [];

      // ソート
      fetchedDocuments.sort((a: Document, b: Document) => {
        switch (sortBy) {
          case 'title':
            return (a.title || '').localeCompare(b.title || '');
          case 'size':
            return (b.fileSize || 0) - (a.fileSize || 0);
          case 'date':
          default:
            return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
        }
      });

      // 検索でフィルタリング
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase();
        fetchedDocuments = fetchedDocuments.filter((doc: Document) =>
          doc.title.toLowerCase().includes(queryLower) ||
          doc.fileName.toLowerCase().includes(queryLower) ||
          doc.description?.toLowerCase().includes(queryLower)
        );
      }

      setDocuments(fetchedDocuments);
    } catch (error) {
      console.error('ドキュメント取得エラー:', error);
      alert('ドキュメントの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user, sortBy, searchQuery]);

  // ファイルタイプを取得
  const getFileType = (fileType: string, fileName: string) => {
    if (fileType.startsWith('image/')) return 'image';
    if (fileType.includes('pdf')) return 'pdf';
    if (fileType.includes('word') || fileType.includes('document') || fileName.match(/\.(doc|docx)$/i)) return 'word';
    if (fileType.includes('excel') || fileType.includes('spreadsheet') || fileName.match(/\.(xls|xlsx)$/i)) return 'excel';
    if (fileType.includes('powerpoint') || fileType.includes('presentation') || fileName.match(/\.(ppt|pptx)$/i)) return 'powerpoint';
    if (fileType.includes('text') || fileName.match(/\.(txt|csv)$/i)) return 'text';
    if (fileType.includes('zip') || fileName.match(/\.(zip|rar|7z)$/i)) return 'archive';
    return 'other';
  };

  // ファイルタイプに応じたアイコンと色を取得
  const getFileIcon = (fileType: string, fileName: string) => {
    const type = getFileType(fileType, fileName);
    switch (type) {
      case 'image':
        return { icon: '🖼️', bg: 'bg-green-100', text: 'text-green-600', label: '画像' };
      case 'pdf':
        return { icon: '📄', bg: 'bg-red-100', text: 'text-red-600', label: 'PDF' };
      case 'word':
        return { icon: '📝', bg: 'bg-blue-100', text: 'text-blue-600', label: 'Word' };
      case 'excel':
        return { icon: '📊', bg: 'bg-green-100', text: 'text-green-600', label: 'Excel' };
      case 'powerpoint':
        return { icon: '📽️', bg: 'bg-orange-100', text: 'text-orange-600', label: 'PowerPoint' };
      case 'text':
        return { icon: '📃', bg: 'bg-gray-100', text: 'text-gray-600', label: 'テキスト' };
      case 'archive':
        return { icon: '📦', bg: 'bg-purple-100', text: 'text-purple-600', label: 'アーカイブ' };
      default:
        return { icon: '📎', bg: 'bg-gray-100', text: 'text-gray-600', label: 'ファイル' };
    }
  };

  // ファイル選択
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // ファイルサイズチェック（100MB以下）
      if (file.size > 100 * 1024 * 1024) {
        alert('ファイルサイズは100MB以下にしてください');
        return;
      }
      setFormData({ ...formData, file });
    }
  };

  // ファイルアップロード
  const handleUpload = async () => {
    if (!user || !formData.title || !formData.file) {
      alert('タイトルとファイルを選択してください');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const token = await user.getIdToken();
      const file = formData.file;

      // Firebase Storageにアップロード
      const storageRef = ref(storage, `documents/${user.uid}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('アップロードエラー:', error);
          alert('ファイルのアップロードに失敗しました');
          setIsUploading(false);
        },
        async () => {
          // アップロード完了
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // ドキュメント情報をFirestoreに保存
          const response = await fetch('/api/documents', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: formData.title,
              fileName: file.name,
              fileUrl: downloadURL,
              fileSize: file.size,
              fileType: file.type,
              description: formData.description,
            }),
          });

          if (!response.ok) {
            throw new Error('ドキュメントの保存に失敗しました');
          }

          await fetchDocuments();
          setShowModal(false);
          setFormData({ title: '', description: '', file: null });
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setIsUploading(false);
          setUploadProgress(0);
          alert('ドキュメントをアップロードしました');
        }
      );
    } catch (error) {
      console.error('アップロードエラー:', error);
      alert('ドキュメントのアップロードに失敗しました');
      setIsUploading(false);
    }
  };

  // ドキュメント削除
  const handleDelete = async (id: string) => {
    if (!user || !confirm('このドキュメントを削除しますか？')) return;

    try {
      const token = await user.getIdToken();

      const response = await fetch(`/api/documents?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('ドキュメントの削除に失敗しました');
      }

      await fetchDocuments();
      if (selectedDocument?.id === id) {
        setSelectedDocument(null);
      }
      alert('ドキュメントを削除しました');
    } catch (error) {
      console.error('ドキュメント削除エラー:', error);
      alert('ドキュメントの削除に失敗しました');
    }
  };

  // ダウンロード
  const handleDownload = (document: Document) => {
    window.open(document.fileUrl, '_blank');
  };

  // ファイルサイズをフォーマット
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // 日付をフォーマット
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* メインコンテンツ */}
            <div className={`flex-1 ${selectedDocument ? 'mr-80' : ''} transition-all`}>
              {/* ヘッダー */}
              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-900">ドキュメント</h1>
                  </div>
                  <div className="flex items-center gap-4">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="date">日付順</option>
                      <option value="title">タイトル順</option>
                      <option value="size">サイズ順</option>
                    </select>
                    <input
                      type="text"
                      placeholder="検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => setShowModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      アップロード
                    </button>
                  </div>
                </div>
              </div>

              {/* ドキュメント一覧 */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">読み込み中...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center bg-white rounded-lg border border-gray-200 p-12">
                  <p className="text-gray-600 mb-4">
                    {searchQuery ? '検索結果が見つかりませんでした' : 'ドキュメントがありません'}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => setShowModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      最初のドキュメントをアップロード
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => {
                    const fileIcon = getFileIcon(doc.fileType, doc.fileName);
                    const isImage = getFileType(doc.fileType, doc.fileName) === 'image';
                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDocument(doc)}
                        className={`bg-white border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          selectedDocument?.id === doc.id
                            ? 'border-blue-500 shadow-md'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {isImage ? (
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              <img
                                src={doc.fileUrl}
                                alt={doc.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  if (target.parentElement) {
                                    target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center ${fileIcon.bg}"><span class="text-lg">${fileIcon.icon}</span></div>`;
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div className={`w-12 h-12 ${fileIcon.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                              <span className="text-lg">{fileIcon.icon}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 mb-1">{doc.title}</h3>
                            <p className="text-xs text-gray-500">{formatDate(doc.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">{formatFileSize(doc.fileSize)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 右側サイドバー（ファイル詳細） */}
            {selectedDocument && (
              <div className="fixed right-0 top-0 h-screen w-80 bg-white border-l border-gray-200 shadow-lg overflow-y-auto z-40">
                <div className="p-4 sm:p-6">
                  {/* アクションアイコン */}
                  <div className="flex items-center justify-end gap-2 mb-6">
                    <button className="p-2 text-gray-400 hover:text-yellow-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDownload(selectedDocument)}
                      className="p-2 text-gray-400 hover:text-blue-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(selectedDocument.id)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setSelectedDocument(null)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* ファイル情報 */}
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">{selectedDocument.title}</h2>
                    <p className="text-sm text-gray-600 mb-4">
                      PDF - {formatFileSize(selectedDocument.fileSize)}
                    </p>

                    {/* プレビュー */}
                    <div className="bg-gray-100 rounded-lg p-4 mb-4 flex items-center justify-center">
                      <div className="w-32 h-40 bg-red-100 rounded-lg flex items-center justify-center">
                        <span className="text-3xl font-bold text-red-600">PDF</span>
                      </div>
                    </div>
                  </div>

                  {/* 詳細情報 */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">詳細情報</h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-500">作成:</span>
                          <span className="text-gray-900 ml-2">{formatDate(selectedDocument.createdAt)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">最終更新:</span>
                          <span className="text-gray-900 ml-2">{formatDate(selectedDocument.updatedAt)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">ファイルサイズ:</span>
                          <span className="text-gray-900 ml-2">{formatFileSize(selectedDocument.fileSize)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">作成者:</span>
                          <span className="text-gray-900 ml-2">{selectedDocument.createdByName || 'ユーザー'}</span>
                        </div>
                        {selectedDocument.description && (
                          <div>
                            <span className="text-gray-500">説明:</span>
                            <p className="text-gray-900 mt-1">{selectedDocument.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ダウンロードボタン */}
                  <button
                    onClick={() => handleDownload(selectedDocument)}
                    className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    ダウンロード
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* アップロードモーダル */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full mx-4 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">ドキュメントをアップロード</h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ title: '', description: '', file: null });
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ドキュメントのタイトル"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="ドキュメントの説明（オプション）"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ファイル *</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.svg,.zip,.rar,.7z"
                    onChange={handleFileSelect}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    PDF、画像、Office文書、テキストファイルなどがアップロードできます（最大100MB）
                  </p>
                  {formData.file && (
                    <p className="text-sm text-gray-600 mt-2">
                      選択中: {formData.file.name} ({formatFileSize(formData.file.size)})
                    </p>
                  )}
                </div>

                {isUploading && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">アップロード中...</span>
                      <span className="text-sm text-gray-600">{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-4 mt-6">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ title: '', description: '', file: null });
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  disabled={isUploading}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading || !formData.title || !formData.file}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isUploading ? 'アップロード中...' : 'アップロード'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}

