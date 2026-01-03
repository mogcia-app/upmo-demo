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
  companyName?: string; // 会社名（AIアシスタントの場合は会社単位で共有）
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

    const sessionData: any = {
      userId: session.userId,
      chatId: session.chatId,
      lastUpdated: new Date(),
      messages: session.messages.map(cleanMessage),
    };
    
    // オプショナルフィールドは値がある場合のみ追加
    if (session.title !== undefined) sessionData.title = session.title;
    if (session.companyName !== undefined) sessionData.companyName = session.companyName;
    
    const docRef = await addDoc(collection(db, 'chatSessions'), sessionData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving chat session:', error);
    throw error;
  }
};

// チャットセッションを更新
export const updateChatSession = async (sessionId: string, messages: ChatMessage[], companyName?: string): Promise<void> => {
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
    const updateData: any = {
      messages: messages.map(cleanMessage),
      lastUpdated: new Date()
    };
    
    // companyNameが指定されている場合は更新
    if (companyName !== undefined) {
      updateData.companyName = companyName;
    }
    
    await updateDoc(sessionRef, updateData);
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
export const fetchChatSession = async (userId: string, chatId: string, companyName?: string): Promise<ChatSession | null> => {
  try {
    let q;
    
    // AIアシスタントの場合はcompanyNameで検索、それ以外はuserIdで検索
    if (chatId === 'ai-assistant' && companyName) {
      q = query(
        collection(db, 'chatSessions'),
        where('chatId', '==', chatId),
        where('companyName', '==', companyName)
      );
    } else {
      q = query(
        collection(db, 'chatSessions'),
        where('userId', '==', userId),
        where('chatId', '==', chatId)
      );
    }
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    // 複数ある場合は最新のものを取得
    const sortedDocs = querySnapshot.docs.sort((a, b) => {
      const aTime = a.data().lastUpdated?.toDate()?.getTime() || 0;
      const bTime = b.data().lastUpdated?.toDate()?.getTime() || 0;
      return bTime - aTime;
    });
    
    const doc = sortedDocs[0];
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
      title: data.title,
      companyName: data.companyName
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
