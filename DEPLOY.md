# 狂気メイド喫茶 — デプロイ・設定マニュアル

本システムを 3-Tier アーキテクチャ（フロントエンド、Node.jsバックエンド、PostgreSQLデータベース）で本番デプロイ・設定するための詳細手順を解説します。
コマンドラインを用いたデプロイに加え、**「Cloudflare ダッシュボード（管理画面）から完全コマンド不要でデプロイ・構成する手順」**、および**「APIサーバーとデータベースの詳細な接続設定方法」**を徹底解説します。

---

## 1. 静的フロントエンド（Cloudflare Workers / Pages）のデプロイ

### 1.1 Cloudflare ダッシュボード上で直接デプロイする方法（完全コマンド不要）

GitHub 連携（Workers Builds）を利用し、Cloudflare のダッシュボード（管理画面）の操作だけで、リポジトリのデプロイ、および環境変数の設定までをすべて完結できます。

#### ステップ 1: GitHub へのリポジトリプッシュ
本ソースコードをお手持ちの GitHub アカウントのリポジトリにプッシュまたはインポートしておきます。

#### ステップ 2: Workers & Pages でプロジェクトを作成
1. [Cloudflare 管理画面](https://dash.cloudflare.com)にログインします。
2. 左メニューから **「Workers & Pages（Worker と Pages）」** をクリックします。
3. 画面右上の **「Create application（アプリケーションの作成）」** ボタンをクリックします。
4. **「Workers」** タブにある **「Deploy from Git（Git からデプロイ）」** または **「Connect to Git」** を選択します。
5. ご自身の GitHub アカウントと連携し、該当のリポジトリを選択して **「Begin setup（セットアップの開始）」** をクリックします。

#### ステップ 3: ビルド設定およびフロントエンド環境変数の指定
ビルド構成画面にて、以下のように設定を行います：
- **Project name（プロジェクト名）**: 任意のプロジェクト名（例: `maid-cafe-menu`）を入力
- **Production branch（本番ブランチ）**: デプロイ元とするブランチ名（例: `main`）
- **Build command（ビルドコマンド）**: **`npm run build`** を指定
  *(※ Viteビルドが走り、静的ファイルと一緒に管理者認証用 `_worker.js` が `./dist` 出力先に用意されます)*
- **環境変数（Vite用）の指定**:
  ビルド時にフロントエンドに埋め込むバックエンドAPIサーバーおよびWebSocketサーバーへの接続URLを指定するため、ダッシュボード上の **「Environment Variables (Environment variables in build step)」** に以下を追加します。
  - **`VITE_API_URL`**: `https://<あなたのNode.jsサーバードメイン>/api`
  - **`VITE_WS_URL`**: `wss://<あなたのNode.jsサーバードメイン>/api/ws`
- 設定完了後、**「Save and deploy（保存してデプロイ）」** をクリックします。

#### ステップ 4: 管理者認証用環境変数 `ADMIN_PASSWORD` の設定
ダッシュボードから、ログイン時に使用する管理者パスワード（デフォルト: `maid2024`）を設定します。
1. デプロイ完了後、作成した Worker の詳細画面を開きます。
2. 上部タブの **「Settings（設定）」** -> **「Variables（変数）」** タブを開きます。
3. **「Environment Variables（環境変数）」** セクションで **「Add variable（変数の追加）」** をクリックします。
   - **Variable name（変数名）**: **`ADMIN_PASSWORD`**
   - **Value（値）**: 任意の管理者パスワード（例: `my_secure_maid_password_2026`）
4. **「Save and deploy（保存してデプロイ）」** をクリックして設定を保存します。これにより、次回以降のビルドまたは再デプロイで、新しい管理者パスワードが適用された認証プロキシが稼働します。

---

### 1.2 CLI（コマンドライン）を用いた超高速デプロイ方法

開発用 PC などのターミナルから、コマンドだけで一気にビルドからデプロイまでを完了させる方法です。

1. **環境変数の定義:**
   プロジェクトルートに `.env.production` などを配置するか、ビルド実行コマンドにインラインで環境変数を渡します。
   ```bash
   VITE_API_URL=https://<あなたのNode.jsサーバードメイン>/api VITE_WS_URL=wss://<あなたのNode.jsサーバードメイン>/api/ws npm run build
   ```

2. **Cloudflare へのデプロイ:**
   ```bash
   npx wrangler deploy
   ```

3. **本番環境の管理者パスワードの追加:**
   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   ```

---

## 2. バックエンドサーバー（Node.js / Express & WebSockets）のデプロイ

Node.js アプリケーションをホストできる任意の PaaS（Render, Fly.io, Heroku, AWS ECS, 自社VPSなど）へデプロイします。

### 2.1 PaaS での設定・デプロイ手順例 (例: Render)

1. **新規 Web Service の作成:**
   Render などのコンソールでリポジトリを連携し、新規 Web Service を作成します。
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`

2. **環境変数の構成 (Environment Variables):**
   ダッシュボード上の設定画面で以下の環境変数を定義します：
   - **`PORT`**: `8080` (またはデプロイ先環境に合わせる)
   - **`DATABASE_URL`**: PostgreSQL データベースへの接続文字列 *(詳細は下記 3.2 参照)*
   - **`ADMIN_PASSWORD`**: Cloudflare Worker と同期させた、同一の管理者パスワード

---

## 3. PostgreSQL データベース（Supabase などのクラウドサービス）の設定

### 3.1 データベースセットアップ手順

1. **データベースインスタンスの作成:**
   Supabase などの PostgreSQL データベースサービスにログインし、新しいプロジェクト/データベースを作成します。

2. **スキーマの適用:**
   `supabase/schema.sql` に定義されている SQL スクリプトを SQL エディタで実行して適用します。これにより、すべてのテーブル（Rooms, GuestUsers, MenuItems）と、カスケード削除・高速インデックスが作成されます。

### 3.2 接続用接続文字列（DATABASE_URL）の書き方

Node.js サーバーから PostgreSQL へのセキュアなアクセスを確立するため、以下のフォーマットの接続文字列を `DATABASE_URL` 環境変数として登録します。

```env
DATABASE_URL=postgresql://[ユーザー名]:[パスワード]@[ホスト名]:[ポート番号]/[データベース名]?sslmode=require
```

**Supabase での取得例:**
- Supabase ダッシュボード -> Project Settings -> Database -> Connection string から `URI`（Node.js 接続用）をコピーしてパスワード部分を実際のデータベースパスワードに置き換えて使用します。
