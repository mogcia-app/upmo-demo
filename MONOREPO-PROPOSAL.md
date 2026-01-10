# モノレポ構成への移行提案

## 現状

- `upmo-demo`: ユーザー向けツール（Next.js）
- `upmo-admin`: 管理者向けツール（Next.js）
- それぞれ別々のリポジトリ/プロジェクトとして管理

## モノレポ構成のメリット

### 1. **コード共有が容易**
- ✅ **型定義の共有**: `User`スキーマ、`SidebarConfig`など、共通の型定義を一箇所で管理
- ✅ **ユーティリティ関数の共有**: Firebase設定、バリデーション関数など
- ✅ **APIロジックの共有**: 認証、データ取得などの共通ロジック

### 2. **データ構造の統一**
- ✅ **ユーザースキーマ**: 現在の課題（admin側と利用者招待側のデータ構造の違い）を解決
- ✅ **一貫性の保証**: 型定義を共有することで、両プロジェクトで同じスキーマを強制

### 3. **開発効率の向上**
- ✅ **変更の反映が即座**: 型定義を変更すると、両プロジェクトに自動反映
- ✅ **リファクタリングが容易**: 共通コードを一箇所で修正可能
- ✅ **依存関係の統一**: 同じバージョンのライブラリを使用

### 4. **CI/CDの統一**
- ✅ **ビルド・デプロイの一元管理**: 1つのワークフローで両プロジェクトを管理
- ✅ **テストの統一**: 共通コードのテストを一箇所で実行

## モノレポ構成のデメリット

### 1. **初期セットアップの手間**
- ⚠️ プロジェクト構造の再構築が必要
- ⚠️ 既存のGit履歴の移行（オプション）

### 2. **ビルド時間の増加**
- ⚠️ 両プロジェクトを同時にビルドする場合、時間がかかる可能性
- ✅ ただし、変更されたプロジェクトのみビルドする仕組みで対応可能

### 3. **依存関係の管理**
- ⚠️ プロジェクト間の依存関係を管理する必要がある
- ✅ モノレポツール（Turborepo、Nxなど）で自動管理可能

## 推奨構成

### オプション1: Turborepo（推奨）

```
upmo-monorepo/
├── apps/
│   ├── demo/              # upmo-demo
│   │   ├── src/
│   │   ├── package.json
│   │   └── next.config.ts
│   └── admin/             # upmo-admin
│       ├── src/
│       ├── package.json
│       └── next.config.ts
├── packages/
│   ├── shared/            # 共有コード
│   │   ├── types/         # 型定義
│   │   │   ├── user.ts
│   │   │   ├── sidebar.ts
│   │   │   └── index.ts
│   │   ├── utils/         # ユーティリティ
│   │   │   ├── firebase.ts
│   │   │   └── validation.ts
│   │   └── package.json
│   └── config/            # 設定ファイル
│       ├── eslint/
│       └── tsconfig/
├── package.json           # ルートのpackage.json
├── turbo.json             # Turborepo設定
└── pnpm-workspace.yaml    # pnpm workspace設定
```

**メリット:**
- ✅ 高速なビルド（キャッシュ機能）
- ✅ 依存関係の自動管理
- ✅ 並列実行による高速化
- ✅ Next.jsとの統合が良好

### オプション2: シンプルなpnpm workspace

```
upmo-monorepo/
├── apps/
│   ├── demo/
│   └── admin/
├── packages/
│   └── shared/
├── package.json
└── pnpm-workspace.yaml
```

**メリット:**
- ✅ シンプルで理解しやすい
- ✅ セットアップが簡単
- ⚠️ ビルド最適化は手動で実装が必要

## 移行手順

### ステップ1: 新しいモノレポリポジトリの作成

```bash
# 新しいディレクトリを作成
mkdir upmo-monorepo
cd upmo-monorepo

# Gitリポジトリの初期化
git init

# 基本的な構造を作成
mkdir -p apps/demo apps/admin packages/shared
```

### ステップ2: 既存プロジェクトの移行

```bash
# upmo-demoをapps/demoにコピー
cp -r /Users/marina/Desktop/upmo-demo/* apps/demo/

# upmo-adminをapps/adminにコピー
cp -r /Users/marina/Desktop/admin/* apps/admin/
```

### ステップ3: 共有コードの抽出

```bash
# 共有型定義を作成
mkdir -p packages/shared/src/types
mkdir -p packages/shared/src/utils

# 型定義を移動
mv apps/demo/src/types/user.ts packages/shared/src/types/
mv apps/demo/src/types/sidebar.ts packages/shared/src/types/

# ユーティリティを移動（必要に応じて）
# mv apps/demo/src/lib/firebase.ts packages/shared/src/utils/
```

### ステップ4: パッケージ設定

**ルートの`package.json`:**
```json
{
  "name": "upmo-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

**`packages/shared/package.json`:**
```json
{
  "name": "@upmo/shared",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    "./types": "./src/types/index.ts",
    "./utils": "./src/utils/index.ts"
  }
}
```

**`apps/demo/package.json`に追加:**
```json
{
  "dependencies": {
    "@upmo/shared": "workspace:*"
  }
}
```

### ステップ5: インポートパスの更新

**変更前:**
```typescript
import { User } from '@/types/user';
```

**変更後:**
```typescript
import { User } from '@upmo/shared/types';
```

## 実装の複雑さ評価

### 難易度: ⭐⭐⭐ (中程度)

**時間見積もり:**
- セットアップ: 2-3時間
- コード移行: 3-4時間
- テスト・調整: 2-3時間
- **合計: 7-10時間**

**主な作業:**
1. ✅ モノレポ構造の作成（30分）
2. ✅ 既存プロジェクトの移行（1-2時間）
3. ✅ 共有コードの抽出（2-3時間）
4. ✅ パッケージ設定（1時間）
5. ✅ インポートパスの更新（2-3時間）
6. ✅ ビルド・動作確認（1-2時間）

## 推奨事項

### ✅ モノレポ構成を推奨する理由

1. **現在の課題解決**: ユーザースキーマの統一という課題を解決できる
2. **将来の拡張性**: 新しいプロジェクト（モバイルアプリなど）を追加しやすい
3. **保守性の向上**: 共通コードを一箇所で管理できる
4. **開発効率**: 型定義の変更が即座に両プロジェクトに反映される

### ⚠️ 注意点

1. **段階的な移行**: 一度にすべてを移行せず、段階的に進める
2. **Git履歴**: 既存のGit履歴を保持したい場合は、`git subtree`や`git filter-branch`を使用
3. **デプロイ設定**: Vercelなどのデプロイ設定を更新する必要がある

## 代替案: 共有パッケージのみ

モノレポ全体を移行するのが大変な場合は、**共有パッケージのみを別リポジトリ**として管理する方法もあります。

```
upmo-shared/          # 別リポジトリ
├── types/
├── utils/
└── package.json

upmo-demo/            # 既存のまま
└── package.json      # @upmo/sharedを依存関係に追加

upmo-admin/           # 既存のまま
└── package.json      # @upmo/sharedを依存関係に追加
```

**メリット:**
- ✅ 既存プロジェクトの構造を維持
- ✅ セットアップが簡単

**デメリット:**
- ⚠️ 共有パッケージの更新を手動で両プロジェクトに反映する必要がある
- ⚠️ バージョン管理が複雑になる可能性

## 結論

**モノレポ構成への移行を推奨します。**

理由:
1. 現在のユーザースキーマ統一の課題を解決できる
2. 将来的な拡張性が高い
3. 開発効率が向上する
4. 初期セットアップの手間はあるが、長期的にはメリットが大きい

**実装の複雑さは中程度**で、1日程度で完了可能です。

