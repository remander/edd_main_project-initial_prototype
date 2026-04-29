from PIL import Image
import sys
import os
import json
import time
from pathlib import Path
from datetime import datetime
try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None

# Ensure repository root is on sys.path so `from surya...` works when
# executing this script directly (e.g. `python surya/surya_driver.py`).
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.append(str(REPO_ROOT))

try:
    from surya.foundation import FoundationPredictor
    from surya.recognition import RecognitionPredictor
    from surya.detection import DetectionPredictor
except Exception as e:
    # Raise an informative error when local `surya` package is not importable
    raise ImportError(f"Failed to import local 'surya' package: {e}\nMake sure you're running this from the repository root or that the package is installed.")

try:
    import pypdfium2 as pdfium
except Exception:
    pdfium = None

try:
    from tools.doctr_formatter import format_to_doctr
except Exception:
    format_to_doctr = None

import platform
import psutil
import cpuinfo
import importlib.metadata


def get_version_safe(package_name):
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
        # Skip non-serializable objects (like SuryaModel, tensors, etc.)
        return None


# === CONFIGURATION ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "surya_full_output.json")

# Global to track Surya initialization timing
surya_init_time_seconds = None


def _collect_metadata(start_time, end_time, samples_cpu, samples_mem):
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
        "ocr_model": "surya",
        #"ocr_model_initialization_time_seconds": surya_init_time_seconds,
        "python_version": platform.python_version(),
        "libraries": {
            "pypdfium2": get_version_safe("pypdfium2") if pdfium is not None else "not installed",
            "surya": get_version_safe("surya-ocr"),
            "Pillow": get_version_safe("Pillow"),
            "psutil": get_version_safe("psutil"),
            "cpuinfo": get_version_safe("py-cpuinfo")
        },
        "system": {
            "platform": platform.platform(),
            "cpu": cpuinfo.get_cpu_info().get('brand_raw', 'unknown'),
            "cpu_count": psutil.cpu_count(logical=True),
            "total_memory_mb": psutil.virtual_memory().total / 1024 / 1024,
            "poppler_path": None
        },
        "timing": {
            "document_start_time": start_time,
            "document_end_time": end_time,
            "total_time_seconds": end_time - start_time,
            "ocr_model_initialization_time_seconds": surya_init_time_seconds,
            "total_time_with_initialization_seconds": (end_time - start_time) + surya_init_time_seconds if surya_init_time_seconds else (end_time - start_time)
        },
        "resource_usage": {
            "document": {
                "avg_cpu_percent": sum(samples_cpu) / len(samples_cpu) if samples_cpu else 0,
                "max_cpu_percent": max(samples_cpu) if samples_cpu else 0,
                "avg_process_memory_mb": sum(samples_mem) / len(samples_mem) if samples_mem else 0,
                "max_process_memory_mb": max(samples_mem) if samples_mem else 0
            }
        }
    }


def process_image(image_path):
    global surya_init_time_seconds
    image = Image.open(image_path)

    # Initialize predictors and capture timing only on first call
    if surya_init_time_seconds is None:
        init_start = time.time()
        foundation_predictor = FoundationPredictor()
        recognition_predictor = RecognitionPredictor(foundation_predictor)
        detection_predictor = DetectionPredictor()
        init_end = time.time()
        surya_init_time_seconds = init_end - init_start
    else:
        foundation_predictor = FoundationPredictor()
        recognition_predictor = RecognitionPredictor(foundation_predictor)
        detection_predictor = DetectionPredictor()

    print(f"Processing image: {os.path.basename(image_path)}...")

    # document/page-level timing & resource tracking
    start_time = time.time()
    cpu_samples = []
    mem_samples = []
    per_page_times = {}
    per_page_resources = {}
    process = psutil.Process(os.getpid())

    predictions = recognition_predictor([image], det_predictor=detection_predictor)

    all_text = []
    for prediction in predictions:
        for text_line in prediction.text_lines:
            all_text.append(text_line.text)

    page_time = time.time() - start_time
    cpu_snapshot = psutil.cpu_percent(interval=0.1)
    mem_snapshot = process.memory_info().rss / 1024 / 1024

    cpu_samples.append(cpu_snapshot)
    mem_samples.append(mem_snapshot)

    stem = Path(image_path).stem
    page_key = f"{stem}_page_1"
    results_map = {page_key: all_text}
    per_page_times[page_key] = page_time
    per_page_resources[page_key] = {"cpu_percent": cpu_snapshot, "memory_mb": mem_snapshot}

    end_time = time.time()

    metadata = _collect_metadata(start_time, end_time, cpu_samples, mem_samples)
    # attach per-page info to metadata for downstream formatting
    metadata.setdefault('per_page', {})
    metadata['per_page'].update({k: {"timing_seconds": v} for k, v in per_page_times.items()})
    for k, v in per_page_resources.items():
        metadata['per_page'].setdefault(k, {}).update({"resource_usage": v})

    # Build output without using doctr formatter (it has serialization issues)
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
    global surya_init_time_seconds
    if pdfium is None:
        raise RuntimeError("pypdfium2 is required to process PDFs for surya")

    pdf = pdfium.PdfDocument(pdf_path)

    # Initialize predictors and capture timing only on first call
    if surya_init_time_seconds is None:
        init_start = time.time()
        foundation_predictor = FoundationPredictor()
        recognition_predictor = RecognitionPredictor(foundation_predictor)
        detection_predictor = DetectionPredictor()
        init_end = time.time()
        surya_init_time_seconds = init_end - init_start
    else:
        foundation_predictor = FoundationPredictor()
        recognition_predictor = RecognitionPredictor(foundation_predictor)
        detection_predictor = DetectionPredictor()

    results_map = {}

    start_time = time.time()
    cpu_samples = []
    mem_samples = []
    process = psutil.Process(os.getpid())

    for i, page in enumerate(pdf):
        page_no = i + 1
        if start_page and page_no < start_page:
            continue
        if end_page and page_no > end_page:
            break
        image = page.render(scale=1).to_pil()
        print(f"Processing page {page_no}...")

        page_start = time.time()
        predictions = recognition_predictor([image], det_predictor=detection_predictor)
        page_lines = []
        for prediction in predictions:
            for text_line in prediction.text_lines:
                page_lines.append(text_line.text)

        page_time = time.time() - page_start
        cpu_snapshot = psutil.cpu_percent(interval=0.1)
        mem_snapshot = process.memory_info().rss / 1024 / 1024

        stem = Path(pdf_path).stem
        page_key = f"{stem}_page_{page_no}"
        results_map[page_key] = page_lines

        per_page_times[page_key] = page_time
        per_page_resources[page_key] = {"cpu_percent": cpu_snapshot, "memory_mb": mem_snapshot}

        cpu_samples.append(cpu_snapshot)
        mem_samples.append(mem_snapshot)

    pdf.close()
    end_time = time.time()

    metadata = _collect_metadata(start_time, end_time, cpu_samples, mem_samples)
    # attach per-page info to metadata for downstream formatting
    metadata.setdefault('per_page', {})
    metadata['per_page'].update({k: {"timing_seconds": v} for k, v in per_page_times.items()})
    for k, v in per_page_resources.items():
        metadata['per_page'].setdefault(k, {}).update({"resource_usage": v})

    # Build output without using doctr formatter (it has serialization issues)
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
    
    return final_obj['results'], metadata


def process_file(file_path, start_page=None, end_page=None):
    p = Path(file_path)
    if p.suffix.lower() == '.pdf':
        return process_pdf(file_path, start_page=start_page, end_page=end_page)
    else:
        return process_image(file_path)


def process_folder(folder_path, start_page=None, end_page=None):
    folder = Path(folder_path)
    if not folder.exists():
        print(f"Error: folder {folder} does not exist!")
        return {}, {}

    all_results = {}
    all_metadata = {}
    for file in folder.iterdir():
        if file.suffix.lower() in ['.pdf', '.png', '.jpg', '.jpeg', '.bmp', '.tiff']:
            res, meta = process_file(file, start_page, end_page)
            all_results.update(res if isinstance(res, dict) else {file.stem: res})
            all_metadata[file.name] = meta
    return all_results, all_metadata


def save_json(data, metadata, output_file):
    # write a simple JSON with metadata
    # Clean non-serializable objects from both data and metadata
    data = clean_for_json(data)
    metadata = clean_for_json(metadata)
    final_output = {"metadata": metadata, "results": data}
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=4, ensure_ascii=False)
    print(f"Results saved to: {output_file}")


if __name__ == '__main__':
    # interactive simple test
    if len(sys.argv) < 2:
        print('Usage: python surya_driver.py path/to/file')
    else:
        res, meta = process_file(sys.argv[1])
        out = Path(sys.argv[1]).with_suffix('.surya.json')
        save_json(res, meta, str(out))
