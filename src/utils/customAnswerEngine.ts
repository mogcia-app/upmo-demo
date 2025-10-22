import { ProcessedText, TextSection, calculateSimilarity } from './textProcessor';

export interface SmartResponse {
  answer: string;
  confidence: number;
  sources: string[];
  relatedTopics: string[];
}

// 自社ロジックでの回答生成（AIを使わない）
export class CustomAnswerEngine {
  private processedTexts: ProcessedText[] = [];
  
  constructor(processedTexts: ProcessedText[]) {
    this.processedTexts = processedTexts;
  }
  
  // 質問に対する回答を生成
  generateAnswer(query: string): SmartResponse {
    const queryLower = query.toLowerCase();
    
    // 1. 直接的なキーワードマッチング
    const directMatches = this.findDirectMatches(queryLower);
    if (directMatches.length > 0) {
      return this.createResponseFromMatches(directMatches, query, 0.9);
    }
    
    // 2. 類似度ベースの検索
    const similarMatches = this.findSimilarMatches(queryLower);
    if (similarMatches.length > 0) {
      return this.createResponseFromMatches(similarMatches, query, 0.7);
    }
    
    // 3. 関連トピックの提案
    const relatedTopics = this.findRelatedTopics(queryLower);
    if (relatedTopics.length > 0) {
      return this.createRelatedTopicsResponse(query, relatedTopics);
    }
    
    // 4. デフォルト回答
    return this.createDefaultResponse(query);
  }
  
  // 直接的なマッチを検索
  private findDirectMatches(query: string): TextSection[] {
    const matches: TextSection[] = [];
    
    for (const processedText of this.processedTexts) {
      for (const section of processedText.sections) {
        const sectionText = (section.title + ' ' + section.content).toLowerCase();
        
        // 完全一致または部分一致
        if (sectionText.includes(query) || 
            section.keywords.some(keyword => keyword.toLowerCase().includes(query))) {
          matches.push(section);
        }
      }
    }
    
    return matches;
  }
  
  // 類似度ベースのマッチを検索
  private findSimilarMatches(query: string): TextSection[] {
    const matches: { section: TextSection; score: number }[] = [];
    
    for (const processedText of this.processedTexts) {
      for (const section of processedText.sections) {
        const sectionText = section.title + ' ' + section.content;
        const similarity = calculateSimilarity(query, sectionText);
        
        if (similarity > 0.3) { // 30%以上の類似度
          matches.push({ section, score: similarity });
        }
      }
    }
    
    // 類似度順でソート
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(match => match.section);
  }
  
  // 関連トピックを検索
  private findRelatedTopics(query: string): string[] {
    const relatedTopics: string[] = [];
    
    for (const processedText of this.processedTexts) {
      for (const section of processedText.sections) {
        // キーワードの重複をチェック
        const queryWords = query.split(/\s+/);
        const commonKeywords = section.keywords.filter(keyword => 
          queryWords.some(word => keyword.toLowerCase().includes(word.toLowerCase()))
        );
        
        if (commonKeywords.length > 0) {
          relatedTopics.push(section.title);
        }
      }
    }
    
    return [...new Set(relatedTopics)].slice(0, 5);
  }
  
  // マッチから回答を作成
  private createResponseFromMatches(matches: TextSection[], query: string, confidence: number): SmartResponse {
    const bestMatch = matches[0];
    const sources = matches.map(match => match.title);
    const relatedTopics = matches.slice(1, 4).map(match => match.title);
    
    let answer = '';
    
    if (bestMatch) {
      // マッチした内容を基に回答を構築
      answer = this.buildAnswerFromSection(bestMatch, query);
    }
    
    return {
      answer,
      confidence,
      sources,
      relatedTopics
    };
  }
  
  // セクションから回答を構築
  private buildAnswerFromSection(section: TextSection, query: string): string {
    const queryWords = query.split(/\s+/);
    
    // クエリに関連する部分を抽出
    const relevantParts = section.content
      .split(/[。！？]/)
      .filter(sentence => 
        queryWords.some(word => sentence.toLowerCase().includes(word.toLowerCase()))
      );
    
    if (relevantParts.length > 0) {
      return `【${section.title}】\n\n${relevantParts.join('。')}。`;
    } else {
      return `【${section.title}】\n\n${section.content.substring(0, 200)}...`;
    }
  }
  
  // 関連トピックの回答を作成
  private createRelatedTopicsResponse(query: string, relatedTopics: string[]): SmartResponse {
    const answer = `「${query}」について、以下の関連トピックが見つかりました：\n\n` +
      relatedTopics.map(topic => `• ${topic}`).join('\n') +
      '\n\n具体的な内容についてお聞きしたい場合は、上記のトピック名でお尋ねください。';
    
    return {
      answer,
      confidence: 0.5,
      sources: relatedTopics,
      relatedTopics: []
    };
  }
  
  // デフォルト回答を作成
  private createDefaultResponse(query: string): SmartResponse {
    const availableTopics = this.processedTexts
      .flatMap(pt => pt.sections.map(s => s.title))
      .slice(0, 5);
    
    const answer = `申し訳ございませんが、「${query}」に関する具体的な情報が見つかりませんでした。\n\n` +
      `以下のトピックについてお聞きいただけます：\n` +
      availableTopics.map(topic => `• ${topic}`).join('\n') +
      '\n\nまたは、より具体的なキーワードでお尋ねください。';
    
    return {
      answer,
      confidence: 0.1,
      sources: availableTopics,
      relatedTopics: []
    };
  }
}

// 便利な関数
export function createAnswerEngine(processedTexts: ProcessedText[]): CustomAnswerEngine {
  return new CustomAnswerEngine(processedTexts);
}

// 質問の分類
export function classifyQuery(query: string): 'specific' | 'general' | 'help' {
  const queryLower = query.toLowerCase();
  
  if (queryLower.includes('何') || queryLower.includes('どう') || queryLower.includes('なぜ')) {
    return 'specific';
  } else if (queryLower.includes('こんにちは') || queryLower.includes('はじめまして')) {
    return 'help';
  } else {
    return 'general';
  }
}
