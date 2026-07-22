from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import json
import os
import requests
from sqlalchemy import func, text
from database import SessionLocal, engine, Base
from models import Chat, Message

load_dotenv()

app = Flask(__name__)
CORS(app)

Base.metadata.create_all(bind=engine)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

DEFAULT_MODEL = "openai/gpt-4.1-mini"
EMBEDDING_MODEL = "text-embedding-3-small"

AVAILABLE_MODELS = [
    {"id": "openai/gpt-4.1-mini", "name": "GPT-4.1 Mini"},
    {"id": "google/gemini-2.5-flash", "name": "Gemini 2.5 Flash"},
    {"id": "qwen/qwen3-32b", "name": "Qwen 3 32B"},
    {"id": "deepseek/deepseek-chat-v3", "name": "DeepSeek Chat V3"},
]

if OPENROUTER_API_KEY:
    print(f"[OpenRouter] API Key okundu: {OPENROUTER_API_KEY[:15]}...")
else:
    print("[OpenRouter] UYARI: OPENROUTER_API_KEY .env dosyasında bulunamadı!")


def try_openrouter(messages, model_name):
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5555",
        "X-Title": "Chat App",
    }

    payload = {
        "model": model_name,
        "messages": messages,
        "max_tokens": 1024,
    }

    print(f"\n[OpenRouter] Model: {model_name}")

    response = requests.post(
        OPENROUTER_URL, headers=headers, json=payload, timeout=30
    )

    print(f"[OpenRouter] HTTP Status: {response.status_code}")

    if not response.ok:
        print(f"\n[OpenRouter Hata] Status: {response.status_code}")
        print(f"[OpenRouter Hata] Response Body: {response.text}\n")

        error_detail = ""
        provider_name = ""
        try:
            error_body = response.json()
            error_detail = error_body.get("error", {}).get("message", response.text)
            provider_name = error_body.get("error", {}).get("metadata", {}).get("provider_name", "")
        except Exception:
            error_detail = response.text

        return None, response.status_code, {
            "error": f"OpenRouter API {response.status_code} hatası: {error_detail}",
            "model": model_name,
            "provider": provider_name,
            "status_code": response.status_code,
        }

    result = response.json()
    reply = result["choices"][0]["message"]["content"]
    used_model = result.get("model", model_name)
    print(f"[OpenRouter] Başarılı yanıt - Kullanılan model: {used_model}")

    return reply, 200, None


def get_embedding(text):
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": EMBEDDING_MODEL,
        "input": text,
    }
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/embeddings",
            headers=headers,
            json=payload,
            timeout=30,
        )
        if response.ok:
            data = response.json()
            return data["data"][0]["embedding"]
    except Exception as e:
        print(f"[Embedding] Hata: {e}")
    return None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.route("/models", methods=["GET"])
def get_models():
    return jsonify(AVAILABLE_MODELS), 200


@app.route("/chats", methods=["GET"])
def list_chats():
    db = next(get_db())
    try:
        chats = db.query(Chat).order_by(Chat.updated_at.desc()).all()
        result = []
        for chat in chats:
            result.append({
                "id": str(chat.id),
                "title": chat.title,
                "created_at": chat.created_at.isoformat() if chat.created_at else None,
                "updated_at": chat.updated_at.isoformat() if chat.updated_at else None,
            })
        return jsonify(result), 200
    finally:
        db.close()


@app.route("/chats", methods=["POST"])
def create_chat():
    db = next(get_db())
    try:
        chat = Chat(title="Yeni Sohbet")
        db.add(chat)
        db.commit()
        db.refresh(chat)
        return jsonify({
            "id": str(chat.id),
            "title": chat.title,
            "created_at": chat.created_at.isoformat() if chat.created_at else None,
            "updated_at": chat.updated_at.isoformat() if chat.updated_at else None,
        }), 201
    finally:
        db.close()


@app.route("/chats/search", methods=["GET"])
def search_chats():
    q = request.args.get("q", "").strip().lower()
    if not q:
        return jsonify([]), 200

    db = next(get_db())
    try:
        chats = db.query(Chat).filter(
            Chat.title.ilike(f"%{q}%")
        ).order_by(Chat.updated_at.desc()).all()

        chat_ids = [c.id for c in chats]

        message_matches = db.query(Message).filter(
            Message.chat_id.in_(chat_ids),
            Message.content.ilike(f"%{q}%")
        ).order_by(Message.created_at.asc()).all()

        chat_messages_map = {}
        for msg in message_matches:
            cid = str(msg.chat_id)
            if cid not in chat_messages_map:
                chat_messages_map[cid] = []
            chat_messages_map[cid].append({
                "id": str(msg.id),
                "role": msg.role,
                "content": msg.content[:200],
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            })

        result = []
        for chat in chats:
            cid = str(chat.id)
            result.append({
                "id": cid,
                "title": chat.title,
                "matches": chat_messages_map.get(cid, []),
            })

        return jsonify(result), 200
    finally:
        db.close()


@app.route("/chats/<chat_id>", methods=["DELETE"])
def delete_chat(chat_id):
    db = next(get_db())
    try:
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            return jsonify({"error": "Sohbet bulunamadı."}), 404
        db.delete(chat)
        db.commit()
        return jsonify({"success": True}), 200
    finally:
        db.close()


@app.route("/chats", methods=["DELETE"])
def clear_chats():
    db = next(get_db())
    try:
        db.query(Message).delete()
        db.query(Chat).delete()
        db.commit()
        return jsonify({"success": True}), 200
    finally:
        db.close()


@app.route("/chats/<chat_id>/messages", methods=["GET"])
def get_messages(chat_id):
    db = next(get_db())
    try:
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            return jsonify({"error": "Sohbet bulunamadı."}), 404

        messages = db.query(Message).filter(
            Message.chat_id == chat_id
        ).order_by(Message.created_at.asc()).all()

        result = []
        for msg in messages:
            result.append({
                "id": str(msg.id),
                "role": msg.role,
                "content": msg.content,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            })
        return jsonify(result), 200
    finally:
        db.close()


@app.route("/message", methods=["POST"])
def message():
    data = request.get_json()
    user_message = data.get("message")
    model = data.get("model", DEFAULT_MODEL)
    chat_id_str = data.get("chat_id")

    if not user_message:
        return jsonify({"error": "Mesaj alanı boş."}), 400

    if not chat_id_str:
        return jsonify({"error": "chat_id gerekli."}), 400

    if not OPENROUTER_API_KEY:
        print("[OpenRouter] API Key eksik, istek gönderilemedi.")
        return jsonify({"error": "OpenRouter API anahtarı .env dosyasında tanımlı değil."}), 500

    db = next(get_db())
    try:
        chat = db.query(Chat).filter(Chat.id == chat_id_str).first()
        if not chat:
            return jsonify({"error": "Sohbet bulunamadı."}), 404

        user_embedding = get_embedding(user_message)
        user_msg = Message(chat_id=chat.id, role="user", content=user_message, embedding=user_embedding)
        db.add(user_msg)

        if chat.title == "Yeni Sohbet":
            chat.title = user_message[:255]
            db.add(chat)

        db.commit()
        db.refresh(user_msg)

        history = db.query(Message).filter(
            Message.chat_id == chat.id
        ).order_by(Message.created_at.asc()).all()

        openrouter_messages = [
            {"role": "system", "content": "Sen Chat App isimli yapay zeka asistanısın. Her zaman Türkçe cevap ver. Yardımsever, doğru ve anlaşılır cevaplar üret."}
        ]
        for msg in history:
            openrouter_messages.append({"role": msg.role, "content": msg.content})

        try:
            reply, status, error_info = try_openrouter(openrouter_messages, model)

            if reply is not None:
                assistant_embedding = get_embedding(reply)
                assistant_msg = Message(chat_id=chat.id, role="assistant", content=reply, embedding=assistant_embedding)
                db.add(assistant_msg)
                db.commit()
                db.refresh(assistant_msg)

                chat.updated_at = func.now()
                db.add(chat)
                db.commit()

                return jsonify({
                    "reply": reply,
                    "model": model,
                    "chat_id": str(chat.id),
                    "chat_title": chat.title,
                }), 200

            return jsonify(error_info), status

        except requests.exceptions.Timeout:
            print(f"[OpenRouter] Zaman aşımı - model: {model}")
            return jsonify({"error": f"OpenRouter API zaman aşımına uğradı (model: {model})."}), 504
        except requests.exceptions.RequestException as e:
            print(f"[OpenRouter] Bağlantı hatası - model: {model}: {str(e)}")
            return jsonify({"error": f"OpenRouter bağlantı hatası (model: {model}): {str(e)}"}), 502
        except (KeyError, IndexError) as e:
            print(f"[OpenRouter] Beklenmeyen yanıt formatı - model: {model}: {str(e)}")
            return jsonify({"error": f"API yanıtı beklenen formatta değil (model: {model}): {str(e)}"}), 502

    finally:
        db.close()


@app.route("/chats/search/semantic", methods=["GET"])
def semantic_search():
    q = request.args.get("q", "").strip()
    chat_id_filter = request.args.get("chat_id")
    limit = request.args.get("limit", 10, type=int)

    if not q:
        return jsonify([]), 200

    query_embedding = get_embedding(q)
    if not query_embedding:
        return jsonify({"error": "Embedding oluşturulamadı."}), 500

    query_vector = json.dumps(query_embedding)

    db = next(get_db())
    try:
        if chat_id_filter:
            sql = text("""
                SELECT m.id, m.chat_id, m.role, m.content, m.created_at,
                       1 - (m.embedding <=> CAST(:query AS vector)) AS similarity
                FROM messages m
                WHERE m.embedding IS NOT NULL AND m.chat_id = :chat_id
                ORDER BY m.embedding <=> CAST(:query AS vector)
                LIMIT :limit
            """)
            params = {"query": query_vector, "chat_id": chat_id_filter, "limit": limit}
        else:
            sql = text("""
                SELECT m.id, m.chat_id, m.role, m.content, m.created_at,
                       1 - (m.embedding <=> CAST(:query AS vector)) AS similarity
                FROM messages m
                WHERE m.embedding IS NOT NULL
                ORDER BY m.embedding <=> CAST(:query AS vector)
                LIMIT :limit
            """)
            params = {"query": query_vector, "limit": limit}

        rows = db.execute(sql, params).fetchall()

        result = []
        for row in rows:
            result.append({
                "id": str(row[0]),
                "chat_id": str(row[1]),
                "role": row[2],
                "content": row[3],
                "created_at": row[4].isoformat() if row[4] else None,
                "similarity": round(float(row[5]), 4),
            })

        return jsonify(result), 200
    finally:
        db.close()


@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "Dosya bulunamadı."}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Dosya adı boş."}), 400

    file.save(os.path.join(UPLOAD_FOLDER, file.filename))
    return jsonify({"success": True, "reply": "Dosya başarıyla yüklendi."}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5555, debug=True)