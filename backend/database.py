import sqlite3
import os

# プロジェクトのルートを基準に instance フォルダとデータベースパスを構築
INSTANCE_FOLDER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'instance')
DATABASE_URL = os.path.join(INSTANCE_FOLDER_PATH, "voice_insight.db")

def get_db_connection():
    """データベース接続を取得します。接続前に instance フォルダの存在を確認します。"""
    os.makedirs(INSTANCE_FOLDER_PATH, exist_ok=True)
    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """データベースを初期化し、テーブルを作成します。"""
    # フォルダの存在確認は get_db_connection で行われる
    conn = get_db_connection()
    cursor = conn.cursor()

    # cartesテーブルが存在しない場合に作成
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cartes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_name_kana TEXT,
        phone_number TEXT,
        email TEXT,
        counseling_content TEXT,
        ai_analysis TEXT,
        photos TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # updated_atを自動更新するためのトリガーを作成
    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS update_cartes_updated_at
    AFTER UPDATE ON cartes
    FOR EACH ROW
    BEGIN
        UPDATE cartes SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
    """)

    conn.commit()
    conn.close()
