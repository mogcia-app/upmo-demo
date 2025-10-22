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
}

interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
  isOnline: boolean;
}

export default function PersonalChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeChat, setActiveChat] = useState<string>("ai-assistant");
  const [chats, setChats] = useState<Chat[]>([]);
  const { user } = useAuth();

  // チャット履歴を読み込み
  const loadChatHistory = async (chatId: string) => {
    if (!user) return;
    
    try {
      // ローカルストレージから履歴を読み込み
      const historyKey = `chat_history_${user.uid}_${chatId}`;
      const savedHistory = localStorage.getItem(historyKey);
      
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        const messagesWithDates = parsedHistory.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates);
        console.log('チャット履歴を読み込みました:', messagesWithDates.length, '件のメッセージ');
      } else {
        // 新しいセッション
        const initialMessages: Message[] = [
          {
            id: "1",
            text: chatId === "ai-assistant" 
              ? "こんにちは！手動入力された文書についてお答えできます。何かご質問がありますか？"
              : "こんにちは！何かお手伝いできることはありますか？",
            sender: "ai",
            timestamp: new Date()
          }
        ];
        setMessages(initialMessages);
      }
    } catch (error) {
      console.error('チャット履歴の読み込みエラー:', error);
    }
  };

  // チャット履歴を保存
  const saveChatHistory = async (chatId: string, messages: Message[]) => {
    if (!user) return;
    
    try {
      const historyKey = `chat_history_${user.uid}_${chatId}`;
      localStorage.setItem(historyKey, JSON.stringify(messages));
    } catch (error) {
      console.error('チャット履歴の保存エラー:', error);
    }
  };

  // 手動入力データを検索
  const searchManualDocuments = async (query: string): Promise<string> => {
    if (!user) return "ユーザーが認証されていません。";

    try {
      const response = await fetch(`/api/search-manual?q=${encodeURIComponent(query)}&userId=${user.uid}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.answer && data.answer !== '該当する情報が見つかりませんでした。') {
          return data.answer;
        }
      }
      
      return "該当する情報が見つかりませんでした。手動入力された文書を確認してください。";
    } catch (error) {
      console.error('手動文書検索エラー:', error);
      return "検索中にエラーが発生しました。";
    }
  };

  // メッセージ送信処理
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: "user",
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText("");
    setIsLoading(true);

    try {
      // 手動入力データを検索
      const aiResponse = await searchManualDocuments(inputText.trim());
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        sender: "ai",
        timestamp: new Date()
      };

      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);
      
      // チャット履歴を保存
      await saveChatHistory(activeChat, finalMessages);
      
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "申し訳ございません。エラーが発生しました。",
        sender: "ai",
        timestamp: new Date()
      };

      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);
      await saveChatHistory(activeChat, finalMessages);
    } finally {
      setIsLoading(false);
    }
  };

  // テンプレートボタンのクリック処理
  const handleTemplateClick = (template: string) => {
    setInputText(template);
  };

  // チャット切り替え
  const handleChatSelect = (chatId: string) => {
    setActiveChat(chatId);
    loadChatHistory(chatId);
  };

  // 初期化
  useEffect(() => {
    if (user) {
      // デフォルトチャットを読み込み
      loadChatHistory(activeChat);
      
      // チャットリストを初期化
      setChats([
        {
          id: "ai-assistant",
          name: "AI アシスタント",
          avatar: "🤖",
          lastMessage: "手動入力された文書についてお答えできます",
          timestamp: new Date(),
          unreadCount: 0,
          isOnline: true
        }
      ]);
    }
  }, [user]);

  // Enterキーでメッセージ送信
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="flex h-screen bg-gray-50">
          {/* サイドバー */}
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">チャット</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleChatSelect(chat.id)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    activeChat === chat.id ? "bg-blue-50 border-blue-200" : ""
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-lg">
                      {chat.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {chat.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {chat.lastMessage}
                      </p>
                    </div>
                    {chat.unreadCount > 0 && (
                      <div className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {chat.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* メインエリア */}
          <div className="flex-1 flex flex-col">
            {/* ヘッダー */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-lg">
                  🤖
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">AI アシスタント</h1>
                  <p className="text-sm text-gray-500">手動入力された文書についてお答えできます</p>
                </div>
              </div>
            </div>

            {/* メッセージエリア */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender === "user"
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-900 border border-gray-200"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {message.timestamp.toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-900 border border-gray-200 px-4 py-2 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* テンプレートボタン */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="mb-3">
                <p className="text-sm text-gray-600 mb-2">よくある質問:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleTemplateClick("〇〇について教えて")}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    〇〇について教えて
                  </button>
                  <button
                    onClick={() => handleTemplateClick("料金について教えて")}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    料金について教えて
                  </button>
                  <button
                    onClick={() => handleTemplateClick("機能について教えて")}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    機能について教えて
                  </button>
                  <button
                    onClick={() => handleTemplateClick("手順について教えて")}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    手順について教えて
                  </button>
                </div>
              </div>
              
              {/* 入力エリア */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="メッセージを入力..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  送信
                </button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}