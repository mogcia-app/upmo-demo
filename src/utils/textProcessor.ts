// PDFから抽出されたテキストの前処理とクリーンアップ

export interface ProcessedText {
  originalText: string;
  cleanedText: string;
  sections: TextSection[];
  keywords: string[];
  summary: string;
}

export interface TextSection {
  title: string;
  content: string;
  pageNumber?: number;
  keywords: string[];
}

// PDFテキストをクリーンアップ
export function cleanPDFText(rawText: string): string {
  let cleaned = rawText;
  
  // ページ区切りを削除
  cleaned = cleaned.replace(/---\s*ページ\s*\d+\s*---/g, '');
  
  // 余分な空白と改行を整理
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/\n+/g, '\n');
  
  // 特殊文字を整理
  cleaned = cleaned.replace(/[　]/g, ' '); // 全角スペースを半角に
  cleaned = cleaned.replace(/[。！？]/g, '$& '); // 句読点の後にスペース
  
  // 数字と文字の間のスペースを削除（例：「1 4 2 5」→「1425」）
  cleaned = cleaned.replace(/(\d)\s+(\d)/g, '$1$2');
  
  // 単語間の不自然なスペースを削除
  cleaned = cleaned.replace(/([a-zA-Z])\s+([a-zA-Z])/g, '$1$2');
  
  return cleaned.trim();
}

// テキストをセクションに分割
export function splitIntoSections(text: string): TextSection[] {
  const sections: TextSection[] = [];
  
  // 見出しパターンを検出（大文字、数字、特定のキーワード）
  const headingPatterns = [
    /(AGENDA|概要|について|機能|特徴|料金|お問い合わせ)/i,
    /(\d+\.\s*[^。]+)/g,
    /([A-Z][A-Z\s]+[A-Z])/g
  ];
  
  let currentSection: TextSection | null = null;
  const lines = text.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 見出しかどうかチェック
    const isHeading = headingPatterns.some(pattern => pattern.test(trimmedLine));
    
    if (isHeading && trimmedLine.length < 100) {
      // 前のセクションを保存
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // 新しいセクション開始
      currentSection = {
        title: trimmedLine,
        content: '',
        keywords: extractKeywords(trimmedLine)
      };
    } else if (currentSection) {
      currentSection.content += trimmedLine + ' ';
    }
  }
  
  // 最後のセクションを保存
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
}

// キーワードを抽出
export function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  
  // 日本語のキーワード
  const japaneseKeywords = text.match(/[一-龯]{2,}/g) || [];
  keywords.push(...japaneseKeywords);
  
  // 英語のキーワード
  const englishKeywords = text.match(/[A-Za-z]{3,}/g) || [];
  keywords.push(...englishKeywords);
  
  // 数字
  const numbers = text.match(/\d+/g) || [];
  keywords.push(...numbers);
  
  return [...new Set(keywords)]; // 重複を削除
}

// テキストの要約を生成
export function generateSummary(text: string, maxLength: number = 200): string {
  const cleaned = cleanPDFText(text);
  const sentences = cleaned.split(/[。！？]/).filter(s => s.trim());
  
  if (sentences.length === 0) return '';
  
  // 最初の文から要約を生成
  let summary = sentences[0];
  
  for (let i = 1; i < sentences.length && summary.length < maxLength; i++) {
    const nextSentence = sentences[i].trim();
    if (summary.length + nextSentence.length < maxLength) {
      summary += '。' + nextSentence;
    }
  }
  
  return summary + (summary.length < cleaned.length ? '...' : '');
}

// メインのテキスト処理関数
export function processPDFText(rawText: string): ProcessedText {
  const cleanedText = cleanPDFText(rawText);
  const sections = splitIntoSections(cleanedText);
  const keywords = extractKeywords(cleanedText);
  const summary = generateSummary(cleanedText);
  
  return {
    originalText: rawText,
    cleanedText,
    sections,
    keywords,
    summary
  };
}

// 検索用のインデックスを作成
export function createSearchIndex(text: string): Map<string, number> {
  const index = new Map<string, number>();
  const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 1);
  
  for (const word of words) {
    index.set(word, (index.get(word) || 0) + 1);
  }
  
  return index;
}

// 類似度を計算（シンプルな文字列マッチング）
export function calculateSimilarity(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\s+/);
  const textWords = text.toLowerCase().split(/\s+/);
  
  let matches = 0;
  for (const queryWord of queryWords) {
    for (const textWord of textWords) {
      if (textWord.includes(queryWord) || queryWord.includes(textWord)) {
        matches++;
        break;
      }
    }
  }
  
  return matches / queryWords.length;
}
