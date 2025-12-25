"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "../../components/Layout";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../contexts/AuthContext";
import AIAssistantIcon from "../../components/AIAssistantIcon";
import { fetchChatSession, updateChatSession, saveChatSession, ChatMessage } from "../../utils/chatHistory";
import SummaryModal from "../../components/SummaryModal";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isTyping?: boolean;
}

interface TeamMember {
  id: string;
  displayName: string;
  email: string;
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
  const router = useRouter();
  
  // Markdownリンクをクリック可能なリンクに変換する関数
  const renderMessageWithLinks = (text: string) => {
    // Markdownリンクのパターン: [テキスト](URL) - 改行を含む場合も考慮
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: (string | React.ReactElement)[] = [];
    let match;
    let key = 0;

    // テキストを行ごとに分割して処理
    const lines = text.split('\n');
    
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        // 改行を追加
        parts.push('\n');
      }
      
      let lineLastIndex = 0;
      linkPattern.lastIndex = 0; // 正規表現をリセット
      
      while ((match = linkPattern.exec(line)) !== null) {
        // リンクの前のテキスト
        if (match.index > lineLastIndex) {
          parts.push(line.substring(lineLastIndex, match.index));
        }
        
        // リンク
        const linkText = match[1];
        const linkUrl = match[2];
        parts.push(
          <a
            key={`link-${key++}`}
            href={linkUrl}
            onClick={(e) => {
              e.preventDefault();
              router.push(linkUrl);
            }}
            className="text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer"
          >
            {linkText}
          </a>
        );
        
        lineLastIndex = linkPattern.lastIndex;
      }
      
      // 残りのテキスト
      if (lineLastIndex < line.length) {
        parts.push(line.substring(lineLastIndex));
      }
    });
    
    return parts.length > 0 ? <>{parts}</> : text;
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeChat, setActiveChat] = useState<string>("ai-assistant");
  const [chats, setChats] = useState<Chat[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { user } = useAuth();
  
  // 要約用の状態
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [summaryDocumentId, setSummaryDocumentId] = useState<string>('');

  // チームメンバーを取得
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!user) return;
      
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          // 現在のユーザーのcompanyNameを取得
          const currentUser = data.users.find((u: any) => u.id === user.uid);
          const currentCompanyName = currentUser?.companyName || '';
          
          const members = data.users
            .filter((u: any) => 
              u.id !== user.uid && 
              u.role === 'user' && 
              u.companyName === currentCompanyName
            )
            .map((u: any) => ({
              id: u.id,
              displayName: u.displayName,
              email: u.email
            }));
          setTeamMembers(members);
        }
      } catch (error) {
        console.error('チームメンバーの読み込みエラー:', error);
      }
    };

    loadTeamMembers();
  }, [user]);

  // チャット履歴を読み込み（Firestoreから）
  const loadChatHistory = async (chatId: string) => {
    if (!user) return;
    
    try {
      if (chatId === "ai-assistant") {
        // AIアシスタントの場合
        const session = await fetchChatSession(user.uid, chatId);
        
        if (session && session.messages.length > 0) {
          const loadedMessages: Message[] = session.messages
            .filter((msg: ChatMessage) => msg.sender === 'user' || msg.sender === 'ai')
            .map((msg: ChatMessage) => ({
              id: msg.id,
              text: msg.text,
              sender: msg.sender === 'ai' ? 'ai' : 'user',
              timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
              isTyping: msg.isTyping
            }));
          setMessages(loadedMessages);
          setCurrentSessionId(session.id);
        } else {
          const initialMessages: Message[] = [
            {
              id: "1",
              text: "こんにちは！お気軽にご質問ください！",
              sender: "ai",
              timestamp: new Date()
            }
          ];
          setMessages(initialMessages);
          setCurrentSessionId(null);
        }
      } else {
        // チームメンバーとのチャットの場合
        // 自分のセッションと相手のセッションの両方を確認
        const mySession = await fetchChatSession(user.uid, chatId);
        const otherUserSession = await fetchChatSession(chatId, user.uid);
        
        // 両方のセッションのメッセージをマージ
        const allMessages: ChatMessage[] = [];
        if (mySession) {
          allMessages.push(...mySession.messages);
        }
        if (otherUserSession) {
          // 相手のセッションのメッセージを追加（senderを'user'に変換）
          allMessages.push(...otherUserSession.messages.map(msg => ({
            ...msg,
            sender: msg.sender === 'other' ? 'user' : msg.sender
          })));
        }
        
        // タイムスタンプでソート
        allMessages.sort((a, b) => {
          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          return timeA - timeB;
        });
        
        if (allMessages.length > 0) {
          const loadedMessages: Message[] = allMessages.map((msg: ChatMessage) => ({
            id: msg.id,
            text: msg.text,
            sender: msg.sender === 'ai' ? 'ai' : (msg.sender === 'other' ? 'user' : 'user'),
            timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
            isTyping: msg.isTyping
          }));
          setMessages(loadedMessages);
          setCurrentSessionId(mySession?.id || null);
        } else {
          // 新しいチャット
          setMessages([]);
          setCurrentSessionId(null);
        }
      }
    } catch (error) {
      console.error('チャット履歴の読み込みエラー:', error);
      const initialMessages: Message[] = chatId === "ai-assistant" 
        ? [{
            id: "1",
            text: "こんにちは！お気軽にご質問ください！",
            sender: "ai" as const,
            timestamp: new Date()
          }]
        : [];
      setMessages(initialMessages);
      setCurrentSessionId(null);
    }
  };

  // チャット履歴を保存（Firestoreに）
  const saveChatHistory = async (chatId: string, messages: Message[]) => {
    if (!user) return;
    
    try {
      const chatMessages: ChatMessage[] = messages
        .filter(msg => !msg.isTyping) // タイピング中のメッセージは除外
        .map(msg => {
          const baseMessage: ChatMessage = {
            id: msg.id,
            text: msg.text,
            sender: msg.sender === 'ai' ? 'ai' : 'user',
            timestamp: msg.timestamp
          };
          // senderNameは値がある場合のみ追加（undefinedを避ける）
          if (msg.sender === 'user' && (user.displayName || user.email)) {
            baseMessage.senderName = user.displayName || user.email || 'Unknown';
          }
          return baseMessage;
        });

      if (activeChat === "ai-assistant") {
        // AIアシスタントの場合は自分のセッションのみ保存
        if (currentSessionId) {
          await updateChatSession(currentSessionId, chatMessages);
        } else {
          const sessionId = await saveChatSession({
            userId: user.uid,
            chatId: chatId,
            messages: chatMessages,
            lastUpdated: new Date()
          });
          setCurrentSessionId(sessionId);
        }
      } else {
        // チームメンバーとのチャットの場合、両方のユーザーのセッションに保存
        const otherUserId = chatId;
        const participants = [user.uid, otherUserId].sort(); // ソートして一意のチャットルームIDを作成
        
        // 自分のセッションを保存/更新
        if (currentSessionId) {
          await updateChatSession(currentSessionId, chatMessages);
        } else {
          const sessionId = await saveChatSession({
            userId: user.uid,
            chatId: chatId,
            messages: chatMessages,
            lastUpdated: new Date()
          });
          setCurrentSessionId(sessionId);
        }
        
        // 相手のセッションも保存/更新
        try {
          const otherUserSession = await fetchChatSession(otherUserId, user.uid);
          if (otherUserSession) {
            // 相手のセッションに自分のメッセージを追加
            const otherUserMessages: ChatMessage[] = [
              ...otherUserSession.messages,
              ...chatMessages.filter(msg => msg.sender === 'user')
            ];
            await updateChatSession(otherUserSession.id, otherUserMessages);
          } else {
            // 相手のセッションが存在しない場合は作成
            const otherUserChatMessages: ChatMessage[] = chatMessages
              .filter(msg => msg.sender === 'user')
              .map(msg => ({
                ...msg,
                sender: 'other' as const,
                senderName: user.displayName || user.email || 'Unknown'
              }));
            await saveChatSession({
              userId: otherUserId,
              chatId: user.uid,
              messages: otherUserChatMessages,
              lastUpdated: new Date()
            });
          }
        } catch (error) {
          console.error('相手のセッション保存エラー:', error);
        }
      }
    } catch (error) {
      console.error('チャット履歴の保存エラー:', error);
    }
  };

  // AIチャットで回答を生成（LLM使用）
  const generateAIResponse = async (query: string): Promise<string> => {
    if (!user) return "ユーザーが認証されていません。";

    try {
      // Firebase認証トークンを取得
      const token = await user.getIdToken();
      
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: query,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.response || '申し訳ございません。回答を生成できませんでした。';
      } else {
        const errorData = await response.json();
        return errorData.response || 'エラーが発生しました。もう一度お試しください。';
      }
    } catch (error) {
      console.error('AI回答生成エラー:', error);
      return 'エラーが発生しました。もう一度お試しください。';
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
        
        // AIで回答を生成（LLM使用、文書管理の内容があればそれも参照）
        const aiResponse = await generateAIResponse(inputText.trim());
        
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
      // チームメンバーとのチャットの場合
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
    }
  }, [user, activeChat]);

  // リアルタイム更新（チームメンバーとのチャットのみ）
  useEffect(() => {
    if (!user || activeChat === "ai-assistant") return;

    let checkInterval: NodeJS.Timeout | null = null;

    // 定期的にチェック（簡易的な実装）
    const startPolling = async () => {
      checkInterval = setInterval(async () => {
        try {
          const updatedSession = await fetchChatSession(activeChat, user.uid);
          if (updatedSession) {
            const newMessages = updatedSession.messages
              .filter(msg => msg.sender === 'other')
              .map(msg => ({
                id: msg.id,
                text: msg.text,
                sender: 'user' as const,
                timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
                isTyping: false
              }));
            
            // 既存のメッセージとマージ（重複を避ける）
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
              if (uniqueNewMessages.length > 0) {
                return [...prev, ...uniqueNewMessages].sort((a, b) => 
                  a.timestamp.getTime() - b.timestamp.getTime()
                );
              }
              return prev;
            });
          }
        } catch (error) {
          console.error('リアルタイム更新エラー:', error);
        }
      }, 2000); // 2秒ごとにチェック
    };

    startPolling();

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [user, activeChat]);

  // チームメンバーが読み込まれたらチャットリストを更新
  useEffect(() => {
    if (user) {
      const chatList: Chat[] = [
        {
          id: "ai-assistant",
          name: "AI アシスタント",
          avatar: <AIAssistantIcon size="md" className="text-blue-600" />,
          lastMessage: "こんにちは！お気軽にご質問ください！",
          timestamp: new Date(),
          unreadCount: 0,
          isOnline: true
        },
        ...teamMembers.map((member) => ({
          id: member.id,
          name: member.displayName,
          avatar: member.displayName.charAt(0).toUpperCase(),
          lastMessage: "メッセージを開始",
          timestamp: new Date(),
          unreadCount: 0,
          isOnline: false // オンライン状態は実装していないため、デフォルトでfalse
        }))
      ];
      setChats(chatList);
    }
  }, [user, teamMembers]);

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
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <button
                      onClick={() => {
                        // チャットログの内容を文字列に変換
                        const chatLog = messages
                          .filter(msg => !msg.isTyping)
                          .map(msg => {
                            const sender = msg.sender === 'user' ? 'ユーザー' : 'AI';
                            const timestamp = msg.timestamp instanceof Date 
                              ? msg.timestamp.toLocaleString('ja-JP')
                              : new Date(msg.timestamp).toLocaleString('ja-JP');
                            return `[${timestamp}] ${sender}: ${msg.text}`;
                          })
                          .join('\n\n');
                        
                        setSummaryContent(chatLog);
                        setSummaryDocumentId(currentSessionId || activeChat);
                        setShowSummaryModal(true);
                      }}
                      className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      title="チャットログを要約"
                    >
                      要約
                    </button>
                  )}
                  {activeChat !== "ai-assistant" && (
                    <div className={`w-3 h-3 rounded-full ${
                      chats.find(chat => chat.id === activeChat)?.isOnline 
                        ? "bg-green-500" 
                        : "bg-gray-400"
                    }`}></div>
                  )}
                </div>
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
                        <div className="text-sm whitespace-pre-wrap">
                          {message.sender === 'ai' 
                            ? renderMessageWithLinks(message.text)
                            : message.text
                          }
                        </div>
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

        {/* 要約モーダル */}
        <SummaryModal
          isOpen={showSummaryModal}
          onClose={() => {
            setShowSummaryModal(false);
            setSummaryContent('');
            setSummaryDocumentId('');
          }}
          content={summaryContent}
          documentType="chat"
          documentId={summaryDocumentId}
          sourceType="chat"
        />
      </Layout>
    </ProtectedRoute>
  );
}