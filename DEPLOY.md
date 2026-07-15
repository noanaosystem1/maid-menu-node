# 狂気メイド喫茶 — デプロイ・設定マニュアル

本システムを 3-Tier アーキテクチャ（フロントエンド、Node.jsバックエンド、PostgreSQLデータベース）で本番デプロイ・設定するための手順を解説します。

---

## 1. 静的フロントエンド（Cloudflare Workers / Pages）のデプロイ

フロントエンドコードを Cloudflare にデプロイし、最速でアセットを世界中のエッジから配信します。

### CLI を用いたデプロイ手順

1. **Vite フロントエンドのビルド:**
   ```bash
   npm run build
   ```
   ビルド完了後、`dist` ディレクトリにコンパイル済みの静的アセットと、軽量化された Cloudflare Worker (`dist/_worker.js` または `dist/worker.js`) が出力されます。

2. **Cloudflare へのデプロイ:**
   ```bash
   npx wrangler deploy
   ```
   これにより、静的ファイルの配信とともに、管理者ログイン機能（`POST /api/admin/login`）をホストする Worker が同時に Cloudflare にデプロイされます。

3. **環境変数（Wrangler / Cloudflare ダッシュボード）の設定:**
   Cloudflare のダッシュボードまたは CLI を用いて、管理者ログイン用のパスワードを設定します：
   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   ```

---

## 2. バックエンドサーバー（Node.js / Express & WebSockets）のデプロイ

Node.js アプリケーションをホストできる PaaS（Render, Fly.io, Heroku, AWS ECS など）へデプロイします。

### 各環境での設定手順例 (例: Render)

1. **新規 Web Service の作成:**
   Render などのコンソールでリポジトリを連携し、新規 Web Service を作成します。
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`

2. **環境変数の構成 (Environment Variables):**
   - `PORT`: サービスがリッスンするポート（PaaSの環境に応じて自動設定される、もしくは `8080`）
   - `DATABASE_URL`: PostgreSQL データベースへの接続文字列
   - `ADMIN_PASSWORD`: 管理者ログインパスワード (例: `maid2024`)

---

## 3. PostgreSQL データベース（Supabase などのクラウドサービス）の設定

### データベースセットアップ手順

1. **データベースインスタンスの作成:**
   Supabase または AWS RDS 等で PostgreSQL データベースを作成し、接続用文字列を取得します。

2. **スキーマの適用:**
   `supabase/schema.sql` に定義されている SQL スクリプトを SQL エディタまたはマイグレーションコマンド等を利用して適用します。

   このスキーマの実行により、以下のテーブルとインデックスが自動的に構成されます：
   - `rooms` (座席/テーブル)
   - `guest_users` (お客様セッション)
   - `menu_items` (メニュー)
   - `idx_guest_users_room_id` などのパフォーマンス最適化インデックス
