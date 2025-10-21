export const extractPDFText = async (file: File): Promise<string> => {
  // ブラウザ環境でのみPDF.jsを動的インポート
  if (typeof window === 'undefined') {
    throw new Error('PDF読み込みはブラウザ環境でのみ利用可能です。');
  }

  try {
    const pdfjsLib = await import('pdfjs-dist');
    
    // PDF.jsのワーカーを設定
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
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
    throw new Error('PDFの読み込みに失敗しました。');
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
