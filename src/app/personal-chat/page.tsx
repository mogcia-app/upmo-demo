"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../contexts/AuthContext";
import { searchCompanyPolicies, generateAIResponse } from "../../utils/companyPolicySearch";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'other';
  senderName?: string;
  timestamp: Date;
  isTyping?: boolean;
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

  // サンプルチャットとメッセージを追加
  useEffect(() => {
    const sampleChats: Chat[] = [
      {
        id: "ai-assistant",
        name: "AIアシスタント",
        avatar: "🤖",
        lastMessage: "こんにちは！何かお手伝いできることはありますか？",
        timestamp: new Date(Date.now() - 60000),
        unreadCount: 0,
        isOnline: true
      },
      {
        id: "yamada",
        name: "山田太郎",
        avatar: "👨‍💼",
        lastMessage: "プロジェクトの進捗について相談したいです",
        timestamp: new Date(Date.now() - 300000),
        unreadCount: 2,
        isOnline: true
      },
      {
        id: "sato",
        name: "佐藤花子",
        avatar: "👩‍💻",
        lastMessage: "資料を確認しました",
        timestamp: new Date(Date.now() - 600000),
        unreadCount: 0,
        isOnline: false
      },
      {
        id: "tanaka",
        name: "田中次郎",
        avatar: "👨‍🔬",
        lastMessage: "会議の時間を変更しましょう",
        timestamp: new Date(Date.now() - 900000),
        unreadCount: 1,
        isOnline: true
      }
    ];
    setChats(sampleChats);

    const sampleMessages: Message[] = [
      {
        id: "1",
        text: "こんにちは！個人チャットへようこそ。何かお手伝いできることはありますか？",
        sender: 'ai',
        senderName: 'AIアシスタント',
        timestamp: new Date(Date.now() - 60000)
      }
    ];
    setMessages(sampleMessages);
  }, []);

  const handleChatSelect = (chatId: string) => {
    setActiveChat(chatId);
    // チャット切り替え時にメッセージをリセット（実際のアプリでは、チャットごとのメッセージを取得）
    const chatMessages: Message[] = [
      {
        id: "1",
        text: chatId === "ai-assistant" 
          ? "こんにちは！何かお手伝いできることはありますか？"
          : `こんにちは！${chats.find(c => c.id === chatId)?.name}さんとのチャットです。`,
        sender: chatId === "ai-assistant" ? 'ai' : 'other',
        senderName: chats.find(c => c.id === chatId)?.name,
        timestamp: new Date(Date.now() - 60000)
      }
    ];
    setMessages(chatMessages);
  };

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

    // AIまたは他のユーザーの返信をシミュレート
    if (activeChat === "ai-assistant") {
      // AIアシスタントの場合、社内規則検索を実行
      setTimeout(async () => {
        // 社内規則検索を実行
        const searchResults = searchCompanyPolicies(inputText);
        let aiResponse = "";
        
        if (searchResults.length > 0) {
          // 社内規則が見つかった場合
          aiResponse = generateAIResponse(inputText, searchResults);
        } else {
          // 社内規則が見つからない場合のデフォルト応答
          if (inputText.includes("こんにちは") || inputText.includes("はじめまして")) {
            aiResponse = "こんにちは！AIアシスタントです。社内規則についてお答えできます。何かご質問がありますか？";
          } else if (inputText.includes("ありがとう")) {
            aiResponse = "どういたしまして！他にも社内規則についてご質問があれば、お気軽にお聞きください。";
          } else if (inputText.includes("時間") || inputText.includes("時刻")) {
            aiResponse = `現在の時刻は ${new Date().toLocaleString('ja-JP')} です。`;
          } else if (inputText.includes("規則") || inputText.includes("ポリシー") || inputText.includes("マニュアル")) {
            aiResponse = "社内規則についてお聞きしたいことがございましたら、具体的な内容をお教えください。例えば「労働時間」「有給休暇」「セキュリティ」などのキーワードでお尋ねいただけます。";
          } else {
            aiResponse = "申し訳ございませんが、社内規則に関する質問以外はお答えできません。社内規則について具体的なキーワードでお聞きください。";
          }
        }
        
        const replyMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: aiResponse,
          sender: 'ai',
          senderName: 'AIアシスタント',
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, replyMessage]);
        setIsLoading(false);
      }, 1500);
    } else {
      // 他のユーザーの場合
      setTimeout(() => {
        const replyMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: "了解しました。後ほど確認して返信します。",
          sender: 'other',
          senderName: chats.find(c => c.id === activeChat)?.name,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, replyMessage]);
        setIsLoading(false);
      }, 1500);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getActiveChatInfo = () => {
    return chats.find(chat => chat.id === activeChat);
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="flex h-full max-h-[calc(300vh-8rem)] bg-white rounded-lg shadow-sm overflow-hidden">
          {/* 左側: チャットリスト */}
          <div className="w-80 border-r border-gray-200 flex flex-col">
            {/* ヘッダー */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">チャット</h1>
                <button className="px-3 py-1 bg-[#005eb2] text-white text-sm rounded-lg hover:bg-[#004a96] transition-colors">
                  + 新しいチャット
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="チャットを検索..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
                />
                <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* チャットリスト */}
            <div className="flex-1 overflow-y-auto">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleChatSelect(chat.id)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    activeChat === chat.id ? 'bg-blue-50 border-l-4 border-l-[#005eb2]' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-xl">
                        {chat.avatar}
                      </div>
                      {chat.isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {chat.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {chat.timestamp.toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
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

          {/* 右側: アクティブチャット */}
          <div className="flex-1 flex flex-col">
            {/* チャットヘッダー */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-lg">
                    {getActiveChatInfo()?.avatar}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {getActiveChatInfo()?.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {getActiveChatInfo()?.isOnline ? 'オンライン' : 'オフライン'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 00-15 0v5h5l-5 5-5-5h5v-5a7.5 7.5 0 0115 0v5z" />
                    </svg>
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* メッセージエリア */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[600px]">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="flex items-end space-x-2 max-w-xs lg:max-w-md">
                    {message.sender !== 'user' && (
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm">
                        {message.sender === 'ai' ? '🤖' : getActiveChatInfo()?.avatar}
                      </div>
                    )}
                    <div
                      className={`px-4 py-3 rounded-lg ${
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
                    {message.sender === 'user' && (
                      <div className="w-8 h-8 bg-[#005eb2] rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {user?.email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* ローディング表示 */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-end space-x-2">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm">
                      {getActiveChatInfo()?.avatar}
                    </div>
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
                    rows={2}
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
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
