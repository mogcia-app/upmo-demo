// PDFの構造化解析と自動分類

export interface DocumentSection {
  title: string;
  content: string;
  category: 'overview' | 'features' | 'pricing' | 'flow' | 'contact' | 'other';
  confidence: number; // 分類の信頼度
}

export interface StructuredDocument {
  id: string;
  originalTitle: string;
  sections: DocumentSection[];
  metadata: {
    totalPages: number;
    extractedAt: Date;
    sourceFile: string;
  };
}

// セクションの自動分類
export function classifySection(title: string, content: string): DocumentSection['category'] {
  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // 概要・紹介
  if (titleLower.includes('概要') || 
      titleLower.includes('について') || 
      titleLower.includes('introduction') ||
      contentLower.includes('企業様が') ||
      contentLower.includes('モヤモヤを感じ')) {
    return 'overview';
  }
  
  // 機能・できること
  if (titleLower.includes('機能') || 
      titleLower.includes('できること') || 
      titleLower.includes('features') ||
      contentLower.includes('パフォーマンス') ||
      contentLower.includes('AIが改善')) {
    return 'features';
  }
  
  // 料金
  if (titleLower.includes('料金') || 
      titleLower.includes('価格') || 
      titleLower.includes('pricing') ||
      contentLower.includes('円') ||
      contentLower.includes('プラン')) {
    return 'pricing';
  }
  
  // 導入フロー
  if (titleLower.includes('フロー') || 
      titleLower.includes('流れ') || 
      titleLower.includes('flow') ||
      contentLower.includes('ステップ') ||
      contentLower.includes('手順')) {
    return 'flow';
  }
  
  // お問い合わせ
  if (titleLower.includes('お問い合わせ') || 
      titleLower.includes('contact') || 
      contentLower.includes('連絡') ||
      contentLower.includes('電話')) {
    return 'contact';
  }
  
  return 'other';
}

// PDFを構造化して解析
export function parseStructuredDocument(rawText: string, fileName: string): StructuredDocument {
  const sections: DocumentSection[] = [];
  
  // 見出しパターンを検出
  const headingPatterns = [
    /(概要|について|Introduction)/i,
    /(機能|できること|Features)/i,
    /(料金|価格|Pricing)/i,
    /(フロー|流れ|Flow)/i,
    /(お問い合わせ|Contact)/i,
    /(\d+\.\s*[^。\n]+)/g, // 数字付き見出し
    /([A-Z][A-Z\s]+[A-Z])/g // 大文字見出し
  ];
  
  const lines = rawText.split('\n').filter(line => line.trim());
  let currentSection: DocumentSection | null = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 見出しかどうかチェック
    const isHeading = headingPatterns.some(pattern => pattern.test(trimmedLine));
    
    if (isHeading && trimmedLine.length < 100) {
      // 前のセクションを保存
      if (currentSection) {
        currentSection.category = classifySection(currentSection.title, currentSection.content);
        sections.push(currentSection);
      }
      
      // 新しいセクション開始
      currentSection = {
        title: trimmedLine,
        content: '',
        category: 'other',
        confidence: 0.8
      };
    } else if (currentSection) {
      currentSection.content += trimmedLine + ' ';
    }
  }
  
  // 最後のセクションを保存
  if (currentSection) {
    currentSection.category = classifySection(currentSection.title, currentSection.content);
    sections.push(currentSection);
  }
  
  return {
    id: Date.now().toString(),
    originalTitle: fileName.replace('.pdf', ''),
    sections: sections,
    metadata: {
      totalPages: rawText.split('ページ').length - 1,
      extractedAt: new Date(),
      sourceFile: fileName
    }
  };
}

// Firestoreに構造化データを保存
export async function saveStructuredDocument(
  structuredDoc: StructuredDocument, 
  userId: string
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'structuredDocuments'), {
      ...structuredDoc,
      userId: userId,
      createdAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving structured document:', error);
    throw error;
  }
}

// カテゴリ別に検索
export async function searchByCategory(
  category: DocumentSection['category'], 
  userId: string
): Promise<DocumentSection[]> {
  try {
    const q = query(
      collection(db, 'structuredDocuments'),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const sections: DocumentSection[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const matchingSections = data.sections.filter(
        (section: DocumentSection) => section.category === category
      );
      sections.push(...matchingSections);
    });
    
    return sections;
  } catch (error) {
    console.error('Error searching by category:', error);
    return [];
  }
}
