from flask import Flask, request, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.route("/message", methods=["POST"])
def message():
    data = request.get_json()
    user_message = data["message"]
    return jsonify({"reply": f"Echo: {user_message}"}), 200


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
    app.run(host="0.0.0.0", port=5000, debug=True)
