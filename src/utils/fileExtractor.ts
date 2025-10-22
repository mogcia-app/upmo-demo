// 複数ファイル形式のテキスト抽出

import { parseStructuredDocument, DocumentSection } from './documentStructuring';

// セクション分類関数（documentStructuring.tsから複製）
function classifySection(title: string, content: string): 'overview' | 'features' | 'pricing' | 'flow' | 'contact' | 'other' {
  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // 概要・紹介
  if (titleLower.includes('概要') || titleLower.includes('紹介') || titleLower.includes('about') || 
      titleLower.includes('overview') || titleLower.includes('はじめに') || titleLower.includes('introduction')) {
    return 'overview';
  }
  
  // 機能・特徴
  if (titleLower.includes('機能') || titleLower.includes('特徴') || titleLower.includes('features') || 
      titleLower.includes('capabilities') || titleLower.includes('できること') || titleLower.includes('メリット')) {
    return 'features';
  }
  
  // 料金・価格
  if (titleLower.includes('料金') || titleLower.includes('価格') || titleLower.includes('pricing') || 
      titleLower.includes('price') || titleLower.includes('コスト') || titleLower.includes('費用')) {
    return 'pricing';
  }
  
  // フロー・手順
  if (titleLower.includes('フロー') || titleLower.includes('手順') || titleLower.includes('flow') || 
      titleLower.includes('process') || titleLower.includes('流れ') || titleLower.includes('ステップ')) {
    return 'flow';
  }
  
  // お問い合わせ・連絡
  if (titleLower.includes('お問い合わせ') || titleLower.includes('連絡') || titleLower.includes('contact') || 
      titleLower.includes('サポート') || titleLower.includes('support')) {
    return 'contact';
  }
  
  return 'other';
}

export const extractTextFromFile = async (file: File): Promise<string> => {
  const fileType = file.type;
  
  try {
    switch (fileType) {
      case 'application/pdf':
        return await extractPDFText(file);
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return await extractWordText(file);
      
      case 'text/plain':
      case 'text/markdown':
        return await extractTextFile(file);
      
      default:
        throw new Error(`未対応のファイル形式: ${fileType}`);
    }
  } catch (error) {
    console.error('ファイル抽出エラー:', error);
    throw error;
  }
};

// PDFテキスト抽出（既存）
export const extractPDFText = async (file: File): Promise<string> => {
  // 既存のPDF抽出ロジックを使用
  const { extractPDFText: pdfExtract } = await import('./pdfExtractor');
  return await pdfExtract(file);
};

// Word文書テキスト抽出（一時的に無効化）
export const extractWordText = async (_file: File): Promise<string> => {
  throw new Error('Word文書のサポートは準備中です。PDF、テキスト、Markdownファイルをご利用ください。');
};

// テキストファイル抽出
export const extractTextFile = async (file: File): Promise<string> => {
  try {
    const text = await file.text();
    return text;
  } catch (error) {
    console.error('テキストファイル抽出エラー:', error);
    throw new Error('テキストファイルの読み込みに失敗しました。');
  }
};

// ファイル形式に応じた構造解析
export const parseDocumentByType = (text: string, fileName: string, fileType: string) => {
  switch (fileType) {
    case 'text/markdown':
      return parseMarkdownDocument(text, fileName);
    
    case 'text/plain':
      return parsePlainTextDocument(text, fileName);
    
    default:
      return parseStructuredDocument(text, fileName);
  }
};

// Markdown文書の解析
export const parseMarkdownDocument = (text: string, fileName: string) => {
  const sections: DocumentSection[] = [];
  
  // Markdownの見出しを検出 (# ## ###)
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let lastIndex = 0;
  let match;
  
  while ((match = headingRegex.exec(text)) !== null) {
    const title = match[2].trim();
    const startIndex = match.index;
    
    // 前のセクションの内容を取得
    if (sections.length > 0) {
      const prevSection = sections[sections.length - 1];
      prevSection.content = text.substring(lastIndex, startIndex).trim();
    }
    
    // 新しいセクションを作成
    sections.push({
      title: title,
      content: '',
      category: classifySection(title, ''),
      confidence: 0.9
    });
    
    lastIndex = startIndex;
  }
  
  // 最後のセクションの内容を設定
  if (sections.length > 0) {
    const lastSection = sections[sections.length - 1];
    lastSection.content = text.substring(lastIndex).trim();
  }
  
  return {
    id: Date.now().toString(),
    originalTitle: fileName.replace(/\.(md|txt)$/, ''),
    sections: sections,
    metadata: {
      totalPages: 1,
      extractedAt: new Date(),
      sourceFile: fileName
    }
  };
};

// プレーンテキスト文書の解析
export const parsePlainTextDocument = (text: string, fileName: string) => {
  const sections: DocumentSection[] = [];
  
  // 段落ごとに分割
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  let currentSection: DocumentSection | null = null;
  
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    
    // 見出しらしき段落を検出（短く、特定のパターン）
    if (trimmed.length < 50 && 
        (trimmed.includes('概要') || 
         trimmed.includes('機能') || 
         trimmed.includes('料金') ||
         trimmed.includes('フロー') ||
         trimmed.includes('お問い合わせ'))) {
      
      // 前のセクションを保存
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // 新しいセクション開始
      currentSection = {
        title: trimmed,
        content: '',
        category: classifySection(trimmed, ''),
        confidence: 0.8
      };
    } else if (currentSection) {
      currentSection.content += trimmed + '\n\n';
    } else {
      // 最初のセクションを作成
      currentSection = {
        title: '概要',
        content: trimmed + '\n\n',
        category: 'overview',
        confidence: 0.7
      };
    }
  }
  
  // 最後のセクションを保存
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return {
    id: Date.now().toString(),
    originalTitle: fileName.replace(/\.(txt|md)$/, ''),
    sections: sections,
    metadata: {
      totalPages: 1,
      extractedAt: new Date(),
      sourceFile: fileName
    }
  };
};
