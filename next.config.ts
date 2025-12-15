import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // ビルド最適化
  compress: true,
  // Firebase Functionsを除外
  webpack: (config, { isServer }) => {
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
    
    // ビルド時間短縮のための最適化
    if (!isServer) {
      // クライアントサイドのビルド最適化
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
      };
    }
    
    return config;
  },
  // 実験的な機能でビルド時間を短縮
  experimental: {
    optimizePackageImports: ['firebase', 'firebase-admin'],
  },
};

export default nextConfig;
