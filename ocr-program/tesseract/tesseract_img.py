import pytesseract
from PIL import Image, ImageFilter, ImageOps
import sys
import os

# === CONFIGURATION ===
# Default path to Tesseract executable (can be overridden by environment)
DEFAULT_TESSERACT = r"C:\Users\rmander\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"

# Automatically save output in the same folder as this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "tesseract_img_handwriting.txt")

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

def ocr_handwritten_image(image_path):
    # Open the image
    img = Image.open(image_path)
    
    # Preprocessing to improve OCR accuracy
    img = img.convert("L")                         # convert to grayscale
    img = ImageOps.invert(img)                     # invert if text is light on dark
    img = img.filter(ImageFilter.MedianFilter())   # reduce noise
    
    # OCR
    text = pytesseract.image_to_string(img)
    
    # Save output to file in the script's folder
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(text)
    
    print(f"OCR complete! Results saved to {OUTPUT_FILE}")
    print("OCR Text Preview:")
    print("-"*40)
    print(text)
    print("-"*40)
    # Return the extracted text so callers (e.g., master_driver) can include it in JSON
    return text

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ocr_handwritten.py path/to/image")
    else:
        ocr_handwritten_image(sys.argv[1])
