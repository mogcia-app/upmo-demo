"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../contexts/AuthContext";
import AIAssistantIcon from "../../components/AIAssistantIcon";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isTyping?: boolean;
}

interface Chat {
  id: string;
  name: string;
  avatar: string | React.ReactNode;
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
              ? "こんにちは！お気軽にご質問ください！"
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
          console.log('手動入力データ取得成功:', data.answer);
          console.log('検索クエリ:', query);
          console.log('検索結果の詳細:', data);
          // 手動サンドイッチ形式で回答を生成
          const sandwichResponse = await generateManualSandwichResponse(query, data.answer);
          console.log('手動サンドイッチ回答生成結果:', sandwichResponse);
          console.log('最終回答:', sandwichResponse);
          return sandwichResponse;
        } else {
          console.log('手動入力データが見つかりませんでした');
          console.log('検索結果:', data);
        }
      }
      
      return "申し訳ございません！該当する情報が見つかりませんでした。";
    } catch (error) {
      console.error('手動文書検索エラー:', error);
      return "検索中にエラーが発生しました。";
    }
  };

  // 手動ロジックでサンドイッチ形式の回答を生成する関数
  const generateManualSandwichResponse = async (query: string, manualData: string): Promise<string> => {
    try {
      console.log('手動サンドイッチ回答生成開始 - 質問:', query, '手動データ:', manualData);
      
      // 手動入力データから不要な部分を削除
      const cleanData = manualData
        .replace(/他にも関連する情報があります。/g, '')
        .replace(/features/g, '')
        .replace(/overview/g, '')
        .replace(/pricing/g, '')
        .replace(/procedures/g, '')
        .replace(/support/g, '')
        .replace(/rules/g, '')
        .replace(/terms/g, '')
        .replace(/^.*について\s*$/gm, '') // 「Upmoについて」のような行を削除
        .trim();

      console.log('クリーニング後のデータ:', cleanData);

      // 質問からキーワードを抽出
      const keyword = query.replace(/について教えて/g, '').replace(/について/g, '').trim();
      console.log('抽出されたキーワード:', keyword);

      // 手動でサンドイッチ形式を組み立て
      const greeting = `${keyword}についてのご質問ですね✨`;
      const itemCount = cleanData.split('\n').filter(line => line.trim()).length;
      const closing = `が主な${keyword}です。`;

      const result = `${greeting}\n\n${cleanData}\n\n${closing}`;
      console.log('手動サンドイッチ回答生成完了:', result);
      return result;
    } catch (error) {
      console.error('手動回答生成エラー:', error);
      // エラー時も手動で組み立て
      const keyword = query.replace(/について教えて/g, '').replace(/について/g, '').trim();
      const itemCount = manualData.split('\n').filter(line => line.trim()).length;
      return `${keyword}についてのご質問ですね✨\n\n${manualData}\n\nが主な${keyword}です。`;
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

    // AIアシスタントの場合のみAI機能を使用
    if (activeChat === "ai-assistant") {
      // ローディングメッセージを追加
      const loadingMessage: Message = {
        id: "loading",
        text: "考え中...",
        sender: "ai",
        timestamp: new Date(),
        isTyping: true
      };

      const messagesWithLoading = [...newMessages, loadingMessage];
      setMessages(messagesWithLoading);

      try {
        // 少し待機してから検索（考えている演出）
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        // 手動入力データを検索
        const aiResponse = await searchManualDocuments(inputText.trim());
        
        // ローディングメッセージを削除してAI回答を追加
        const finalMessages = newMessages.concat({
          id: (Date.now() + 1).toString(),
          text: aiResponse,
          sender: "ai",
          timestamp: new Date()
        });
        
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
        
        const finalMessages = newMessages.concat(errorMessage);
        setMessages(finalMessages);
        await saveChatHistory(activeChat, finalMessages);
      } finally {
        setIsLoading(false);
      }
    } else {
      // チームメンバーとのチャットの場合、メッセージのみ保存
      await saveChatHistory(activeChat, newMessages);
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
      
      // チャットリストを初期化（AIアシスタント + チームメンバー）
      setChats([
        {
          id: "ai-assistant",
          name: "AI アシスタント",
          avatar: <AIAssistantIcon size="md" className="text-blue-600" />,
          lastMessage: "こんにちは！お気軽にご質問ください！",
          timestamp: new Date(),
          unreadCount: 0,
          isOnline: true
        },
        {
          id: "team-member-1",
          name: "田中 太郎",
          avatar: "👨‍💼",
          lastMessage: "お疲れ様です！プロジェクトの進捗はいかがですか？",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2時間前
          unreadCount: 2,
          isOnline: true
        },
        {
          id: "team-member-2",
          name: "佐藤 花子",
          avatar: "👩‍💻",
          lastMessage: "資料の確認お願いします！",
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4時間前
          unreadCount: 1,
          isOnline: false
        },
        {
          id: "team-member-3",
          name: "鈴木 一郎",
          avatar: "👨‍🔧",
          lastMessage: "会議の時間変更になりました",
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6時間前
          unreadCount: 0,
          isOnline: true
        },
        {
          id: "team-member-4",
          name: "高橋 美咲",
          avatar: "👩‍🎨",
          lastMessage: "デザイン案を送りました！",
          timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8時間前
          unreadCount: 0,
          isOnline: false
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
          <div className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col">
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
                      {typeof chat.avatar === 'string' ? chat.avatar : chat.avatar}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-lg">
                  {(() => {
                    const activeChatData = chats.find(chat => chat.id === activeChat);
                    if (!activeChatData) return "🤖";
                    return typeof activeChatData.avatar === 'string' ? activeChatData.avatar : activeChatData.avatar;
                  })()}
                  </div>
                  <div>
                  <h1 className="text-lg font-semibold text-gray-900">
                    {chats.find(chat => chat.id === activeChat)?.name || "AI アシスタント"}
                  </h1>
                    <p className="text-sm text-gray-500">
                    {activeChat === "ai-assistant" 
                      ? "お気軽にご質問ください！" 
                      : chats.find(chat => chat.id === activeChat)?.isOnline 
                        ? "オンライン" 
                        : "オフライン"
                    }
                  </p>
                </div>
                {activeChat !== "ai-assistant" && (
                  <div className={`w-3 h-3 rounded-full ${
                    chats.find(chat => chat.id === activeChat)?.isOnline 
                      ? "bg-green-500" 
                      : "bg-gray-400"
                  }`}></div>
                )}
                </div>
                
                {/* モバイル用チャット切り替えボタン */}
                <button className="lg:hidden p-2 rounded-md hover:bg-gray-100">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* メッセージエリア */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs sm:max-w-md lg:max-w-lg px-3 sm:px-4 py-2 sm:py-3 rounded-lg ${
                      message.sender === "user"
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-900 border border-gray-200"
                    }`}
                  >
                    {message.isTyping ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">考え中</span>
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {message.timestamp.toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* テンプレートボタン（AIアシスタントの場合のみ表示） */}
            {activeChat === "ai-assistant" && (
              <div className="bg-white border-t border-gray-200 p-2 sm:p-4">
                <div className="mb-3">
                  <p className="text-xs sm:text-sm text-gray-600 mb-2">よくある質問:</p>
                  <div className="flex flex-wrap gap-1 sm:gap-2">
                    <button
                      onClick={() => handleTemplateClick("〇〇について教えて")}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                    >
                      について教えて
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
              </div>
            )}

            {/* 入力エリア */}
            <div className="bg-white border-t border-gray-200 p-2 sm:p-4">
              <div className="flex space-x-2 sm:space-x-4">
                <input
                  type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                  placeholder={activeChat === "ai-assistant" ? "メッセージを入力..." : "メッセージを入力..."}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isLoading}
                  className="px-3 sm:px-4 py-2 sm:py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
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