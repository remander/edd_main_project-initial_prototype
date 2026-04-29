import os
import sys
import json
import time
from pathlib import Path
from pdf2image import convert_from_path
import pytesseract
from PIL import Image, ImageFilter, ImageOps
import platform
import psutil
import cpuinfo
import importlib.metadata
from datetime import datetime
try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None


def get_version_safe(package_name):
    try:
        return importlib.metadata.version(package_name)
    except importlib.metadata.PackageNotFoundError:
        return "not installed"
    except Exception:
        return "unknown"


# --- CONFIG ---
DEFAULT_TESSERACT = r"C:\Users\rmander\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"
POPPLER_PATH = r"C:\Users\rmander\Documents\poppler-25.07.0\Library\bin"
MAX_PAGES = 3
tesseract_init_time_seconds = None

# Resolve Tesseract path: prefer environment variable `TESSERACT_CMD` or `TESSERACT_PATH`
_env_tess = os.environ.get('TESSERACT_CMD') or os.environ.get('TESSERACT_PATH')
if _env_tess:
    if os.path.isdir(_env_tess):
        _env_tess = os.path.join(_env_tess, 'tesseract.exe')
    TESSERACT_PATH = _env_tess
else:
    TESSERACT_PATH = DEFAULT_TESSERACT

if os.path.isfile(TESSERACT_PATH):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH
else:
    print(f"Warning: tesseract executable not found at {TESSERACT_PATH}; ensure tesseract is on PATH or set TESSERACT_CMD.")


def _preprocess_image(img: Image.Image) -> Image.Image:
    # Convert to grayscale and reduce noise; invert to help some handwriting
    img = img.convert("L")
    img = ImageOps.invert(img)
    img = img.filter(ImageFilter.MedianFilter())
    return img


def pdf_to_images(pdf_path, start_page=None, end_page=None):
    pages = convert_from_path(pdf_path, dpi=300, poppler_path=POPPLER_PATH,
                              first_page=start_page, last_page=end_page)
    image_paths = []
    pdf_dir = Path(pdf_path).parent
    base_name = Path(pdf_path).stem
    for i, page in enumerate(pages, start=(start_page or 1)):
        img_path = pdf_dir / f"{base_name}_page_{i}.png"
        page.save(img_path, "PNG")
        image_paths.append(img_path)
    return image_paths


def ocr_images(image_paths):
    global tesseract_init_time_seconds
    result_dict = {}
    per_page_times = {}
    cpu_percents = {}
    mem_usages = {}

    # Capture tesseract initialization timing on first use
    if tesseract_init_time_seconds is None:
        init_start = time.time()
        # Test pytesseract by getting version
        try:
            _ = pytesseract.get_tesseract_version()
        except Exception:
            pass
        init_end = time.time()
        tesseract_init_time_seconds = init_end - init_start

    doc_start_time = time.time()
    doc_cpu_samples = []
    doc_mem_samples = []

    process = psutil.Process(os.getpid())

    per_page_resources = {}
    
    for img_path in image_paths:
        print(f"Tesseract OCR processing: {img_path}")
        page_start = time.time()

        try:
            img = Image.open(img_path)
            img = _preprocess_image(img)
            text = pytesseract.image_to_string(img)
        except Exception:
            # fallback: try opening without preprocessing
            try:
                text = pytesseract.image_to_string(Image.open(img_path))
            except Exception:
                text = ""

        # Normalize result to list of lines like other drivers
        lines = [l for l in text.splitlines() if l.strip()]
        page_key = Path(img_path).stem
        result_dict[page_key] = lines

        page_time = time.time() - page_start
        per_page_times[page_key] = page_time

        cpu_percent = psutil.cpu_percent(interval=0.1)
        mem_used_sys = psutil.virtual_memory().used / 1024 / 1024
        mem_used_proc = process.memory_info().rss / 1024 / 1024

        cpu_percents[page_key] = cpu_percent
        mem_usages[page_key] = {
            "system_memory_mb": mem_used_sys,
            "process_memory_mb": mem_used_proc
        }
        per_page_resources[page_key] = {
            "cpu_percent": cpu_percent,
            "memory_mb": mem_used_proc
        }

        doc_cpu_samples.append(cpu_percent)
        doc_mem_samples.append(mem_used_proc)

    doc_end_time = time.time()

    # Detect tesseract model/version if available
    model_name = "tesseract"
    try:
        tess_version = pytesseract.get_tesseract_version()
        if tess_version:
            model_name = f"tesseract-{tess_version}"
    except Exception:
        pass

    # Add processing date in format: YYYY-MM-DD, h:MM:SS am/pm ZZZ
    if ZoneInfo is not None:
        try:
            dt = datetime.fromtimestamp(doc_start_time, tz=ZoneInfo('America/New_York'))
            processing_date = dt.strftime('%Y-%m-%d, %-I:%M:%S %p %Z')
        except Exception:
            dt = datetime.fromtimestamp(doc_start_time)
            processing_date = dt.strftime('%Y-%m-%d, %H:%M:%S')
    else:
        dt = datetime.fromtimestamp(doc_start_time)
        processing_date = dt.strftime('%Y-%m-%d, %H:%M:%S')

    metadata = {
        "date_of_ocr_processing": f"Date of OCR Processing: {processing_date}",
        "ocr_model": model_name,
        #"ocr_model_initialization_time_seconds": tesseract_init_time_seconds,
        "python_version": platform.python_version(),
        "libraries": {
            "pytesseract": get_version_safe("pytesseract"),
            "pdf2image": get_version_safe("pdf2image"),
            "Pillow": get_version_safe("Pillow"),
            "psutil": get_version_safe("psutil"),
            "cpuinfo": get_version_safe("py-cpuinfo")
        },
        "system": {
            "platform": platform.platform(),
            "cpu": cpuinfo.get_cpu_info().get('brand_raw', 'unknown'),
            "cpu_count": psutil.cpu_count(logical=True),
            "total_memory_mb": psutil.virtual_memory().total / 1024 / 1024,
            "poppler_path": POPPLER_PATH,
            "tesseract_path": TESSERACT_PATH
        },
        "timing": {
            "document_start_time": doc_start_time,
            "document_end_time": doc_end_time,
            "total_time_seconds": doc_end_time - doc_start_time,
            "ocr_model_initialization_time_seconds": tesseract_init_time_seconds,
            "total_time_with_initialization_seconds": (doc_end_time - doc_start_time) + tesseract_init_time_seconds if tesseract_init_time_seconds else (doc_end_time - doc_start_time),
            "per_page_seconds": per_page_times
        },
        "resource_usage": {
            "per_page": {
                "cpu_percent": cpu_percents,
                "memory_mb": mem_usages
            },
            "document": {
                "avg_cpu_percent": sum(doc_cpu_samples) / len(doc_cpu_samples) if doc_cpu_samples else 0,
                "max_cpu_percent": max(doc_cpu_samples) if doc_cpu_samples else 0,
                "avg_process_memory_mb": sum(doc_mem_samples) / len(doc_mem_samples) if doc_mem_samples else 0,
                "max_process_memory_mb": max(doc_mem_samples) if doc_mem_samples else 0
            }
        },
        "per_page": {k: {"timing_seconds": v, "resource_usage": per_page_resources.get(k, {})} for k, v in per_page_times.items()}
    }

    return result_dict, metadata


def process_file(file_path, start_page=None, end_page=None):
    file_path = Path(file_path)
    if not file_path.exists():
        print(f"Error: file {file_path} does not exist!")
        return {}, {}

    if file_path.suffix.lower() == ".pdf":
        # convert to images and OCR
        images = pdf_to_images(file_path, start_page, end_page)
        result, metadata = ocr_images(images)
        # cleanup
        for img in images:
            try:
                os.remove(img)
            except Exception:
                pass
        # also provide combined text and per-page mapping
        combined = []
        pages = {}
        for p, lines in result.items():
            pages[p] = "\n".join(lines)
            combined.append(f"--- {p} ---\n" + pages[p])

        final = {"text": "\n".join(combined), "pages": pages}
        return final, metadata
    elif file_path.suffix.lower() in [".png", ".jpg", ".jpeg", ".bmp", ".tiff"]:
        res, meta = ocr_images([file_path])
        return res, meta
    else:
        print(f"Unsupported file type: {file_path.suffix}")
        return {}, {}


def process_folder(folder_path, start_page=None, end_page=None):
    folder = Path(folder_path)
    if not folder.exists():
        print(f"Error: folder {folder} does not exist!")
        return {}, {}

    all_results = {}
    all_metadata = {}
    for file in folder.iterdir():
        if file.suffix.lower() in [".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".tiff"]:
            res, meta = process_file(file, start_page, end_page)
            all_results.update(res if isinstance(res, dict) else {file.stem: res})
            all_metadata[file.name] = meta
    return all_results, all_metadata


def save_json(data, metadata, output_file):
    final_output = {"metadata": metadata, "results": data}
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=4, ensure_ascii=False)
    print(f"Results saved to: {output_file}")


if __name__ == "__main__":
    # simple CLI for local testing
    if len(sys.argv) < 2:
        print("Usage: python tesseract_driver.py path/to/file")
    else:
        res, meta = process_file(sys.argv[1])
        out = Path(sys.argv[1]).with_suffix('.tesseract.json')
        save_json(res, meta, out)
