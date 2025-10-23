# Upmo Demo - 要件定義書

## 📋 プロジェクト概要

**Upmo Demo** は、分散された社内規則や文書を一元化し、AI チャット機能を通じて瞬時に情報を出力することで業務改善を図る企業向けプラットフォームです。

### 🎯 プロジェクトの目的
- 社内文書の一元管理と構造化
- AI を活用した自然言語での情報検索
- ユーザーフレンドリーなインターフェースでの情報提供
- 業務効率化と意思決定支援

---

## 🏗️ 技術アーキテクチャ

### フロントエンド
- **フレームワーク**: Next.js 15.5.6 (App Router)
- **UI ライブラリ**: React 19.1.0 + Tailwind CSS 4
- **言語**: TypeScript 5
- **状態管理**: React Context API

### バックエンド
- **API**: Next.js API Routes
- **データベース**: Firebase Firestore
- **認証**: Firebase Authentication
- **ファイル処理**: PDF.js (pdfjs-dist 3.11.174)
- **AI 統合**: OpenAI API (gpt-3.5-turbo)

### デプロイメント
- **プラットフォーム**: Vercel
- **ドメイン**: upmo-demo.vercel.app
- **環境変数**: Vercel Environment Variables

### 開発環境
- **パッケージマネージャー**: npm
- **リンター**: ESLint 9
- **バージョン管理**: Git + GitHub

---

## 👥 ユーザーロールと権限管理

### ロール定義

#### 1. 管理者 (Admin)
- **権限**: 全機能へのアクセス
- **機能**:
  - ユーザー管理（作成・編集・削除）
  - 文書管理（手動入力・編集・削除）
  - システム設定
- **登録方法**: ログインページでの新規登録（自動的に管理者権限付与）

#### 2. 利用者 (User)
- **権限**: 基本機能へのアクセス
- **機能**:
  - 個人チャット（AI アシスタント）
  - TODO リスト管理
  - カスタムタブ作成・編集
- **登録方法**: 管理者による作成

### アクセス制御
- **ProtectedRoute**: 認証が必要なページの保護
- **adminOnly**: 管理者専用ページの制限
- **サイドバー**: ロールに応じたメニュー表示

---

## 🚀 主要機能

### 1. 認証システム
- **ログイン/新規登録**: Firebase Authentication
- **セッション管理**: 自動認証状態監視
- **ロールベースアクセス**: Firestore でのユーザーメタデータ管理

### 2. ダッシュボード
- **統計表示**: ユーザー数、アクティビティ等
- **ウェルカムメッセージ**: ユーザー向けの案内
- **レスポンシブデザイン**: モバイル・デスクトップ対応

### 3. 個人チャット (AI アシスタント)
- **AI 統合**: OpenAI GPT-3.5-turbo
- **文書検索**: 手動入力データからの検索
- **会話形式**: 自然言語での質問応答
- **ローディングアニメーション**: UX 向上のためのタイピング効果
- **フォールバック**: API キー未設定時の代替機能

### 4. TODO リスト (Kanban ボード)
- **3 カラム構成**: Shared, ToDo, In Progress
- **タスク管理**: 作成・編集・削除・ステータス変更
- **詳細情報**: ID、タイトル、説明、担当者、期限、タグ
- **ローカルストレージ**: データ永続化
- **モダン UI**: Jooto スタイルのカードデザイン

### 5. カスタムタブ
- **動的ページ作成**: ユーザー定義のページ
- **コンポーネント**: データテーブル、チャート、フォーム、カレンダー
- **URL ルーティング**: 動的ルート (`/custom/[slug]`)
- **多言語対応**: 英語・日本語スラッグマッピング

### 6. 管理者機能

#### 文書管理 (`/admin/contracts`)
- **手動入力**: 構造化された文書データの入力
- **文書タイプ**: 概要、機能、料金、手順、サポート、規則、条件
- **CRUD 操作**: 作成・読み取り・更新・削除
- **Firestore 統合**: データ永続化

#### ユーザー管理 (`/admin/users`)
- **Firebase Admin SDK**: サーバーサイドユーザー管理
- **ユーザー作成**: メール・パスワード設定
- **権限管理**: ロール・部門・役職設定
- **検索・フィルタ**: ユーザー検索機能
- **モダン UI**: カードベースのユーザー表示

---

## 🔌 API エンドポイント

### 認証関連
- **Firebase Authentication**: クライアントサイド認証
- **Firebase Admin SDK**: サーバーサイドユーザー管理

### 文書管理
- `POST /api/admin/save-manual-document`: 手動文書の保存
- `GET /api/admin/get-manual-documents`: 手動文書の取得
- `POST /api/admin/process-document`: PDF 文書の処理（将来実装）

### 検索機能
- `POST /api/search-manual`: 手動文書の検索
- `POST /api/search`: 構造化文書の検索

### AI 機能
- `POST /api/generate-natural-response`: AI レスポンス生成
- `GET/POST /api/test-ai`: AI 機能のテスト

### ユーザー管理
- `GET /api/admin/users`: ユーザー一覧取得
- `POST /api/admin/users`: ユーザー作成
- `PUT /api/admin/users`: ユーザー更新
- `DELETE /api/admin/users`: ユーザー削除

---

## 📊 データ構造

### Firestore コレクション

#### `users`
```typescript
{
  email: string;
  displayName: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'active' | 'inactive' | 'pending';
  department?: string;
  position?: string;
  createdAt: Date;
  createdBy: string;
  lastLoginAt?: Date;
}
```

#### `manualDocuments`
```typescript
{
  id: string;
  title: string;
  description: string;
  type: string;
  sections: {
    overview?: string;
    features?: string;
    pricing?: string;
    procedures?: string;
    support?: string;
    rules?: string;
    terms?: string;
  };
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  userId: string;
  createdAt: Date;
  lastUpdated: Date;
}
```

#### `structuredDocuments`
```typescript
{
  id: string;
  fileName: string;
  documentType: string;
  sections: DocumentSection[];
  userId: string;
  createdAt: Date;
  lastUpdated: Date;
}
```

### ローカルストレージ
- **TODO データ**: `todos` キーでタスクデータを保存
- **カスタムタブ**: `customTabs` キーでユーザー定義ページを保存

---

## 🎨 UI/UX 設計

### デザインシステム
- **メインカラー**: #005eb2 (ブルー)
- **フレームワーク**: Tailwind CSS 4
- **アイコン**: Unicode 絵文字
- **フォント**: Geist (Vercel フォント)

### レスポンシブデザイン
- **モバイルファースト**: スマートフォン対応
- **ブレークポイント**: sm, md, lg, xl
- **サイドバー**: モバイルではオーバーレイ表示

### アニメーション
- **ローディング**: スピナー、タイピング効果
- **トランジション**: フェードイン、スライド
- **インタラクション**: ホバー効果、クリックフィードバック

---

## 🔒 セキュリティ

### 認証・認可
- **Firebase Authentication**: セキュアな認証
- **JWT トークン**: 自動トークン管理
- **ロールベースアクセス**: ページ・機能レベルでの制御

### データ保護
- **Firestore セキュリティルール**: データアクセス制御
- **環境変数**: API キーの安全な管理
- **HTTPS**: 全通信の暗号化

### 入力検証
- **クライアントサイド**: フォームバリデーション
- **サーバーサイド**: API エンドポイントでの検証
- **ファイルサイズ制限**: アップロードファイルの制限

---

## 📈 パフォーマンス

### 最適化
- **Next.js 最適化**: 自動コード分割、画像最適化
- **Firestore インデックス**: 検索パフォーマンス向上
- **キャッシュ戦略**: ブラウザキャッシュ、CDN

### 監視
- **Vercel Analytics**: パフォーマンス監視
- **エラーハンドリング**: 包括的なエラー処理
- **ログ**: デバッグ用ログ出力

---

## 🚀 デプロイメント

### 環境
- **本番**: Vercel (upmo-demo.vercel.app)
- **開発**: ローカル開発サーバー (localhost:3000)
- **ステージング**: Vercel Preview Deployments

### CI/CD
- **GitHub 連携**: 自動デプロイ
- **ブランチ戦略**: main ブランチから本番デプロイ
- **環境変数**: Vercel ダッシュボードで管理

---

## 🔮 将来の拡張計画

### 短期計画
- **PDF 処理機能**: 完全な PDF アップロード・処理
- **高度な検索**: 全文検索、ファジー検索
- **通知システム**: リアルタイム通知

### 中期計画
- **チーム機能**: チームベースの文書共有
- **ワークフロー**: 承認フロー、タスク管理
- **レポート機能**: 使用状況分析、レポート生成

### 長期計画
- **AI 機能強化**: GPT-4 統合、カスタムモデル
- **モバイルアプリ**: React Native アプリ
- **API 公開**: サードパーティ統合

---

## 📝 開発ガイドライン

### コーディング規約
- **TypeScript**: 厳密な型定義
- **ESLint**: コード品質の維持
- **命名規則**: camelCase (変数), PascalCase (コンポーネント)

### Git ワークフロー
- **コミットメッセージ**: Conventional Commits
- **ブランチ**: feature/機能名, fix/バグ修正
- **プルリクエスト**: コードレビュー必須

### テスト戦略
- **単体テスト**: Jest + React Testing Library
- **統合テスト**: API エンドポイントテスト
- **E2E テスト**: Playwright (将来実装)

---

## 📞 サポート・メンテナンス

### ドキュメント
- **README**: セットアップ手順
- **API ドキュメント**: エンドポイント仕様
- **ユーザーマニュアル**: 機能説明

### 監視・ログ
- **エラー監視**: Vercel エラーログ
- **パフォーマンス**: Vercel Analytics
- **ユーザー行動**: Firebase Analytics (将来実装)

---

*最終更新: 2024年12月*
*バージョン: 0.1.0*
