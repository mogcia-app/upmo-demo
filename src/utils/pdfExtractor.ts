export const extractPDFText = async (file: File): Promise<string> => {
  // ブラウザ環境でのみPDF.jsを動的インポート
  if (typeof window === 'undefined') {
    throw new Error('PDF読み込みはブラウザ環境でのみ利用可能です。');
  }

  // ファイルサイズチェック（10MB制限）
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。');
  }

  try {
    // クライアントサイドでのみPDF.jsを動的インポート
    const pdfjsLib = await import('pdfjs-dist') as any;
    
    // 複数のワーカー設定を試す
    const workerConfigs = [
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`,
      `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`,
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`
    ];
    
    let workerSet = false;
    for (const workerSrc of workerConfigs) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        workerSet = true;
        break;
      } catch (workerError) {
        console.warn('ワーカー設定失敗:', workerSrc, workerError);
        continue;
      }
    }
    
    if (!workerSet) {
      throw new Error('PDF.jsワーカーの設定に失敗しました。');
    }
    
    // ファイルを安全に読み込み
    let fileData;
    try {
      // FileReaderを使用してより安全に読み込み
      const reader = new FileReader();
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
      fileData = new Uint8Array(arrayBuffer);
    } catch {
      throw new Error('ファイルの読み込みに失敗しました。');
    }
    
    // 複数の設定でPDFを読み込みを試す
    const pdfConfigs = [
      // 設定1: シンプル
      {
        data: fileData,
        verbosity: 0,
        disableAutoFetch: true,
        disableStream: true,
        isEvalSupported: false
      },
      // 設定2: より緩い設定
      {
        data: fileData,
        verbosity: 0,
        disableAutoFetch: false,
        disableStream: false
      },
      // 設定3: 最小限
      {
        data: fileData
      }
    ];
    
    let pdf = null;
    let lastError = null;
    
    for (const config of pdfConfigs) {
      try {
        const loadingTask = pdfjsLib.getDocument(config);
        pdf = await loadingTask.promise;
        break;
      } catch (configError) {
        lastError = configError;
        console.warn('PDF設定を試行中...', configError);
        continue;
      }
    }
    
    if (!pdf) {
      throw lastError || new Error('すべての設定でPDF読み込みに失敗しました。');
    }
    
    let fullText = '';
    
    // 全ページのテキストを抽出
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += `\n--- ページ ${i} ---\n${pageText}\n`;
      } catch (pageError) {
        console.warn(`ページ ${i} の読み込みに失敗:`, pageError);
        fullText += `\n--- ページ ${i} ---\n[テキスト抽出に失敗]\n`;
      }
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
      } else if (error.message.includes('detached ArrayBuffer')) {
        throw new Error('ファイルの読み込みに失敗しました。ファイルを再度選択してください。');
      } else if (error.message.includes('API version')) {
        throw new Error('PDF.jsのバージョン不整合が発生しました。ページを再読み込みしてください。');
      } else if (error.message.includes('worker')) {
        throw new Error('PDF.jsワーカーの読み込みに失敗しました。インターネット接続を確認してください。');
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
