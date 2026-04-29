# easyocr_pdf_tqdm.py
import os
import sys
from pdf2image import convert_from_path
import easyocr
from tqdm import tqdm
from collections import defaultdict
import json
from pathlib import Path

try:
    from tools.doctr_formatter import format_to_doctr
except Exception:
    format_to_doctr = None

# === CONFIGURATION ===
POPPLER_PATH = r"C:\Users\rmander\Documents\poppler-25.07.0\Library\bin"
Y_THRESHOLD = 10  # vertical threshold to group words into the same line

def pdf_to_images(pdf_path, dpi=200, start_page=None, end_page=None):
    """Convert PDF pages to images."""
    pages = convert_from_path(
        pdf_path, dpi=dpi, poppler_path=POPPLER_PATH,
        first_page=start_page, last_page=end_page
    )
    image_paths = []

    pdf_dir = os.path.dirname(os.path.abspath(pdf_path))
    base_name = os.path.splitext(os.path.basename(pdf_path))[0]

    for i, page in enumerate(pages, start=(start_page or 1)):
        img_path = os.path.join(pdf_dir, f"{base_name}_page_{i}.png")
        page.save(img_path, "PNG")
        image_paths.append(img_path)

    return image_paths

def ocr_images(image_paths, lang='en', y_threshold=Y_THRESHOLD):
    """Run EasyOCR on each image and merge words into lines.

    Returns a dict mapping page_stem -> list[str]
    """
    reader = easyocr.Reader([lang], gpu=False)
    results_by_page = {}

    for img_path in tqdm(image_paths, desc="OCR Pages", unit="page"):
        results = reader.readtext(img_path)
        lines_dict = defaultdict(list)
        page_lines = []

        for bbox, text, conf in results:
            y = int(bbox[0][1])  # top-left y-coordinate
            found_line = False
            for line_y in list(lines_dict.keys()):
                if abs(y - line_y) <= y_threshold:
                    lines_dict[line_y].append((bbox[0][0], text))  # store x for horizontal sorting
                    found_line = True
                    break
            if not found_line:
                lines_dict[y].append((bbox[0][0], text))

        # sort lines by y, words by x, and join words
        for line_y in sorted(lines_dict.keys()):
            words = sorted(lines_dict[line_y], key=lambda x: x[0])
            line_text = " ".join(word for _, word in words)
            page_lines.append(line_text)

        stem = Path(img_path).stem
        results_by_page[stem] = page_lines

    return results_by_page

def save_output(results_map, output_path, driver_meta=None, ocr_model_name=None):
    """Save results_map (page->lines) to JSON in doctr format when formatter is available.

    If formatter is unavailable, falls back to writing plain text concatenation.
    """
    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if format_to_doctr:
        # attempt to detect document name from first page key
        doc_name = None
        try:
            first_key = next(iter(results_map))
            # strip trailing _page_N if present
            doc_name = first_key.split('_page_')[0]
        except Exception:
            doc_name = None

        final = format_to_doctr(results_map, driver_meta=driver_meta or {}, ocr_model_name=ocr_model_name, document_name=doc_name, poppler_path=POPPLER_PATH, is_pdf=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(final, f, indent=4, ensure_ascii=False)
    else:
        # fallback: write concatenated text
        with open(output_path, "w", encoding="utf-8") as f:
            for page, lines in results_map.items():
                for line in lines:
                    f.write(line + "\n")

def cleanup_images(image_paths):
    """Delete the intermediate PNG images."""
    for img_path in image_paths:
        try:
            os.remove(img_path)
        except Exception:
            pass  # silently ignore errors

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

    if not os.path.isfile(input_path) or not str(input_path).lower().endswith('.pdf'):
        print("Error: Please provide a valid PDF file.")
        sys.exit(1)

    image_files = pdf_to_images(str(input_path), start_page=start_page, end_page=end_page)
    text_output = ocr_images(image_files)
    save_output(text_output, str(output_json))
    cleanup_images(image_files)
