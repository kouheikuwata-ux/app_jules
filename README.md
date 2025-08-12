# VoiceInsight v3.0 Enhanced

「VoiceInsight v3.0 Enhanced」は、AI音声分析を活用した美容師向けのカウンセリングシステムです。
このアプリケーションは、カウンセリング内容を音声で記録し、AIが自動で文字起こしと内容分析を行うことで、カルテ作成の手間を大幅に削減し、より質の高いカウンセリングを実現します。

## 主な機能

- **顧客管理**: 顧客情報の登録・管理
- **音声カウンセリング**:
  - Web Audio APIによる高音質な音声録音
  - リアルタイムでの録音時間表示
  - 録音した音声の再生
- **AIによる自動化**:
  - OpenAI Whisper APIによる高精度な文字起こし
  - OpenAI GPT-4 APIによるカウンセリング内容の構造化分析（要望、髪の状態、提案など）
- **カルテ管理**:
  - 作成したカルテの永続的な保存（SQLite）
  - 写真（Before/After）の関連付け
  - カルテの一覧表示、検索、日付フィルタリング
  - カルテ詳細のPDF出力
- **堅牢なアーキテクチャ**:
  - フロントエンド: React (Vite) + TypeScript + Tailwind CSS + shadcn/ui
  - バックエンド: Flask (Python) + SQLAlchemy
  - APIレート制限によるサーバー保護

## セットアップと実行方法

### 前提条件

- Node.js (v18以降)
- Python (v3.11以降)
- OpenAI APIキー

### 1. リポジトリのクローン

```bash
git clone <repository_url>
cd <repository_name>
```

### 2. バックエンドのセットアップ

```bash
# backendディレクトリに移動
cd backend

# Python仮想環境の作成と有効化
python3 -m venv venv
source venv/bin/activate

# 依存関係のインストール
pip install -r requirements.txt

# 環境変数ファイルの設定
# .env ファイルを作成し、以下の内容を記述してください。
# OPENAI_API_KEY を実際のキーに置き換える必要があります。
# SECRET_KEYは任意のランダムな文字列に変更することを推奨します。
echo "OPENAI_API_KEY=\"YOUR_OPENAI_API_KEY_HERE\"" > .env
echo "SECRET_KEY=\"a_very_secret_random_key_for_flask\"" >> .env
echo "DATABASE_URL=\"sqlite:///../instance/voice_insight.db\"" >> .env

# データベースの初期化
flask --app app init-db

# バックエンドサーバーの起動 (ポート5001で起動します)
flask --app app run --port=5001
```

### 3. フロントエンドのセットアップ

```bash
# (別ターミナルで) frontendディレクトリに移動
cd frontend

# 依存関係のインストール
npm install

# 開発サーバーの起動 (ポート5173で起動します)
npm run dev
```

### 4. アプリケーションへのアクセス

ブラウザで `http://localhost:5173` を開きます。

## データベース

このアプリケーションは、開発用にSQLiteを使用しています。
データベースファイルは `backend/instance/voice_insight.db` に作成されます。
`init-db` コマンドはデータベースを完全にリセットするため、注意して使用してください。
