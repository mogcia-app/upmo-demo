# シンプルなモノレポ移行案（実用的な解決策）

## 現状の問題

- adminとdemoを分けているが、**思うようにできない**
- **めんどくささ**を感じている
- データ構造の不整合（ユーザースキーマなど）
- コードの重複管理

## 解決策: 最小限のモノレポ構成

**複雑なツールは使わず、シンプルにpnpm workspaceで実現**

### なぜシンプルなアプローチが良いか

1. ✅ **セットアップが簡単**（30分程度）
2. ✅ **既存のコードをほぼそのまま使える**
3. ✅ **学習コストが低い**
4. ✅ **すぐに効果を実感できる**

## 構成案（超シンプル版）

```
upmo/
├── apps/
│   ├── demo/              # 現在のupmo-demoをそのまま移動
│   └── admin/             # 現在のadminをそのまま移動
├── packages/
│   └── shared/            # 共有コードのみ
│       ├── types/         # 型定義だけ共有
│       │   ├── user.ts
│       │   ├── sidebar.ts
│       │   └── index.ts
│       └── package.json
├── package.json           # ルート（workspace設定のみ）
└── pnpm-workspace.yaml    # pnpm設定
```

**ポイント:**
- 既存のコードは**ほぼそのまま**使える
- 共有するのは**型定義だけ**（最初は）
- 複雑なビルドツールは使わない

## 実装手順（30分で完了）

### ステップ1: ディレクトリ構造の作成（5分）

```bash
# 新しいディレクトリを作成
cd /Users/marina/Desktop
mkdir upmo
cd upmo

# 基本的な構造を作成
mkdir -p apps/demo apps/admin packages/shared/src/types
```

### ステップ2: 既存プロジェクトを移動（10分）

```bash
# 既存のプロジェクトを移動（Git履歴は保持）
mv upmo-demo/* apps/demo/
mv admin/* apps/admin/

# .gitディレクトリも移動（履歴を保持したい場合）
# または、新しいGitリポジトリとして開始
```

### ステップ3: 共有パッケージの作成（10分）

**`packages/shared/package.json`:**
```json
{
  "name": "@upmo/shared",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

**`packages/shared/src/types/index.ts`:**
```typescript
export * from './user';
export * from './sidebar';
```

**`packages/shared/src/types/user.ts`:**
```typescript
// 既存のsrc/types/user.tsをコピー
```

**`packages/shared/src/types/sidebar.ts`:**
```typescript
// 既存のsrc/types/sidebar.tsをコピー
```

### ステップ4: ルート設定（5分）

**`package.json`:**
```json
{
  "name": "upmo-monorepo",
  "private": true,
  "scripts": {
    "dev:demo": "pnpm --filter demo dev",
    "dev:admin": "pnpm --filter admin dev",
    "build:demo": "pnpm --filter demo build",
    "build:admin": "pnpm --filter admin build"
  }
}
```

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### ステップ5: 各アプリの設定更新（5分）

**`apps/demo/package.json`に追加:**
```json
{
  "dependencies": {
    "@upmo/shared": "workspace:*"
  }
}
```

**`apps/admin/package.json`に追加:**
```json
{
  "dependencies": {
    "@upmo/shared": "workspace:*"
  }
}
```

### ステップ6: インポートパスの更新（必要に応じて）

**変更前:**
```typescript
import { User } from '@/types/user';
```

**変更後:**
```typescript
import { User } from '@upmo/shared/types';
```

## メリット（すぐに実感できる）

### 1. **型定義の統一**
```typescript
// packages/shared/src/types/user.ts を修正すると
// → apps/demo と apps/admin の両方に自動反映
```

### 2. **データ構造の不整合を防止**
- 型定義を共有することで、admin側とdemo側で同じスキーマを強制
- TypeScriptの型チェックで不整合を検出

### 3. **開発の効率化**
- 型定義を1箇所で管理
- 変更が即座に両プロジェクトに反映

## 段階的な移行（無理しない）

### フェーズ1: 型定義だけ共有（今すぐ）
- ✅ 最小限のセットアップ
- ✅ 既存コードへの影響が少ない
- ✅ すぐに効果を実感できる

### フェーズ2: ユーティリティ関数を共有（後で）
- 必要になったら、`packages/shared/src/utils/`に追加
- Firebase設定など、共通コードを移動

### フェーズ3: コンポーネントを共有（さらに後で）
- 共通UIコンポーネントを共有
- ただし、無理に共有する必要はない

## 注意点

### ✅ やること
- 型定義だけ共有する（最初は）
- 既存のコードはそのまま使う
- 段階的に移行する

### ❌ やらないこと
- 一度にすべてを共有しようとしない
- 複雑なビルドツールを導入しない（最初は）
- 既存のコードを大幅に変更しない

## 実際の作業時間

- **セットアップ: 30分**
- **型定義の移動: 10分**
- **動作確認: 10分**
- **合計: 約50分**

## 結論

**シンプルなモノレポ構成で、めんどくささを解決できます。**

複雑なツールは使わず、pnpm workspaceだけで十分です。まずは型定義だけ共有して、効果を実感してから、必要に応じて段階的に拡張していくのがおすすめです。

## 次のステップ

1. この構成で進めるか決める
2. 進める場合は、一緒にセットアップを進めましょう
3. 型定義の共有から始めて、効果を確認

**めんどくささを解決するために、一緒に進めましょう！** 🚀




