from surya.foundation import FoundationPredictor
from surya.recognition import RecognitionPredictor
from surya.detection import DetectionPredictor
import pypdfium2 as pdfium
import sys
import os
import json
from pathlib import Path

try:
    from tools.doctr_formatter import format_to_doctr
except Exception:
    format_to_doctr = None

# === CONFIGURATION ===
# Automatically save output in the same folder as this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "surya_pdf_output.txt")

def process_pdf(pdf_path, start_page=None, end_page=None):
    # Load PDF
    pdf = pdfium.PdfDocument(pdf_path)
    
    # Initialize predictors once
    foundation_predictor = FoundationPredictor()
    recognition_predictor = RecognitionPredictor(foundation_predictor)
    detection_predictor = DetectionPredictor()

    results_map = {}

    # Loop over pages; respect optional start_page/end_page (1-based indexes)
    for i, page in enumerate(pdf):
        page_no = i + 1
        if start_page and page_no < start_page:
            continue
        if end_page and page_no > end_page:
            break
        image = page.render(scale=1).to_pil()
        print(f"Processing page {page_no}...")

        predictions = recognition_predictor([image], det_predictor=detection_predictor)
        page_lines = []
        for prediction in predictions:
            for text_line in prediction.text_lines:
                page_lines.append(text_line.text)

        # store page lines using a stable key
        stem = Path(pdf_path).stem
        page_key = f"{stem}_page_{page_no}"
        results_map[page_key] = page_lines

    pdf.close()

    # Save results as doctr-style JSON when formatter is available
    if format_to_doctr:
        final = format_to_doctr(results_map, driver_meta={"driver": "surya_pdf"}, ocr_model_name="surya", document_name=Path(pdf_path).stem, poppler_path=None, is_pdf=True)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(final, f, indent=4, ensure_ascii=False)
        print(f"OCR complete! JSON results saved to {OUTPUT_FILE}")
        # Return the structured JSON so callers can include it in aggregated output
        return final
    else:
        # fallback to text output similar to previous behavior
        all_text = []
        for page_no in range(1, len(results_map) + 1):
            all_text.append(f"--- Page {page_no} ---\n")
            page_key = f"{Path(pdf_path).stem}_page_{page_no}"
            for line in results_map.get(page_key, []):
                all_text.append(line + "\n")
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.writelines(all_text)
        print(f"OCR complete! Results saved to {OUTPUT_FILE}")
        # Also return the per-page mapping for programmatic use
        return results_map

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

    # surya_pdf writes text output; use the chosen output filename (text)
    OUTPUT_FILE = str(output_json)

    process_pdf(str(input_path), start_page=start_page, end_page=end_page)
