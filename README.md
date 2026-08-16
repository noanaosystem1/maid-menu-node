# 狂気メイド喫茶 — デジタルメニュー制御システム

React + Cloudflare Workers (静的ホスティング & 認証) + Node.js (Express & WebSockets) + PostgreSQL 搭載版。

## アーキテクチャ

本システムは以下の3層で構成されています。

```
メニュー/
├── wrangler.json       Wrangler 設定ファイル（静的アセット配信 & 管理者ログイン proxy）
├── server/
│   ├── worker.js       Cloudflare Workers 用管理者ログイン API
│   ├── index.js        Node.js (Express & WebSockets) メインサーバー
│   └── db.js           PostgreSQL (pg) 接続および初期化スクリプト
├── src/                React フロントエンド
└── supabase/
    └── schema.sql      PostgreSQL データベース用スキーマ
```

### 各役割の詳細

1. **静的ホスティングフロントエンド（React / Cloudflare Workers）:**
   - フロントエンドのアセットは Vite を使用してビルドされ、Cloudflare Workers (ASSETS) を利用してエッジから高速に配信されます。
   - セキュリティ確保のため、管理者パスワードの検証処理（`POST /api/admin/login`）のみは Cloudflare Worker (`server/worker.js`) 上で動作します。

2. **バックエンドサーバー（Node.js / Express & WebSockets）:**
   - ゲスト情報、テーブル（部屋）、メニューなどのすべての業務ロジック、およびリアルタイム通信の処理を担います。
   - `ws` ライブラリを使用して `/api/ws` 上で WebSocket サーバーをホスト。演出フェーズ（待機中、メニュー閲覧、ハッキング開始、暗転等）の即時ブロードキャストおよびゲストのオンライン状況のミリ秒単位での同期を行います。

3. **データベース（PostgreSQL / Supabase）:**
   - メニュー情報や部屋、ゲストユーザーのデータを管理。
   - テーブルのカスケード削除（部屋を削除した際の紐づくゲストの自動クリーンアップ）やインデックスにより、安定した高速データ操作が保証されます。

---

## 開発環境のセットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、必要な構成に合わせて設定します。

```env
# Node.js サーバー用ポート (デフォルト: 8080)
PORT=8080

# PostgreSQL 接続文字列
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# 管理者パスワード (デフォルト: maid2024)
ADMIN_PASSWORD=maid2024

# フロントエンドからバックエンドへの接続用設定 (Vite ビルド時)
VITE_API_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080/api/ws
```

### 3. 各サーバーの起動

**Node.js バックエンドサーバーの起動:**
```bash
node server/index.js
```

**フロントエンドローカル開発サーバーの起動:**
```bash
npm run dev
```

---

## Supabase (PostgreSQL) セットアップ

Supabase を使用してデータベースを構築・接続する手順については、[SUPABASE.md](SUPABASE.md) をご参照ください。

---

## 本番デプロイ

詳細なデプロイ方法については、[DEPLOY.md](DEPLOY.md) をご参照ください。
