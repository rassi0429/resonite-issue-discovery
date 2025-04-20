# Resonite Issue Discovery

GitHub Issue トラッカーシステム - Resonite プロジェクトの Issue を監視し、アクティビティの高い Issue をランキング化・要約するシステム。

## 概要

本プロジェクトは、GitHub リポジトリの Issue を定期的に監視し、アクティビティの高い Issue をランキング化・要約するシステムです。英語で書かれた Issue に対しても、日本語でのほんわかした検索や理解を可能にします。Resonite プロジェクトの Issue を主な対象とし、バグ報告、機能要望、コンテンツ関連の問題などを効率的に追跡します。

## 機能

- GitHub API からの Issue データ取得
- Issue タイプの分類（バグ/機能要望/コンテンツ）
- アクティビティスコア計算
- ローカル MongoDB データベースの利用

## 技術スタック

- Node.js
- TypeScript
- MongoDB
- Octokit.js (GitHub API)

## セットアップ

### 前提条件

- Node.js (v18以上)
- npm または yarn

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/resonite-issue-discovery.git
cd resonite-issue-discovery

# 依存関係をインストール
npm install

# .envファイルを設定
cp .env.example .env
# .envファイルを編集して、GitHub APIトークンなどを設定
```

### 環境変数の設定

`.env`ファイルに以下の環境変数を設定してください：

- `GITHUB_TOKEN`: GitHub API トークン
- `MONGODB_URI`: MongoDB 接続 URI（オプション、ローカル MongoDB を使用する場合は不要）
- `USE_LOCAL_MONGODB`: ローカル MongoDB を使用するかどうか（true/false）
- `TARGET_REPO`: 対象リポジトリ（例：Yellow-Dog-Man/Resonite-Issues）

### ビルドと実行

```bash
# TypeScriptをコンパイル
npm run build

# アプリケーションを実行
npm run start

# または、コンパイルと実行を一度に行う
npm run dev
```

## 使用方法

このアプリケーションは、GitHub リポジトリから Issue データを取得し、MongoDB に保存します。データは `data/exports` ディレクトリに JSON ファイルとしてエクスポートされます。

```bash
# Issue データを更新
npm run update-issues
```

## プロジェクト構造

```
resonite-issue-discovery/
├── src/                  # ソースコード
│   ├── config/           # 設定ファイル
│   ├── models/           # データモデル
│   ├── services/         # サービス
│   └── utils/            # ユーティリティ
├── data/                 # データディレクトリ
│   ├── mongodb-data/     # MongoDB データ
│   └── exports/          # エクスポートされた JSON ファイル
├── .env                  # 環境変数
├── .env.example          # 環境変数の例
├── package.json          # パッケージ設定
└── tsconfig.json         # TypeScript 設定
```

## 開発

### フェーズ1: 基本機能実装（現在）

- GitHub Actions ワークフロー設定
- Issue データ収集実装
- データベース構造設計・実装
- アクティビティスコア計算ロジック実装
- Issue タイプ分類機能の実装

### フェーズ2: AI 機能拡張（予定）

- ベクトル埋め込み生成
- 要約機能実装
- 検索機能実装
- 関連 Issue 検出機能

### フェーズ3: 最適化・拡張（予定）

- パフォーマンス最適化
- コスト最適化
- 追加機能実装
- ユーザーインターフェース開発（オプション）

## ライセンス

ISC
