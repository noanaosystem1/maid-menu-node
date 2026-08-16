# Supabase 連携・セットアップ手順書

本システム（狂気メイド喫茶 デジタルメニュー制御システム）で PostgreSQL データベースとして **Supabase** を利用するための詳細ガイドです。

---

## 1. Supabase プロジェクトの作成

1. [Supabase 公式サイト](https://supabase.com/) にアクセスし、ログインします。
2. **「New Project」** ボタンをクリックし、新しいプロジェクトを作成します。
   - **Name**: 例 `maid-cafe-menu`
   - **Database Password**: 強固なパスワードを設定（※忘れないようにメモしてください）
   - **Region**: 日本に最も近い `Tokyo (ap-northeast-1)` などに設定

---

## 2. データベーススキーマ（テーブル構造）の適用

Supabase のダッシュボードから、本システムに必要なテーブル群（Rooms, GuestUsers, MenuItems）を作成します。

1. Supabase 左側のサイドメニューから **「SQL Editor」**（`>/_` アイコン）を選択します。
2. **「New query」** をクリックします。
3. リポジトリ内の `supabase/schema.sql` の内容をコピー＆ペーストして、右下の **「Run」** ボタンをクリックして実行します。

```sql
-- supabase/schema.sql の内容

CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(255) PRIMARY KEY,
  name TEXT NOT NULL,
  phase VARCHAR(50) NOT NULL DEFAULT 'WAITING',
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guest_users (
  id VARCHAR(255) PRIMARY KEY,
  name TEXT NOT NULL,
  room_id VARCHAR(255) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen TIMESTAMPTZ,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(255) PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  category VARCHAR(100) NOT NULL DEFAULT 'food',
  description TEXT,
  image_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_users_room_id ON guest_users(room_id);
CREATE INDEX IF NOT EXISTS idx_guest_users_session_token ON guest_users(session_token);
CREATE INDEX IF NOT EXISTS idx_menu_items_order ON menu_items(order_index);
```

4. （任意）デモ用の初期メニューデータを投入したい場合は、`supabase/seed.sql` の内容も同様に SQL Editor で実行します。

---

## 3. 接続文字列（DATABASE_URL）の取得と環境変数設定

Node.js バックエンドサーバーが Supabase の PostgreSQL に接続するための接続文字列を設定します。

### 3.1 接続文字列の取得方法

1. Supabase ダッシュボードで **Project Settings** (歯車アイコン) -> **Database** を開きます。
2. **Connection string** セクションで **URI** (Node.js 用) タブを選択します。
3. コピーした接続文字列内の `[YOUR-PASSWORD]` を、プロジェクト作成時に設定したデータベースパスワードに置き換えます。

```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### 3.2 サーバー側環境変数への設定

#### ローカル開発時 (`.env`)
プロジェクトルートの `.env` ファイルに記述します。

```env
PORT=8080
ADMIN_PASSWORD=maid2024
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

#### 本番環境（Render / Fly.io / VPS 等）
ホスティングサービスの環境変数設定画面で `DATABASE_URL` として上記の URI を登録してください。

---

## 4. 接続動作の確認

Node.js サーバーを起動します。

```bash
node server/index.js
```

ログに以下のように表示されれば、Supabase への正常な接続およびスキーマ初期化が完了しています。

```
[Database] Initializing PostgreSQL schemas...
[Database] PostgreSQL schemas initialized successfully.
[Server] Node.js backend active and listening on port 8080
```

ヘルスチェックエンドポイント (`GET /api/health`) にアクセスすると確認できます：

```json
{
  "ok": true,
  "database": "postgresql"
}
```
