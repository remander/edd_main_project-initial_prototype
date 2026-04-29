import os
import sys
from pdf2image import convert_from_path
from paddleocr import PaddleOCR

# --- CONFIG ---
POPPLER_PATH = r"C:\Users\rmander\Documents\poppler-25.07.0\Library\bin"

def pdf_to_images(pdf_path, dpi=200, start_page=None, end_page=None):
    """Convert PDF pages to images."""
    pages = convert_from_path(pdf_path, dpi=dpi, poppler_path=POPPLER_PATH, first_page=start_page, last_page=end_page)
    image_paths = []
    pdf_dir = os.path.dirname(os.path.abspath(pdf_path))
    base_name = os.path.splitext(os.path.basename(pdf_path))[0]

    for i, page in enumerate(pages, start=(start_page or 1)):
        img_path = os.path.join(pdf_dir, f"{base_name}_page_{i}.png")
        page.save(img_path, "PNG")
        print(f"Saved page {i} as image: {img_path}")
        image_paths.append(img_path)

    return image_paths

def ocr_images(image_paths, lang="en"):
    """Run PaddleOCR on each image and return all text lines."""
    ocr = PaddleOCR(use_textline_orientation=True, lang=lang)
    all_text = []

    for i, img_path in enumerate(image_paths, start=1):
        print(f"Running OCR on page {i}...")
        results = ocr.predict(img_path)
        res = results[0]
        for text in res["rec_texts"]:
            all_text.append(text)

    return all_text

def save_output(text_lines, pdf_path):
    """Save all OCR text to a file next to the PDF."""
    output_file = os.path.splitext(pdf_path)[0] + "_ocr.txt"
    with open(output_file, "w", encoding="utf-8") as f:
        for line in text_lines:
            f.write(line + "\n")
    print(f"OCR complete! Results saved to: {output_file}")

def cleanup_images(image_paths):
    """Delete the intermediate PNG images."""
    for img_path in image_paths:
        try:
            os.remove(img_path)
            print(f"Deleted temporary image: {img_path}")
        except Exception as e:
            print(f"Could not delete {img_path}: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python paddle_pdf.py path/to/file.pdf [start_page] [end_page]")
        sys.exit(1)

    pdf_file = sys.argv[1]
    start_page = int(sys.argv[2]) if len(sys.argv) >= 3 else None
    end_page = int(sys.argv[3]) if len(sys.argv) >= 4 else None

    if not os.path.isfile(pdf_file) or not pdf_file.lower().endswith(".pdf"):
        print("Error: Please provide a valid PDF file.")
        sys.exit(1)

    print("Converting PDF to images...")
    image_files = pdf_to_images(pdf_file, start_page=start_page, end_page=end_page)

    print("Running OCR on PDF pages...")
    text_output = ocr_images(image_files)

    save_output(text_output, pdf_file)
    cleanup_images(image_files)
