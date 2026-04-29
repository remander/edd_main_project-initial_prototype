import os
import sys
import json
import time
from pathlib import Path
from pdf2image import convert_from_path
from paddleocr import PaddleOCR
import psutil
import platform
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
POPPLER_PATH = r"C:\Users\rmander\Documents\poppler-25.07.0\Library\bin"
ocr_model_name = "PP-OCRv5_mobile"
ocr = None
ocr_init_time_seconds = None

def pdf_to_images(pdf_path, start_page=None, end_page=None):
    pages = convert_from_path(
        pdf_path, dpi=200, poppler_path=POPPLER_PATH,
        first_page=start_page, last_page=end_page
    )
    image_paths = []
    pdf_dir = Path(pdf_path).parent
    base_name = Path(pdf_path).stem
    for i, page in enumerate(pages, start=(start_page or 1)):
        img_path = pdf_dir / f"{base_name}_page_{i}.png"
        page.save(img_path, "PNG")
        image_paths.append(img_path)
    return image_paths

def ocr_images(image_paths):
    global ocr, ocr_init_time_seconds
    result_dict = {}
    per_page_times = {}
    cpu_percents = {}
    mem_usages = {}

    # Initialize PaddleOCR on first use and capture timing
    if ocr is None:
        init_start = time.time()
        ocr = PaddleOCR(use_textline_orientation=True, lang="en")
        init_end = time.time()
        ocr_init_time_seconds = init_end - init_start

    # Track document-wide stats
    doc_start_time = time.time()
    doc_cpu_samples = []
    doc_mem_samples = []

    process = psutil.Process(os.getpid())

    for img_path in image_paths:
        print(f"OCR processing: {img_path.name}")
        start_time = time.time()

        results = ocr.predict(str(img_path))
        res = results[0]
        result_dict[img_path.stem] = res["rec_texts"]

        end_time = time.time()
        per_page_times[img_path.stem] = end_time - start_time

        # Resource usage snapshot (system + process)
        cpu_percent = psutil.cpu_percent(interval=0.1)
        mem_used_sys = psutil.virtual_memory().used / 1024 / 1024  # MB
        mem_used_proc = process.memory_info().rss / 1024 / 1024   # MB

        cpu_percents[img_path.stem] = cpu_percent
        mem_usages[img_path.stem] = {
            "system_memory_mb": mem_used_sys,
            "process_memory_mb": mem_used_proc
        }

        doc_cpu_samples.append(cpu_percent)
        doc_mem_samples.append(mem_used_proc)

    doc_end_time = time.time()
    
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
        "ocr_model": ocr_model_name,
        #"ocr_model_initialization_time_seconds": ocr_init_time_seconds,
        "python_version": platform.python_version(),
        "libraries": {
            "pdf2image": get_version_safe("pdf2image"),
            "paddleocr": get_version_safe("paddleocr"),
            "Pillow": get_version_safe("Pillow"),
            "psutil": get_version_safe("psutil"),
            "cpuinfo": get_version_safe("py-cpuinfo")
        },
        "system": {
            "platform": platform.platform(),
            "cpu": cpuinfo.get_cpu_info().get('brand_raw', 'unknown'),
            "cpu_count": psutil.cpu_count(logical=True),
            "total_memory_mb": psutil.virtual_memory().total / 1024 / 1024,
            "poppler_path": POPPLER_PATH
        },
        "timing": {
            "document_start_time": doc_start_time,
            "document_end_time": doc_end_time,
            "total_time_seconds": doc_end_time - doc_start_time,
            "ocr_model_initialization_time_seconds": ocr_init_time_seconds,
            "total_time_with_initialization_seconds": (doc_end_time - doc_start_time) + ocr_init_time_seconds if ocr_init_time_seconds else (doc_end_time - doc_start_time),
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
        }
    }

    return result_dict, metadata


def process_file(file_path, start_page=None, end_page=None):
    file_path = Path(file_path)
    if not file_path.exists():
        print(f"Error: file {file_path} does not exist!")
        return {}, {}

    if file_path.suffix.lower() == ".pdf":
        images = pdf_to_images(file_path, start_page, end_page)
        result, metadata = ocr_images(images)
        # Cleanup intermediate PNGs
        for img in images:
            try:
                os.remove(img)
            except:
                pass
    elif file_path.suffix.lower() in [".png", ".jpg", ".jpeg", ".bmp", ".tiff"]:
        result, metadata = ocr_images([file_path])
    else:
        print(f"Unsupported file type: {file_path.suffix}")
        return {}, {}
    return result, metadata

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
            all_results.update(res)
            all_metadata[file.name] = meta
    return all_results, all_metadata

def save_json(data, metadata, output_file):
    # Normalize output to doctr format when possible
    try:
        from tools.doctr_formatter import format_to_doctr
    except Exception:
        format_to_doctr = None

    if format_to_doctr:
        doc_name = None
        try:
            doc_name = Path(output_file).stem
        except Exception:
            doc_name = None
        final_output = format_to_doctr(data, driver_meta=metadata, ocr_model_name=ocr_model_name, document_name=doc_name, poppler_path=POPPLER_PATH, is_pdf=True)
    else:
        final_output = {
            "metadata": metadata,
            "results": data
        }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=4, ensure_ascii=False)
    print(f"Results saved to: {output_file}")

# Get folder where this script lives (paddle_integration)
SCRIPT_DIR = Path(__file__).parent

if __name__ == "__main__":
    # Use the shared interactive helper to keep consistent behavior across drivers
    repo_root = Path(__file__).resolve().parents[2]
    sys.path.append(str(repo_root))
    from driver_interactive import interactive_select

    TEST_FILES_DIR = repo_root / "test_files"
    DEFAULT_OUTPUT_PARENT = SCRIPT_DIR.parent / "paddle_outputs"

    input_path, OUTPUT_DIR, output_json, start_page, end_page = interactive_select(TEST_FILES_DIR, DEFAULT_OUTPUT_PARENT)

    if input_path.is_file():
        results, metadata = process_file(input_path, start_page, end_page)
    else:
        results, metadata = process_folder(input_path, start_page, end_page)

    if results:
        save_json(results, metadata, output_json)

