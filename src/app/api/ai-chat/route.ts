import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { searchSalesCases, searchProgressNotes } from '@/utils/salesSearch';
import { getAppKnowledge, findPageByKeyword, getPageContext } from '@/bff';
import { AVAILABLE_MENU_ITEMS, AIChatMetadata, FieldMapping, SearchableField } from '@/types/sidebar';

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

// 質問の意図を解析（メニュー項目ベース）
type Intent = 
  | { type: 'customer'; menuId?: string }
  | { type: 'sales'; menuId?: string }
  | { type: 'progress'; menuId?: string }
  | { type: 'meeting'; menuId?: string }
  | { type: 'todo'; menuId?: string }
  | { type: 'event'; menuId?: string }
  | { type: 'document'; menuId?: string }
  | { type: 'unknown'; menuId?: never };

// Phase 1: アクション検出の型定義（Intent + Domain + エンティティ）
type ActionIntent = 'create' | 'check' | 'search' | 'update' | 'delete';
type ActionDomain = 'invoice' | 'todo' | 'customer' | 'contract' | 'document';

type ActionType = {
  intent: ActionIntent;
  domain: ActionDomain;
  entities: Record<string, string>; // エンティティ（顧客名、タスク名など）
};

// メニュー項目からAIチャット用メタデータを取得
function getMenuAIMetadata(menuId: string): AIChatMetadata | null {
  const menuItem = AVAILABLE_MENU_ITEMS.find(item => item.id === menuId);
  return menuItem?.aiChatMetadata || null;
}

// メニュー項目IDから意図を判定
function parseIntentFromMenu(message: string): { menuId: string; intent: Intent } | null {
  const messageLower = message.toLowerCase();
  
  // 一般的な質問（「使い方を教えて」など）は、特定のメニューにマッチしないようにする
  const generalQueryPatterns = [
    '使い方を教えて', '使い方', '使い方を', '使い方について',
    '使い方を知りたい', '使い方を確認したい', '使い方を見たい',
    '使い方を説明して', '使い方を説明', '使い方の説明',
    'どう使う', 'どうやって使う', '使用方法', '使用方法を教えて',
    'ヘルプ', 'help', 'ヘルプを', 'ヘルプを教えて',
    'よくある質問を教えて', 'よくある質問', 'FAQ', 'faq', 'よくある質問について'
  ];
  
  const isGeneralUsageQuery = generalQueryPatterns.some(pattern => 
    messageLower === pattern.toLowerCase() || messageLower === `${pattern}。` || messageLower === `${pattern}？` || messageLower.includes(pattern.toLowerCase())
  );
  
  // 一般的な使い方の質問の場合は、nullを返してunknown intentにする
  if (isGeneralUsageQuery) {
    return null;
  }
  
  // 契約書管理を最優先（「の料金」などのセクションクエリがある場合）
  const contractsItem = AVAILABLE_MENU_ITEMS.find(item => item.id === 'contracts');
  if (contractsItem && contractsItem.aiChatMetadata) {
    // fieldMappingsはセクション検索用なので、意図判定からは除外する
    // （「使い方」などのキーワードが含まれているため、誤検出を防ぐ）
    const contractsKeywords = [
      '契約書', '契約', 'document', 'ドキュメント',
      ...contractsItem.aiChatMetadata.searchableFields.flatMap(f => f.japaneseNames)
      // fieldMappingsは除外（セクション検索用）
    ];
    
    const contractsMatched = contractsKeywords.some(keyword => 
      keyword && messageLower.includes(keyword.toLowerCase())
    );
    
    if (contractsMatched) {
      const intentType = mapCategoryToIntent(contractsItem.category);
      if (process.env.NODE_ENV === 'development') {
        console.log('[AI Chat] Menu-based intent detected (contracts):', { menuId: contractsItem.id, intentType });
      }
      // intentTypeが'unknown'の場合はmenuIdを設定しない
      if (intentType === 'unknown') {
        return null;
      }
      return {
        menuId: contractsItem.id,
        intent: { type: intentType, menuId: contractsItem.id } as Intent
      };
    }
  }
  
  // その他のメニュー項目をチェック（スコアベースで優先順位付け）
  const menuItemsWithScores = AVAILABLE_MENU_ITEMS
    .filter(item => item.aiChatMetadata && item.id !== 'contracts')
    .map(menuItem => {
      let score = 0;
      const itemName = menuItem.name?.toLowerCase() || '';
      const itemDescription = menuItem.description?.toLowerCase() || '';
      
      // メニュー名の完全一致（最高優先度）
      if (itemName && messageLower === itemName) {
        score += 100;
      } else if (itemName && messageLower.includes(itemName)) {
        score += 50;
      }
      
      // 説明の完全一致（高優先度）
      if (itemDescription && messageLower.includes(itemDescription)) {
        score += 30;
      }
      
      // より長いキーワードを優先（「顧客リスト」>「リスト」）
      const searchableKeywords = menuItem.aiChatMetadata!.searchableFields.flatMap(f => f.japaneseNames);
      for (const keyword of searchableKeywords) {
        const keywordLower = keyword.toLowerCase();
        if (keywordLower && messageLower.includes(keywordLower)) {
          // キーワードの長さに応じてスコアを加算（長いキーワードほど高スコア）
          score += keywordLower.length;
        }
      }
      
      return { menuItem, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score); // スコアの高い順にソート
  
  // 最もスコアの高いメニュー項目を選択
  if (menuItemsWithScores.length > 0) {
    const { menuItem } = menuItemsWithScores[0];
    const intentType = mapCategoryToIntent(menuItem.category);
    if (process.env.NODE_ENV === 'development') {
      console.log('[AI Chat] Menu-based intent detected:', { menuId: menuItem.id, intentType, score: menuItemsWithScores[0].score });
    }
    // intentTypeが'unknown'の場合はmenuIdを設定しない
    if (intentType === 'unknown') {
      return null;
    }
    return {
      menuId: menuItem.id,
      intent: { type: intentType, menuId: menuItem.id } as Intent
    };
  }
  
  return null;
}

// カテゴリを意図タイプにマッピング
function mapCategoryToIntent(category: string): Intent['type'] {
  const mapping: Record<string, Intent['type']> = {
    'customer': 'customer',
    'sales': 'sales',
    'document': 'document',
    'other': 'todo'
  };
  return mapping[category] || 'unknown';
}

function parseIntent(message: string): Intent {
  const messageLower = message.toLowerCase();
  
  // 一般的な質問（「使い方を教えて」など）は、特定のメニューにマッチしないようにする
  const generalQueryPatterns = [
    '使い方を教えて', '使い方', '使い方を', '使い方について',
    '使い方を知りたい', '使い方を確認したい', '使い方を見たい',
    '使い方を説明して', '使い方を説明', '使い方の説明',
    'どう使う', 'どうやって使う', '使用方法', '使用方法を教えて',
    'ヘルプ', 'help', 'ヘルプを', 'ヘルプを教えて'
  ];
  
  const isGeneralUsageQuery = generalQueryPatterns.some(pattern => 
    messageLower.includes(pattern.toLowerCase())
  );
  
  // 一般的な使い方の質問の場合は、unknown intentを返す（後でAIチャット自体の使い方を説明する応答を返す）
  if (isGeneralUsageQuery) {
    return { type: 'unknown' };
  }
  
  // まずメニュー項目ベースで判定
  const menuResult = parseIntentFromMenu(message);
  if (menuResult) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AI Chat] Menu-based intent:', { menuId: menuResult.menuId, intent: menuResult.intent.type });
    }
    return menuResult.intent;
  }
  
  // フォールバック: BFFのキーワードマッチングを使用
  const pageId = findPageByKeyword(message);
  
  if (pageId === 'customer') return { type: 'customer' };
  if (pageId === 'sales') return { type: 'sales' };
  if (pageId === 'progress') return { type: 'progress' };
  if (pageId === 'meeting') return { type: 'meeting' };
  if (pageId === 'todo') return { type: 'todo', menuId: 'todo' };
  if (pageId === 'event') return { type: 'event' };
  if (pageId === 'document') {
    // documentの場合は、契約書管理（contracts）にマッチさせる
    // 「文書」「document」「ドキュメント」などのキーワードでcontractsメニューを検出
    const messageLower = message.toLowerCase();
    if (['契約書', '契約', 'contract', '文書', 'document', 'ドキュメント'].some(keyword => messageLower.includes(keyword))) {
      return { type: 'document', menuId: 'contracts' };
    }
    return { type: 'document', menuId: 'contracts' }; // デフォルトでcontractsにマッチ
  }
  
  return { type: 'unknown' };
}

// Phase 1: アクション検出関数（Intent + Domain + エンティティ）
function detectAction(message: string): ActionType | null {
  const messageLower = message.toLowerCase();
  
  // Step 1: 意図の検出（より多くのパターンに対応）
  let intent: ActionIntent | null = null;
  
  // 作成系の動詞（優先順位: より具体的な表現を先に）
  const createPatterns = [
    '作って', '作成して', '発行して', '追加して', '登録して',
    '作る', '作成する', '発行する', '追加する', '登録する',
    '作', '作成', '発行', '追加', '登録'
  ];
  if (createPatterns.some(pattern => messageLower.includes(pattern))) {
    intent = 'create';
  } 
  // 確認系の動詞
  else {
    const checkPatterns = [
      '確認して', '見て', 'チェックして', '確認する', '見る', 'チェックする',
      '確認', '見', 'チェック', '閲覧', '閲覧して'
    ];
    if (checkPatterns.some(pattern => messageLower.includes(pattern))) {
      intent = 'check';
    } 
    // 更新系の動詞
    else {
      const updatePatterns = [
        '更新して', '変更して', '編集して', '修正して',
        '更新する', '変更する', '編集する', '修正する',
        '更新', '変更', '編集', '修正'
      ];
      if (updatePatterns.some(pattern => messageLower.includes(pattern))) {
        intent = 'update';
      } 
      // 削除系の動詞
      else {
        const deletePatterns = [
          '削除して', '消して', '削除する', '消す',
          '削除', '消', '除去', '除去して'
        ];
        if (deletePatterns.some(pattern => messageLower.includes(pattern))) {
          intent = 'delete';
        }
      }
    }
  }
  
  // 検索系の動詞はアクション検出の対象外（通常の検索ロジックを使用）
  // 「教えて」「見せて」などの一般的な検索動詞は、アクション検出をスキップ
  // これにより、通常の検索ロジック（メタデータベース検索など）が使用される
  
  if (!intent) return null;
  
  // Step 2: ドメインの検出（より具体的なキーワードを優先）
  let domain: ActionDomain | null = null;
  
  // 請求書関連（優先順位: より具体的な表現を先に）
  if (['請求書', 'invoice', 'インボイス', '請求'].some(keyword => messageLower.includes(keyword))) {
    domain = 'invoice';
  } 
  // TODO関連
  else if (['todoリスト', 'タスクリスト', 'todo', 'タスク', 'やること', 'やる事'].some(keyword => messageLower.includes(keyword))) {
    domain = 'todo';
  } 
  // 顧客関連
  else if (['顧客', 'customer', '取引先', 'クライアント', '顧客リスト', '顧客管理'].some(keyword => messageLower.includes(keyword))) {
    domain = 'customer';
  } 
  // 契約書関連
  else if (['契約書', '契約', 'contract'].some(keyword => messageLower.includes(keyword))) {
    domain = 'contract';
  } 
  // 文書関連
  else if (['文書', 'document', 'ドキュメント'].some(keyword => messageLower.includes(keyword))) {
    domain = 'document';
  }
  
  if (!domain) return null;
  
  // Step 3: エンティティ抽出（Phase 1: 正規表現）
  const entities: Record<string, string> = {};
  
  // 顧客名の抽出（「〇〇さんに」「〇〇様に」「〇〇への」など）
  const customerPatterns = [
    /(.+?)(さん|様)(に|へ|の)/,
    /(.+?)(への|への|に)/,
    /(.+?)(さん|様)/
  ];
  
  for (const pattern of customerPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const extractedName = match[1].trim();
      // 動詞や助詞が含まれていないことを確認
      if (extractedName.length > 0 && !['作', '作成', '発行', '確認', '見'].includes(extractedName)) {
        entities.customerName = extractedName;
        break;
      }
    }
  }
  
  // タスク名の抽出（「〇〇を作成して」「〇〇を追加して」など）
  const taskPatterns = [
    /(.+?)(を|が)(作|作成|追加|登録)/,
    /(.+?)(の)(作成|追加|登録)/
  ];
  
  for (const pattern of taskPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const extractedName = match[1].trim();
      if (extractedName.length > 0) {
        entities.taskName = extractedName;
        break;
      }
    }
  }
  
  return {
    intent,
    domain,
    entities
  };
}

// Phase 1: アクション応答の生成（AIっぽい文章で判断している感を出す）
function generateActionResponse(
  action: ActionType,
  userId: string,
  companyName: string
): string | null {
  const { intent, domain, entities } = action;
  
  // 請求書作成の応答
  if (intent === 'create' && domain === 'invoice') {
    const customerName = entities.customerName;
    
    if (customerName) {
      return `【請求書作成の準備】\n\n${customerName}さんへの請求書作成ですね。\n\n請求書発行ページで作成できます。\n\n[📄 請求書発行ページへ移動](/admin/invoice)`;
    } else {
      return `【請求書作成】\n\n請求書を作成します。\n\n請求書発行ページで作成できます。\n\n[📄 請求書発行ページへ移動](/admin/invoice)`;
    }
  }
  
  // TODO作成の応答
  if (intent === 'create' && domain === 'todo') {
    const taskName = entities.taskName;
    
    if (taskName) {
      return `【タスク作成の準備】\n\n「${taskName}」というタスクを作成しますね。\n\nTODOリストページで作成できます。\n\n[✅ TODOリストページへ移動](/todo)`;
    } else {
      return `【タスク作成】\n\nタスクを作成します。\n\nTODOリストページで作成できます。\n\n[✅ TODOリストページへ移動](/todo)`;
    }
  }
  
  // 確認系の応答
  if (intent === 'check') {
    if (domain === 'invoice') {
      return `【請求書の確認】\n\n請求書を確認します。\n\n請求書発行ページで確認できます。\n\n[📄 請求書発行ページへ移動](/admin/invoice)`;
    } else if (domain === 'todo') {
      return `【タスクの確認】\n\nタスクを確認します。\n\nTODOリストページで確認できます。\n\n[✅ TODOリストページへ移動](/todo)`;
    } else if (domain === 'customer') {
      return `【顧客情報の確認】\n\n顧客情報を確認します。\n\n顧客管理ページで確認できます。\n\n[👥 顧客管理ページへ移動](/customers)`;
    } else if (domain === 'contract') {
      return `【契約書の確認】\n\n契約書を確認します。\n\n契約書管理ページで確認できます。\n\n[📄 契約書管理ページへ移動](/admin/contracts)`;
    }
  }
  
  // 更新系の応答
  if (intent === 'update') {
    if (domain === 'invoice') {
      return `【請求書の更新】\n\n請求書を更新します。\n\n請求書発行ページで更新できます。\n\n[📄 請求書発行ページへ移動](/admin/invoice)`;
    } else if (domain === 'todo') {
      return `【タスクの更新】\n\nタスクを更新します。\n\nTODOリストページで更新できます。\n\n[✅ TODOリストページへ移動](/todo)`;
    } else if (domain === 'customer') {
      return `【顧客情報の更新】\n\n顧客情報を更新します。\n\n顧客管理ページで更新できます。\n\n[👥 顧客管理ページへ移動](/customers)`;
    }
  }
  
  // 削除系の応答
  if (intent === 'delete') {
    if (domain === 'invoice') {
      return `【請求書の削除】\n\n請求書を削除します。\n\n請求書発行ページで削除できます。\n\n[📄 請求書発行ページへ移動](/admin/invoice)`;
    } else if (domain === 'todo') {
      return `【タスクの削除】\n\nタスクを削除します。\n\nTODOリストページで削除できます。\n\n[✅ TODOリストページへ移動](/todo)`;
    } else if (domain === 'customer') {
      return `【顧客情報の削除】\n\n顧客情報を削除します。\n\n顧客管理ページで削除できます。\n\n[👥 顧客管理ページへ移動](/customers)`;
    }
  }
  
  return null;
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

// メタデータを使用した検索クエリの構築
function buildSearchQueryFromMetadata(
  message: string,
  metadata: AIChatMetadata
): {
  keywords: string[];
  fieldQueries: Record<string, string[]>;
  sectionQueries: Record<string, string>;
  titleQuery?: string;  // タイトルクエリ（例: 「Signal.」）
} {
  const messageLower = message.toLowerCase();
  const keywords: string[] = [];
  const fieldQueries: Record<string, string[]> = {};
  const sectionQueries: Record<string, string> = {};
  let titleQuery: string | undefined;
  
  // 「（タイトル）の（項目名）について教えて」パターンをチェック
  const titleWithSectionPattern = /^(.+?)(の)(.+?)(について|とは|の説明|について教えて|について知りたい|を教えて|を見たい)/;
  const titlePattern = /^(.+?)(について|とは|の説明|について教えて|について知りたい)/;
  
  const titleWithSectionMatch = message.match(titleWithSectionPattern);
  const titleMatch = !titleWithSectionMatch ? message.match(titlePattern) : null;
  
  let extractedTitle: string | null = null;
  let extractedSection: string | null = null;
  
  if (titleWithSectionMatch) {
    // 「Signal.の料金について教えて」のようなパターン
    extractedTitle = titleWithSectionMatch[1].trim();
    extractedSection = titleWithSectionMatch[3].trim();
  } else if (titleMatch) {
    // 「Signal.について教えて」のようなパターン
    extractedTitle = titleMatch[1].trim();
  }
  
  // タイトルクエリを設定
  // ただし、メニュー名自体（例: 「TODOリスト」）が抽出された場合は、titleQueryとして設定しない
  if (extractedTitle) {
    const menuItem = AVAILABLE_MENU_ITEMS.find(item => 
      item.name.toLowerCase() === extractedTitle.toLowerCase() ||
      item.name.toLowerCase().includes(extractedTitle.toLowerCase()) ||
      extractedTitle.toLowerCase().includes(item.name.toLowerCase())
    );
    
    // メニュー名と一致しない場合のみ、titleQueryとして設定
    if (!menuItem) {
      titleQuery = extractedTitle;
    }
  }
  
  // フィールドマッピングをチェック（セクションクエリ）
  if (extractedSection) {
    // 抽出されたセクション名からマッピングを検索
    for (const mapping of metadata.fieldMappings) {
      const matchedJapanese = mapping.japanese.find(jp => 
        extractedSection!.toLowerCase().includes(jp.toLowerCase()) ||
        jp.toLowerCase().includes(extractedSection!.toLowerCase())
      );
      
      if (matchedJapanese) {
        // セクションクエリとして追加（例: 「料金」→ pricing）
        sectionQueries[mapping.english] = matchedJapanese;
        break; // 最初のマッチのみ使用
      }
    }
  } else {
    // セクション名が抽出されていない場合、メッセージ全体から検索
    // ただし、一般的な質問（「教えて」など）の場合は、セクションクエリを抽出しない
    const isGeneralQuery = ['一覧', '見たい', '教えて', '確認', '見る', '全部', 'すべて', '全て'].some(
      keyword => messageLower.includes(keyword)
    );
    
    if (!isGeneralQuery) {
      for (const mapping of metadata.fieldMappings) {
        const matchedJapanese = mapping.japanese.find(jp => 
          messageLower.includes(jp.toLowerCase())
        );
        
        if (matchedJapanese) {
          // セクションクエリとして追加（例: 「料金」→ pricing）
          sectionQueries[mapping.english] = matchedJapanese;
          break; // 最初のマッチのみ使用
        }
      }
    }
  }
  
  // 検索可能フィールドの日本語名をチェック
  for (const field of metadata.searchableFields) {
    const matchedJapanese = field.japaneseNames.find(jp => 
      messageLower.includes(jp.toLowerCase())
    );
    
    if (matchedJapanese) {
      if (!fieldQueries[field.fieldName]) {
        fieldQueries[field.fieldName] = [];
      }
      fieldQueries[field.fieldName].push(matchedJapanese);
    }
  }
  
  // 一般的なキーワードを抽出（タイトルクエリを除く）
  const words = messageLower.split(/\s+/).filter(w => w.length > 1);
  if (titleQuery) {
    // タイトルクエリをキーワードから除外
    const titleWords = titleQuery.toLowerCase().split(/\s+/);
    keywords.push(...words.filter(w => !titleWords.some(tw => w.includes(tw) || tw.includes(w))));
    keywords.push(titleQuery.toLowerCase()); // タイトルをキーワードとして追加
  } else {
    keywords.push(...words);
  }
  
  return { keywords, fieldQueries, sectionQueries, titleQuery };
}

// メタデータを使用した検索
async function searchByMenuMetadata(
  menuId: string,
  message: string,
  userId: string,
  companyName: string
): Promise<ContextResult | null> {
  const metadata = getMenuAIMetadata(menuId);
  if (!metadata) return null;
  
  const menuItem = AVAILABLE_MENU_ITEMS.find(item => item.id === menuId);
  if (!menuItem) return null;
  
  if (!adminDb) {
    console.warn('[searchByMenuMetadata] adminDb is not initialized');
    return null;
  }
  
  // 検索クエリを構築
  const query = buildSearchQueryFromMetadata(message, metadata);
  
  // Firestoreで検索
  let snapshot;
  try {
    if (metadata.searchByCompany && companyName) {
      snapshot = await adminDb.collection(metadata.collectionName)
        .where('companyName', '==', companyName)
        .limit(metadata.defaultLimit || 10)
        .get();
    } else if (metadata.searchByUser) {
      snapshot = await adminDb.collection(metadata.collectionName)
        .where('userId', '==', userId)
        .limit(metadata.defaultLimit || 10)
        .get();
    } else {
      snapshot = await adminDb.collection(metadata.collectionName)
        .limit(metadata.defaultLimit || 10)
        .get();
    }
  } catch (error) {
    console.error(`[searchByMenuMetadata] Error fetching from ${metadata.collectionName}:`, error);
    return null;
  }
  
  // 検索結果をフィルタリング
  const results = filterResultsByMetadata(snapshot.docs, query, metadata, message);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[searchByMenuMetadata] Results:', {
      menuId,
      collectionName: metadata.collectionName,
      snapshotDocsCount: snapshot.docs.length,
      filteredResultsCount: results.length,
      userId,
      companyName,
      query: JSON.stringify(query)
    });
  }
  
  // 結果をフォーマット
  return formatResultsByMetadata(results, metadata, menuItem, query);
}

// メタデータを使用した結果のフィルタリング
function filterResultsByMetadata(
  docs: any[],
  query: ReturnType<typeof buildSearchQueryFromMetadata>,
  metadata: AIChatMetadata,
  message: string
): any[] {
  const messageLower = message.toLowerCase();
  const isGeneralQuery = ['一覧', '見たい', '教えて', '確認', '見る', '全部', 'すべて', '全て'].some(
    keyword => messageLower.includes(keyword)
  );
  
  return docs.filter(doc => {
    const data = doc.data();
    
    // 一般的な質問の場合は、すべての結果を返す（フィルタリングをスキップ）
    // titleQueryやsectionQueriesがあっても、一般的な質問の場合はすべての結果を返す
    if (isGeneralQuery) {
      return true;
    }
    
    // タイトルクエリがある場合、まずタイトルでマッチング
    // ただし、一般的な質問の場合はスキップ（上で既にtrueを返している）
    if (query.titleQuery && !isGeneralQuery) {
      const title = data.title || data.text || data.name || ''; // TODOデータの場合はtextフィールドもチェック
      const titleLower = title.toLowerCase();
      const titleQueryLower = query.titleQuery.toLowerCase();
      
      // タイトルが完全一致または部分一致するかチェック
      const titleMatch = titleLower === titleQueryLower || 
                        titleLower.includes(titleQueryLower) || 
                        titleQueryLower.includes(titleLower);
      
      if (!titleMatch) {
        return false; // タイトルが一致しない場合は除外
      }
    }
    
    // 一般的な質問で、キーワードがメニュー名や説明に含まれている場合も返す
    if (isGeneralQuery && query.keywords.length > 0) {
      // メニュー名や説明に含まれるキーワードがある場合は返す
      const menuItem = AVAILABLE_MENU_ITEMS.find(item => item.id === metadata.collectionName);
      if (menuItem) {
        const menuKeywords = [
          menuItem.name?.toLowerCase(),
          menuItem.description?.toLowerCase(),
          ...metadata.searchableFields.flatMap(f => f.japaneseNames.map(n => n.toLowerCase()))
        ];
        const matchedKeyword = query.keywords.some(keyword => 
          menuKeywords.some(menuKeyword => menuKeyword && menuKeyword.includes(keyword))
        );
        if (matchedKeyword) {
          return true;
        }
      }
    }
    
    // セクションクエリのチェック（例: pricing）
    if (Object.keys(query.sectionQueries).length > 0) {
      let sectionMatched = false;
      for (const [sectionKey, japaneseName] of Object.entries(query.sectionQueries)) {
        const sections = data.sections || {};
        if (sections[sectionKey] !== undefined && sections[sectionKey] !== null) {
          // セクションが存在し、内容が空でないことを確認
          const sectionContent = sectionContentToString(sections[sectionKey]);
          if (sectionContent.trim().length > 0) {
            sectionMatched = true;
            break;
          }
        }
      }
      
      // タイトルクエリがある場合は、セクションがマッチした場合のみ返す
      if (query.titleQuery) {
        return sectionMatched;
      }
      
      // タイトルクエリがない場合は、セクションがマッチすれば返す
      if (sectionMatched) {
        return true;
      }
    }
    
    // フィールドクエリのチェック
    for (const [fieldName, japaneseNames] of Object.entries(query.fieldQueries)) {
      const fieldValue = data[fieldName];
      if (fieldValue) {
        const fieldValueLower = String(fieldValue).toLowerCase();
        const matched = japaneseNames.some(jp => 
          fieldValueLower.includes(jp.toLowerCase())
        );
        if (matched) return true;
      }
    }
    
    // フィールドマッピングを使用したステータス検索（例: 「共有事項」→ `shared`）
    // メッセージにステータス名が含まれている場合、そのステータスのデータを返す
    for (const mapping of metadata.fieldMappings) {
      const matchedJapanese = mapping.japanese.find(jp => 
        messageLower.includes(jp.toLowerCase())
      );
      
      if (matchedJapanese) {
        // ステータスフィールドがある場合、そのステータス値と一致するかチェック
        const statusValue = data.status;
        if (statusValue && String(statusValue).toLowerCase() === mapping.english.toLowerCase()) {
          return true;
        }
      }
    }
    
    // キーワードマッチング（タイトルクエリがある場合は、タイトルが一致していることが前提）
    if (query.keywords.length > 0) {
      const allText = JSON.stringify(data).toLowerCase();
      const matched = query.keywords.some(keyword => 
        allText.includes(keyword)
      );
      if (matched) return true;
    }
    
    // タイトルクエリのみで、他の条件がない場合は返す
    if (query.titleQuery && Object.keys(query.sectionQueries).length === 0 && Object.keys(query.fieldQueries).length === 0) {
      return true;
    }
    
    // 一般的な質問で、すべての条件が満たされない場合でも、データが存在すれば返す
    if (isGeneralQuery) {
      return true;
    }
    
    return false;
  });
}

// メタデータを使用した結果のフォーマット
function formatResultsByMetadata(
  results: any[],
  metadata: AIChatMetadata,
  menuItem: typeof AVAILABLE_MENU_ITEMS[0],
  query: ReturnType<typeof buildSearchQueryFromMetadata>
): ContextResult {
  const formattedItems = results.map(doc => {
    const data = doc.data();
    const item: any = { id: doc.id, ...data };
    
    // セクションクエリがある場合は、そのセクションだけを返す
    if (Object.keys(query.sectionQueries).length > 0) {
      item.targetSectionKey = Object.keys(query.sectionQueries)[0];
    }
    
    return item;
  });
  
  // フォーマットされたテキストを生成
  const formatted = formatItemsAsText(formattedItems, metadata, menuItem, query);
  
  return {
    type: mapCategoryToIntent(menuItem.category) as Intent['type'],
    items: formattedItems,
    formatted,
    pageUrl: menuItem.href
  };
}

// アイテムをテキストにフォーマット
function formatItemsAsText(
  items: any[],
  metadata: AIChatMetadata,
  menuItem: typeof AVAILABLE_MENU_ITEMS[0],
  query: ReturnType<typeof buildSearchQueryFromMetadata>
): string {
  if (items.length === 0) {
    return `【${menuItem.name}】\n\n情報が見つかりませんでした。\n\n別のキーワードで検索していただくか、${menuItem.name}ページで確認してください。`;
  }
  
  // セクションクエリがある場合（例: 契約書の料金）
  if (Object.keys(query.sectionQueries).length > 0) {
    const sectionKey = Object.keys(query.sectionQueries)[0];
    const sectionLabel = query.sectionQueries[sectionKey];
    
    // セクションラベルのマッピング（日本語名を取得）
    const sectionMapping = metadata.fieldMappings.find(m => m.english === sectionKey);
    const displayLabel = sectionMapping?.japanese[0] || sectionLabel;
    
    const sectionTexts = items.map(item => {
      const sections = item.sections || {};
      const sectionValue = sections[sectionKey];
      
      if (sectionValue === undefined || sectionValue === null) {
        return null;
      }
      
      // セクション内容を文字列化
      const sectionContent = sectionContentToString(sectionValue);
      if (sectionContent.trim().length === 0) {
        return null;
      }
      
      // セクションクエリがある場合は、そのセクションだけを返す
      return `【${item.title}】\n\n${displayLabel}:\n${sectionContent}`;
    }).filter(text => text !== null);
    
    if (sectionTexts.length > 0) {
      const header = query.titleQuery 
        ? `【${menuItem.name}】\n\n「${query.titleQuery}」の${displayLabel}について、${sectionTexts.length}件ヒットしました。`
        : `【${menuItem.name}】\n\n${displayLabel}について、${sectionTexts.length}件ヒットしました。`;
      
      return `${header}\n\n${sectionTexts.join('\n\n---\n\n')}\n\n[📄 ${menuItem.name}ページへ移動](${menuItem.href})`;
    } else {
      // セクションが見つからない場合
      return `【${menuItem.name}】\n\n${query.titleQuery ? `「${query.titleQuery}」の` : ''}${displayLabel}に関する情報が見つかりませんでした。\n\n別のキーワードで検索していただくか、${menuItem.name}ページで確認してください。`;
    }
  }
  
  // 通常のフォーマット
  const itemTexts = items.map(item => {
    let text = '';
    
    // タイトル
    if (item.title) text += `タイトル: ${item.title}\n`;
    if (item.name) text += `名前: ${item.name}\n`;
    
    // 検索可能フィールドを表示
    for (const field of metadata.searchableFields) {
      const value = item[field.fieldName];
      if (value !== undefined && value !== null && value !== '') {
        const fieldLabel = field.japaneseNames[0] || field.fieldName;
        text += `${fieldLabel}: ${value}\n`;
      }
    }
    
    return text.trim();
  });
  
  return `【${menuItem.name}】\n\n${items.length}件ヒットしました。\n\n${itemTexts.join('\n\n---\n\n')}\n\n[📄 ${menuItem.name}ページへ移動](${menuItem.href})`;
}

// セクション内容を文字列化
function sectionContentToString(sectionValue: any): string {
  if (typeof sectionValue === 'string') {
    return sectionValue;
  }
  if (Array.isArray(sectionValue)) {
    return sectionValue.map((item: any) => {
      if (typeof item === 'string') {
        return `• ${item}`;
      }
      if (item && typeof item === 'object') {
        const title = item.title || '';
        const content = item.content || '';
        if (title && content) {
          return `• ${title}\n  ${content}`;
        } else if (title) {
          return `• ${title}`;
        } else if (content) {
          return `• ${content}`;
        }
      }
      return '';
    }).filter((s: string) => s.length > 0).join('\n');
  }
  return '';
}

// intentに基づいて1系統だけ検索
async function searchByIntent(
  intent: Intent,
  message: string,
  userId: string,
  companyName: string
): Promise<ContextResult | null> {
  // メニューIDがある場合は、メタデータベースの検索を使用
  if (intent.menuId) {
    const result = await searchByMenuMetadata(intent.menuId, message, userId, companyName);
    if (result) {
      return result;
    }
  }
  
  // 汎用的なフォールバック: メタデータが定義されているメニュー項目を自動検出
  // メニューIDが設定されていない場合でも、メタデータが定義されていれば使用
  const messageLower = message.toLowerCase();
  
  // スコアベースのマッチング（より具体的なキーワードを優先）
  const menuItemsWithScores = AVAILABLE_MENU_ITEMS
    .filter(item => item.aiChatMetadata)
    .map(item => {
      let score = 0;
      const itemName = item.name?.toLowerCase() || '';
      const itemDescription = item.description?.toLowerCase() || '';
      
      // メニュー名の完全一致（最高優先度）
      if (itemName && messageLower === itemName) {
        score += 100;
      } else if (itemName && messageLower.includes(itemName)) {
        score += 50;
      }
      
      // 説明の完全一致（高優先度）
      if (itemDescription && messageLower.includes(itemDescription)) {
        score += 30;
      }
      
      // メニュー名の部分一致（中優先度）
      if (itemName && messageLower.includes(itemName.split(' ')[0])) {
        score += 20;
      }
      
      // より長いキーワードを優先（「顧客リスト」>「リスト」）
      const searchableKeywords = item.aiChatMetadata!.searchableFields.flatMap(f => f.japaneseNames);
      for (const keyword of searchableKeywords) {
        const keywordLower = keyword.toLowerCase();
        if (keywordLower && messageLower.includes(keywordLower)) {
          // キーワードの長さに応じてスコアを加算（長いキーワードほど高スコア）
          score += keywordLower.length;
        }
      }
      
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score); // スコアの高い順にソート
  
  // 最もスコアの高いメニュー項目を選択
  const menuItemWithMetadata = menuItemsWithScores.length > 0 ? menuItemsWithScores[0].item : null;
  
  if (menuItemWithMetadata && menuItemWithMetadata.aiChatMetadata) {
    const result = await searchByMenuMetadata(menuItemWithMetadata.id, message, userId, companyName);
    if (result) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AI Chat] Using metadata-based search (fallback):', { menuId: menuItemWithMetadata.id });
      }
      return result;
    }
  }
  
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
        // メタデータベースの検索を使用（顧客管理）
        if (intent.menuId === 'customer-management' || intent.menuId === 'customer-list') {
          const result = await searchByMenuMetadata(intent.menuId, message, userId, companyName);
          if (result) {
            return result;
          }
        }
        
        // フォールバック: 既存のロジック
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
        // メタデータベースの検索を使用（営業案件）
        if (intent.menuId === 'sales-opportunity' || intent.menuId === 'sales-lead' || intent.menuId === 'sales-activity') {
          const result = await searchByMenuMetadata(intent.menuId, message, userId, companyName);
          if (result) {
            return result;
          }
        }
        
        // フォールバック: 既存のロジック
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
        // メタデータベースの検索を使用（進捗メモ）
        if (intent.menuId === 'progress-notes') {
          const result = await searchByMenuMetadata('progress-notes', message, userId, companyName);
          if (result) {
            return result;
          }
        }
        
        // フォールバック: 既存のロジック
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
        // メタデータベースの検索を使用（議事録管理）
        if (intent.menuId === 'minutes-management') {
          const result = await searchByMenuMetadata('minutes-management', message, userId, companyName);
          if (result) {
            return result;
          }
        }
        
        // フォールバック: 既存のロジック
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
        // メタデータベースの検索を使用（TODOリスト）
        // menuIdが設定されていない場合でも、todo intentの場合はメタデータベース検索を試みる
        if (intent.menuId === 'todo' || !intent.menuId) {
          const result = await searchByMenuMetadata('todo', message, userId, companyName);
          if (result) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[AI Chat] Using metadata-based search for todo:', { resultCount: result.items.length });
            }
            return result;
          }
        }
        
        // フォールバック: 既存のロジック
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
        // メタデータベースの検索を使用（契約書管理）
        // 「契約書」「契約」「document」などのキーワードでcontractsメニューを検出
        const messageLower = message.toLowerCase();
        const isContractQuery = ['契約書', '契約', 'contract', 'document'].some(keyword => 
          messageLower.includes(keyword)
        );
        
        // メタデータベースの検索を優先（契約書関連の質問の場合）
        if (isContractQuery || intent.menuId === 'contracts') {
          const result = await searchByMenuMetadata('contracts', message, userId, companyName);
          if (result) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[AI Chat] Using metadata-based search for contracts');
            }
            return result;
          }
        }
        
        // フォールバック: 既存のロジック（後方互換性のため）
        // 会社単位で契約書を取得
        // companyNameがない場合は、userIdで検索（後方互換性のため）
        let snapshot;
        
        if (companyName) {
          // 会社名で検索（推奨）
          snapshot = await adminDb.collection('manualDocuments')
            .where('companyName', '==', companyName)
            .get();
        } else {
          // companyNameがない場合は、userIdで検索
          console.warn('[AI Chat] companyName is empty, falling back to userId search');
          snapshot = await adminDb.collection('manualDocuments')
            .where('userId', '==', userId)
            .get();
        }
        const relevantDocs: any[] = [];
        
        // 「（タイトル）について教えて」「（タイトル）の（項目名）について教えて」のようなパターンからタイトルと項目名を抽出
        // まず「の（項目名）」パターンをチェック（より具体的なパターンを先に）
        const titleWithSectionPattern = /^(.+?)(の)(.+?)(について|とは|の説明|について教えて|について知りたい|を教えて|を見たい)/;
        const titlePattern = /^(.+?)(について|とは|の説明|について教えて|について知りたい)/;
        
        const titleWithSectionMatch = message.match(titleWithSectionPattern);
        const titleMatch = !titleWithSectionMatch ? message.match(titlePattern) : null;
        
        let extractedTitle: string | null = null;
        let extractedSection: string | null = null;
        
        if (titleWithSectionMatch) {
          // 「Signal.の料金について教えて」のようなパターン
          extractedTitle = titleWithSectionMatch[1].trim();
          extractedSection = titleWithSectionMatch[3].trim();
        } else if (titleMatch) {
          // 「Signal.について教えて」のようなパターン
          extractedTitle = titleMatch[1].trim();
        }
        
        // メタデータから項目名のマッピングを取得（契約書管理の場合）
        const contractsMetadata = getMenuAIMetadata('contracts');
        const sectionMapping: { [key: string]: string } = {};
        
        if (contractsMetadata) {
          // メタデータのフィールドマッピングを使用
          contractsMetadata.fieldMappings.forEach(mapping => {
            mapping.japanese.forEach(jp => {
              sectionMapping[jp.toLowerCase()] = mapping.english;
            });
          });
        } else {
          // フォールバック: 既存のマッピング
          sectionMapping['説明'] = 'overview';
          sectionMapping['概要'] = 'overview';
          sectionMapping['料金'] = 'pricing';
          sectionMapping['価格'] = 'pricing';
          sectionMapping['特徴'] = 'features';
          sectionMapping['機能'] = 'features';
          sectionMapping['手順'] = 'procedures';
          sectionMapping['サポート'] = 'support';
          sectionMapping['規則'] = 'rules';
          sectionMapping['条件'] = 'terms';
          sectionMapping['Q&A'] = 'qa';
          sectionMapping['質問'] = 'qa';
        }
        
        // 項目名を英語に変換
        const targetSectionKey = extractedSection ? sectionMapping[extractedSection.toLowerCase()] || null : null;
        
        // セクション内容を文字列化するヘルパー関数
        const sectionContentToString = (sectionValue: any): string => {
          if (typeof sectionValue === 'string') {
            return sectionValue;
          }
          if (Array.isArray(sectionValue)) {
            return sectionValue.map((item: any) => {
              if (typeof item === 'string') {
                return item;
              }
              if (item && typeof item === 'object') {
                return `${item.title || ''} ${item.content || ''}`.trim();
              }
              return '';
            }).filter((s: string) => s.length > 0).join(' ');
          }
          return '';
        };
        
        for (const doc of snapshot.docs) {
          const data = doc.data();
          const sections = data.sections || {};
          
          // 一般的な質問の場合は、すべてのドキュメントを返す
          if (isGeneralQuery) {
            relevantDocs.push({
              title: data.title,
              description: data.description || '',
              sections: sections,
              targetSectionKey: null
            });
          } else {
            // タイトル抽出パターンがある場合、タイトルで優先的に検索
            let isMatch = false;
            let matchScore = 0;
            
            // 項目指定がある場合、その項目の内容をチェック
            if (targetSectionKey) {
              const targetSectionContent = sections[targetSectionKey];
              if (targetSectionContent === undefined || targetSectionContent === null) {
                // 指定された項目が存在しない場合はスキップ
                continue;
              }
              
              // 項目の内容が空でないことを確認
              const sectionContentStr = sectionContentToString(targetSectionContent);
              if (sectionContentStr.trim().length === 0) {
                // 項目の内容が空の場合はスキップ
                continue;
              }
            }
            
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
            // 項目指定がある場合は、その項目の内容だけで検索
            let contentMatch = false;
            let wordMatch = false;
            
            if (targetSectionKey) {
              // 項目指定がある場合、その項目の内容だけで検索
              const targetSectionContent = sections[targetSectionKey];
              const sectionContentStr = sectionContentToString(targetSectionContent).toLowerCase();
              contentMatch = sectionContentStr.includes(searchQuery);
              wordMatch = queryWords.some(word => sectionContentStr.includes(word));
            } else {
              // 項目指定がない場合、すべてのセクションを検索
              const allSectionsContent = Object.entries(sections)
                .map(([key, value]) => sectionContentToString(value))
                .join(' ')
                .toLowerCase();
              contentMatch = allSectionsContent.includes(searchQuery);
              wordMatch = queryWords.some(word => 
                data.title?.toLowerCase().includes(word) || 
                data.description?.toLowerCase().includes(word) ||
                allSectionsContent.includes(word)
              );
            }
            
            if ((contentMatch || wordMatch) && !isMatch) {
              isMatch = true;
              matchScore = 40;
            }
            
            if (isMatch) {
              relevantDocs.push({
                title: data.title,
                description: data.description || '',
                sections: sections,
                matchScore,
                targetSectionKey: targetSectionKey || null // 指定された項目名を保存
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
          // 「の（項目名）について教えて」パターンの場合は、指定された項目だけを返す
          
          const docTexts = relevantDocs.map((doc, index) => {
            const sections = doc.sections || {};
            const sectionTexts: string[] = [];
            
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
            
            // 項目指定がある場合は、その項目だけを処理
            let sectionsToProcess: [string, any][];
            
            // targetSectionKeyが設定されている場合（doc.targetSectionKeyまたはグローバル変数）
            const effectiveTargetSectionKey = doc.targetSectionKey || targetSectionKey;
            
            // ドキュメントにtargetSectionKeyが設定されている場合（項目指定）
            if (effectiveTargetSectionKey) {
              // 指定された項目だけを処理
              const targetKey = effectiveTargetSectionKey;
              if (sections[targetKey] !== undefined && sections[targetKey] !== null) {
                // セクションが存在し、内容が空でないことを確認
                const sectionContentStr = sectionContentToString(sections[targetKey]);
                if (sectionContentStr.trim().length > 0) {
                  sectionsToProcess = [[targetKey, sections[targetKey]]];
                } else {
                  // セクションの内容が空の場合
                  sectionsToProcess = [];
                }
              } else {
                // 指定された項目が存在しない場合
                sectionsToProcess = [];
              }
            } else if (extractedTitle && !effectiveTargetSectionKey) {
              // 「について教えて」の場合は、overviewセクションまたは説明を表示
              if (sections.overview !== undefined) {
                sectionsToProcess = [['overview', sections.overview]];
              } else if (doc.description && doc.description.trim()) {
                // overviewがない場合は説明を表示
                sectionTexts.push(`説明: ${doc.description}`);
                sectionsToProcess = [];
              } else {
                sectionsToProcess = [];
              }
            } else {
              // すべてのセクションを処理（通常の検索）
              // ただし、targetSectionKeyが設定されている場合は、そのセクションだけを処理
              if (targetSectionKey && !effectiveTargetSectionKey) {
                // グローバル変数のtargetSectionKeyを使用
                if (sections[targetSectionKey] !== undefined && sections[targetSectionKey] !== null) {
                  const sectionContentStr = sectionContentToString(sections[targetSectionKey]);
                  if (sectionContentStr.trim().length > 0) {
                    sectionsToProcess = [[targetSectionKey, sections[targetSectionKey]]];
                  } else {
                    sectionsToProcess = [];
                  }
                } else {
                  sectionsToProcess = [];
                }
              } else {
                sectionsToProcess = Object.entries(sections);
                // 説明を最初に表示
                if (doc.description && doc.description.trim()) {
                  sectionTexts.push(`説明: ${doc.description}`);
                }
              }
            }
            
            for (const [key, value] of sectionsToProcess) {
              const label = sectionLabels[key] || key;
              
              if (Array.isArray(value) && value.length > 0) {
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
                // 文字列の場合（overviewなど）
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
    // 「よくある質問」「FAQ」を検出
    const faqKeywords = ['よくある質問', 'FAQ', 'faq', 'よくある質問を教えて', 'よくある質問について'];
    const isFAQQuery = faqKeywords.some(keyword => message.toLowerCase().includes(keyword));
    
    // 「使い方」「方法」「教えて」などの一般的な質問を検出
    const helpKeywords = ['使い方', '使い', '方法', '教えて', 'how to', '使い方を', 'どうやって', 'どう使う'];
    const isHelpQuery = helpKeywords.some(keyword => message.toLowerCase().includes(keyword));
    
    try {
      const knowledge = getAppKnowledge();
      
      if (isFAQQuery) {
        // よくある質問のリストを返す
        const faqList = [
          {
            question: '「情報が見つかりませんでした」と表示される',
            answer: 'データが存在しないか、質問の表現が適切でない可能性があります。「〇〇について教えて」という形式で質問してください。'
          },
          {
            question: 'セクション検索がうまく動作しない',
            answer: 'タイトルとセクション名の両方を指定してください。例：「Signal.の料金について教えて」'
          },
          {
            question: '自分のTODOが見つからない',
            answer: 'TODOリストはユーザー単位で検索されます。ログインしているユーザーのデータのみ検索対象です。'
          },
          {
            question: '契約書が見つからない',
            answer: '契約書管理は会社単位で共有されます。会社名が正しく設定されているか確認してください。'
          },
          {
            question: 'アクション検出が動作しない',
            answer: 'アクション動詞（「作って」「確認したい」など）とドメイン名（「請求書」「タスク」など）を含めてください。'
          },
          {
            question: '検索結果が多すぎる/少なすぎる',
            answer: 'より具体的な質問をするか、セクション名やステータスを指定してください。'
          }
        ];
        
        const faqText = faqList.map((faq, index) => 
          `Q${index + 1}: ${faq.question}\nA: ${faq.answer}`
        ).join('\n\n');
        
        return `❓ よくある質問\n\n${faqText}\n\n他に質問があれば、お気軽にどうぞ！`;
      } else if (isHelpQuery) {
        // 使い方の質問に対して、より親切な案内を返す
        const helpExamples = [
          {
            category: 'TODOリスト',
            examples: [
              '「TODOリストについて教えて」',
              '「共有事項について教えて」',
              '「進行中のタスクを確認したい」'
            ]
          },
          {
            category: '進捗メモ',
            examples: [
              '「進捗メモについて教えて」',
              '「営業活動の進捗を確認したい」',
              '「案件の進捗を見たい」'
            ]
          },
          {
            category: '契約書管理',
            examples: [
              '「契約書について教えて」',
              '「Signal.について教えて」',
              '「Signal.の料金について教えて」'
            ]
          },
          {
            category: '利用者管理',
            examples: [
              '「利用者について教えて」',
              '「ユーザー一覧を確認したい」',
              '「利用者を検索したい」'
            ]
          },
          {
            category: '会社情報',
            examples: [
              '「会社情報について教えて」',
              '「会社の住所を確認したい」',
              '「会社の電話番号を教えて」'
            ]
          },
          {
            category: '請求書発行',
            examples: [
              '「請求書について教えて」',
              '「請求書一覧を確認したい」',
              '「請求書を検索したい」'
            ]
          }
        ];
        
        const examplesText = helpExamples.map(help => {
          const examplesList = help.examples.map(ex => `  • ${ex}`).join('\n');
          return `${help.category}\n${examplesList}`;
        }).join('\n\n');
        
        return `こんにちは！AIアシスタントです。\n\n` +
          `このチャットでは、アプリ内の情報を質問形式で検索できます。\n\n` +
          `質問の例：\n\n${examplesText}\n\n` +
          `💡 ポイント\n` +
          `• 自然な日本語で質問してください\n` +
          `• 具体的なキーワード（「顧客」「案件」「タスク」など）を含めると、より正確な結果が得られます\n` +
          `• 「12月1日のタスクは？」のように日付を含めると、その日の情報を取得できます\n\n` +
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

    // デバッグログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('[AI Chat] User info:', { userId, companyName: companyName || '(empty)' });
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: 'データベース接続エラー' },
        { status: 500 }
      );
    }

    // Phase 1: アクション検出を最初に試みる
    const action = detectAction(message);
    if (action) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AI Chat] Action detected:', action);
      }
      
      const actionResponse = generateActionResponse(action, userId, companyName);
      if (actionResponse) {
        return NextResponse.json({
          response: actionResponse,
          intent: 'action',
          action: action
        });
      }
    }

    // 1. intentを最初に決定（アクションが検出されなかった場合）
    const intent = parseIntent(message);
    
    // デバッグログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('[AI Chat] Intent parsed:', { message, intent: intent.type, menuId: intent.menuId || 'none' });
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

