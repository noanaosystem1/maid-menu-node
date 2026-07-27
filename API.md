# 狂気メイド喫茶 — Node.js & PostgreSQL リアルタイム同期 API 仕様書

本システムは、**Node.js (Express & WebSockets)** および **PostgreSQL (Supabase)** を全面採用した、高信頼・リアルタイム分散制御システムです。
データストアのすべての操作が PostgreSQL データベースに対して実行され、WebSocket 接続されたクライアントにリアルタイムに状態変更がブロードキャストされます。

---

## 1. 共通仕様

- **ベース URL**: `http://localhost:8080/api` (ローカル開発時) / `https://<your-backend-domain>/api` (本番時)
- **プロトコル**: HTTPS (REST API) / WSS (WebSocket)
- **Content-Type**: `application/json` (REST API リクエスト/レスポンス)
- **CORS**: すべてのオリジンに対して CORS を許可しています。
  - 許可メソッド: `GET`, `HEAD`, `POST`, `PATCH`, `PUT`, `DELETE`, `OPTIONS`
  - 許可ヘッダー: `Content-Type`, `X-Admin-Password`, `Authorization`
- **管理者認証**:
  - データの更新・削除を行うすべてのミューテーション操作（`POST`, `PATCH`, `DELETE`）、およびクエリパラメータなしのゲスト全件取得には管理者認証が必要です。
  - **認証方法**: リクエストヘッダーに `X-Admin-Password` または `Authorization` を付与し、正しいパスワードを設定してください。
  - **パスワード**: Node.js サーバーの環境変数 `ADMIN_PASSWORD` (デフォルトは `"maid2024"`) と照合されます。
  - **認証失敗時のレスポンス (共通)**:
    - **ステータス**: `401 Unauthorized`
    - **ボディ**:
      ```json
      { "error": "Unauthorized access" }
      ```

---

## 2. 外部連携・アトミック統合 API (最重要)

### 2.1 部屋作成 ＆ ユーザー追加 ＆ 招待URL自動発行（アトミック統合 API）

外部システムから1回リクエストを送信するだけで、裏側で「部屋の作成」「複数ゲストの登録（UUID、一意トークン発行）」「各ゲスト専用アクセスURL」の生成・アタッチを1プロセスで行い、全レスポンスを返却します。
外部API連携による省エネに完全最適化されています。

- **メソッド / パス**: `POST /api/rooms-with-guests`
- **認証**: 必要 (`X-Admin-Password` または `Authorization` ヘッダー)
- **リクエスト Body (JSON)**:
  ```json
  {
    "roomName": "ロイヤルルーム S",
    "guests": ["アリス", "ボブ", "キャロル"]
  }
  ```
  - `roomName` (string, 必須): 新規作成するルームの表示名。
  - `guests` (array of strings, 任意): 自動登録したいお客様のニックネームの配列。

- **成功レスポンス 201 (Created)**:
  ```json
  {
    "ok": true,
    "room": {
      "id": "e81d898a-ea84-486a-bc3f-7e8cc34493a7",
      "name": "ロイヤルルーム S",
      "phase": "WAITING",
      "created_date": "2026-07-12T05:14:32.100Z"
    },
    "guests": [
      {
        "id": "0df81e11-be84-4054-9eb5-827878df8cc1",
        "name": "アリス",
        "roomId": "e81d898a-ea84-486a-bc3f-7e8cc34493a7",
        "sessionToken": "4bb9f2cc-660c-402a-a9f8-b394df8bcfa1",
        "isActive": true,
        "isOnline": false,
        "lastSeen": null,
        "created_date": "2026-07-12T05:14:32.100Z",
        "guestUrl": "http://localhost:8787/guest?token=4bb9f2cc-660c-402a-a9f8-b394df8bcfa1"
      },
      {
        "id": "99ea78fa-d0ef-4df1-be78-bc4bbd0f8bc5",
        "name": "ボブ",
        "roomId": "e81d898a-ea84-486a-bc3f-7e8cc34493a7",
        "sessionToken": "11bc7c6d-cfbc-4cbf-a0ef-1122c3344ffa",
        "isActive": true,
        "isOnline": false,
        "lastSeen": null,
        "created_date": "2026-07-12T05:14:32.100Z",
        "guestUrl": "http://localhost:8787/guest?token=11bc7c6d-cfbc-4cbf-a0ef-1122c3344ffa"
      }
    ]
  }
  ```
  *(※ guests 配列内の各要素に、そのままユーザーがブラウザで開けばアクセスできる完全URL guestUrl が紐づけられた状態で返却されます。)*

- **失敗レスポンス 400 (Bad Request)**:
  `roomName` が指定されていない場合。
  ```json
  { "error": "roomName is required" }
  ```

---

## 3. WebSocket リアルタイム接続 API (`/api/ws`)

クライアント（ゲスト画面、管理画面等）がリアルタイム同期を行うための双方向通信エンドポイントです。

- **メソッド**: `GET` (HTTP Upgrade)
- **パス**: `/api/ws`
- **認証**: 不要（一般公開）
- **クエリパラメータ**:
  - `roomId` (string, **必須**): 接続先となるルームのID。指定しない場合は `400 Bad Request` となります。
  - `guestId` (string, 任意): 接続するゲストのID。指定すると、接続開始時に自動的にデータベースの `is_online` が `true` に更新され、切断時には自動的に `false` に戻ります。

---

## 4. Rooms API (ルーム・テーブル管理)

### 4.1 ルーム一覧取得
登録されているルームの一覧情報を降順（作成日順）で全件取得します。

- **メソッド / パス**: `GET /api/rooms`
- **認証**: 不要（一般公開）
- **成功レスポンス 200 (OK)**:
  ```json
  [
    {
      "id": "96ca036a-222c-4396-b0bd-2050fd8c1987",
      "name": "テーブルA",
      "phase": "WAITING",
      "created_date": "2026-07-10T14:56:02.130Z"
    }
  ]
  ```

---

### 4.2 ルーム新規作成（疎結合 API）
外部システム等から新しくルーム（座席・テーブル）を単体で登録し、自動生成されたルームの UUID を返却します。 この UUID を使うことで、後から `POST /api/guests` 経由でゲストを紐づけて個別登録することができます。

- **メソッド / パス**: `POST /api/rooms`
- **認証**: 必要 (`X-Admin-Password` または `Authorization` ヘッダー)
- **リクエスト Body (JSON)**:
  ```json
  {
    "name": "テーブルA"
  }
  ```
  - `name` (string, 必須): 新規作成するルーム名。
  - `id` (string, 任意): ルームのUUID。未指定時はセキュアな UUIDv4 が自動生成されます。
  - `phase` (string, 任意): ルームの初期演出フェーズ（未指定時はデフォルトで WAITING が割り当てられます）。

- **成功レスポンス 201 (Created)**:
  ```json
  {
    "id": "96ca036a-222c-4396-b0bd-2050fd8c1987",
    "name": "テーブルA",
    "phase": "WAITING",
    "created_date": "2026-07-11T02:15:30.123Z"
  }
  ```

---

### 4.3 ルーム詳細取得
指定した ID のルーム詳細情報を取得します。

- **メソッド / パス**: `GET /api/rooms/:id`
- **認証**: 不要（一般公開）
- **成功レスポンス 200 (OK)**:
  ```json
  {
    "id": "96ca036a-222c-4396-b0bd-2050fd8c1987",
    "name": "テーブルA",
    "phase": "WAITING",
    "created_date": "2026-07-10T14:56:02.130Z"
  }
  ```

---

### 4.4 ルーム情報の更新（フェーズ変更等）
指定したルームの名前や進行フェーズを更新します。

- **メソッド / パス**: `PATCH /api/rooms/:id`
- **認証**: 必要 (`X-Admin-Password` or `Authorization`)
- **リクエスト Body (JSON)**:
  ```json
  {
    "name": "新テーブルA",
    "phase": "HACKING"
  }
  ```
- **成功レスポンス 200 (OK)**:
  ```json
  {
    "id": "96ca036a-222c-4396-b0bd-2050fd8c1987",
    "name": "新テーブルA",
    "phase": "HACKING",
    "created_date": "2026-07-10T14:56:02.130Z"
  }
  ```

---

### 4.5 ルーム削除
指定したルームを削除します。ルームに紐づくすべてのゲスト（`guest_users`）も、カスケード的に自動削除されます。

- **メソッド / パス**: `DELETE /api/rooms/:id`
- **認証**: 必要 (`X-Admin-Password` or `Authorization`)
- **成功レスポンス 204 (No Content)**:
  - ボディなし（空文字）

---

## 5. Guests API (ゲスト管理)

### 5.1 ゲスト一覧取得
登録されているゲスト情報を取得します。

- **メソッド / パス**: `GET /api/guests`
- **クエリパラメータ (任意)**:
  - `roomId=<id>`: 特定のルームに所属しているゲストのみを抽出します。(**認証不要**)
  - `sessionToken=<token>`: 招待リンクのトークンに紐づく特定の1名を抽出します。(**認証不要**)
- **認証仕様**:
  - `roomId` または `sessionToken` が**指定されている場合**: **認証不要（一般公開）**
  - パラメータなしで**全件リストを取得する場合**: **管理者認証が必要** (`X-Admin-Password`)
- **成功レスポンス 200 (OK)**:
  ```json
  [
    {
      "id": "b8f8e6f1-33f6-4fe0-bdbe-f9d9bf2a396c",
      "name": "さくら",
      "roomId": "96ca036a-222c-4396-b0bd-2050fd8c1987",
      "sessionToken": "token-abc-123",
      "isActive": true,
      "isOnline": true,
      "lastSeen": "2026-07-10T14:57:37.592Z",
      "created_date": "2026-07-10T14:56:36.728Z"
    }
  ]
  ```

---

### 5.2 ゲスト登録（招待リンク発行用）
新しくルームにお客様を登録（招待リンク発行用情報の作成）します。

- **メソッド / パス**: `POST /api/guests`
- **認証**: 必要 (`X-Admin-Password` or `Authorization`)
- **リクエスト Body (JSON)**:
  ```json
  {
    "id": "b8f8e6f1-33f6-4fe0-bdbe-f9d9bf2a396c",
    "name": "さくら",
    "roomId": "96ca036a-222c-4396-b0bd-2050fd8c1987",
    "sessionToken": "token-abc-123",
    "isActive": true,
    "isOnline": false
  }
  ```
- **成功レスポンス 201 (Created)**:
  ```json
  {
    "id": "b8f8e6f1-33f6-4fe0-bdbe-f9d9bf2a396c",
    "name": "さくら",
    "roomId": "96ca036a-222c-4396-b0bd-2050fd8c1987",
    "sessionToken": "token-abc-123",
    "isActive": true,
    "isOnline": false,
    "lastSeen": null,
    "created_date": "2026-07-10T14:56:36.728Z"
  }
  ```

---

### 5.3 ゲスト情報の更新
ゲスト情報（名前、ルームID、有効フラグ、オンライン状態など）を更新します。

- **メソッド / パス**: `PATCH /api/guests/:id`
- **認証**: 必要 (`X-Admin-Password` or `Authorization`、もしくは匿名自己更新用)
- **成功レスポンス 200 (OK)**:
  ```json
  {
    "id": "b8f8e6f1-33f6-4fe0-bdbe-f9d9bf2a396c",
    "name": "さくら改",
    "roomId": "96ca036a-222c-4396-b0bd-2050fd8c1987",
    "sessionToken": "token-new-456",
    "isActive": true,
    "isOnline": true,
    "lastSeen": "2026-07-10T15:20:00.000Z",
    "created_date": "2026-07-10T14:56:36.728Z"
  }
  ```

---

### 5.4 ゲスト削除
ゲスト情報をデータベースから完全に削除します。

- **メソッド / パス**: `DELETE /api/guests/:id`
- **認証**: 必要 (`X-Admin-Password` or `Authorization`)
- **成功レスポンス 204 (No Content)**:
  - ボディなし（空文字）

---

## 6. Menu Items API (メニュー管理)

### 6.1 メニュー一覧取得
登録されているすべてのメニュー項目を取得します。

- **メソッド / パス**: `GET /api/menu-items?limit=100`
- **認証**: 不要（一般公開）
- **成功レスポンス 200 (OK)**:
  ```json
  [
    {
      "id": "1",
      "name": "オムライス♡",
      "price": 980,
      "category": "food",
      "description": "ふわとろ卵の王道メニュー",
      "imageUrl": null,
      "order": 0,
      "created_date": "2026-07-10T14:53:31.000Z"
    }
  ]
  ```

---

### 6.2 メニュー項目追加
新しくメニュー項目を追加します。

- **メソッド / パス**: `POST /api/menu-items`
- **認証**: 必要 (`X-Admin-Password` or `Authorization`)
- **成功レスポンス 201 (Created)**:
  ```json
  {
    "id": "1",
    "name": "萌え萌えハンバーグ",
    "price": 1280,
    "category": "food",
    "description": "デミグラスたっぷり",
    "imageUrl": "https://example.com/hamburg.jpg",
    "order": 1,
    "created_date": "2026-07-11T03:00:00.000Z"
  }
  ```

---

### 6.3 メニュー項目更新
既存のメニュー項目を更新します。

- **メソッド / パス**: `PATCH /api/menu-items/:id`
- **認証**: 必要 (`X-Admin-Password` or `Authorization`)
- **成功レスポンス 200 (OK)**:
  ```json
  {
    "id": "1",
    "name": "萌え萌えハンバーグ",
    "price": 1380,
    "category": "food",
    "description": "特製デミグラスをたっぷりかけた王道ハンバーグ",
    "imageUrl": "https://example.com/hamburg.jpg",
    "order": 1,
    "created_date": "2026-07-11T03:00:00.000Z"
  }
  ```

---

### 6.4 メニュー項目削除
指定されたメニュー項目を削除します。

- **メソッド / パス**: `DELETE /api/menu-items/:id`
- **認証**: 必要 (`X-Admin-Password` or `Authorization`)
- **成功レスポンス 204 (No Content)**:
  - ボディなし（空文字）

---

## 7. Health API (状態確認)

- **メソッド / パス**: `GET /api/health`
- **認証**: 不要（一般公開）
- **成功レスポンス 200 (OK)**:
  ```json
  {
    "ok": true,
    "database": "postgresql"
  }
  ```
