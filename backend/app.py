import os
import json
import openai
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
from database import get_db_connection
from werkzeug.utils import secure_filename
import logging
from crypto_utils import encrypt, decrypt

# ... (imports and setup are the same) ...
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

# アップロード用の一時フォルダ
UPLOAD_FOLDER = 'temp_uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


# CORS設定: フロントエンドのオリジンを許可する
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})

# Helper function to process carte data for response
def process_carte_for_response(carte_row):
    if not carte_row:
        return None
    carte = dict(carte_row)
    # Decrypt personal info
    carte['phone_number'] = decrypt(carte.get('phone_number', ''))
    carte['email'] = decrypt(carte.get('email', ''))

    # Parse JSON strings back to objects
    if carte.get('ai_analysis'):
        try:
            carte['ai_analysis'] = json.loads(carte['ai_analysis'])
        except (json.JSONDecodeError, TypeError):
            carte['ai_analysis'] = {"error": "Invalid JSON format"}
    if carte.get('photos'):
        try:
            carte['photos'] = json.loads(carte['photos'])
        except (json.JSONDecodeError, TypeError):
            carte['photos'] = []
    return carte

# --- AI Analysis API ---

@app.route('/api/v2/analyze-audio', methods=['POST'])
@limiter.limit("10 per hour")
def analyze_audio():
    # ... (omitted for brevity, no changes in this part)
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
        system_prompt = """
あなたは、プロの美容師向けのカウンセリングアシスタントです。
以下のカウンセリング音声のテキストから、指定された項目を抽出し、JSON形式で出力してください。
特に、美容業界の専門用語（例: レイヤー、シャギー、バレイヤージュなど）を正確に解釈し、顧客の要望や髪の状態を的確に要約してください。
出力するJSONの構造は以下の通りです:
{
  "customer_requests": "顧客の要望や悩み、希望するスタイルなど",
  "hair_condition": "現在の髪の長さ、色、ダメージレベル、癖など、髪の状態に関する記述",
  "stylist_suggestions": "スタイリストからの提案内容",
  "chosen_style": "最終的に決定した、または最も有力なヘアスタイル",
  "confidence_score": "分析結果全体の信頼度を0.0から1.0の範囲で評価した数値"
}
"""
        completion = client.chat.completions.create(
            model="gpt-4-turbo",
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": transcript_text}]
        )
        analysis_result = json.loads(completion.choices[0].message.content)
        response_data = {"transcription": transcript_text, "analysis": analysis_result}
        return jsonify(response_data)
    except openai.APIError as e:
        logging.error(f"OpenAI API Error: {e}")
        return jsonify({"error": f"OpenAI API Error: {e}"}), 500
    except Exception as e:
        logging.error(f"An error occurred: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if filepath and os.path.exists(filepath):
            os.remove(filepath)


# --- カルテ (Carte) CRUD API ---

@app.route('/api/cartes', methods=['POST'])
@limiter.limit("60 per minute")
def create_carte():
    # ... (omitted for brevity, no changes in this part)
    data = request.get_json()
    if not data or not data.get('customer_name'):
        return jsonify({"error": "Missing required field: customer_name"}), 400
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO cartes (customer_name, customer_name_kana, phone_number, email, counseling_content, ai_analysis, photos)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data.get('customer_name'),
            data.get('customer_name_kana'),
            encrypt(data.get('phone_number', '')),
            encrypt(data.get('email', '')),
            data.get('counseling_content'),
            json.dumps(data.get('ai_analysis')) if data.get('ai_analysis') else None,
            json.dumps(data.get('photos', []))
        )
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    conn = get_db_connection()
    new_carte_row = conn.execute('SELECT * FROM cartes WHERE id = ?', (new_id,)).fetchone()
    conn.close()
    return jsonify(process_carte_for_response(new_carte_row)), 201

@app.route('/api/cartes', methods=['GET'])
def get_all_cartes():
    query = request.args.get('q', '')
    conn = get_db_connection()

    sql_query = 'SELECT * FROM cartes'
    params = []

    if query:
        sql_query += ' WHERE customer_name LIKE ? OR customer_name_kana LIKE ?'
        params.extend([f'%{query}%', f'%{query}%'])

    sql_query += ' ORDER BY created_at DESC'

    cartes_rows = conn.execute(sql_query, tuple(params)).fetchall()
    conn.close()

    cartes = [process_carte_for_response(row) for row in cartes_rows]
    return jsonify(cartes)

# ... (the rest of the CRUD endpoints are the same) ...
@app.route('/api/cartes/<int:carte_id>', methods=['GET'])
def get_carte(carte_id):
    conn = get_db_connection()
    carte_row = conn.execute('SELECT * FROM cartes WHERE id = ?', (carte_id,)).fetchone()
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
    if conn.execute('SELECT id FROM cartes WHERE id = ?', (carte_id,)).fetchone() is None:
        conn.close()
        return jsonify({"error": "Carte not found"}), 404

    fields_to_update = []
    values = []
    for key, value in data.items():
        if key in ['customer_name', 'customer_name_kana', 'counseling_content', 'ai_analysis', 'photos']:
            fields_to_update.append(f"{key} = ?")
            values.append(json.dumps(value) if isinstance(value, (dict, list)) else value)
        elif key in ['phone_number', 'email']:
            fields_to_update.append(f"{key} = ?")
            values.append(encrypt(value))

    if not fields_to_update:
        conn.close()
        return jsonify({"error": "No fields to update"}), 400

    values.append(carte_id)
    query = f"UPDATE cartes SET {', '.join(fields_to_update)} WHERE id = ?"

    conn.execute(query, tuple(values))
    conn.commit()

    updated_carte_row = conn.execute('SELECT * FROM cartes WHERE id = ?', (carte_id,)).fetchone()
    conn.close()

    return jsonify(process_carte_for_response(updated_carte_row))

@app.route('/api/cartes/<int:carte_id>', methods=['DELETE'])
def delete_carte(carte_id):
    conn = get_db_connection()
    if conn.execute('SELECT id FROM cartes WHERE id = ?', (carte_id,)).fetchone() is None:
        conn.close()
        return jsonify({"error": "Carte not found"}), 404

    conn.execute('DELETE FROM cartes WHERE id = ?', (carte_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Carte deleted successfully"}), 200


if __name__ == '__main__':
    if not client or not os.getenv("SECRET_KEY"):
        logging.error("Could not start Flask server. Check OPENAI_API_KEY and SECRET_KEY in .env file.")
    else:
        app.run(debug=True, port=5000)
