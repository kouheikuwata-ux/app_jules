import os
import json
import openai
import click
import boto3
from botocore.exceptions import NoCredentialsError
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
from database import get_db_connection, init_db
from psycopg2.extras import DictCursor
from werkzeug.utils import secure_filename
import logging
from crypto_utils import encrypt, decrypt

# ロギング設定
logging.basicConfig(level=logging.INFO)

# .envファイルから環境変数を読み込む
load_dotenv()

# OpenAIクライアントの初期化
try:
    openai.api_key = os.getenv("OPENAI_API_KEY")
    if not openai.api_key or openai.api_key == "YOUR_OPENAI_API_KEY_HERE":
        raise ValueError("OPENAI_API_KEY not found or not set in .env file")
    client = openai.OpenAI()
except Exception as e:
    logging.error(f"Failed to initialize OpenAI client: {e}")
    client = None

app = Flask(__name__)

# --- レート制限の設定 ---
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)

# アップロード用の一時フォルダ (音声分析用)
UPLOAD_FOLDER = 'temp_uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


# CORS設定: フロントエンドのオリジンを許可する
CORS(app, resources={r"/api/*": {"origins": "*"}}) # Allow all for containerized env

# Helper function to process carte data for response
def process_carte_for_response(carte_row):
    if not carte_row:
        return None
    carte = dict(carte_row)
    carte['phone_number'] = decrypt(carte.get('phone_number', ''))
    carte['email'] = decrypt(carte.get('email', ''))
    # JSONB is automatically parsed by psycopg2, so no need for json.loads
    return carte

# --- S3 Photo Upload API ---
@app.route('/api/photos/upload', methods=['POST'])
@limiter.limit("60 per minute")
def upload_photo_to_s3():
    S3_BUCKET = os.getenv("S3_BUCKET")
    S3_REGION = os.getenv("S3_REGION")

    if not all([S3_BUCKET, S3_REGION]):
        return jsonify({"error": "S3 configuration is missing in environment variables."}), 500

    if 'photo' not in request.files:
        return jsonify({"error": "No photo file part"}), 400
    file = request.files['photo']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    s3_client = boto3.client("s3")

    try:
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = secure_filename(f"{timestamp}_{file.filename}")

        s3_client.upload_fileobj(
            file,
            S3_BUCKET,
            filename,
            ExtraArgs={'ContentType': file.content_type, 'ACL': 'public-read'}
        )

        photo_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{filename}"
        return jsonify({"url": photo_url}), 201

    except NoCredentialsError:
        return jsonify({"error": "AWS credentials not available."}), 500
    except Exception as e:
        logging.error(f"S3 Upload Error: {e}")
        return jsonify({"error": "Failed to upload to S3"}), 500


# --- AI Analysis API ---
@app.route('/api/v2/analyze-audio', methods=['POST'])
@limiter.limit("10 per hour")
def analyze_audio():
    # (This function remains largely the same as it doesn't interact with the main DB)
    if not client:
        return jsonify({"error": "OpenAI client is not initialized"}), 500
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file part"}), 400
    file = request.files['audio']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    filepath = None
    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        with open(filepath, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(model="whisper-1", file=audio_file)
        transcript_text = transcription.text
        system_prompt = "..." # Omitted for brevity
        completion = client.chat.completions.create(
            model="gpt-4-turbo",
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": transcript_text}]
        )
        analysis_result = json.loads(completion.choices[0].message.content)
        response_data = {"transcription": transcript_text, "analysis": analysis_result}
        return jsonify(response_data)
    except openai.APIError as e:
        return jsonify({"error": f"OpenAI API Error: {e}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if filepath and os.path.exists(filepath):
            os.remove(filepath)


# --- カルテ (Carte) CRUD API ---
@app.route('/api/cartes', methods=['POST'])
def create_carte():
    data = request.get_json()
    if not data or not data.get('customer_name'):
        return jsonify({"error": "Missing required field: customer_name"}), 400

    sql = """
        INSERT INTO cartes (customer_name, customer_name_kana, phone_number, email, counseling_content, ai_analysis, photos)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id;
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(sql, (
                data.get('customer_name'), data.get('customer_name_kana'),
                encrypt(data.get('phone_number', '')), encrypt(data.get('email', '')),
                data.get('counseling_content'),
                json.dumps(data.get('ai_analysis')) if data.get('ai_analysis') else None,
                json.dumps(data.get('photos', []))
            ))
            new_id = cur.fetchone()['id']
            conn.commit()
            cur.execute('SELECT * FROM cartes WHERE id = %s', (new_id,))
            new_carte_row = cur.fetchone()
    finally:
        conn.close()
    return jsonify(process_carte_for_response(new_carte_row)), 201

@app.route('/api/cartes', methods=['GET'])
def get_all_cartes():
    query = request.args.get('q', '')
    start_date = request.args.get('startDate')
    end_date = request.args.get('endDate')
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            sql_query = 'SELECT * FROM cartes'
            params = []
            conditions = []
            if query:
                conditions.append('(customer_name LIKE %s OR customer_name_kana LIKE %s)')
                params.extend([f'%{query}%', f'%{query}%'])
            if start_date:
                conditions.append('created_at >= %s')
                params.append(start_date)
            if end_date:
                conditions.append('created_at <= %s')
                params.append(f'{end_date} 23:59:59')
            if conditions:
                sql_query += ' WHERE ' + ' AND '.join(conditions)
            sql_query += ' ORDER BY created_at DESC'
            cur.execute(sql_query, tuple(params))
            cartes_rows = cur.fetchall()
    finally:
        conn.close()
    cartes = [process_carte_for_response(row) for row in cartes_rows]
    return jsonify(cartes)

@app.route('/api/cartes/<int:carte_id>', methods=['GET'])
def get_carte(carte_id):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute('SELECT * FROM cartes WHERE id = %s', (carte_id,))
            carte_row = cur.fetchone()
    finally:
        conn.close()
    if carte_row is None:
        return jsonify({"error": "Carte not found"}), 404
    return jsonify(process_carte_for_response(carte_row))

@app.route('/api/cartes/<int:carte_id>', methods=['PUT'])
def update_carte(carte_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid data"}), 400
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute('SELECT id FROM cartes WHERE id = %s', (carte_id,))
            if cur.fetchone() is None:
                return jsonify({"error": "Carte not found"}), 404
            fields_to_update = []
            values = []
            for key, value in data.items():
                if key in ['customer_name', 'customer_name_kana', 'counseling_content']:
                    fields_to_update.append(f"{key} = %s")
                    values.append(value)
                elif key in ['ai_analysis', 'photos']:
                    fields_to_update.append(f"{key} = %s")
                    values.append(json.dumps(value))
                elif key in ['phone_number', 'email']:
                    fields_to_update.append(f"{key} = %s")
                    values.append(encrypt(value))
            if not fields_to_update:
                return jsonify({"error": "No fields to update"}), 400
            values.append(carte_id)
            query = f"UPDATE cartes SET {', '.join(fields_to_update)} WHERE id = %s"
            cur.execute(query, tuple(values))
            conn.commit()
            cur.execute('SELECT * FROM cartes WHERE id = %s', (carte_id,))
            updated_carte_row = cur.fetchone()
    finally:
        conn.close()
    return jsonify(process_carte_for_response(updated_carte_row))

@app.route('/api/cartes/<int:carte_id>', methods=['DELETE'])
def delete_carte(carte_id):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute('SELECT id FROM cartes WHERE id = %s', (carte_id,))
            if cur.fetchone() is None:
                return jsonify({"error": "Carte not found"}), 404
            cur.execute('DELETE FROM cartes WHERE id = %s', (carte_id,))
            conn.commit()
    finally:
        conn.close()
    return jsonify({"message": "Carte deleted successfully"}), 200


# --- Statistics API ---
@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    stats = {}
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            # 1. Total number of cartes
            cur.execute("SELECT COUNT(*) as total_cartes FROM cartes;")
            stats['total_cartes'] = cur.fetchone()['total_cartes']

            # 2. Number of cartes in the last 30 days
            cur.execute("SELECT COUNT(*) as recent_cartes FROM cartes WHERE created_at > NOW() - INTERVAL '30 days';")
            stats['recent_cartes'] = cur.fetchone()['recent_cartes']

            # 3. Top 3 most frequent styles
            cur.execute("""
                SELECT
                    ai_analysis->>'chosen_style' as style,
                    COUNT(*) as count
                FROM cartes
                WHERE ai_analysis->>'chosen_style' IS NOT NULL
                GROUP BY style
                ORDER BY count DESC
                LIMIT 3;
            """)
            top_styles = cur.fetchall()
            stats['top_styles'] = [{'style': row['style'], 'count': row['count']} for row in top_styles]

    finally:
        conn.close()

    return jsonify(stats)


# --- CLI Commands ---
@app.cli.command("init-db")
def init_db_command():
    """Clear the existing data and create new tables."""
    init_db()
    click.echo("Initialized the database.")

if __name__ == '__main__':
    app.run(debug=True, port=5001)
