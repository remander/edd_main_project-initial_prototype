"""
OCR HTTP server — uses your project's tesseract driver to read receipt images.

Run with:
  /Users/remymander/anaconda3/envs/ocr/bin/python ocr-program/server.py

Listens on http://localhost:5001
"""
import os
import sys
import tempfile
from pathlib import Path

# Add the ocr-program directory to the path so the tesseract driver is importable
REPO_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(REPO_ROOT))

from flask import Flask, request, jsonify
from flask_cors import CORS
from tesseract.tesseract_driver import process_file

app = Flask(__name__)
CORS(app)  # allow requests from Vite dev server on localhost:5173


@app.route("/ocr", methods=["POST"])
def ocr_endpoint():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    suffix = Path(file.filename).suffix.lower() or ".png"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name

    # Convert unsupported formats (e.g. WebP) to PNG before passing to driver
    SUPPORTED = {".png", ".jpg", ".jpeg", ".bmp", ".tiff"}
    if suffix not in SUPPORTED:
        try:
            from PIL import Image as PILImage
            converted_path = tmp_path + ".png"
            PILImage.open(tmp_path).convert("RGB").save(converted_path, "PNG")
            os.remove(tmp_path)
            tmp_path = converted_path
        except Exception as e:
            return jsonify({"error": f"Could not convert image: {e}"}), 400

    try:
        results, _metadata = process_file(tmp_path)
        # results is a dict mapping page stem -> list of text lines
        all_lines = []
        for lines in results.values():
            if isinstance(lines, list):
                all_lines.extend(lines)
            elif isinstance(lines, str):
                all_lines.extend(lines.splitlines())
        text = "\n".join(all_lines)
        return jsonify({"text": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    print("OCR server starting on http://localhost:5001")
    app.run(host="127.0.0.1", port=5001, debug=False)
