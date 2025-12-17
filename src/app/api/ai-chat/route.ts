import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { searchSalesCases, searchProgressNotes } from '@/utils/salesSearch';

// Firebase Admin SDK の初期化
if (!getApps().length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
}

const adminDb = getFirestore();
const auth = getApps().length > 0 ? getAuth() : null;

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

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI APIキーが設定されていません' },
        { status: 500 }
      );
    }

    // ユーザーのcompanyNameを取得
    const companyName = await getUserCompanyName(userId);

    // すべてのページのデータを統合検索
    let documentContext = '';
    let salesCaseContext = '';
    let progressNoteContext = '';
    let customerContext = '';
    let meetingNoteContext = '';
    let todoContext = '';
    let eventContext = '';
    
    try {
      const searchQuery = message.toLowerCase();
      
      // 1. 文書管理の内容を検索（Admin SDKを使用）
      const snapshot = await adminDb.collection('manualDocuments').get();
      
      const relevantDocs: any[] = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const titleMatch = data.title?.toLowerCase().includes(searchQuery);
        const contentMatch = JSON.stringify(data.sections || {}).toLowerCase().includes(searchQuery);
        
        if (titleMatch || contentMatch) {
          relevantDocs.push({
            title: data.title,
            sections: data.sections
          });
        }
      }
      
      // 更新日順でソート
      relevantDocs.sort((a, b) => {
        // ここでは簡易的にタイトルでソート（必要に応じてlastUpdatedを追加）
        return 0;
      });
      
      if (relevantDocs.length > 0) {
        const bestDoc = relevantDocs[0];
        const sections = bestDoc.sections || {};
        
        const sectionTexts: string[] = [];
        for (const [key, value] of Object.entries(sections)) {
          if (Array.isArray(value)) {
            sectionTexts.push(`${key}: ${value.join('\n')}`);
          } else if (typeof value === 'string') {
            sectionTexts.push(`${key}: ${value}`);
          }
        }
        
        documentContext = `【社内ドキュメント】\n${bestDoc.title}\n\n${sectionTexts.join('\n\n')}`;
      }
      
      // 2. 営業案件を検索
      try {
        const salesCases = await searchSalesCases(message, userId, 3);
        if (salesCases.length > 0) {
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
          salesCaseContext = `【営業案件】\n${caseTexts.join('\n\n---\n\n')}`;
        }
      } catch (error) {
        console.error('案件検索エラー:', error);
      }
      
      // 3. 進捗メモを検索
      try {
        const progressNotes = await searchProgressNotes(message, userId, undefined, 3);
        if (progressNotes.length > 0) {
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
          progressNoteContext = `【進捗メモ】\n${noteTexts.join('\n\n---\n\n')}`;
        }
      } catch (error) {
        console.error('進捗メモ検索エラー:', error);
      }

      // 4. 顧客管理の内容を検索
      try {
        if (companyName) {
          const customersSnapshot = await adminDb.collection('customers')
            .where('companyName', '==', companyName)
            .limit(10)
            .get();
          
          const relevantCustomers: any[] = [];
          customersSnapshot.forEach((doc) => {
            const data = doc.data();
            const nameMatch = data.name?.toLowerCase().includes(searchQuery);
            const companyMatch = data.company?.toLowerCase().includes(searchQuery);
            const emailMatch = data.email?.toLowerCase().includes(searchQuery);
            
            if (nameMatch || companyMatch || emailMatch) {
              relevantCustomers.push({
                name: data.name,
                company: data.company,
                email: data.email,
                phone: data.phone,
                status: data.status,
                notes: data.notes
              });
            }
          });
          
          if (relevantCustomers.length > 0) {
            const customerTexts = relevantCustomers.map(c => {
              let text = `顧客名: ${c.name}`;
              if (c.company) text += `\n会社名: ${c.company}`;
              if (c.email) text += `\nメール: ${c.email}`;
              if (c.phone) text += `\n電話: ${c.phone}`;
              if (c.status) text += `\nステータス: ${getCustomerStatusLabel(c.status)}`;
              if (c.notes) text += `\nメモ: ${c.notes}`;
              return text;
            });
            customerContext = `【顧客管理】\n${customerTexts.join('\n\n---\n\n')}`;
          }
        }
      } catch (error) {
        console.error('顧客検索エラー:', error);
      }

      // 5. 議事録の内容を検索
      try {
        if (companyName) {
          const meetingNotesSnapshot = await adminDb.collection('meetingNotes')
            .where('companyName', '==', companyName)
            .limit(10)
            .get();
          
          const relevantNotes: any[] = [];
          meetingNotesSnapshot.forEach((doc) => {
            const data = doc.data();
            const titleMatch = data.title?.toLowerCase().includes(searchQuery);
            const notesMatch = data.notes?.toLowerCase().includes(searchQuery);
            
            if (titleMatch || notesMatch) {
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
          });
          
          if (relevantNotes.length > 0) {
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
            meetingNoteContext = `【議事録】\n${noteTexts.join('\n\n---\n\n')}`;
          }
        }
      } catch (error) {
        console.error('議事録検索エラー:', error);
      }

      // 6. TODOリストの内容を検索
      try {
        const todosSnapshot = await adminDb.collection('todos')
          .where('userId', '==', userId)
          .limit(10)
          .get();
        
        const relevantTodos: any[] = [];
        todosSnapshot.forEach((doc) => {
          const data = doc.data();
          const titleMatch = data.title?.toLowerCase().includes(searchQuery);
          const descriptionMatch = data.description?.toLowerCase().includes(searchQuery);
          
          if (titleMatch || descriptionMatch) {
            relevantTodos.push({
              title: data.title,
              description: data.description,
              status: data.status,
              priority: data.priority,
              dueDate: data.dueDate
            });
          }
        });
        
        if (relevantTodos.length > 0) {
          const todoTexts = relevantTodos.map(t => {
            let text = `タスク: ${t.title}`;
            if (t.description) text += `\n説明: ${t.description}`;
            if (t.status) text += `\nステータス: ${t.status}`;
            if (t.priority) text += `\n優先度: ${t.priority}`;
            if (t.dueDate) {
              const dueDate = t.dueDate instanceof Timestamp ? t.dueDate.toDate() : new Date(t.dueDate);
              text += `\n期限: ${dueDate.toLocaleDateString('ja-JP')}`;
            }
            return text;
          });
          todoContext = `【TODOリスト】\n${todoTexts.join('\n\n---\n\n')}`;
        }
      } catch (error) {
        console.error('TODO検索エラー:', error);
      }

      // 7. カレンダーイベントの内容を検索
      try {
        const eventsSnapshot = await adminDb.collection('events')
          .where('userId', '==', userId)
          .limit(10)
          .get();
        
        const relevantEvents: any[] = [];
        eventsSnapshot.forEach((doc) => {
          const data = doc.data();
          const titleMatch = data.title?.toLowerCase().includes(searchQuery);
          const descriptionMatch = data.description?.toLowerCase().includes(searchQuery);
          
          if (titleMatch || descriptionMatch) {
            relevantEvents.push({
              title: data.title,
              description: data.description,
              date: data.date,
              time: data.time,
              location: data.location
            });
          }
        });
        
        if (relevantEvents.length > 0) {
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
          eventContext = `【カレンダー】\n${eventTexts.join('\n\n---\n\n')}`;
        }
      } catch (error) {
        console.error('イベント検索エラー:', error);
      }

      // 8. 見積管理の内容を検索
      try {
        if (companyName) {
          const quotesSnapshot = await adminDb.collection('quotes')
            .where('companyName', '==', companyName)
            .limit(5)
            .get();
          
          if (!quotesSnapshot.empty) {
            const relevantQuotes: any[] = [];
            quotesSnapshot.forEach((doc) => {
              const data = doc.data();
              const titleMatch = data.title?.toLowerCase().includes(searchQuery);
              const customerMatch = data.customerName?.toLowerCase().includes(searchQuery);
              
              if (titleMatch || customerMatch) {
                relevantQuotes.push({
                  quoteNumber: data.quoteNumber,
                  customerName: data.customerName,
                  title: data.title,
                  amount: data.amount,
                  status: data.status,
                  validUntil: data.validUntil
                });
              }
            });
            
            if (relevantQuotes.length > 0) {
              const quoteTexts = relevantQuotes.map(q => {
                let text = `見積番号: ${q.quoteNumber}\n顧客: ${q.customerName}\nタイトル: ${q.title}`;
                if (q.amount) text += `\n金額: ${q.amount.toLocaleString()}円`;
                if (q.status) text += `\nステータス: ${q.status}`;
                if (q.validUntil) text += `\n有効期限: ${q.validUntil}`;
                return text;
              });
              salesCaseContext += (salesCaseContext ? '\n\n' : '') + `【見積管理】\n${quoteTexts.join('\n\n---\n\n')}`;
            }
          }
        }
      } catch (error) {
        // コレクションが存在しない場合はスキップ
      }

      // 9. 受注管理の内容を検索
      try {
        if (companyName) {
          const ordersSnapshot = await adminDb.collection('orders')
            .where('companyName', '==', companyName)
            .limit(5)
            .get();
          
          if (!ordersSnapshot.empty) {
            const relevantOrders: any[] = [];
            ordersSnapshot.forEach((doc) => {
              const data = doc.data();
              const titleMatch = data.title?.toLowerCase().includes(searchQuery);
              const customerMatch = data.customerName?.toLowerCase().includes(searchQuery);
              
              if (titleMatch || customerMatch) {
                relevantOrders.push({
                  orderNumber: data.orderNumber,
                  customerName: data.customerName,
                  title: data.title,
                  amount: data.amount,
                  status: data.status,
                  orderDate: data.orderDate,
                  deliveryDate: data.deliveryDate
                });
              }
            });
            
            if (relevantOrders.length > 0) {
              const orderTexts = relevantOrders.map(o => {
                let text = `受注番号: ${o.orderNumber}\n顧客: ${o.customerName}\nタイトル: ${o.title}`;
                if (o.amount) text += `\n金額: ${o.amount.toLocaleString()}円`;
                if (o.status) text += `\nステータス: ${o.status}`;
                if (o.orderDate) text += `\n受注日: ${o.orderDate}`;
                if (o.deliveryDate) text += `\n納期: ${o.deliveryDate}`;
                return text;
              });
              salesCaseContext += (salesCaseContext ? '\n\n' : '') + `【受注管理】\n${orderTexts.join('\n\n---\n\n')}`;
            }
          }
        }
      } catch (error) {
        // コレクションが存在しない場合はスキップ
      }

      // 10. 請求管理の内容を検索
      try {
        if (companyName) {
          const invoicesSnapshot = await adminDb.collection('invoices')
            .where('companyName', '==', companyName)
            .limit(5)
            .get();
          
          if (!invoicesSnapshot.empty) {
            const relevantInvoices: any[] = [];
            invoicesSnapshot.forEach((doc) => {
              const data = doc.data();
              const customerMatch = data.customerName?.toLowerCase().includes(searchQuery);
              const companyMatch = data.customerCompany?.toLowerCase().includes(searchQuery);
              
              if (customerMatch || companyMatch) {
                relevantInvoices.push({
                  invoiceNumber: data.invoiceNumber,
                  customerName: data.customerName,
                  customerCompany: data.customerCompany,
                  amount: data.amount,
                  totalAmount: data.totalAmount,
                  status: data.status,
                  issueDate: data.issueDate,
                  dueDate: data.dueDate
                });
              }
            });
            
            if (relevantInvoices.length > 0) {
              const invoiceTexts = relevantInvoices.map(i => {
                let text = `請求書番号: ${i.invoiceNumber}\n顧客: ${i.customerName}`;
                if (i.customerCompany) text += ` (${i.customerCompany})`;
                if (i.totalAmount) text += `\n金額: ${i.totalAmount.toLocaleString()}円`;
                if (i.status) text += `\nステータス: ${i.status}`;
                if (i.issueDate) text += `\n発行日: ${i.issueDate}`;
                if (i.dueDate) text += `\n支払期限: ${i.dueDate}`;
                return text;
              });
              documentContext += (documentContext ? '\n\n' : '') + `【請求管理】\n${invoiceTexts.join('\n\n---\n\n')}`;
            }
          }
        }
      } catch (error) {
        // コレクションが存在しない場合はスキップ
      }

      // 11. 経費管理の内容を検索
      try {
        if (companyName) {
          const expensesSnapshot = await adminDb.collection('expenses')
            .where('companyName', '==', companyName)
            .limit(5)
            .get();
          
          if (!expensesSnapshot.empty) {
            const relevantExpenses: any[] = [];
            expensesSnapshot.forEach((doc) => {
              const data = doc.data();
              const descMatch = data.description?.toLowerCase().includes(searchQuery);
              const categoryMatch = data.category?.toLowerCase().includes(searchQuery);
              
              if (descMatch || categoryMatch) {
                relevantExpenses.push({
                  expenseNumber: data.expenseNumber,
                  category: data.category,
                  description: data.description,
                  amount: data.amount,
                  status: data.status,
                  expenseDate: data.expenseDate
                });
              }
            });
            
            if (relevantExpenses.length > 0) {
              const expenseTexts = relevantExpenses.map(e => {
                let text = `経費番号: ${e.expenseNumber}\nカテゴリ: ${e.category}\n内容: ${e.description}`;
                if (e.amount) text += `\n金額: ${e.amount.toLocaleString()}円`;
                if (e.status) text += `\nステータス: ${e.status}`;
                if (e.expenseDate) text += `\n日付: ${e.expenseDate}`;
                return text;
              });
              documentContext += (documentContext ? '\n\n' : '') + `【経費管理】\n${expenseTexts.join('\n\n---\n\n')}`;
            }
          }
        }
      } catch (error) {
        // コレクションが存在しない場合はスキップ
      }

      // 12. 在庫管理の内容を検索
      try {
        if (companyName) {
          const inventorySnapshot = await adminDb.collection('inventory')
            .where('companyName', '==', companyName)
            .limit(5)
            .get();
          
          if (!inventorySnapshot.empty) {
            const relevantItems: any[] = [];
            inventorySnapshot.forEach((doc) => {
              const data = doc.data();
              const nameMatch = data.itemName?.toLowerCase().includes(searchQuery);
              const codeMatch = data.itemCode?.toLowerCase().includes(searchQuery);
              
              if (nameMatch || codeMatch) {
                relevantItems.push({
                  itemCode: data.itemCode,
                  itemName: data.itemName,
                  category: data.category,
                  quantity: data.quantity,
                  unit: data.unit,
                  location: data.location
                });
              }
            });
            
            if (relevantItems.length > 0) {
              const itemTexts = relevantItems.map(i => {
                let text = `商品コード: ${i.itemCode}\n商品名: ${i.itemName}`;
                if (i.category) text += `\nカテゴリ: ${i.category}`;
                if (i.quantity !== undefined) text += `\n在庫数: ${i.quantity} ${i.unit || '個'}`;
                if (i.location) text += `\n保管場所: ${i.location}`;
                return text;
              });
              documentContext += (documentContext ? '\n\n' : '') + `【在庫管理】\n${itemTexts.join('\n\n---\n\n')}`;
            }
          }
        }
      } catch (error) {
        // コレクションが存在しない場合はスキップ
      }

      // 13. 発注管理の内容を検索
      try {
        if (companyName) {
          const purchasesSnapshot = await adminDb.collection('purchases')
            .where('companyName', '==', companyName)
            .limit(5)
            .get();
          
          if (!purchasesSnapshot.empty) {
            const relevantPurchases: any[] = [];
            purchasesSnapshot.forEach((doc) => {
              const data = doc.data();
              const itemMatch = data.itemName?.toLowerCase().includes(searchQuery);
              const supplierMatch = data.supplierName?.toLowerCase().includes(searchQuery);
              
              if (itemMatch || supplierMatch) {
                relevantPurchases.push({
                  purchaseNumber: data.purchaseNumber,
                  supplierName: data.supplierName,
                  itemName: data.itemName,
                  quantity: data.quantity,
                  totalAmount: data.totalAmount,
                  status: data.status,
                  orderDate: data.orderDate
                });
              }
            });
            
            if (relevantPurchases.length > 0) {
              const purchaseTexts = relevantPurchases.map(p => {
                let text = `発注番号: ${p.purchaseNumber}\n仕入先: ${p.supplierName}\n商品: ${p.itemName}`;
                if (p.quantity) text += `\n数量: ${p.quantity}`;
                if (p.totalAmount) text += `\n金額: ${p.totalAmount.toLocaleString()}円`;
                if (p.status) text += `\nステータス: ${p.status}`;
                if (p.orderDate) text += `\n発注日: ${p.orderDate}`;
                return text;
              });
              documentContext += (documentContext ? '\n\n' : '') + `【発注管理】\n${purchaseTexts.join('\n\n---\n\n')}`;
            }
          }
        }
      } catch (error) {
        // コレクションが存在しない場合はスキップ
      }

      // 14. PDCA管理の内容を検索
      try {
        const pdcaCollections = ['pdcaPlan', 'pdcaDo', 'pdcaCheck', 'pdcaAction'];
        let pdcaContext = '';
        
        for (const collectionName of pdcaCollections) {
          try {
            const pdcaSnapshot = await adminDb.collection(collectionName)
              .where('userId', '==', userId)
              .limit(3)
              .get();
            
            if (!pdcaSnapshot.empty) {
              const relevantItems: any[] = [];
              pdcaSnapshot.forEach((doc) => {
                const data = doc.data();
                const titleMatch = data.title?.toLowerCase().includes(searchQuery);
                const contentMatch = JSON.stringify(data).toLowerCase().includes(searchQuery);
                
                if (titleMatch || contentMatch) {
                  relevantItems.push({
                    title: data.title,
                    content: data.content || data.description || '',
                    category: collectionName
                  });
                }
              });
              
              if (relevantItems.length > 0) {
                const categoryName = {
                  'pdcaPlan': '計画管理',
                  'pdcaDo': '実行管理',
                  'pdcaCheck': '評価管理',
                  'pdcaAction': '改善管理'
                }[collectionName] || collectionName;
                
                const itemTexts = relevantItems.map(i => {
                  let text = `タイトル: ${i.title}`;
                  if (i.content) text += `\n内容: ${i.content}`;
                  return text;
                });
                pdcaContext += (pdcaContext ? '\n\n' : '') + `【${categoryName}】\n${itemTexts.join('\n\n---\n\n')}`;
              }
            }
          } catch (error) {
            // 個別のコレクションエラーは無視
          }
        }
        
        if (pdcaContext) {
          documentContext += (documentContext ? '\n\n' : '') + pdcaContext;
        }
      } catch (error) {
        // コレクションが存在しない場合はスキップ
      }
    } catch (error) {
      console.error('検索エラー:', error);
    }

    // 統合されたコンテキストを構築
    const allContexts: string[] = [];
    if (documentContext) allContexts.push(documentContext);
    if (salesCaseContext) allContexts.push(salesCaseContext);
    if (progressNoteContext) allContexts.push(progressNoteContext);
    if (customerContext) allContexts.push(customerContext);
    if (meetingNoteContext) allContexts.push(meetingNoteContext);
    if (todoContext) allContexts.push(todoContext);
    if (eventContext) allContexts.push(eventContext);
    
    const combinedContext = allContexts.join('\n\n');
    const hasContext = allContexts.length > 0;

    // OpenAI APIで回答生成
    const systemPrompt = hasContext
      ? `あなたは企業の社内AIアシスタントです。以下の情報源から、ユーザーの質問に正確で分かりやすい回答をしてください。

情報源:
${combinedContext}

回答のガイドライン:
- 提供された情報（社内ドキュメント、営業案件、進捗メモ、顧客管理、議事録、TODOリスト、カレンダーなど）に基づいて回答してください
- 複数の情報源がある場合は、それらを統合して包括的な回答をしてください
- 質問された内容に関連する情報がある場合は、その情報をテンプレート形式で整理して提示してください
- 案件、顧客、議事録、タスク、イベントなどに関する質問の場合は、最新の状況を反映してください
- 不明な点がある場合は「情報が見つかりませんでした」と明記してください
- 分かりやすい日本語で回答してください
- 必要に応じて情報源の該当箇所を引用してください
- 情報源にない情報については、一般的な知識として回答してください
- テンプレート形式で回答する場合は、見やすく整理された形式で提示してください`
      : `あなたは親しみやすいAIアシスタントです。ユーザーの質問に分かりやすく、丁寧に回答してください。

回答のガイドライン:
- 分かりやすい日本語で回答してください
- 専門的な内容でも理解しやすく説明してください
- 不明な点がある場合は正直に伝えてください
- テンプレート形式で回答する場合は、見やすく整理された形式で提示してください`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', errorData);
      throw new Error('OpenAI API呼び出しに失敗しました');
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '申し訳ございません。回答を生成できませんでした。';

    return NextResponse.json({
      response: aiResponse,
      hasDocumentContext: !!documentContext,
      hasSalesCaseContext: !!salesCaseContext,
      hasProgressNoteContext: !!progressNoteContext,
      hasCustomerContext: !!customerContext,
      hasMeetingNoteContext: !!meetingNoteContext,
      hasTodoContext: !!todoContext,
      hasEventContext: !!eventContext,
      contextSources: {
        documents: !!documentContext,
        salesCases: !!salesCaseContext,
        progressNotes: !!progressNoteContext,
        customers: !!customerContext,
        meetingNotes: !!meetingNoteContext,
        todos: !!todoContext,
        events: !!eventContext
      }
    });

  } catch (error) {
    console.error('AIチャットエラー:', error);
    return NextResponse.json(
      { error: 'エラーが発生しました', response: '申し訳ございません。エラーが発生しました。もう一度お試しください。' },
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

