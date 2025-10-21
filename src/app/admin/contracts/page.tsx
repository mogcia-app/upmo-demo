"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../../components/Layout";
import { ProtectedRoute } from "../../../components/ProtectedRoute";
import { useAuth } from "../../../contexts/AuthContext";
import { saveCompanyPolicyToFirestore } from "../../../utils/companyPolicySearch";
import { collection, addDoc, getDocs, query, where, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from "../../../lib/firebase";

interface Document {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  category: 'regulation' | 'policy' | 'manual' | 'other';
  description?: string;
  extractedText?: string; // PDFから抽出されたテキスト
}

export default function ContractsPage() {
  const { user } = useAuth();
  
  // Firestoreからドキュメントを取得
  const fetchDocumentsFromFirestore = async () => {
    if (!user) return;
    
    try {
      const q = query(
        collection(db, 'documents'),
        where('userId', '==', user.uid),
        orderBy('uploadedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const docs: Document[] = [];
      
      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        docs.push({
          id: docSnapshot.id,
          title: data.title,
          fileName: data.fileName,
          fileUrl: data.fileUrl,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          category: data.category,
          description: data.description,
          extractedText: data.extractedText
        });
      });
      
      setDocuments(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  // Firestoreにドキュメントを保存
  const saveDocumentToFirestore = async (document: Document): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, 'documents'), {
        title: document.title,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        uploadedAt: document.uploadedAt,
        category: document.category,
        description: document.description,
        extractedText: document.extractedText,
        userId: user?.uid
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving document:', error);
      throw error;
    }
  };
  

  // ユーザー認証時にFirestoreからドキュメントを取得
  useEffect(() => {
    if (user) {
      fetchDocumentsFromFirestore();
    }
  }, [user]);

  const [documents, setDocuments] = useState<Document[]>([]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newDocument, setNewDocument] = useState({
    title: '',
    description: '',
    category: 'regulation' as Document['category'],
    file: null as File | null
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setNewDocument(prev => ({ ...prev, file }));
    } else {
      alert('PDFファイルのみアップロード可能です。');
    }
  };

  const handleUpload = async () => {
    if (!newDocument.title || !newDocument.file) {
      alert('タイトルとファイルを入力してください。');
      return;
    }

    try {
      // PDFからテキストを抽出（動的インポート）
      const { extractPDFText } = await import("../../../utils/pdfExtractor");
      const extractedText = await extractPDFText(newDocument.file);
      
      const document: Document = {
        id: Date.now().toString(),
        title: newDocument.title,
        fileName: newDocument.file.name,
        fileUrl: URL.createObjectURL(newDocument.file), // 一時的なURL
        uploadedAt: new Date(),
        category: newDocument.category,
        description: newDocument.description,
        extractedText: extractedText
      };

      // Firestoreに保存（AI検索用）
      try {
        await saveCompanyPolicyToFirestore({
          title: document.title,
          category: document.category,
          content: extractedText,
          userId: user?.uid,
          source: document.fileName
        });
        console.log('PDF内容をAI検索システムに保存しました');
      } catch (firestoreError) {
        console.error('Firestore保存エラー:', firestoreError);
        // Firestoreのエラーは警告として扱い、処理は継続
      }

      // Firestoreにドキュメントを保存
      try {
        const docId = await saveDocumentToFirestore(document);
        document.id = docId; // FirestoreのIDを設定
        setDocuments(prev => [document, ...prev]);
        setNewDocument({ title: '', description: '', category: 'regulation', file: null });
        setShowUploadModal(false);
        
        alert('書類のアップロードとテキスト抽出が完了しました！');
      } catch (firestoreError) {
        console.error('Firestore保存エラー:', firestoreError);
        alert('ドキュメントの保存中にエラーが発生しました。');
      }
    } catch (error) {
      console.error('PDF読み込みエラー:', error);
      
      // エラーメッセージを詳細化
      let errorMessage = 'PDFの読み込みに失敗しました。';
      
      if (error instanceof Error) {
        if (error.message.includes('無効なPDF')) {
          errorMessage = '無効なPDFファイルです。ファイルが破損している可能性があります。';
        } else if (error.message.includes('パスワード')) {
          errorMessage = 'パスワードで保護されたPDFファイルです。パスワードを解除してからアップロードしてください。';
        } else if (error.message.includes('ネットワーク')) {
          errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
        } else {
          errorMessage = `PDF読み込みエラー: ${error.message}`;
        }
      }
      
      alert(errorMessage);
    }
  };

  const getCategoryColor = (category: Document['category']) => {
    switch (category) {
      case 'regulation': return 'bg-blue-100 text-blue-800';
      case 'policy': return 'bg-green-100 text-green-800';
      case 'manual': return 'bg-purple-100 text-purple-800';
      case 'other': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryText = (category: Document['category']) => {
    switch (category) {
      case 'regulation': return '規定・規則';
      case 'policy': return 'ポリシー';
      case 'manual': return 'マニュアル';
      case 'other': return 'その他';
      default: return '不明';
    }
  };

  // ドキュメントを削除
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('このドキュメントを削除しますか？')) return;
    
    try {
      // Firestoreから削除
      await deleteDoc(doc(db, 'documents', documentId));
      
      // ローカル状態から削除
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      
      alert('ドキュメントを削除しました。');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('ドキュメントの削除中にエラーが発生しました。');
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* ヘッダー */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  企業規定書類管理
                </h1>
                <p className="text-gray-600">
                  企業の規定書類、ポリシー、マニュアルを管理します。
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>書類をアップロード</span>
              </button>
            </div>
          </div>


          {/* 書類一覧 - カード表示 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">書類一覧</h2>
              <div className="text-sm text-gray-500">
                全 {documents.length} 件
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((document) => (
                <div key={document.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="p-6">
                    {/* ヘッダー */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {document.title}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {document.fileName}
                        </p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(document.category)}`}>
                        {getCategoryText(document.category)}
                      </span>
                    </div>

                    {/* 説明 */}
                    {document.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {document.description}
                      </p>
                    )}

                    {/* アップロード日 */}
                    <div className="text-xs text-gray-400 mb-4">
                      アップロード日: {document.uploadedAt.toLocaleDateString('ja-JP')}
                    </div>

                    {/* 操作ボタン */}
                    <div className="flex space-x-2">
                      <a
                        href={document.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-2 bg-[#005eb2] text-white text-sm rounded-md hover:bg-[#004a96] transition-colors text-center"
                      >
                        表示
                      </a>
                      <button className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors">
                        ダウンロード
                      </button>
                      <button 
                        onClick={() => handleDeleteDocument(document.id)}
                        className="px-3 py-2 border border-red-300 text-red-700 text-sm rounded-md hover:bg-red-50 transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 空の状態 */}
            {documents.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-20z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  書類がありません
                </h3>
                <p className="text-gray-600 mb-6">
                  最初の書類をアップロードしてください。
                </p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 bg-[#005eb2] text-white rounded-md hover:bg-[#004a96] transition-colors"
                >
                  書類をアップロード
                </button>
              </div>
            )}
          </div>
        </div>

        {/* アップロードモーダル */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-gray-900">書類をアップロード</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    書類名
                  </label>
                  <input
                    type="text"
                    value={newDocument.title}
                    onChange={(e) => setNewDocument(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                    placeholder="例: 就業規則"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    カテゴリ
                  </label>
                  <select
                    value={newDocument.category}
                    onChange={(e) => setNewDocument(prev => ({ ...prev, category: e.target.value as Document['category'] }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                  >
                    <option value="regulation">規定・規則</option>
                    <option value="policy">ポリシー</option>
                    <option value="manual">マニュアル</option>
                    <option value="other">その他</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    説明（任意）
                  </label>
                  <textarea
                    value={newDocument.description}
                    onChange={(e) => setNewDocument(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                    rows={3}
                    placeholder="書類の詳細説明"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PDFファイル
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    PDFファイルのみアップロード可能です（最大10MB）
                  </p>
                </div>

                {newDocument.file && (
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-600">
                      選択されたファイル: <span className="font-medium">{newDocument.file.name}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      サイズ: {(newDocument.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!newDocument.title || !newDocument.file}
                  className="px-4 py-2 bg-[#005eb2] text-white rounded-md hover:bg-[#004a96] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  アップロード
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
