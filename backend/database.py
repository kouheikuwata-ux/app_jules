import os
import psycopg2
from psycopg2.extras import DictCursor

def get_db_connection():
    """
    Establishes a connection to the PostgreSQL database using the DATABASE_URL
    environment variable.
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set.")

    conn = psycopg2.connect(database_url)
    return conn

def init_db():
    """
    Initializes the database by creating the 'cartes' table if it doesn't exist.
    This version is for PostgreSQL.
    """
    conn = get_db_connection()
    with conn.cursor(cursor_factory=DictCursor) as cur:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS cartes (
            id SERIAL PRIMARY KEY,
            customer_name VARCHAR(255) NOT NULL,
            customer_name_kana VARCHAR(255),
            phone_number TEXT,
            email TEXT,
            counseling_content TEXT,
            ai_analysis JSONB,
            photos JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """)

        cur.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.updated_at = NOW();
           RETURN NEW;
        END;
        $$ language 'plpgsql';
        """)

        cur.execute("""
        DROP TRIGGER IF EXISTS update_cartes_updated_at ON cartes;
        CREATE TRIGGER update_cartes_updated_at
        BEFORE UPDATE ON cartes
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
        """)

    conn.commit()
    conn.close()
