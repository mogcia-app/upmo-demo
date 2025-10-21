import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Firebase Functionsを除外
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push({
      'firebase-functions': 'commonjs firebase-functions',
      'firebase-admin': 'commonjs firebase-admin',
      // PDF.jsのNode.js依存関係を除外
      'canvas': 'canvas',
      'fs': 'fs'
    });
    
    // PDF.jsの最適化
    config.resolve.alias = {
      ...config.resolve.alias,
      'pdfjs-dist/build/pdf.worker.entry': 'pdfjs-dist/build/pdf.worker.js',
    };
    
    // PDF.jsをクライアントサイドでのみ読み込むように設定
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
    };
    
    return config;
  }
};

export default nextConfig;
