"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../contexts/AuthContext";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isTyping?: boolean;
}

export default function PersonalChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  // サンプルメッセージを追加
  useEffect(() => {
    const sampleMessages: Message[] = [
      {
        id: "1",
        text: "こんにちは！個人チャットへようこそ。何かお手伝いできることはありますか？",
        sender: 'ai',
        timestamp: new Date(Date.now() - 60000)
      }
    ];
    setMessages(sampleMessages);
  }, []);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    // AIの返信をシミュレート
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "ありがとうございます。その件について詳しく教えていただけますか？",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">
          {/* ヘッダー */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  個人チャット
                </h1>
                <p className="text-gray-600">
                  AIアシスタントと1対1でチャットできます
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">オンライン</span>
              </div>
            </div>
          </div>

          {/* チャットエリア */}
          <div className="flex-1 bg-white rounded-lg shadow-sm flex flex-col">
            {/* メッセージリスト */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                      message.sender === 'user'
                        ? 'bg-[#005eb2] text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                    <p
                      className={`text-xs mt-1 ${
                        message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
              
              {/* ローディング表示 */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-xs text-gray-500">入力中...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 入力エリア */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="メッセージを入力してください..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isLoading}
                  className="px-6 py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* ユーザー情報 */}
          <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#005eb2] rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {user?.email}
                </p>
                <p className="text-xs text-gray-500">
                  個人チャットセッション
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
