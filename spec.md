# GitHub Issue トラッカー 仕様書

## 1. 概要

本プロジェクトは、GitHub リポジトリの Issue を定期的に監視し、アクティビティの高い Issue をランキング化・要約するシステムです。英語で書かれた Issue に対しても、日本語でのほんわかした検索や理解を可能にします。Resonite プロジェクトの Issue を主な対象とし、バグ報告、機能要望、コンテンツ関連の問題などを効率的に追跡します。
https://github.com/Yellow-Dog-Man/Resonite-Issues

## 2. システム構成

### 2.1 全体アーキテクチャ

- **データ収集**: GitHub Actions による定期実行
- **バックエンド**: Node.js
- **データベース**: MongoDB（スケーラビリティとドキュメント指向の特性を活かすため）
- **AI 連携**: OpenAI API 
- **ベクトルデータベース**: Pinecone または ChromaDB

### 2.2 主要コンポーネント

1. **データ収集モジュール**
   - GitHub API からの Issue データ取得
   - メタデータの抽出・整形
   - Issue タイプの分類（バグ/機能要望/コンテンツ）

2. **分析モジュール**
   - アクティビティスコア計算
   - トレンド分析
   - テキストの埋め込みベクトル生成
   - Issue タイプ別の重要度評価

3. **要約モジュール**
   - LLM API を用いた英語 Issue の日本語要約
   - 重要ポイントの抽出
   - 技術的詳細と一般ユーザー向け説明の分離

4. **検索モジュール**
   - ベクトル検索による意味的類似性マッチング
   - 日本語クエリ → 英語 Issue の検索
   - Issue タイプによるフィルタリング

5. **ストレージモジュール**
   - データ永続化
   - キャッシング
   - 履歴データの管理

## 3. 機能要件

### 3.1 データ収集機能

- 指定した GitHub リポジトリの Issue を定期取得
- 新規・更新された Issue の検出
- メタデータ（コメント数、リアクション、参加者など）の収集
- Issue のラベル情報に基づく分類（バグ/機能要望/コンテンツ）

### 3.2 分析機能

- Issue のアクティビティスコア計算
  - コメント数
  - コメントへのリプライ数
  - リアクション数（種類別）
  - 参加者数
  - 状態変更
  - 会話の深さ（リプライチェーンの長さ）

- トレンド検出
  - 時間経過に伴うアクティビティ変化の分析
  - 急激に注目を集めた Issue の特定
  - Issue タイプ別のトレンド分析

- Issue タイプ別の分析
  - バグ報告の重要度評価（影響範囲、再現性など）
  - 機能要望の人気度評価
  - コンテンツ関連問題の分類

### 3.3 要約・翻訳機能

- 英語 Issue の日本語要約
- 要約の粒度調整（短い見出し・概要・詳細）
- 新規コメント追加時の再要約
- 技術的な詳細と一般ユーザー向けの説明の分離
- VR/AR 関連の専門用語の適切な翻訳と説明

### 3.4 検索機能

- 日本語クエリによるセマンティック検索
- ベクトル埋め込みを用いた類似性検索
- キーワードとセマンティック検索のハイブリッド
- Issue タイプによるフィルタリング（バグのみ、機能要望のみなど）
- 関連する Issue のグループ化と表示

### 3.5 レポート生成

- 日次/週次のアクティブ Issue ダイジェスト
- カテゴリ別のまとめ
- 重要 Issue のハイライト
- 解決済み Issue の要約（特にバグ修正や実装された機能）
- 開発者向けと一般ユーザー向けの異なるレポートフォーマット

## 4. 技術仕様

### 4.1 GitHub Actions 設定

- 実行頻度: 6時間ごと
- トリガー: スケジュール + 手動実行オプション
- 環境変数:
  - GITHUB_TOKEN
  - MONGODB_URI
  - OPENAI_API_KEY
  - VECTOR_DB_API_KEY

### 4.2 データモデル

#### Issue データ
```
{
  id: String,              // GitHub Issue ID
  repo: String,            // リポジトリ名
  number: Number,          // Issue 番号
  title: String,           // タイトル
  body: String,            // 本文
  author: String,          // 作成者
  created_at: Date,        // 作成日時
  updated_at: Date,        // 更新日時
  closed_at: Date,         // クローズ日時（該当する場合）
  state: String,           // 状態（open/closed）
  comments: Number,        // コメント数
  comments_detail: [       // コメント詳細
    {
      id: String,          // コメントID
      author: String,      // 作成者
      created_at: Date,    // 作成日時
      updated_at: Date,    // 更新日時
      body: String,        // 本文
      reactions: Object,   // リアクション数
      replies: [           // リプライ情報
        {
          id: String,      // リプライID
          author: String,  // 作成者
          created_at: Date // 作成日時
        }
      ],
      reply_count: Number  // リプライ数
    }
  ],
  total_replies: Number,   // 全リプライ数
  reactions: {             // リアクション数
    total: Number,
    +1: Number,
    -1: Number,
    laugh: Number,
    hooray: Number,
    confused: Number,
    heart: Number,
    rocket: Number,
    eyes: Number
  },
  participants: [String],  // 参加者リスト
  labels: [String],        // ラベルリスト
  issue_type: String,      // Issue タイプ（bug/feature/content/other）
  activity_score: Number,  // アクティビティスコア
  embedding: Vector,       // テキスト埋め込みベクトル
  summary: {               // 要約情報
    ja: {
      short: String,       // 短い要約
      full: String,        // 詳細要約
      technical: String,   // 技術者向け要約
      general: String,     // 一般ユーザー向け要約
      generated_at: Date   // 要約生成日時
    }
  },
  history: [               // 履歴データ
    {
      date: Date,
      comments: Number,
      replies: Number,      // リプライ数の履歴
      reactions: Object,
      activity_score: Number
    }
  ],
  engagement_metrics: {    // エンゲージメント指標
    reply_depth: Number,   // 最大リプライ深度
    reply_breadth: Number, // リプライの広がり（返信者数）
    avg_reply_time: Number // 平均リプライ応答時間
  },
  related_issues: [        // 関連 Issue
    {
      number: Number,      // Issue 番号
      similarity: Number,  // 類似度スコア
      relation_type: String // 関連タイプ（similar/duplicate/dependency）
    }
  ],
  priority_score: Number,  // 優先度スコア（タイプ別の重要度を考慮）
  implementation_status: String // 実装状態（未対応/検討中/実装中/実装済み）
}
```

### 4.3 API 利用

#### GitHub API
- REST API または GraphQL API を使用
- GraphQL APIを利用したコメントとリプライの階層構造取得
- レート制限に対する対策実装
- エラーハンドリング・リトライ機構
- Webhook 連携によるリアルタイム更新（オプション）

#### OpenAI
- Embeddings 生成: text-embedding-3-small など
- 要約生成: GPT-4.1
- コスト最適化のためのモデル選択
- VR/AR 専門用語に対応するためのプロンプト最適化

### 4.4 ベクトル検索実装

- インデックス作成: タイトル + 本文 + コメント + リプライのベクトル化
- 複合ベクトル: 各コンテンツの重み付け（タイトル > 本文 > コメント > リプライ）
- 類似度計算: コサイン類似度
- クエリ処理: 日本語クエリのベクトル化 → 類似 Issue 検索
- リプライ情報を含めた検索結果のランキング調整
- Issue タイプによるフィルタリングとスコア調整

## 5. 実装計画

### 5.1 フェーズ 1: 基本機能実装

- GitHub Actions ワークフロー設定
- Issue データ収集実装
- データベース構造設計・実装
- アクティビティスコア計算ロジック実装
- Issue タイプ分類機能の実装

### 5.2 フェーズ 2: AI 機能拡張

- ベクトル埋め込み生成
- 要約機能実装
- 検索機能実装
- 関連 Issue 検出機能

### 5.3 フェーズ 3: 最適化・拡張

- パフォーマンス最適化
- コスト最適化
- 追加機能実装
- ユーザーインターフェース開発（オプション）

## 6. 技術選定

### 6.1 主要ライブラリ

- **GitHub API**: Octokit.js
- **データベース**: MongoDB（mongoose）
- **ベクトル検索**: Pinecone SDK / ChromaDB
- **AI/LLM**: OpenAI Node.js SDK
- **ユーティリティ**: LangChain.js, Bull/BullMQ (キュー管理)
- **テスト**: Jest, Supertest

### 6.2 開発言語・ツール

- **言語**: TypeScript
- **ランタイム**: Node.js v18+
- **パッケージ管理**: npm / yarn / pnpm
- **CI/CD**: GitHub Actions
- **コード品質**: ESLint, Prettier
- **ドキュメント**: TypeDoc

## 7. スケーリング・パフォーマンス考慮事項

### 7.1 データ量対策

- インデックス設計最適化
- ページネーション処理
- データアーカイブ戦略
- シャーディング対応（将来的に必要な場合）

### 7.2 API コスト対策

- キャッシング戦略
- 選択的処理（重要 Issue のみ要約など）
- バッチ処理
- 増分更新の実装

### 7.3 スケーラビリティ

- モジュラー設計
- 処理の非同期化
- 設定の外部化
- マイクロサービスアーキテクチャの検討（将来的に）

## 8. 今後の拡張性

- 複数リポジトリのクロス分析
- 機械学習によるトレンド予測
- Slack/Discord 通知連携
- ダッシュボード UI 実装
- コミュニティフィードバック機能
- 開発者向け API の提供
- VR/AR 関連の専門用語辞書の構築と活用

## 9. Resonite 固有の考慮事項

### 9.1 Issue タイプの特性

- **バグ報告**: 再現手順、環境情報、影響範囲の抽出と構造化
- **機能要望**: 類似要望のグループ化、実現可能性の評価
- **コンテンツ問題**: アセット、アバター、ワールドなどのカテゴリ分類

### 9.2 専門用語対応

- VR/AR 関連の専門用語辞書の構築
- Resonite 固有の機能名・コンポーネント名の正確な翻訳
- 技術的概念の一般ユーザー向け説明生成

### 9.3 コミュニティ対応

- 活発なコントリビューターの識別
- コミュニティの関心領域の分析
- 開発者とユーザー間のコミュニケーションパターン分析

---

## 付録: GitHub Actions ワークフロー例

```yaml
name: Update Issue Tracker DB

on:
  schedule:
    - cron: '0 */6 * * *'  # 6時間ごとに実行
  workflow_dispatch:  # 手動実行オプション

jobs:
  update-db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: ~/.npm
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-
      - run: npm ci
      - run: npm run update-issues
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          MONGODB_URI: ${{ secrets.MONGODB_URI }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          VECTOR_DB_API_KEY: ${{ secrets.VECTOR_DB_API_KEY }}
```

## 付録: Issue タイプ分類ロジック例

```typescript
function classifyIssueType(issue: Issue): IssueType {
  const labels = issue.labels.map(l => l.toLowerCase());
  
  // バグ関連のラベルチェック
  if (labels.some(l => ['bug', 'defect', 'error', 'crash'].includes(l))) {
    return 'bug';
  }
  
  // 機能要望関連のラベルチェック
  if (labels.some(l => ['feature', 'enhancement', 'request', 'new feature'].includes(l))) {
    return 'feature';
  }
  
  // コンテンツ関連のラベルチェック
  if (labels.some(l => ['content', 'asset', 'avatar', 'world', 'model'].includes(l))) {
    return 'content';
  }
  
  // タイトルと本文のキーワード分析によるフォールバック分類
  const text = `${issue.title} ${issue.body}`.toLowerCase();
  
  if (text.match(/bug|crash|error|broken|doesn't work|issue|problem|fail/)) {
    return 'bug';
  }
  
  if (text.match(/feature|add|enhance|improve|request|would be nice|suggestion/)) {
    return 'feature';
  }
  
  if (text.match(/content|asset|avatar|world|model|texture|material/)) {
    return 'content';
  }
  
  return 'other';
}
