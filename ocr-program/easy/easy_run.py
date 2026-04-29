# easyocr_test.py
import sys
import os
import easyocr
from PIL import Image
import json
from pathlib import Path

try:
    from tools.doctr_formatter import format_to_doctr
except Exception:
    format_to_doctr = None

# === CONFIGURATION ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "easyocr_img.txt")

def process_image(image_path):
    # Ensure file exists
    if not os.path.isfile(image_path):
        print(f"Error: File not found: {image_path}")
        return

    # Open image (optional, mainly for PIL use)
    image = Image.open(image_path)

    # Initialize EasyOCR Reader
    reader = easyocr.Reader(['en'], gpu=False)  # Set gpu=True if you have CUDA

    # Run OCR
    print(f"Processing image: {os.path.basename(image_path)}...")
    results = reader.readtext(image_path)

    # Collect text lines
    all_text = []
    # print("OCR Results:")
    for bbox, text, confidence in results:
        # print(text)
        all_text.append(text)

    # Prepare results map
    stem = Path(image_path).stem
    page_key = f"{stem}_page_1"
    results_map = {page_key: all_text}

    # Save as doctr-style JSON when formatter is available
    if format_to_doctr:
        doc_name = stem
        final = format_to_doctr(results_map, driver_meta={}, ocr_model_name="easyocr", document_name=doc_name, poppler_path=None, is_pdf=True)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(final, f, indent=4, ensure_ascii=False)
        print(f"OCR complete! JSON results saved to {os.path.abspath(OUTPUT_FILE)}")
    else:
        # fallback to plain text
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            for line in all_text:
                f.write(line + "\n")
        print(f"OCR complete! Results saved to {os.path.abspath(OUTPUT_FILE)}")

if __name__ == "__main__":
    # Interactive selection
    from pathlib import Path
    repo_root = Path(__file__).resolve().parents[1]
    import sys
    sys.path.append(str(repo_root))
    from driver_interactive import interactive_select

    SCRIPT_DIR = Path(__file__).parent
    TEST_FILES_DIR = repo_root / "test_files"
    DEFAULT_OUTPUT_PARENT = SCRIPT_DIR

    input_path, OUTPUT_DIR, output_json, start_page, end_page = interactive_select(TEST_FILES_DIR, DEFAULT_OUTPUT_PARENT)

    OUTPUT_FILE = str(output_json)
    process_image(str(input_path))