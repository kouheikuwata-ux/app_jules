import os
import json
import openai
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from database import get_db_connection
from werkzeug.utils import secure_filename
import logging

# ロギング設定
logging.basicConfig(level=logging.INFO)

# .envファイルから環境変数を読み込む
load_dotenv()

# OpenAIクライアントの初期化
try:
    openai.api_key = os.getenv("OPENAI_API_KEY")
    if not openai.api_key:
        raise ValueError("OPENAI_API_KEY not found in .env file")
    client = openai.OpenAI()
except Exception as e:
    logging.error(f"Failed to initialize OpenAI client: {e}")
    client = None

app = Flask(__name__)

# アップロード用の一時フォルダ
UPLOAD_FOLDER = 'temp_uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


# CORS設定: フロントエンドのオリジンを許可する
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})

# Helper function to convert a db row to a dictionary
def row_to_dict(row):
    return dict(row) if row else None

# Error handler for 404 Not Found
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not Found"}), 404

# --- AI Analysis API ---

@app.route('/api/v2/analyze-audio', methods=['POST'])
def analyze_audio():
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

        # 1. Whisper APIで音声をテキストに変換
        with open(filepath, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        transcript_text = transcription.text
        logging.info(f"Transcription: {transcript_text}")

        # 2. GPT-4 APIでテキストを分析
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
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": transcript_text}
            ]
        )

        analysis_result = json.loads(completion.choices[0].message.content)

        # レスポンスに文字起こしテキストも追加して返す
        response_data = {
            "transcription": transcript_text,
            "analysis": analysis_result
        }

        return jsonify(response_data)

    except openai.APIError as e:
        logging.error(f"OpenAI API Error: {e}")
        return jsonify({"error": f"OpenAI API Error: {e}"}), 500
    except Exception as e:
        logging.error(f"An error occurred: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        # 一時ファイルを削除
        if filepath and os.path.exists(filepath):
            os.remove(filepath)


# --- カルテ (Carte) CRUD API ---

@app.route('/api/cartes', methods=['POST'])
def create_carte():
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
            data.get('phone_number'),
            data.get('email'),
            data.get('counseling_content'),
            # AI analysis can be complex, store as JSON string
            json.dumps(data.get('ai_analysis')) if data.get('ai_analysis') else None,
            # Photos are expected as a list of URLs, store as JSON string
            json.dumps(data.get('photos', []))
        )
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    conn = get_db_connection()
    new_carte_row = conn.execute('SELECT * FROM cartes WHERE id = ?', (new_id,)).fetchone()
    conn.close()

    new_carte = row_to_dict(new_carte_row)
    # Parse JSON strings back to objects for the response
    if new_carte.get('ai_analysis'):
        new_carte['ai_analysis'] = json.loads(new_carte['ai_analysis'])
    if new_carte.get('photos'):
        new_carte['photos'] = json.loads(new_carte['photos'])

    return jsonify(new_carte), 201


@app.route('/api/cartes', methods=['GET'])
def get_all_cartes():
    conn = get_db_connection()
    cartes_rows = conn.execute('SELECT * FROM cartes ORDER BY created_at DESC').fetchall()
    conn.close()

    cartes = []
    for row in cartes_rows:
        carte = row_to_dict(row)
        if carte.get('ai_analysis'):
            try:
                carte['ai_analysis'] = json.loads(carte['ai_analysis'])
            except (json.JSONDecodeError, TypeError):
                # Handle cases where ai_analysis is not valid JSON
                carte['ai_analysis'] = {"error": "Invalid JSON format"}
        if carte.get('photos'):
            try:
                carte['photos'] = json.loads(carte['photos'])
            except (json.JSONDecodeError, TypeError):
                carte['photos'] = []
        cartes.append(carte)

    return jsonify(cartes)

@app.route('/api/cartes/<int:carte_id>', methods=['GET'])
def get_carte(carte_id):
    conn = get_db_connection()
    carte_row = conn.execute('SELECT * FROM cartes WHERE id = ?', (carte_id,)).fetchone()
    conn.close()
    if carte_row is None:
        return jsonify({"error": "Carte not found"}), 404

    carte = row_to_dict(carte_row)
    if carte.get('ai_analysis'):
        carte['ai_analysis'] = json.loads(carte['ai_analysis'])
    if carte.get('photos'):
        carte['photos'] = json.loads(carte['photos'])

    return jsonify(carte)

@app.route('/api/cartes/<int:carte_id>', methods=['PUT'])
def update_carte(carte_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid data"}), 400

    conn = get_db_connection()
    # Check if carte exists
    existing_carte = conn.execute('SELECT * FROM cartes WHERE id = ?', (carte_id,)).fetchone()
    if existing_carte is None:
        conn.close()
        return jsonify({"error": "Carte not found"}), 404

    # Build update query
    fields_to_update = []
    values = []
    for key, value in data.items():
        if key in ['customer_name', 'customer_name_kana', 'phone_number', 'email', 'counseling_content', 'ai_analysis', 'photos']:
            fields_to_update.append(f"{key} = ?")
            values.append(json.dumps(value) if isinstance(value, (dict, list)) else value)

    if not fields_to_update:
        conn.close()
        return jsonify({"error": "No fields to update"}), 400

    values.append(carte_id)
    query = f"UPDATE cartes SET {', '.join(fields_to_update)} WHERE id = ?"

    conn.execute(query, tuple(values))
    conn.commit()

    # Fetch and return the updated carte
    updated_carte_row = conn.execute('SELECT * FROM cartes WHERE id = ?', (carte_id,)).fetchone()
    conn.close()

    updated_carte = row_to_dict(updated_carte_row)
    if updated_carte.get('ai_analysis'):
        updated_carte['ai_analysis'] = json.loads(updated_carte['ai_analysis'])
    if updated_carte.get('photos'):
        updated_carte['photos'] = json.loads(updated_carte['photos'])

    return jsonify(updated_carte)


@app.route('/api/cartes/<int:carte_id>', methods=['DELETE'])
def delete_carte(carte_id):
    conn = get_db_connection()
    # Verify carte exists before deleting
    carte = conn.execute('SELECT * FROM cartes WHERE id = ?', (carte_id,)).fetchone()
    if carte is None:
        conn.close()
        return jsonify({"error": "Carte not found"}), 404

    conn.execute('DELETE FROM cartes WHERE id = ?', (carte_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Carte deleted successfully"}), 200

if __name__ == '__main__':
    # Make sure to set the OPENAI_API_KEY in your .env file
    if not client:
        logging.error("Could not start Flask server, OpenAI client failed to initialize.")
    else:
        app.run(debug=True, port=5000)
