# Vercelビルド時間最適化ガイド

## 問題
Vercelでのビルドに27分もかかっている（ローカルでは約12秒）

## 考えられる原因

### 1. 依存関係のインストール時間
- `node_modules`が633MBと大きい
- `firebase-admin`や`pdfjs-dist`などの重いパッケージ
- 初回ビルドまたはキャッシュが効いていない

### 2. Vercelのビルド環境の問題
- リソース不足
- ネットワーク遅延
- ビルドキューが混雑

### 3. ビルドキャッシュの問題
- `.next/cache`が効いていない
- `node_modules`のキャッシュが効いていない

## 実施した最適化

### 1. `.vercelignore`の追加
不要なファイルをビルドから除外

### 2. `next.config.ts`の最適化
- `swcMinify: true` - SWCによる高速なminify
- `compress: true` - 圧縮を有効化
- `optimizePackageImports` - パッケージインポートの最適化

## 追加で確認すべきこと

### Vercelダッシュボードで確認
1. **ビルドログを確認**
   - どのステップで時間がかかっているか
   - `npm install`に時間がかかっているか
   - `next build`に時間がかかっているか

2. **ビルド設定を確認**
   - Build Command: `npm run build`
   - Install Command: `npm install`（デフォルト）
   - Output Directory: `.next`（デフォルト）

3. **環境変数を確認**
   - 不要な環境変数がないか
   - 大きな環境変数がないか

### 追加の最適化案

#### 1. package.jsonの最適化
```json
{
  "scripts": {
    "build": "next build",
    "postinstall": "next telemetry disable" // テレメトリーを無効化
  }
}
```

#### 2. Vercelのビルド設定
- **Install Command**: `npm ci` を使用（より高速）
- **Build Command**: `npm run build`
- **Node.js Version**: 20.x を明示的に指定

#### 3. 依存関係の見直し
- `firebase-admin`はサーバーサイドのみで使用するため、`optionalDependencies`に移動を検討
- 不要な依存関係を削除

#### 4. ビルドキャッシュの確認
Vercelの設定で以下を確認：
- Build Cache: 有効になっているか
- Dependencies Cache: 有効になっているか

## トラブルシューティング

### ビルドがハングしている場合
1. Vercelダッシュボードでビルドをキャンセル
2. 再ビルドを実行
3. それでも遅い場合は、Vercelサポートに問い合わせ

### 特定のステップで時間がかかっている場合
- `npm install`: 依存関係の見直し
- `next build`: `next.config.ts`の最適化
- TypeScript型チェック: `tsconfig.json`の最適化

## 参考
- [Vercel Build Optimization](https://vercel.com/docs/concepts/builds/build-optimization)
- [Next.js Build Performance](https://nextjs.org/docs/app/building-your-application/optimizing/build-performance)

