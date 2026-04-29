"""Unified EasyOCR driver for images and PDFs with metadata collection."""
import os
import sys
import json
import time
import easyocr
from pathlib import Path
from collections import defaultdict
from pdf2image import convert_from_path
from PIL import Image
import platform
import psutil
import cpuinfo
import importlib.metadata
from datetime import datetime
try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None

# === CONFIGURATION ===
POPPLER_PATH = r"C:\Users\rmander\Documents\poppler-25.07.0\Library\bin"
Y_THRESHOLD = 10  # vertical threshold to group words into the same line
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "easy_full_output.json")

# Global to track EasyOCR initialization timing
easy_init_time_seconds = None


def get_version_safe(package_name):
    """Safely get package version."""
    try:
        return importlib.metadata.version(package_name)
    except importlib.metadata.PackageNotFoundError:
        return "not installed"
    except Exception:
        return "unknown"


def clean_for_json(obj):
    """Recursively remove non-JSON-serializable objects."""
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_for_json(item) for item in obj]
    elif isinstance(obj, str) or isinstance(obj, (int, float, bool)) or obj is None:
        return obj
    else:
        # Skip non-serializable objects
        return None


def _collect_metadata(start_time, end_time, cpu_samples, mem_samples):
    """Collect comprehensive metadata for the OCR process."""
    # Add processing date in format: YYYY-MM-DD, h:MM:SS am/pm ZZZ
    if ZoneInfo is not None:
        try:
            dt = datetime.fromtimestamp(start_time, tz=ZoneInfo('America/New_York'))
            processing_date = dt.strftime('%Y-%m-%d, %-I:%M:%S %p %Z')
        except Exception:
            dt = datetime.fromtimestamp(start_time)
            processing_date = dt.strftime('%Y-%m-%d, %H:%M:%S')
    else:
        dt = datetime.fromtimestamp(start_time)
        processing_date = dt.strftime('%Y-%m-%d, %H:%M:%S')
    
    return {
        "date_of_ocr_processing": f"Date of OCR Processing: {processing_date}",
        "ocr_model": "easyocr",
        #"ocr_model_initialization_time_seconds": easy_init_time_seconds,
        "python_version": platform.python_version(),
        "libraries": {
            "easyocr": get_version_safe("easyocr"),
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
            "poppler_path": POPPLER_PATH if os.path.exists(POPPLER_PATH) else None
        },
        "timing": {
            "document_start_time": start_time,
            "document_end_time": end_time,
            "total_time_seconds": end_time - start_time,
            "ocr_model_initialization_time_seconds": easy_init_time_seconds,
            "total_time_with_initialization_seconds": (end_time - start_time) + easy_init_time_seconds if easy_init_time_seconds else (end_time - start_time)
        },
        "resource_usage": {
            "document": {
                "avg_cpu_percent": sum(cpu_samples) / len(cpu_samples) if cpu_samples else 0,
                "max_cpu_percent": max(cpu_samples) if cpu_samples else 0,
                "avg_process_memory_mb": sum(mem_samples) / len(mem_samples) if mem_samples else 0,
                "max_process_memory_mb": max(mem_samples) if mem_samples else 0
            }
        }
    }


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
    """Run EasyOCR on images and merge words into lines.
    
    Returns:
        - results_map: dict mapping page_stem -> list[str] (lines of text)
        - per_page_times: dict mapping page_stem -> time in seconds
        - per_page_resources: dict mapping page_stem -> {cpu_percent, memory_mb}
    """
    global easy_init_time_seconds
    
    # Capture initialization timing on first use
    reader_init_start = time.time()
    reader = easyocr.Reader([lang], gpu=False)
    reader_init_end = time.time()
    easy_init_time_seconds = reader_init_end - reader_init_start
    
    results_by_page = {}
    per_page_times = {}
    per_page_resources = {}

    # Get initial process info
    proc = psutil.Process()
    
    for img_path in image_paths:
        page_start = time.time()
        initial_mem = proc.memory_info().rss / 1024 / 1024
        initial_cpu = proc.cpu_percent(interval=0.1)

        results = reader.readtext(img_path)
        lines_dict = defaultdict(list)
        page_lines = []

        for bbox, text, conf in results:
            y = int(bbox[0][1])  # top-left y-coordinate
            found_line = False
            for line_y in list(lines_dict.keys()):
                if abs(y - line_y) <= y_threshold:
                    lines_dict[line_y].append((bbox[0][0], text))
                    found_line = True
                    break
            if not found_line:
                lines_dict[y].append((bbox[0][0], text))

        # Sort lines by y, words by x, and join words
        for line_y in sorted(lines_dict.keys()):
            words = sorted(lines_dict[line_y], key=lambda x: x[0])
            line_text = " ".join(word for _, word in words)
            page_lines.append(line_text)

        page_end = time.time()
        final_mem = proc.memory_info().rss / 1024 / 1024
        final_cpu = proc.cpu_percent(interval=0.1)

        stem = Path(img_path).stem
        results_by_page[stem] = page_lines
        per_page_times[stem] = page_end - page_start
        per_page_resources[stem] = {
            "cpu_percent": final_cpu,
            "memory_mb": final_mem
        }

    return results_by_page, per_page_times, per_page_resources


def process_image(image_path):
    """Process a single image file."""
    if not os.path.isfile(image_path):
        print(f"Error: File not found: {image_path}")
        return {}, {}

    start_time = time.time()
    cpu_samples = []
    mem_samples = []
    proc = psutil.Process()

    # Sample CPU and memory during processing
    image = Image.open(image_path)
    
    # Run OCR
    results_map, per_page_times, per_page_resources = ocr_images([image_path])
    
    # Collect samples
    cpu_samples.append(proc.cpu_percent(interval=0.1))
    mem_samples.append(proc.memory_info().rss / 1024 / 1024)

    end_time = time.time()
    metadata = _collect_metadata(start_time, end_time, cpu_samples, mem_samples)
    
    # Attach per-page info to metadata
    metadata.setdefault('per_page', {})
    metadata['per_page'].update({k: {"timing_seconds": v} for k, v in per_page_times.items()})
    for k, v in per_page_resources.items():
        metadata['per_page'].setdefault(k, {}).update({"resource_usage": v})

    # Build output
    final_obj = {"results": results_map, "metadata": metadata}
    
    # Include per-page timing and resources
    for pk in results_map.keys():
        final_obj.setdefault('results_detailed', {})
        final_obj['results_detailed'].setdefault(pk, {})
        final_obj['results_detailed'][pk] = {
            'ocr': results_map.get(pk, []),
            'timing_seconds': per_page_times.get(pk),
            'resource_usage': per_page_resources.get(pk)
        }

    # Clean non-serializable objects before saving
    final_obj = clean_for_json(final_obj)
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_obj, f, indent=4, ensure_ascii=False)
    
    return results_map, metadata


def process_pdf(pdf_path, start_page=None, end_page=None):
    """Process a PDF file."""
    if not os.path.isfile(pdf_path):
        print(f"Error: File not found: {pdf_path}")
        return {}, {}

    start_time = time.time()
    cpu_samples = []
    mem_samples = []
    proc = psutil.Process()

    # Convert PDF to images
    image_files = pdf_to_images(pdf_path, start_page=start_page, end_page=end_page)
    
    # Run OCR on all pages
    results_map, per_page_times, per_page_resources = ocr_images(image_files)
    
    # Collect samples
    cpu_samples.append(proc.cpu_percent(interval=0.1))
    mem_samples.append(proc.memory_info().rss / 1024 / 1024)

    end_time = time.time()
    metadata = _collect_metadata(start_time, end_time, cpu_samples, mem_samples)
    
    # Attach per-page info to metadata
    metadata.setdefault('per_page', {})
    metadata['per_page'].update({k: {"timing_seconds": v} for k, v in per_page_times.items()})
    for k, v in per_page_resources.items():
        metadata['per_page'].setdefault(k, {}).update({"resource_usage": v})

    # Build output
    final_obj = {"results": results_map, "metadata": metadata}
    
    # Include per-page timing and resources
    combined = []
    pages = {}
    for p, lines in results_map.items():
        pages[p] = "\n".join(lines)
        combined.append(f"--- {p} ---\n" + pages[p])
        final_obj.setdefault('results_detailed', {})
        final_obj['results_detailed'][p] = {
            'ocr': lines,
            'timing_seconds': per_page_times.get(p),
            'resource_usage': per_page_resources.get(p)
        }
    
    final_text = "\n".join(combined)
    final_obj['results'] = {"text": final_text, "pages": pages}
    
    # Clean non-serializable objects before saving
    final_obj = clean_for_json(final_obj)
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_obj, f, indent=4, ensure_ascii=False)
    
    # Clean up temporary image files
    for img_path in image_files:
        try:
            os.remove(img_path)
        except Exception:
            pass
    
    return final_obj['results'], metadata


def process_file(file_path, start_page=None, end_page=None):
    """Dispatcher function to handle both images and PDFs."""
    p = Path(file_path)
    if p.suffix.lower() == '.pdf':
        return process_pdf(file_path, start_page=start_page, end_page=end_page)
    else:
        return process_image(file_path)


def process_folder(folder_path, start_page=None, end_page=None):
    """Process all images and PDFs in a folder."""
    all_results = {}
    all_metadata = {}
    
    for file in Path(folder_path).iterdir():
        if file.suffix.lower() in ['.png', '.jpg', '.jpeg', '.tiff', '.pdf']:
            try:
                print(f"Processing: {file.name}")
                res, meta = process_file(str(file), start_page, end_page)
                all_results.update(res if isinstance(res, dict) else {file.stem: res})
                all_metadata[file.name] = meta
            except Exception as e:
                print(f"Error processing {file.name}: {e}")
    
    return all_results, all_metadata


def save_json(data, metadata, output_file):
    """Save results and metadata to JSON."""
    # Clean non-serializable objects from both data and metadata
    data = clean_for_json(data)
    metadata = clean_for_json(metadata)
    final_output = {"metadata": metadata, "results": data}
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=4, ensure_ascii=False)
    print(f"Results saved to: {output_file}")


if __name__ == '__main__':
    # Interactive simple test
    if len(sys.argv) < 2:
        print('Usage: python easy_driver.py path/to/file')
    else:
        res, meta = process_file(sys.argv[1])
        out = Path(sys.argv[1]).stem
        out = os.path.join(SCRIPT_DIR, f"{out}.easy.json")
        save_json(res, meta, str(out))
