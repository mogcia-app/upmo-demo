import { collection, addDoc, getDocs, query, where, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'other';
  senderName?: string;
  timestamp: Date;
  isTyping?: boolean;
}

export interface ChatSession {
  id: string;
  userId: string;
  chatId: string; // 'ai-assistant', 'yamada', etc.
  messages: ChatMessage[];
  lastUpdated: Date;
  title?: string; // チャットのタイトル（最初のメッセージから生成）
}

// チャットセッションをFirestoreに保存
export const saveChatSession = async (session: Omit<ChatSession, 'id'>): Promise<string> => {
  try {
    // undefinedの値を削除してFirestoreに保存
    const cleanMessage = (msg: ChatMessage) => {
      const cleaned: any = {
        id: msg.id,
        text: msg.text,
        sender: msg.sender,
        timestamp: msg.timestamp
      };
      // オプショナルフィールドは値がある場合のみ追加
      if (msg.senderName !== undefined) cleaned.senderName = msg.senderName;
      if (msg.isTyping !== undefined) cleaned.isTyping = msg.isTyping;
      return cleaned;
    };

    const sessionData = {
      userId: session.userId,
      chatId: session.chatId,
      lastUpdated: new Date(),
      messages: session.messages.map(cleanMessage),
      ...(session.title !== undefined && { title: session.title })
    };
    
    const docRef = await addDoc(collection(db, 'chatSessions'), sessionData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving chat session:', error);
    throw error;
  }
};

// チャットセッションを更新
export const updateChatSession = async (sessionId: string, messages: ChatMessage[]): Promise<void> => {
  try {
    // undefinedの値を削除してFirestoreに保存
    const cleanMessage = (msg: ChatMessage) => {
      const cleaned: any = {
        id: msg.id,
        text: msg.text,
        sender: msg.sender,
        timestamp: msg.timestamp
      };
      // オプショナルフィールドは値がある場合のみ追加
      if (msg.senderName !== undefined) cleaned.senderName = msg.senderName;
      if (msg.isTyping !== undefined) cleaned.isTyping = msg.isTyping;
      return cleaned;
    };

    const sessionRef = doc(db, 'chatSessions', sessionId);
    await updateDoc(sessionRef, {
      messages: messages.map(cleanMessage),
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Error updating chat session:', error);
    throw error;
  }
};

// ユーザーのチャットセッションを取得
export const fetchUserChatSessions = async (userId: string): Promise<ChatSession[]> => {
  try {
    const q = query(
      collection(db, 'chatSessions'),
      where('userId', '==', userId),
      orderBy('lastUpdated', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const sessions: ChatSession[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      sessions.push({
        id: doc.id,
        userId: data.userId,
        chatId: data.chatId,
        messages: data.messages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp?.toDate() || new Date()
        })),
        lastUpdated: data.lastUpdated?.toDate() || new Date(),
        title: data.title
      });
    });
    
    return sessions;
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return [];
  }
};

// 特定のチャットセッションを取得
export const fetchChatSession = async (userId: string, chatId: string): Promise<ChatSession | null> => {
  try {
    const q = query(
      collection(db, 'chatSessions'),
      where('userId', '==', userId),
      where('chatId', '==', chatId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      userId: data.userId,
      chatId: data.chatId,
      messages: data.messages.map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp?.toDate() || new Date()
      })),
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
      title: data.title
    };
  } catch (error) {
    console.error('Error fetching chat session:', error);
    return null;
  }
};

// チャットセッションを削除
export const deleteChatSession = async (sessionId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'chatSessions', sessionId));
  } catch (error) {
    console.error('Error deleting chat session:', error);
    throw error;
  }
};

// チャットタイトルを生成
export const generateChatTitle = (messages: ChatMessage[]): string => {
  const firstUserMessage = messages.find(msg => msg.sender === 'user');
  if (firstUserMessage) {
    const text = firstUserMessage.text;
    if (text.length > 30) {
      return text.substring(0, 30) + '...';
    }
    return text;
  }
  return '新しいチャット';
};

// メッセージを追加
export const addMessageToSession = async (
  sessionId: string, 
  message: ChatMessage
): Promise<void> => {
  try {
    // 既存のセッションを取得
    const sessionRef = doc(db, 'chatSessions', sessionId);
    const sessionDoc = await getDocs(query(collection(db, 'chatSessions'), where('__name__', '==', sessionId)));
    
    if (!sessionDoc.empty) {
      const sessionData = sessionDoc.docs[0].data();
      const updatedMessages = [...sessionData.messages, message];
      
      await updateDoc(sessionRef, {
        messages: updatedMessages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp
        })),
        lastUpdated: new Date()
      });
    }
  } catch (error) {
    console.error('Error adding message to session:', error);
    throw error;
  }
};
