from paddleocr import PaddleOCR
import sys
import os

# === CONFIGURATION ===
# Automatically save output in the same folder as this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "paddle_sign_output.txt")


def process_image(image_path):
    # Ensure the image exists
    if not os.path.isfile(image_path):
        print(f"Error: File not found: {image_path}")
        return

    # Initialize PaddleOCR
    # use_textline_orientation replaces the old use_angle_cls
    ocr = PaddleOCR(use_textline_orientation=True, lang="en")

    # Run PaddleOCR (predict is the new API)
    print(f"Processing image: {os.path.basename(image_path)}...")
    results = ocr.predict(image_path)

    print("OCR Results:")
    all_text = []

    # results is a list of dicts with detection + recognition output
    # each dict has keys like "rec_texts" and "rec_scores"
    res = results[0]
    for text in res["rec_texts"]:
        print(text)
        all_text.append(text)

    # Optional: save results to a file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for line in all_text:
            f.write(line + "\n")

    print(f"OCR complete! Results saved to {os.path.abspath(OUTPUT_FILE)}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python paddle_run.py path/to/image")
    else:
        process_image(sys.argv[1])
