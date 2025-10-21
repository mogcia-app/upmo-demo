export const extractPDFText = async (file: File): Promise<string> => {
  // ブラウザ環境でのみPDF.jsを動的インポート
  if (typeof window === 'undefined') {
    throw new Error('PDF読み込みはブラウザ環境でのみ利用可能です。');
  }

  try {
    const pdfjsLib = await import('pdfjs-dist');
    
    const arrayBuffer = await file.arrayBuffer();
    
    // 複数の設定を試す
    const loadOptions = [
      // 設定1: 最小限の設定
      { data: arrayBuffer },
      // 設定2: CDN設定付き
      { 
        data: arrayBuffer,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      },
      // 設定3: 完全設定
      { 
        data: arrayBuffer,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
      }
    ];
    
    let pdf = null;
    let lastError = null;
    
    // 各設定を順番に試す
    for (const options of loadOptions) {
      try {
        // ワーカー設定をリセット
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        
        pdf = await pdfjsLib.getDocument(options).promise;
        break; // 成功したらループを抜ける
      } catch (error) {
        lastError = error;
        console.warn('PDF読み込み設定を試行中...', error);
        continue; // 次の設定を試す
      }
    }
    
    if (!pdf) {
      throw lastError || new Error('すべての設定でPDF読み込みに失敗しました。');
    }
    
    let fullText = '';
    
    // 全ページのテキストを抽出
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += `\n--- ページ ${i} ---\n${pageText}\n`;
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('PDF読み込みエラー:', error);
    
    // より詳細なエラー情報を提供
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF')) {
        throw new Error('無効なPDFファイルです。ファイルが破損している可能性があります。');
      } else if (error.message.includes('Password')) {
        throw new Error('パスワードで保護されたPDFファイルです。');
      } else if (error.message.includes('network')) {
        throw new Error('ネットワークエラーが発生しました。インターネット接続を確認してください。');
      }
    }
    
    throw new Error('PDFの読み込みに失敗しました。ファイル形式を確認してください。');
  }
};

// テキストをセクションに分割
export const splitTextIntoChunks = (text: string, maxChunkSize: number = 500): string[] => {
  const chunks: string[] = [];
  const sentences = text.split(/[。！？\n]/);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence + '。';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};
