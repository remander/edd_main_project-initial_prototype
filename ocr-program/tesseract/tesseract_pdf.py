import pytesseract
from pdf2image import convert_from_path
import sys
import os

# === CONFIGURATION ===
# Default path to Tesseract executable (can be overridden by environment)
DEFAULT_TESSERACT = r"C:\Users\rmander\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"
# Path to Poppler 'bin' folder
POPPLER_PATH = r"C:\Users\rmander\Documents\poppler-25.07.0\Library\bin"
# Max pages to process
MAX_PAGES = 3

# Resolve Tesseract path: prefer environment variable `TESSERACT_CMD` or `TESSERACT_PATH`
_env_tess = os.environ.get('TESSERACT_CMD') or os.environ.get('TESSERACT_PATH')
if _env_tess:
    # if user provided folder, append executable name
    if os.path.isdir(_env_tess):
        _env_tess = os.path.join(_env_tess, 'tesseract.exe')
    TESSERACT_PATH = _env_tess
else:
    TESSERACT_PATH = DEFAULT_TESSERACT

# Only set pytesseract path if the file exists; otherwise leave default and warn
if os.path.isfile(TESSERACT_PATH):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH
else:
    print(f"Warning: tesseract executable not found at {TESSERACT_PATH}; ensure tesseract is on PATH or set TESSERACT_CMD.")

# Automatically save output in the same folder as this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "tesseract_pdf.txt")

def ocr_pdf_to_text(pdf_path):
    # Convert PDF to images
    pages = convert_from_path(pdf_path, dpi=300, poppler_path=POPPLER_PATH)
    
    all_text = []

    per_page = {}
    for i, page in enumerate(pages):
        if i >= MAX_PAGES:
            break
        page_no = i + 1
        print(f"Processing page {page_no}...")
        text = pytesseract.image_to_string(page)
        per_page[f"page_{page_no}"] = text
        all_text.append(f"--- Page {page_no} ---\n{text}\n")

    # Write all text to a file in the script's folder
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.writelines(all_text)
    
    print(f"OCR complete! Results saved to {OUTPUT_FILE}")
    # Return structured results so callers can include them in aggregated JSON
    return {"text": "\n".join(all_text), "pages": per_page}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tesseract_pdf.py path/to/file.pdf")
    else:
        ocr_pdf_to_text(sys.argv[1])
