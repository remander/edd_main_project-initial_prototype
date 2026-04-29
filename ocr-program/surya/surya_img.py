from surya.foundation import FoundationPredictor
from surya.recognition import RecognitionPredictor
from surya.detection import DetectionPredictor
from PIL import Image
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
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "surya_sign_output.txt")



def process_image(image_path):
    # Open the image
    image = Image.open(image_path)
    
    # Initialize predictors
    foundation_predictor = FoundationPredictor()
    recognition_predictor = RecognitionPredictor(foundation_predictor)
    detection_predictor = DetectionPredictor()

    # Run Surya OCR
    print(f"Processing image: {os.path.basename(image_path)}...")
    predictions = recognition_predictor([image], det_predictor=detection_predictor)
    
    print("OCR Results:")
    all_text = []
    for prediction in predictions:
        for text_line in prediction.text_lines:
            print(text_line.text)
            all_text.append(text_line.text)
    
    # Prepare results map
    stem = Path(image_path).stem
    page_key = f"{stem}_page_1"
    results_map = {page_key: all_text}

    # Save doctr-style JSON when formatter is available
    if format_to_doctr:
        final = format_to_doctr(results_map, driver_meta={}, ocr_model_name="surya", document_name=stem, poppler_path=None, is_pdf=True)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(final, f, indent=4, ensure_ascii=False)
        print(f"OCR complete! JSON results saved to {os.path.abspath(OUTPUT_FILE)}")
        # Return the structured JSON so callers can include it
        return final
    else:
        # fallback to plain text
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            for line in all_text:
                f.write(line + "\n")
        print(f"OCR complete! Results saved to {os.path.abspath(OUTPUT_FILE)}")
        # Also return a simple results map for programmatic use
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

    OUTPUT_FILE = str(output_json)
    process_image(str(input_path))
    print(f"OCR complete! Results saved to {OUTPUT_FILE}")
