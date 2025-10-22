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
  async generateAnswer(query: string): Promise<SmartResponse> {
    const queryLower = query.toLowerCase();
    
    // デバッグ情報を出力
    console.log('🔍 検索クエリ:', query);
    console.log('📚 利用可能なテキスト数:', this.processedTexts.length);
    
    // 各テキストの詳細情報を出力
    this.processedTexts.forEach((pt, index) => {
      console.log(`📄 テキスト${index + 1}:`, {
        summary: pt.summary.substring(0, 100) + '...',
        keywords: pt.keywords.slice(0, 5),
        sectionsCount: pt.sections.length,
        originalTextLength: pt.originalText.length,
        cleanedTextSample: pt.cleanedText.substring(0, 200) + '...'
      });
      
      // 検索キーワードがテキストに含まれているかチェック
      const queryWords = this.extractKeywords(queryLower);
      queryWords.forEach(word => {
        if (pt.cleanedText.toLowerCase().includes(word)) {
          console.log(`✅ キーワード「${word}」がテキスト${index + 1}に含まれています`);
        } else {
          console.log(`❌ キーワード「${word}」がテキスト${index + 1}に含まれていません`);
        }
      });
    });
    
    // 0. 書類名での検索（最優先）
    const documentMatches = this.findDocumentByName(queryLower);
    console.log('📁 書類名マッチ数:', documentMatches.length);
    if (documentMatches.length > 0) {
      return this.createDocumentResponse(documentMatches[0], query);
    }
    
    // 1. 直接的なキーワードマッチング
    const directMatches = this.findDirectMatches(queryLower);
    console.log('🎯 直接マッチ数:', directMatches.length);
    if (directMatches.length > 0) {
      const response = this.createResponseFromMatches(directMatches, query, 0.9);
      // 資料名を追加
      const documentNames = this.processedTexts.map(pt => pt.summary.split('\n')[0] || 'Signal資料').filter(name => name.trim());
      response.sources = documentNames.length > 0 ? documentNames : ['Signal資料'];
      return response;
    }
    
    // 2. 類似度ベースの検索
    const similarMatches = this.findSimilarMatches(queryLower);
    console.log('🔗 類似マッチ数:', similarMatches.length);
    if (similarMatches.length > 0) {
      const response = this.createResponseFromMatches(similarMatches, query, 0.7);
      // 資料名を追加
      const documentNames = this.processedTexts.map(pt => pt.summary.split('\n')[0] || 'Signal資料').filter(name => name.trim());
      response.sources = documentNames.length > 0 ? documentNames : ['Signal資料'];
      return response;
    }
    
    // 3. 関連トピックの提案
    const relatedTopics = this.findRelatedTopics(queryLower);
    console.log('📋 関連トピック数:', relatedTopics.length);
    if (relatedTopics.length > 0) {
      return this.createRelatedTopicsResponse(query, relatedTopics);
    }
    
    // 4. AIを使った検索（フォールバック）
    console.log('🤖 AI検索を試行中...');
    
    // 料金に関する質問の場合は特別処理
    if (queryLower.includes('料金') || queryLower.includes('価格') || queryLower.includes('費用') || queryLower.includes('コスト')) {
      const priceInfo = this.extractPriceInfo();
      if (priceInfo) {
        // 資料名を取得
        const documentNames = this.processedTexts.map(pt => pt.summary.split('\n')[0] || 'Signal資料').filter(name => name.trim());
        return {
          answer: priceInfo,
          confidence: 0.9,
          sources: documentNames.length > 0 ? documentNames : ['Signal資料'],
          relatedTopics: []
        };
      }
    }
    
    const aiResponse = await this.generateAIResponse(query, this.processedTexts);
    if (aiResponse) {
      // 資料名を取得
      const documentNames = this.processedTexts.map(pt => pt.summary.split('\n')[0] || 'Signal資料').filter(name => name.trim());
      return {
        answer: aiResponse,
        confidence: 0.8, // AI検索の信頼度を上げる
        sources: documentNames.length > 0 ? documentNames : ['Signal資料'],
        relatedTopics: []
      };
    }
    
    // 5. デフォルト回答
    return this.createDefaultResponse(query);
  }
  
  // 書類名での検索
  private findDocumentByName(query: string): ProcessedText[] {
    const matches: ProcessedText[] = [];
    
    // 書類名のパターンを検出
    const documentPatterns = [
      /(.+)について教えて/i,
      /(.+)とは/i,
      /(.+)の概要/i,
      /(.+)の内容/i,
      /(.+)について/i
    ];
    
    let documentName = '';
    for (const pattern of documentPatterns) {
      const match = query.match(pattern);
      if (match) {
        documentName = match[1].trim().toLowerCase();
        break;
      }
    }
    
    // パターンが見つからない場合は、クエリ全体を書類名として扱う
    if (!documentName) {
      documentName = query.toLowerCase();
    }
    
    console.log('🔍 検索する書類名:', documentName);
    
    // 各テキストのタイトルやキーワードと照合
    for (const processedText of this.processedTexts) {
      const title = processedText.originalText.toLowerCase();
      const keywords = processedText.keywords.map(k => k.toLowerCase());
      
      // タイトルに書類名が含まれているかチェック
      if (title.includes(documentName) || 
          keywords.some(keyword => keyword.includes(documentName))) {
        matches.push(processedText);
        console.log('✅ 書類名マッチ:', processedText.summary.substring(0, 50) + '...');
      }
    }
    
    return matches;
  }
  
  // 書類の回答を作成
  private createDocumentResponse(processedText: ProcessedText, query: string): SmartResponse {
    const documentName = this.extractDocumentName(query);
    
    // 書類の概要を生成（より読みやすく）
    const summary = this.createReadableSummary(processedText);
    
    // 主要なセクションを抽出（日本語を優先）
    const mainSections = processedText.sections.slice(0, 3);
    const sectionContent = mainSections.map(section => 
      `**${this.cleanSectionTitle(section.title)}**\n${this.cleanSectionContent(section.content)}`
    ).join('\n\n');
    
    // 日本語キーワードを優先（意味のある単語のみ）
    const japaneseKeywords = processedText.keywords
      .filter(keyword => {
        const trimmed = keyword.trim();
        return trimmed.length > 1 && 
               /[ひらがなカタカナ漢字]/.test(trimmed) &&
               !trimmed.match(/^[A-Z\s\d]+$/) && // 英語のみを除外
               !trimmed.match(/^\d+$/); // 数字のみを除外
      })
      .slice(0, 6);
    
    const answer = `${documentName}について\n\n` +
      `概要\n${summary}\n\n` +
      `主要な内容\n${sectionContent}\n\n` +
      `関連キーワード: ${japaneseKeywords.join(', ')}`;
    
    return {
      answer,
      confidence: 0.95,
      sources: [processedText.summary.split('\n')[0] || documentName],
      relatedTopics: processedText.sections.slice(0, 5).map(s => s.title)
    };
  }
  
  // 読みやすい概要を作成
  private createReadableSummary(processedText: ProcessedText): string {
    const text = processedText.cleanedText;
    
    // 日本語の文を抽出して整理
    const sentences = text.split(/[。！？]/)
      .filter(sentence => {
        const trimmed = sentence.trim();
        return trimmed.length > 10 && 
               /[ひらがなカタカナ漢字]/.test(trimmed) &&
               !trimmed.match(/^[A-Z\s\d]+$/); // 英語のみの文を除外
      })
      .map(sentence => sentence.trim())
      .slice(0, 3);
    
    if (sentences.length > 0) {
      return sentences.join('。') + '。';
    }
    
    // フォールバック: 最初の日本語部分を抽出
    const japanesePart = text.match(/[ひらがなカタカナ漢字][^。！？]*[ひらがなカタカナ漢字]/);
    if (japanesePart) {
      return japanesePart[0].substring(0, 200) + '...';
    }
    
    return '詳細な情報が含まれています。';
  }
  
  // セクションタイトルをクリーンアップ
  private cleanSectionTitle(title: string): string {
    return title
      .replace(/[A-Z\s]+/g, '') // 英語の大文字を削除
      .replace(/\d+/g, '') // 数字を削除
      .trim() || '内容';
  }
  
  // セクション内容をクリーンアップ
  private cleanSectionContent(content: string): string {
    // 日本語の文を抽出
    const sentences = content.split(/[。！？]/)
      .filter(sentence => {
        const trimmed = sentence.trim();
        return trimmed.length > 15 && 
               /[ひらがなカタカナ漢字]/.test(trimmed) &&
               !trimmed.match(/^[A-Z\s\d]+$/); // 英語のみの文を除外
      })
      .map(sentence => sentence.trim())
      .slice(0, 2); // 最大2文
    
    if (sentences.length > 0) {
      return sentences.join('。') + '。';
    }
    
    // フォールバック: 日本語部分を抽出
    const japaneseParts = content.split(/\s+/)
      .filter(part => /[ひらがなカタカナ漢字]/.test(part))
      .join(' ');
    
    return japaneseParts.substring(0, 150) + (japaneseParts.length > 150 ? '...' : '');
  }
  
  // クエリから書類名を抽出
  private extractDocumentName(query: string): string {
    const patterns = [
      /(.+)について教えて/i,
      /(.+)とは/i,
      /(.+)の概要/i,
      /(.+)の内容/i,
      /(.+)について/i
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return query.trim();
  }
  
  // 直接的なマッチを検索
  private findDirectMatches(query: string): TextSection[] {
    const matches: TextSection[] = [];
    const queryWords = this.extractKeywords(query);
    
    console.log('🔍 検索単語:', queryWords);
    
    for (const processedText of this.processedTexts) {
      const fullText = processedText.cleanedText.toLowerCase();
      const originalText = processedText.originalText.toLowerCase();
      
      // 単語ごとの部分一致をチェック
      let matchCount = 0;
      const matchedWords: string[] = [];
      
      for (const word of queryWords) {
        if (fullText.includes(word) || originalText.includes(word)) {
          matchCount++;
          matchedWords.push(word);
        }
      }
      
      // 50%以上の単語がマッチした場合
      if (matchCount >= Math.ceil(queryWords.length * 0.5)) {
        console.log('✅ 部分マッチ発見:', matchedWords.join(', '));
        const relevantPart = this.extractRelevantPart(fullText, matchedWords.join(' '));
        matches.push({
          title: '資料内容',
          content: relevantPart,
          keywords: processedText.keywords
        });
      }
      
      // セクション単位でも検索
      for (const section of processedText.sections) {
        const sectionText = (section.title + ' ' + section.content).toLowerCase();
        let sectionMatchCount = 0;
        
        for (const word of queryWords) {
          if (sectionText.includes(word)) {
            sectionMatchCount++;
          }
        }
        
        if (sectionMatchCount >= Math.ceil(queryWords.length * 0.5)) {
          matches.push({
            title: section.title,
            content: section.content,
            keywords: processedText.keywords
          });
        }
      }
    }
    
    return matches;
  }
  
  // 日本語クエリからキーワードを抽出
  private extractKeywords(query: string): string[] {
    const keywords: string[] = [];
    const queryLower = query.toLowerCase();
    
    // 1. 助詞や接続詞を除去して単語を抽出
    const cleanedQuery = queryLower
      .replace(/[のをについて教えてとは]/g, ' ') // 助詞・接続詞を除去
      .replace(/[、。！？]/g, ' ') // 句読点を除去
      .trim();
    
    // 2. 空白で分割
    const words = cleanedQuery.split(/\s+/).filter(word => word.length > 1);
    
    // 3. 元のクエリも含める（完全一致用）
    keywords.push(queryLower);
    
    // 4. 分割された単語を追加
    keywords.push(...words);
    
    // 5. 日本語の単語境界で分割（ひらがな、カタカナ、漢字の境界）
    const japaneseWords = this.splitJapaneseWords(queryLower);
    keywords.push(...japaneseWords);
    
    // 6. 重複を除去
    return [...new Set(keywords)].filter(word => word.length > 0);
  }
  
  // 日本語の単語境界で分割
  private splitJapaneseWords(text: string): string[] {
    const words: string[] = [];
    
    // ひらがな、カタカナ、漢字、英数字の境界で分割
    const segments = text.split(/(?=[ひらがなカタカナ漢字])(?<=[a-zA-Z0-9])|(?=[a-zA-Z0-9])(?<=[ひらがなカタカナ漢字])/);
    
    for (const segment of segments) {
      if (segment.length > 1) {
        words.push(segment);
      }
    }
    
    return words;
  }
  // 関連部分を抽出
  private extractRelevantPart(text: string, query: string): string {
    const queryWords = this.extractKeywords(query);
    let bestIndex = -1;
    let bestScore = 0;
    
    // 各単語の位置をチェックして最適な位置を見つける
    for (let i = 0; i < text.length; i++) {
      let score = 0;
      for (const word of queryWords) {
        if (text.substring(i, i + word.length) === word) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    
    if (bestIndex === -1) {
      // マッチしない場合は最初の部分を返す
      return text.substring(0, 300) + '...';
    }
    
    const start = Math.max(0, bestIndex - 150);
    const end = Math.min(text.length, bestIndex + 300);
    return text.substring(start, end);
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
      return `${section.title}\n\n${relevantParts.join('。')}。`;
    } else {
      return `${section.title}\n\n${section.content.substring(0, 200)}...`;
    }
  }
  
  // 関連トピックの回答を作成
  private createRelatedTopicsResponse(query: string, relatedTopics: string[]): SmartResponse {
    const answer = `「${query}」について、以下の関連トピックが見つかりました：\n\n` +
      relatedTopics.map(topic => `${topic}`).join('\n') +
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
    // より柔軟な検索を試行
    const flexibleMatches = this.findFlexibleMatches(query);
    
    if (flexibleMatches.length > 0) {
      return this.createResponseFromMatches(flexibleMatches, query, 0.3);
    }
    
    const availableTopics = this.processedTexts
      .flatMap(pt => pt.sections.map(s => s.title))
      .slice(0, 5);
    
    // 利用可能なキーワードも表示
    const availableKeywords = this.processedTexts
      .flatMap(pt => pt.keywords)
      .slice(0, 10);
    
    const answer = `申し訳ございませんが、「${query}」に関する具体的な情報が見つかりませんでした。\n\n` +
      `以下のトピックについてお聞きいただけます：\n` +
      availableTopics.map(topic => `${topic}`).join('\n') +
      `\n\n利用可能なキーワード：\n` +
      availableKeywords.map(keyword => `${keyword}`).join('\n') +
      '\n\nまたは、より具体的なキーワードでお尋ねください。';
    
    return {
      answer,
      confidence: 0.1,
      sources: availableTopics,
      relatedTopics: []
    };
  }
  
  // AIを使った検索（フォールバック）
  private async generateAIResponse(query: string, processedTexts: ProcessedText[]): Promise<string | null> {
    try {
      // テキストを結合してAIに送信（より読みやすく整理）
      const combinedText = processedTexts
        .map(pt => {
          // テキストを読みやすく整理
          const cleanText = pt.cleanedText
            .replace(/\s+/g, ' ') // 複数スペースを1つに
            .replace(/([a-zA-Z])([ひらがなカタカナ漢字])/g, '$1 $2') // 英語と日本語の間にスペース
            .replace(/([ひらがなカタカナ漢字])([a-zA-Z])/g, '$1 $2')
            .replace(/[。！？]/g, '$1\n') // 句読点の後に改行
            .replace(/\n\s*\n/g, '\n') // 複数改行を1つに
            .trim();
          
          return `【${pt.summary}】\n${cleanText}`;
        })
        .join('\n\n---\n\n');
      
      if (combinedText.length === 0) {
        return null;
      }
      
      // デバッグ: AIに送信されるテキストの一部を表示
      console.log('🤖 AIに送信されるテキスト（最初の500文字）:', combinedText.substring(0, 500));
      
      // 料金情報が含まれているかチェック
      const hasPriceInfo = combinedText.includes('万円') || combinedText.includes('円') || combinedText.includes('料金');
      console.log('💰 料金情報の有無:', hasPriceInfo ? 'あり' : 'なし');
      
      // より具体的なAIプロンプト
      const prompt = `以下の文書から「${query}」に関する情報を探して、簡潔に回答してください。

文書内容:
${combinedText}

回答の要件:
- 簡潔で直接的な回答をしてください
- 料金の質問なら「○万円/月」の形式で回答
- 長い説明は不要、要点のみ
- 情報が見つからない場合は「該当する情報が見つかりませんでした」

回答例:
質問: 「料金について教えて」
回答: 「3万円〜/月、6万円/月、12万円/月です。」

回答:`;
      
      // OpenAI APIを呼び出し（動的インポート）
      const { generateAIResponse } = await import('./aiAssistant');
      const response = await generateAIResponse(prompt, []);
      
      return response || null;
    } catch (error) {
      console.error('AI検索エラー:', error);
      return null;
    }
  }
  
  // 料金情報を直接抽出
  private extractPriceInfo(): string | null {
    const prices: string[] = [];
    
    for (const processedText of this.processedTexts) {
      const text = processedText.cleanedText;
      
      // 料金パターンを検索
      const pricePatterns = [
        /(\d+)\s*万円\s*[〜～]\s*\/\s*月/g,
        /(\d+)\s*万円\s*\/\s*月/g,
        /(\d+)\s*万\s*円\s*[〜～]\s*\/\s*月/g,
        /(\d+)\s*万\s*円\s*\/\s*月/g
      ];
      
      for (const pattern of pricePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const price = match[1] + '万円/月';
          if (!prices.includes(price)) {
            prices.push(price);
          }
        }
      }
    }
    
    if (prices.length > 0) {
      return prices.join('、') + 'です。';
    }
    
    return null;
  }
  
  // より柔軟な検索
  private findFlexibleMatches(query: string): TextSection[] {
    const matches: TextSection[] = [];
    const queryWords = this.extractKeywords(query);
    
    for (const processedText of this.processedTexts) {
      const fullText = processedText.cleanedText.toLowerCase();
      
      // 部分一致をチェック
      for (const word of queryWords) {
        if (word.length > 2 && fullText.includes(word)) {
          const relevantPart = this.extractRelevantPart(fullText, word);
          matches.push({
            title: `「${word}」に関する情報`,
            content: relevantPart,
            keywords: processedText.keywords
          });
          break; // 最初のマッチで十分
        }
      }
    }
    
    return matches;
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
