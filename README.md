# VoiceInsight v3.0 Enhanced

これは、AI音声分析を搭載した美容師向けカウンセリングシステムです。
This is a counseling system for hair stylists, equipped with AI voice analysis.

## プロジェクト構造

- `/backend`: Flaskバックエンドサーバー (API)
- `/frontend`: React (Vite) フロントエンドアプリケーション (UI)

## セットアップと実行方法

### Dockerを使った推奨セットアップ

これが最も簡単で推奨される実行方法です。

1.  **DockerとDocker Composeをインストールします。**

2.  **環境変数を設定します:**
    - `backend/.env.example` を `backend/.env` にコピーします。
    - `backend/.env` ファイルを開き、`SECRET_KEY`とあなたの`OPENAI_API_KEY`を設定します。
      - `SECRET_KEY`は `python backend/generate_key.py` を実行して生成できます。

3.  **Dockerコンテナをビルドして起動します:**
    - リポジトリのルートディレクトリで以下のコマンドを実行します。
    ```bash
    docker-compose up --build
    ```
    - 初回起動には数分かかることがあります。

4.  **アプリケーションへのアクセス:**
    - ブラウザで `http://localhost:5173` を開きます。

5.  **アプリケーションの停止:**
    ```bash
    docker-compose down
    ```

---

### 手動セットアップ（開発者向け）

### 1. 前提条件

- Node.js (v18以降推奨)
- Python (3.10以降推奨)
- `pip` と `venv`

### 2. バックエンドのセットアップ

1.  **リポジトリのルートで、バックエンド用の仮想環境を作成・有効化します:**
    ```bash
    python3 -m venv backend/venv
    source backend/venv/bin/activate
    ```

2.  **必要なPythonパッケージをインストールします:**
    ```bash
    pip install -r backend/requirements.txt
    ```

3.  **環境変数を設定します:**
    - `backend/.env.example` を `backend/.env` にコピーします。
    - `backend/.env` ファイルを開き、あなたのOpenAI APIキーを設定します。
      ```
      OPENAI_API_KEY="sk-..."
      ```

4.  **データベースを初期化します:**
    - このコマンドは、`backend` ディレクトリに `voice_insight.db` というSQLiteデータベースファイルを作成します。
    ```bash
    python3 backend/database.py
    ```

5.  **バックエンドサーバーを起動します:**
    - サーバーは `http://localhost:5000` で起動します。
    ```bash
    python3 backend/app.py
    ```

### 3. フロントエンドのセットアップ

1.  **リポジトリのルートで、フロントエンドの依存関係をインストールします:**
    - このコマンドは `frontend` ディレクトリの `package.json` を参照してパッケージをインストールします。
    ```bash
    npm install --prefix ./frontend
    ```

2.  **フロントエンド開発サーバーを起動します:**
    - サーバーは `http://localhost:5173` で起動し、ブラウザで自動的に開かれます。
    ```bash
    npm run dev --prefix ./frontend
    ```

### 4. アプリケーションへのアクセス

- バックエンドとフロントエンドの両方のサーバーが起動したら、ブラウザで `http://localhost:5173` を開きます。

## 主な技術スタック

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend:** Flask, Python, SQLite
- **AI:** OpenAI (Whisper, GPT-4)
- **APIs:** Web Speech API, MediaRecorder API
