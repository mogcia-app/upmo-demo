import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { searchSalesCases, searchProgressNotes } from '@/utils/salesSearch';
import { getAppKnowledge, findPageByKeyword, getPageContext } from '@/bff';

// Firebase Admin SDK の初期化
let adminDb: ReturnType<typeof getFirestore> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

try {
  if (!getApps().length) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      adminDb = getFirestore();
      auth = getAuth();
    } else {
      console.warn('Firebase Admin SDKの環境変数が設定されていません');
    }
  } else {
    adminDb = getFirestore();
    auth = getAuth();
  }
} catch (error) {
  console.error('Firebase Admin SDKの初期化エラー:', error);
}

// 認証トークンを検証するヘルパー関数
async function verifyAuthToken(request: NextRequest): Promise<string | null> {
  if (!auth) return null;
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('認証トークン検証エラー:', error);
    return null;
  }
}

// ユーザーのcompanyNameを取得
async function getUserCompanyName(userId: string): Promise<string> {
  if (!adminDb) return '';
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    return userData?.companyName || '';
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    return '';
  }
}

// 質問の意図を解析（BFFベース）
type Intent = 
  | { type: 'customer' }
  | { type: 'sales' }
  | { type: 'progress' }
  | { type: 'meeting' }
  | { type: 'todo' }
  | { type: 'event' }
  | { type: 'document' }
  | { type: 'unknown' };

function parseIntent(message: string): Intent {
  // BFFのキーワードマッチングを使用
  const pageId = findPageByKeyword(message);
  
  if (pageId === 'customer') return { type: 'customer' };
  if (pageId === 'sales') return { type: 'sales' };
  if (pageId === 'progress') return { type: 'progress' };
  if (pageId === 'meeting') return { type: 'meeting' };
  if (pageId === 'todo') return { type: 'todo' };
  if (pageId === 'event') return { type: 'event' };
  if (pageId === 'document') return { type: 'document' };
  
  return { type: 'unknown' };
}

// 検索結果の構造体
type ContextResult = {
  type: Intent['type'];
  items: any[];
  formatted: string;
  pageUrl?: string; // このページへのURL
};

// ContextResultのruntime validation（型保証だけでは不十分なため）
function validateContextResult(result: any): ContextResult | null {
  if (!result) return null;
  
  // 構造を保証
  return {
    type: result.type || 'unknown',
    items: Array.isArray(result.items) ? result.items : [],
    formatted: typeof result.formatted === 'string' && result.formatted.trim() !== '' 
      ? result.formatted 
      : ''
  };
}

// intentに基づいて1系統だけ検索
async function searchByIntent(
  intent: Intent,
  message: string,
  userId: string,
  companyName: string
): Promise<ContextResult | null> {
  // unknown intentの場合は検索しない（パフォーマンス向上）
  if (intent.type === 'unknown') {
    return null;
  }

  if (!adminDb) {
    console.warn('[searchByIntent] adminDb is not initialized');
    return null;
  }

  const searchQuery = message.toLowerCase();
  const queryWords = searchQuery.split(/\s+/).filter(w => w.length > 0);
  
  // 一般的な質問を検出（「一覧」「見たい」「教えて」など）
  const generalQueryKeywords = ['一覧', '見たい', '教えて', '確認', '見る', '全部', 'すべて', '全て', '何がある', '何があるの', '何が', 'どんな', 'リスト', '全部見せて'];
  const isGeneralQuery = generalQueryKeywords.some(keyword => searchQuery.includes(keyword));

  try {
    switch (intent.type) {
      case 'customer': {
        if (!companyName) return null;
        const customersSnapshot = await adminDb.collection('customers')
          .where('companyName', '==', companyName)
          .limit(isGeneralQuery ? 20 : 10)
          .get();
        
        const relevantCustomers: any[] = [];
        customersSnapshot.forEach((doc) => {
          const data = doc.data();
          
          // 一般的な質問の場合は、すべての顧客を返す
          if (isGeneralQuery) {
            relevantCustomers.push({
              name: data.name,
              company: data.company,
              email: data.email,
              phone: data.phone,
              status: data.status,
              notes: data.notes
            });
          } else {
            // 通常の検索：マッチング条件を適用
            const nameMatch = data.name?.toLowerCase().includes(searchQuery);
            const companyMatch = data.company?.toLowerCase().includes(searchQuery);
            const emailMatch = data.email?.toLowerCase().includes(searchQuery);
            const wordMatch = queryWords.some(word => 
              data.name?.toLowerCase().includes(word) || 
              data.company?.toLowerCase().includes(word) ||
              data.email?.toLowerCase().includes(word)
            );
            
            if (nameMatch || companyMatch || emailMatch || wordMatch) {
              relevantCustomers.push({
                name: data.name,
                company: data.company,
                email: data.email,
                phone: data.phone,
                status: data.status,
                notes: data.notes
              });
            }
          }
        });
        
        if (relevantCustomers.length === 0) {
          return {
            type: 'customer',
            items: [],
            formatted: '【顧客管理】\n\n顧客情報が見つかりませんでした。\n\n別のキーワードで検索していただくか、顧客名・会社名・メールアドレスで検索してみてください。'
          };
        }
        
        const customerTexts = relevantCustomers.map(c => {
          let text = `顧客名: ${c.name}`;
          if (c.company) text += `\n会社名: ${c.company}`;
          if (c.email) text += `\nメール: ${c.email}`;
          if (c.phone) text += `\n電話: ${c.phone}`;
          if (c.status) text += `\nステータス: ${getCustomerStatusLabel(c.status)}`;
          if (c.notes) text += `\nメモ: ${c.notes}`;
          return text;
        });
        
        const pageContext = getPageContext('customer');
        const pageUrl = pageContext?.url || '/customers';
        
        return {
          type: 'customer',
          items: relevantCustomers,
          formatted: `【顧客管理】\n\n${relevantCustomers.length}件ヒットしました。\n\n${customerTexts.join('\n\n---\n\n')}\n\n[📋 顧客管理ページへ移動](${pageUrl})`,
          pageUrl
        };
      }

      case 'sales': {
        const limit = isGeneralQuery ? 10 : 5;
        const salesCases = await searchSalesCases(message, userId, limit);
        
        if (salesCases.length === 0) {
          // 一般的な質問の場合は、全案件を取得してみる
          if (isGeneralQuery) {
            try {
              const allCasesSnapshot = await adminDb.collection('salesCases')
                .where('userId', '==', userId)
                .limit(10)
                .get();
              
              const allCases = allCasesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));
              
              if (allCases.length > 0) {
                const caseTexts = allCases.map((c: any) => {
                  let text = `案件名: ${c.title}\n顧客: ${c.customerName}`;
                  if (c.customerCompany) text += ` (${c.customerCompany})`;
                  text += `\nステータス: ${getStatusLabel(c.status)}`;
                  if (c.description) text += `\n概要: ${c.description}`;
                  if (c.estimatedValue) text += `\n見積金額: ${c.estimatedValue.toLocaleString()}円`;
                  if (c.probability) text += `\n成約確率: ${c.probability}%`;
                  if (c.expectedCloseDate) text += `\n予定クロージング日: ${c.expectedCloseDate.toLocaleDateString('ja-JP')}`;
                  return text;
                });
                
                const pageContext = getPageContext('sales');
                const pageUrl = pageContext?.url || '/sales/cases';
                
                return {
                  type: 'sales',
                  items: allCases,
                  formatted: `【営業案件】\n\n${allCases.length}件ヒットしました。\n\n${caseTexts.join('\n\n---\n\n')}\n\n[💼 営業案件ページへ移動](${pageUrl})`,
                  pageUrl
                };
              }
            } catch (error) {
              console.error('[searchByIntent] Error fetching all sales cases', error);
            }
          }
          
          return {
            type: 'sales',
            items: [],
            formatted: '【営業案件】\n\n営業案件が見つかりませんでした。\n\n別のキーワードで検索していただくか、案件名・顧客名で検索してみてください。'
          };
        }
        
        const caseTexts = salesCases.map(c => {
          let text = `案件名: ${c.title}\n顧客: ${c.customerName}`;
          if (c.customerCompany) text += ` (${c.customerCompany})`;
          text += `\nステータス: ${getStatusLabel(c.status)}`;
          if (c.description) text += `\n概要: ${c.description}`;
          if (c.estimatedValue) text += `\n見積金額: ${c.estimatedValue.toLocaleString()}円`;
          if (c.probability) text += `\n成約確率: ${c.probability}%`;
          if (c.expectedCloseDate) text += `\n予定クロージング日: ${c.expectedCloseDate.toLocaleDateString('ja-JP')}`;
          return text;
        });
        
        const pageContext = getPageContext('sales');
        const pageUrl = pageContext?.url || '/sales/cases';
        
        return {
          type: 'sales',
          items: salesCases,
          formatted: `【営業案件】\n\n${salesCases.length}件ヒットしました。\n\n${caseTexts.join('\n\n---\n\n')}\n\n[💼 営業案件ページへ移動](${pageUrl})`,
          pageUrl
        };
      }

      case 'progress': {
        const limit = isGeneralQuery ? 10 : 5;
        const progressNotes = await searchProgressNotes(message, userId, undefined, limit);
        
        if (progressNotes.length === 0) {
          // 一般的な質問の場合は、全メモを取得してみる
          if (isGeneralQuery) {
            try {
              const allNotesSnapshot = await adminDb.collection('progressNotes')
                .where('userId', '==', userId)
                .orderBy('date', 'desc')
                .limit(10)
                .get();
              
              const allNotes = allNotesSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  title: data.title,
                  date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
                  content: data.content,
                  caseTitle: data.caseTitle
                };
              });
              
              if (allNotes.length > 0) {
                const noteTexts = allNotes.map((n: any) => {
                  let text = `タイトル: ${n.title}\n日付: ${n.date.toLocaleDateString('ja-JP')}`;
                  if (n.caseTitle) text += `\n関連案件: ${n.caseTitle}`;
                  text += `\n内容: ${n.content}`;
                  return text;
                });
                
                const pageContext = getPageContext('progress');
                const pageUrl = pageContext?.url || '/sales/progress-notes';
                
                return {
                  type: 'progress',
                  items: allNotes,
                  formatted: `【進捗メモ】\n\n${allNotes.length}件ヒットしました。\n\n${noteTexts.join('\n\n---\n\n')}\n\n[📝 進捗メモページへ移動](${pageUrl})`,
                  pageUrl
                };
              }
            } catch (error) {
              console.error('[searchByIntent] Error fetching all progress notes', error);
            }
          }
          
          return {
            type: 'progress',
            items: [],
            formatted: '【進捗メモ】\n\n進捗メモが見つかりませんでした。\n\n別のキーワードで検索していただくか、タイトル・内容で検索してみてください。'
          };
        }
        
        const noteTexts = progressNotes.map(n => {
          let text = `タイトル: ${n.title}\n日付: ${n.date.toLocaleDateString('ja-JP')}`;
          if (n.caseTitle) text += `\n関連案件: ${n.caseTitle}`;
          text += `\n内容: ${n.content}`;
          if (n.nextActions && n.nextActions.length > 0) {
            text += `\n次アクション: ${n.nextActions.join(', ')}`;
          }
          if (n.risks && n.risks.length > 0) {
            text += `\nリスク・懸念: ${n.risks.join(', ')}`;
          }
          return text;
        });
        
        const pageContext = getPageContext('progress');
        const pageUrl = pageContext?.url || '/sales/progress-notes';
        
        return {
          type: 'progress',
          items: progressNotes,
          formatted: `【進捗メモ】\n\n${progressNotes.length}件ヒットしました。\n\n${noteTexts.join('\n\n---\n\n')}\n\n[📝 進捗メモページへ移動](${pageUrl})`,
          pageUrl
        };
      }

      case 'meeting': {
        if (!companyName) return null;
        const limit = isGeneralQuery ? 20 : 10;
        const meetingNotesSnapshot = await adminDb.collection('meetingNotes')
          .where('companyName', '==', companyName)
          .limit(limit)
          .get();
        
        const relevantNotes: any[] = [];
        meetingNotesSnapshot.forEach((doc) => {
          const data = doc.data();
          
          // 一般的な質問の場合は、すべての議事録を返す
          if (isGeneralQuery) {
            relevantNotes.push({
              title: data.title,
              meetingDate: data.meetingDate,
              meetingTime: data.meetingTime,
              location: data.location,
              assignee: data.assignee,
              notes: data.notes,
              actionItems: data.actionItems
            });
          } else {
            // 通常の検索：マッチング条件を適用
            const titleMatch = data.title?.toLowerCase().includes(searchQuery);
            const notesMatch = data.notes?.toLowerCase().includes(searchQuery);
            const wordMatch = queryWords.some(word => 
              data.title?.toLowerCase().includes(word) || 
              data.notes?.toLowerCase().includes(word)
            );
            
            if (titleMatch || notesMatch || wordMatch) {
              relevantNotes.push({
                title: data.title,
                meetingDate: data.meetingDate,
                meetingTime: data.meetingTime,
                location: data.location,
                assignee: data.assignee,
                notes: data.notes,
                actionItems: data.actionItems
              });
            }
          }
        });
        
        if (relevantNotes.length === 0) {
          return {
            type: 'meeting',
            items: [],
            formatted: '【議事録】\n\n議事録が見つかりませんでした。\n\n別のキーワードで検索していただくか、議題・備考で検索してみてください。'
          };
        }
        
        const noteTexts = relevantNotes.map(n => {
          let text = `タイトル: ${n.title}`;
          if (n.meetingDate) text += `\n日付: ${n.meetingDate}`;
          if (n.meetingTime) text += `\n時間: ${n.meetingTime}`;
          if (n.location) text += `\n場所: ${n.location}`;
          if (n.assignee) text += `\n担当者: ${n.assignee}`;
          if (n.notes) text += `\n備考: ${n.notes}`;
          if (n.actionItems && n.actionItems.length > 0) {
            text += `\nアクション項目: ${n.actionItems.map((item: any) => `${item.item} (担当: ${item.assignee}, 期限: ${item.deadline})`).join(', ')}`;
          }
          return text;
        });
        
        const pageContext = getPageContext('meeting');
        const pageUrl = pageContext?.url || '/meeting-notes';
        
        return {
          type: 'meeting',
          items: relevantNotes,
          formatted: `【議事録】\n\n${relevantNotes.length}件ヒットしました。\n\n${noteTexts.join('\n\n---\n\n')}\n\n[📝 議事録ページへ移動](${pageUrl})`,
          pageUrl
        };
      }

      case 'todo': {
        // 「今日」「きょう」「today」などのキーワードを検出
        const todayKeywords = ['今日', 'きょう', 'today', '本日'];
        const isTodayQuery = todayKeywords.some(keyword => searchQuery.includes(keyword));
        
        // 今日の日付を取得（時刻を00:00:00に設定）
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // 自分のTODOと共有されたTODOを取得
        const myTodosSnapshot = await adminDb.collection('todos')
          .where('userId', '==', userId)
          .limit(50)
          .get();
        
        const sharedTodosSnapshot = await adminDb.collection('todos')
          .where('sharedWith', 'array-contains', userId)
          .limit(50)
          .get();
        
        const relevantTodos: any[] = [];
        const allTodos: any[] = [];
        const todoIds = new Set<string>();
        
        // 自分のTODOを追加
        myTodosSnapshot.forEach((doc) => {
          const data = doc.data();
          if (!todoIds.has(doc.id)) {
            todoIds.add(doc.id);
            allTodos.push({
              id: doc.id,
              text: data.text,
              description: data.description,
              status: data.status,
              priority: data.priority,
              dueDate: data.dueDate,
              startDate: data.startDate,
              completed: data.completed || false
            });
          }
        });
        
        // 共有されたTODOを追加
        sharedTodosSnapshot.forEach((doc) => {
          const data = doc.data();
          if (!todoIds.has(doc.id)) {
            todoIds.add(doc.id);
            allTodos.push({
              id: doc.id,
              text: data.text,
              description: data.description,
              status: data.status,
              priority: data.priority,
              dueDate: data.dueDate,
              startDate: data.startDate,
              completed: data.completed || false
            });
          }
        });
        
        if (isTodayQuery) {
          // 「今日」の場合は、期限が今日のタスクをフィルタリング
          allTodos.forEach(todo => {
            const dueDate = todo.dueDate instanceof Timestamp 
              ? todo.dueDate.toDate() 
              : todo.dueDate 
                ? new Date(todo.dueDate) 
                : null;
            
            if (dueDate) {
              const dueDateOnly = new Date(dueDate);
              dueDateOnly.setHours(0, 0, 0, 0);
              
              if (dueDateOnly.getTime() === today.getTime()) {
                relevantTodos.push(todo);
              }
            }
          });
          
          // 「今日」のタスクが見つからない場合、全タスクを返す（より寛容に）
          if (relevantTodos.length === 0 && allTodos.length > 0) {
            relevantTodos.push(...allTodos.slice(0, 10));
          }
        } else {
          // 一般的な質問の場合は、すべてのタスクを返す
          if (isGeneralQuery) {
            relevantTodos.push(...allTodos.slice(0, 20));
          } else {
            // 通常の検索：テキストや説明でマッチング
            const queryLower = searchQuery.toLowerCase();
            const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
            
            allTodos.forEach(todo => {
              const textMatch = todo.text?.toLowerCase().includes(queryLower);
              const descriptionMatch = todo.description?.toLowerCase().includes(queryLower);
              const wordMatch = queryWords.some(word => 
                todo.text?.toLowerCase().includes(word) || 
                todo.description?.toLowerCase().includes(word)
              );
              
              if (textMatch || descriptionMatch || wordMatch) {
                relevantTodos.push(todo);
              }
            });
          }
        }
        
        // 結果が0件の場合でも、適切なメッセージを返す
        if (relevantTodos.length === 0) {
          if (allTodos.length === 0) {
            // TODOが全く存在しない場合
            return {
              type: 'todo',
              items: [],
              formatted: '【TODOリスト】\n\n現在、登録されているタスクはありません。\n\n[✅ タスク管理ページへ移動](/todo)で新しいタスクを作成できます。'
            };
          } else if (isTodayQuery) {
            return {
              type: 'todo',
              items: [],
              formatted: '【今日のタスク】\n\n今日のタスクはありません。\n\n期限が設定されていないタスクや、他の日のタスクがある場合は、別のキーワードで検索してみてください。'
            };
          } else {
            return {
              type: 'todo',
              items: [],
              formatted: `【TODOリスト】\n\n検索条件に一致するタスクが見つかりませんでした。\n\n現在、${allTodos.length}件のタスクが登録されています。\n\n別のキーワードで検索していただくか、タスク名・説明で検索してみてください。`
            };
          }
        }
        
        const todoTexts = relevantTodos.map(t => {
          let text = `タスク: ${t.text || '（タイトルなし）'}`;
          if (t.description) text += `\n説明: ${t.description}`;
          if (t.status) {
            const statusLabels: Record<string, string> = {
              'shared': '共有事項',
              'todo': 'ToDoリスト',
              'in-progress': '進行中',
              'completed': '完了'
            };
            text += `\nステータス: ${statusLabels[t.status] || t.status}`;
          }
          if (t.priority) text += `\n優先度: ${getPriorityLabel(t.priority)}`;
          if (t.completed) text += `\n完了: はい`;
          if (t.dueDate) {
            const dueDate = t.dueDate instanceof Timestamp ? t.dueDate.toDate() : new Date(t.dueDate);
            text += `\n期限: ${dueDate.toLocaleDateString('ja-JP')}`;
          }
          if (t.startDate) {
            const startDate = t.startDate instanceof Timestamp ? t.startDate.toDate() : new Date(t.startDate);
            text += `\n開始日: ${startDate.toLocaleDateString('ja-JP')}`;
          }
          return text;
        });
        
        const pageContext = getPageContext('todo');
        const pageUrl = pageContext?.url || '/todo';
        const header = isTodayQuery ? '【今日のタスク】' : '【TODOリスト】';
        
        return {
          type: 'todo',
          items: relevantTodos,
          formatted: `${header}\n\n${relevantTodos.length}件ヒットしました。\n\n${todoTexts.join('\n\n---\n\n')}\n\n[✅ タスク管理ページへ移動](${pageUrl})`,
          pageUrl
        };
      }

      case 'event': {
        const limit = isGeneralQuery ? 20 : 10;
        const eventsSnapshot = await adminDb.collection('events')
          .where('userId', '==', userId)
          .orderBy('date', 'desc')
          .limit(limit)
          .get();
        
        const relevantEvents: any[] = [];
        eventsSnapshot.forEach((doc) => {
          const data = doc.data();
          
          // 一般的な質問の場合は、すべてのイベントを返す
          if (isGeneralQuery) {
            relevantEvents.push({
              title: data.title,
              description: data.description,
              date: data.date,
              time: data.time,
              location: data.location
            });
          } else {
            // 通常の検索：マッチング条件を適用
            const titleMatch = data.title?.toLowerCase().includes(searchQuery);
            const descriptionMatch = data.description?.toLowerCase().includes(searchQuery);
            const wordMatch = queryWords.some(word => 
              data.title?.toLowerCase().includes(word) || 
              data.description?.toLowerCase().includes(word)
            );
            
            if (titleMatch || descriptionMatch || wordMatch) {
              relevantEvents.push({
                title: data.title,
                description: data.description,
                date: data.date,
                time: data.time,
                location: data.location
              });
            }
          }
        });
        
        if (relevantEvents.length === 0) {
          return {
            type: 'event',
            items: [],
            formatted: '【カレンダー】\n\n予定・イベントが見つかりませんでした。\n\n別のキーワードで検索していただくか、イベント名・説明で検索してみてください。'
          };
        }
        
        const eventTexts = relevantEvents.map(e => {
          let text = `イベント: ${e.title}`;
          if (e.date) {
            const eventDate = e.date instanceof Timestamp ? e.date.toDate() : new Date(e.date);
            text += `\n日付: ${eventDate.toLocaleDateString('ja-JP')}`;
          }
          if (e.time) text += `\n時間: ${e.time}`;
          if (e.location) text += `\n場所: ${e.location}`;
          if (e.description) text += `\n説明: ${e.description}`;
          return text;
        });
        
        const pageContext = getPageContext('event');
        const pageUrl = pageContext?.url || '/calendar';
        
        return {
          type: 'event',
          items: relevantEvents,
          formatted: `【カレンダー】\n\n${relevantEvents.length}件ヒットしました。\n\n${eventTexts.join('\n\n---\n\n')}\n\n[📅 カレンダーページへ移動](${pageUrl})`,
          pageUrl
        };
      }

      case 'document': {
        const snapshot = await adminDb.collection('manualDocuments').get();
        const relevantDocs: any[] = [];
        
        // 「（タイトル）について教えて」のようなパターンからタイトルを抽出
        const titlePattern = /^(.+?)(について|とは|の説明|について教えて|について知りたい)/;
        const titleMatch = message.match(titlePattern);
        const extractedTitle = titleMatch ? titleMatch[1].trim() : null;
        
        for (const doc of snapshot.docs) {
          const data = doc.data();
          
          // 一般的な質問の場合は、すべてのドキュメントを返す
          if (isGeneralQuery) {
            relevantDocs.push({
              title: data.title,
              description: data.description || '',
              sections: data.sections
            });
          } else {
            // タイトル抽出パターンがある場合、タイトルで優先的に検索
            let isMatch = false;
            let matchScore = 0;
            
            if (extractedTitle) {
              const docTitleLower = data.title?.toLowerCase() || '';
              const extractedTitleLower = extractedTitle.toLowerCase();
              
              // 完全一致
              if (docTitleLower === extractedTitleLower) {
                isMatch = true;
                matchScore = 100;
              }
              // 部分一致（タイトルに含まれる）
              else if (docTitleLower.includes(extractedTitleLower) || extractedTitleLower.includes(docTitleLower)) {
                isMatch = true;
                matchScore = 80;
              }
            }
            
            // タイトルマッチング
            const titleMatch = data.title?.toLowerCase().includes(searchQuery);
            if (titleMatch && !isMatch) {
              isMatch = true;
              matchScore = 60;
            }
            
            // 説明でのマッチング
            const descriptionMatch = data.description?.toLowerCase().includes(searchQuery);
            if (descriptionMatch && !isMatch) {
              isMatch = true;
              matchScore = 50;
            }
            
            // 内容でのマッチング
            const contentMatch = JSON.stringify(data.sections || {}).toLowerCase().includes(searchQuery);
            const wordMatch = queryWords.some(word => 
              data.title?.toLowerCase().includes(word) || 
              data.description?.toLowerCase().includes(word) ||
              JSON.stringify(data.sections || {}).toLowerCase().includes(word)
            );
            
            if ((contentMatch || wordMatch) && !isMatch) {
              isMatch = true;
              matchScore = 40;
            }
            
            if (isMatch) {
              relevantDocs.push({
                title: data.title,
                description: data.description || '',
                sections: data.sections,
                matchScore
              });
            }
          }
        }
        
        // マッチスコアでソート（高い順）
        relevantDocs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
        
        // PDCA管理も検索
        const pdcaCollections = ['pdcaPlan', 'pdcaDo', 'pdcaCheck', 'pdcaAction'];
        const pdcaItems: any[] = [];
        
        for (const collectionName of pdcaCollections) {
          try {
            const limit = isGeneralQuery ? 10 : 3;
            const pdcaSnapshot = await adminDb.collection(collectionName)
              .where('userId', '==', userId)
              .limit(limit)
              .get();
            
            pdcaSnapshot.forEach((doc) => {
              const data = doc.data();
              
              // 一般的な質問の場合は、すべてのPDCAアイテムを返す
              if (isGeneralQuery) {
                const categoryName = {
                  'pdcaPlan': '計画管理',
                  'pdcaDo': '実行管理',
                  'pdcaCheck': '評価管理',
                  'pdcaAction': '改善管理'
                }[collectionName] || collectionName;
                
                pdcaItems.push({
                  title: data.title,
                  content: data.content || data.description || '',
                  category: categoryName
                });
              } else {
                // 通常の検索：マッチング条件を適用
                const titleMatch = data.title?.toLowerCase().includes(searchQuery);
                const contentMatch = JSON.stringify(data).toLowerCase().includes(searchQuery);
                
                if (titleMatch || contentMatch) {
                  const categoryName = {
                    'pdcaPlan': '計画管理',
                    'pdcaDo': '実行管理',
                    'pdcaCheck': '評価管理',
                    'pdcaAction': '改善管理'
                  }[collectionName] || collectionName;
                  
                  pdcaItems.push({
                    title: data.title,
                    content: data.content || data.description || '',
                    category: categoryName
                  });
                }
              }
            });
          } catch (error) {
            // 個別のコレクションエラーは無視
          }
        }
        
        if (relevantDocs.length === 0 && pdcaItems.length === 0) {
          return {
            type: 'document',
            items: [],
            formatted: '【社内ドキュメント】\n\nドキュメントが見つかりませんでした。\n\n別のキーワードで検索していただくか、タイトル・内容で検索してみてください。'
          };
        }
        
        const totalCount = relevantDocs.length + pdcaItems.length;
        const formattedParts: string[] = [];
        
        if (relevantDocs.length > 0) {
          // 複数のドキュメントがある場合は、すべて表示
          // 「について教えて」パターンの場合は、overviewセクションだけを返す
          const isAboutQuery = !!extractedTitle;
          
          const docTexts = relevantDocs.map((doc, index) => {
            const sections = doc.sections || {};
            const sectionTexts: string[] = [];
            
            // 説明を最初に表示
            if (doc.description && doc.description.trim()) {
              sectionTexts.push(`説明: ${doc.description}`);
            }
            
            // セクションラベルのマッピング
            const sectionLabels: Record<string, string> = {
              'overview': '概要',
              'features': '機能',
              'pricing': '料金',
              'procedures': '手順',
              'support': 'サポート',
              'rules': '規則',
              'terms': '条件',
              'qa': 'Q&A'
            };
            
            // 「について教えて」の場合は、overviewセクションだけを処理
            const sectionsToProcess = isAboutQuery 
              ? Object.entries(sections).filter(([key]) => key === 'overview')
              : Object.entries(sections);
            
            for (const [key, value] of sectionsToProcess) {
              if (Array.isArray(value) && value.length > 0) {
                const label = sectionLabels[key] || key;
                if (key === 'qa' && typeof value[0] === 'object' && 'question' in value[0]) {
                  // Q&Aセクションの特別な処理
                  const qaTexts = value.map((qa: any, i: number) => 
                    `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`
                  );
                  sectionTexts.push(`${label}:\n${qaTexts.join('\n\n')}`);
                } else {
                  // タイトルと本文の形式に対応
                  const items = value.map((v: any) => {
                    if (typeof v === 'string') {
                      return `• ${v}`;
                    } else if (v && typeof v === 'object') {
                      const title = v.title || '';
                      const content = v.content || '';
                      if (title && content) {
                        return `• ${title}\n  ${content}`;
                      } else if (title) {
                        return `• ${title}`;
                      } else if (content) {
                        return `• ${content}`;
                      }
                      return '';
                    }
                    return '';
                  }).filter((item: string) => item.length > 0);
                  if (items.length > 0) {
                    sectionTexts.push(`${label}:\n${items.join('\n')}`);
                  }
                }
              } else if (typeof value === 'string' && value.trim()) {
                const label = sectionLabels[key] || key;
                sectionTexts.push(`${label}: ${value}`);
              }
            }
            
            if (sectionTexts.length > 0) {
              return `【${doc.title}】\n\n${sectionTexts.join('\n\n')}`;
            } else {
              return `【${doc.title}】`;
            }
          });
          
          formattedParts.push(docTexts.join('\n\n---\n\n'));
        }
        
        if (pdcaItems.length > 0) {
          const pdcaTexts = pdcaItems.map(i => {
            let text = `タイトル: ${i.title}`;
            if (i.content) text += `\n内容: ${i.content}`;
            return text;
          });
          formattedParts.push(`【${pdcaItems[0].category}】\n${pdcaTexts.join('\n\n---\n\n')}`);
        }
        
        const pageContext = getPageContext('document');
        const pageUrl = pageContext?.url || '/admin/contracts';
        
        return {
          type: 'document',
          items: [...relevantDocs, ...pdcaItems],
          formatted: `【社内ドキュメント】\n\n${totalCount}件ヒットしました。\n\n${formattedParts.join('\n\n')}\n\n[📄 ドキュメントページへ移動](${pageUrl})`,
          pageUrl
        };
      }

      default:
        return null;
    }
  } catch (error) {
    console.error(`検索エラー (${intent.type}):`, error);
    return null;
  }
}

// intentと結果から応答を構築（BFFベース）
// 必ず文字列を返すことを保証する関数（runtime safety強化）
function buildResponse(intent: Intent, result: ContextResult | null, message: string): string {
  // 1. 検索結果がある場合はformattedを返す（runtime validation）
  if (result) {
    const validatedResult = validateContextResult(result);
    
    if (validatedResult && validatedResult.formatted) {
      return validatedResult.formatted;
    }
    
    // formattedが空または無効な場合のフォールバック
    if (validatedResult && validatedResult.items && validatedResult.items.length > 0) {
      console.warn('[buildResponse] formatted is empty but items exist', { intent, itemsCount: validatedResult.items.length });
      return `【${validatedResult.type}】\nデータが見つかりましたが、表示形式に問題があります。\n件数: ${validatedResult.items.length}件`;
    }
    
    // validatedResultがnullまたはitemsが空の場合、次の処理に進む
    console.warn('[buildResponse] result validation failed or empty', { intent, result });
  }

  // 2. unknown intentの場合
  if (intent.type === 'unknown') {
    // 「使い方」「方法」「教えて」などの一般的な質問を検出
    const helpKeywords = ['使い方', '使い', '方法', '教えて', 'how to', '使い方を', 'どうやって', 'どう使う'];
    const isHelpQuery = helpKeywords.some(keyword => message.toLowerCase().includes(keyword));
    
    try {
      const knowledge = getAppKnowledge();
      
      if (isHelpQuery) {
        // 使い方の質問に対して、より親切な案内を返す
        const helpExamples = [
          {
            category: '📋 顧客管理',
            examples: [
              '「顧客一覧を見たい」',
              '「山田さんの情報を教えて」',
              '「顧客を検索したい」'
            ]
          },
          {
            category: '💼 営業案件',
            examples: [
              '「営業案件を教えて」',
              '「進行中の案件は？」',
              '「案件の一覧を見たい」'
            ]
          },
          {
            category: '✅ タスク管理',
            examples: [
              '「今日のタスクは？」',
              '「タスク一覧を見たい」',
              '「優先度の高いタスクは？」'
            ]
          },
          {
            category: '📝 議事録',
            examples: [
              '「議事録を見たい」',
              '「先週の会議の議事録は？」',
              '「議事録を検索したい」'
            ]
          },
          {
            category: '📅 カレンダー',
            examples: [
              '「今日の予定は？」',
              '「今週のイベントは？」',
              '「予定を確認したい」'
            ]
          },
          {
            category: '📄 社内ドキュメント',
            examples: [
              '「マニュアルを探したい」',
              '「契約書を検索したい」',
              '「社内文書を見たい」'
            ]
          }
        ];
        
        const examplesText = helpExamples.map(help => 
          `${help.category}\n${help.examples.map(ex => `  • ${ex}`).join('\n')}`
        ).join('\n\n');
        
        return `こんにちは！AIアシスタントです。\n\n` +
          `📖 使い方\n\n` +
          `このチャットでは、アプリ内の情報を質問形式で検索できます。\n\n` +
          `質問の例：\n\n${examplesText}\n\n` +
          `💡 ポイント\n` +
          `• 自然な日本語で質問してください\n` +
          `• 具体的なキーワード（「顧客」「案件」「タスク」など）を含めると、より正確な結果が得られます\n` +
          `• 「今日のタスクは？」のように日付を含めると、その日の情報を取得できます\n\n` +
          `何か質問があれば、お気軽にどうぞ！`;
      } else {
        // 通常のunknown intent
        const availablePages = knowledge.pages.map(p => 
          `• ${p.description}\n  利用可能な操作: ${p.operations.map(op => op.label).join(', ')}`
        ).join('\n\n');
        
        return `申し訳ございませんが、「${message}」に関する情報が見つかりませんでした。\n\n` +
          `📋 利用可能な機能\n\n${availablePages}\n\n` +
          `💡 使い方のヒント\n` +
          `具体的な質問をしていただくと、より詳しい情報をお答えできます。\n\n` +
          `質問例：\n` +
          `• 「顧客一覧を見たい」\n` +
          `• 「今日のタスクは？」\n` +
          `• 「営業案件を教えて」\n` +
          `• 「議事録を見たい」\n` +
          `• 「使い方を教えて」（このメッセージを表示）`;
      }
    } catch (error) {
      console.error('[buildResponse] Error getting app knowledge', error);
      // catch内でも必ずreturn
      return `こんにちは！AIアシスタントです。\n\n` +
        `📖 使い方\n\n` +
        `このチャットでは、アプリ内の情報を質問形式で検索できます。\n\n` +
        `質問の例：\n` +
        `• 「顧客一覧を見たい」\n` +
        `• 「営業案件を教えて」\n` +
        `• 「今日のタスクは？」\n` +
        `• 「議事録を見たい」\n` +
        `• 「予定を確認したい」\n\n` +
        `何か質問があれば、お気軽にどうぞ！`;
    }
  }

  // 3. intentは判定できたが結果が見つからなかった場合
  try {
    const pageContext = getPageContext(intent.type);
    
    if (pageContext) {
      const availableOperations = pageContext.operations.map(op => op.label).join('、');
      return `${pageContext.description}\n\n` +
        `「${message}」に関する情報が見つかりませんでした。\n\n` +
        `このページで利用可能な操作：${availableOperations}\n\n` +
        `別のキーワードで検索していただくか、上記の操作を試してみてください。`;
    }
  } catch (error) {
    console.error('[buildResponse] Error getting page context', { intent, error });
    // catch内でも必ずreturn（次のフォールバックに進む）
  }

  // 4. 最終フォールバック（必ず文字列を返す - runtime safety保証）
  // この行に到達した場合、必ず文字列を返す
  return `「${message}」に関する情報が見つかりませんでした。\n\n` +
    `別のキーワードで検索していただくか、管理者にお問い合わせください。`;
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'メッセージが必要です' },
        { status: 400 }
      );
    }

    // 認証トークンからuserIdを取得
    const userId = await verifyAuthToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // ユーザーのcompanyNameを取得
    const companyName = await getUserCompanyName(userId);

    if (!adminDb) {
      return NextResponse.json(
        { error: 'データベース接続エラー' },
        { status: 500 }
      );
    }

    // 1. intentを最初に決定
    const intent = parseIntent(message);
    
    // デバッグログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('[AI Chat] Intent parsed:', { message, intent: intent.type });
    }

    // 2. intentに基づいて1系統だけ検索
    const rawResult = await searchByIntent(intent, message, userId, companyName);
    
    // runtime validation（構造保証）
    const result = validateContextResult(rawResult);
    
    // デバッグログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('[AI Chat] Search result:', { 
        intent: intent.type, 
        hasResult: !!result,
        hasFormatted: result?.formatted ? result.formatted.length > 0 : false,
        itemsCount: result?.items?.length || 0,
        validated: !!result
      });
    }

    // 3. intentと結果から応答を構築（必ず文字列を返す - runtime safety保証）
    let aiResponse: string;
    try {
      aiResponse = buildResponse(intent, result, message);
    } catch (error) {
      console.error('[AI Chat] buildResponse threw error', error);
      // catch内でも必ず文字列を設定
      aiResponse = `申し訳ございません。応答の生成中にエラーが発生しました。\n\n` +
        `もう一度お試しいただくか、管理者にお問い合わせください。`;
    }
    
    // 最終チェック：aiResponseが空でないことを保証
    if (!aiResponse || aiResponse.trim() === '') {
      console.error('[AI Chat] aiResponse is empty!', { intent, result, message });
      const fallbackResponse = `申し訳ございません。応答の生成に失敗しました。\n\n` +
        `もう一度お試しいただくか、管理者にお問い合わせください。`;
      return NextResponse.json({
        response: fallbackResponse,
        intent: intent.type,
        error: 'Response generation failed'
      });
    }

    // レスポンスを構築
    const responseData: any = {
      response: aiResponse,
      intent: intent.type
    };

    // 後方互換性のため、contextSourcesも設定
    if (result) {
      responseData.contextSources = {
        [result.type]: true
      };
      responseData[`has${result.type.charAt(0).toUpperCase() + result.type.slice(1)}Context`] = true;
      // ページURLも含める（フロントエンドでリンクをクリック可能にするため）
      if (result.pageUrl) {
        responseData.pageUrl = result.pageUrl;
      }
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('AIチャットエラー:', error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('エラー詳細:', { errorMessage, errorStack });
    
    return NextResponse.json(
      { 
        error: 'エラーが発生しました', 
        response: '申し訳ございません。エラーが発生しました。もう一度お試しください。',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

// 案件ステータスのラベルを取得
function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    'prospecting': '見込み客',
    'qualification': '見極め中',
    'proposal': '提案中',
    'negotiation': '交渉中',
    'closed_won': '成約',
    'closed_lost': '失注'
  };
  return statusMap[status] || status;
}

// 顧客ステータスのラベルを取得
function getCustomerStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    'active': 'アクティブ',
    'prospect': '見込み客',
    'inactive': '非アクティブ'
  };
  return statusMap[status] || status;
}

// タスクステータスのラベルを取得
function getTodoStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': '未着手',
    'in_progress': '進行中',
    'completed': '完了',
    'cancelled': 'キャンセル'
  };
  return statusMap[status] || status;
}

// 優先度のラベルを取得
function getPriorityLabel(priority: string): string {
  const priorityMap: Record<string, string> = {
    'low': '低',
    'medium': '中',
    'high': '高',
    'urgent': '緊急'
  };
  return priorityMap[priority] || priority;
}

