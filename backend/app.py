from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests
import json

load_dotenv()

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

DEFAULT_MODEL = "openai/gpt-4.1-mini"

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

conversation_history = [
    {
        "role": "system",
        "content": "Sen Chat App isimli yapay zeka asistanısın. Her zaman Türkçe cevap ver. Yardımsever, doğru ve anlaşılır cevaplar üret."
    }
]


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
    print(f"[OpenRouter] Authorization: Bearer {OPENROUTER_API_KEY[:15]}...")

    response = requests.post(
        OPENROUTER_URL, headers=headers, json=payload, timeout=30
    )

    print(f"[OpenRouter] HTTP Status: {response.status_code}")

    if not response.ok:
        print(f"\n[OpenRouter Hata] Status: {response.status_code}")
        print(f"[OpenRouter Hata] Response Headers: {dict(response.headers)}")
        print(f"[OpenRouter Hata] Response Body: {response.text}\n")

        error_detail = ""
        provider_name = ""
        try:
            error_body = response.json()
            error_detail = error_body.get("error", {}).get("message", response.text)
            provider_name = error_body.get("error", {}).get("metadata", {}).get("provider_name", "")
        except Exception:
            error_detail = response.text

        print(f"[OpenRouter Hata] Provider: {provider_name}")
        print(f"[OpenRouter Hata] Ayrıntı: {error_detail}")

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


@app.route("/models", methods=["GET"])
def get_models():
    return jsonify(AVAILABLE_MODELS), 200


@app.route("/message", methods=["POST"])
def message():
    data = request.get_json()
    user_message = data.get("message")
    model = data.get("model", DEFAULT_MODEL)

    if not user_message:
        return jsonify({"error": "Mesaj alanı boş."}), 400

    if not OPENROUTER_API_KEY:
        print("[OpenRouter] API Key eksik, istek gönderilemedi.")
        return jsonify({"error": "OpenRouter API anahtarı .env dosyasında tanımlı değil."}), 500

    conversation_history.append({"role": "user", "content": user_message})
    print(f"[Conversation History] Kullanıcı mesajı eklendi. Toplam mesaj: {len(conversation_history)}")

    try:
        reply, status, error_info = try_openrouter(conversation_history, model)

        if reply is not None:
            conversation_history.append({"role": "assistant", "content": reply})
            print(f"[Conversation History] Asistan cevabı eklendi. Toplam mesaj: {len(conversation_history)}")
            return jsonify({"reply": reply, "model": model}), 200

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