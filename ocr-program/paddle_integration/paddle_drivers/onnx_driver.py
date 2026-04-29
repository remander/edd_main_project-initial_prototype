import os
import sys
import json
import time
from pathlib import Path
import tempfile
import psutil
import platform
import cpuinfo
import importlib.metadata
import cv2
import atexit
import numpy as np
from datetime import datetime
try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None

# Lazy imports for onnxtr
try:
    from onnxtr.io import DocumentFile
    from onnxtr.models import ocr_predictor
except ImportError as e:
    DocumentFile = None
    ocr_predictor = None
    ONNXTR_IMPORT_ERROR = e
else:
    ONNXTR_IMPORT_ERROR = None

# --- CONFIG ---
DETECTION_MODEL = "db_resnet50"
RECOGNITION_MODEL = "parseq"

temp_files = []


def get_version_safe(package_name):
    try:
        return importlib.metadata.version(package_name)
    except importlib.metadata.PackageNotFoundError:
        return "not installed"
    except Exception:
        return "unknown"


def cleanup_temp_files():
    for f in temp_files:
        try:
            if f.exists():
                f.unlink()
        except Exception:
            pass


atexit.register(cleanup_temp_files)


predictor = None
predictor_init_time_seconds = None


def setup_predictor(det_model: str, reco_model: str):
    global predictor, predictor_init_time_seconds
    if predictor is not None:
        return predictor
    if ONNXTR_IMPORT_ERROR:
        raise RuntimeError(
            f"onnxtr is not available: {ONNXTR_IMPORT_ERROR}. Install onnxtr and onnxruntime."
        )
    start = time.time()
    predictor = ocr_predictor(
        det_arch=det_model,
        reco_arch=reco_model,
        assume_straight_pages=False,
        detect_language=False,
        detect_orientation=True,
        export_as_straight_boxes=False,
        resolve_lines=True,
        resolve_blocks=False,
        det_bs=2,
        reco_bs=128,
    )
    predictor.det_predictor.model.postprocessor.box_thresh = 0.1
    predictor.det_predictor.model.postprocessor.bin_thresh = 0.3
    predictor_init_time_seconds = time.time() - start
    return predictor


def preprocess_image(image_path: Path):
    img = cv2.imread(str(image_path))
    if img is None:
        return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    preprocessed = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
    temp_file_path = Path(tempfile.mktemp(suffix=".jpg", prefix="preprocessed_"))
    temp_files.append(temp_file_path)
    cv2.imwrite(str(temp_file_path), preprocessed)
    return temp_file_path


def extract_text(doc):
    result = predictor(doc)
    if not result.pages:
        return [], []
    lines = []
    confidences = []
    for page in result.pages:
        for block in page.blocks:
            for line in block.lines:
                line_text = []
                line_conf = []
                for word in line.words:
                    line_text.append(word.value)
                    line_conf.append(getattr(word, "confidence", 1.0))
                if line_text:
                    lines.append(" ".join(line_text))
                    confidences.extend(line_conf)
    return lines, confidences


def ocr_images(image_paths):
    global predictor
    result_dict = {}
    per_page_times = {}
    cpu_percents = {}
    mem_usages = {}
    avg_confidences = {}

    process = psutil.Process(os.getpid())

    for img_path in image_paths:
        print(f"OCR processing: {img_path.name}")
        start_time = time.time()

        if img_path.suffix.lower() == ".pdf":
            doc = DocumentFile.from_pdf(str(img_path))
        else:
            preprocessed_path = preprocess_image(img_path)
            if preprocessed_path is None:
                result_dict[img_path.stem] = []
                per_page_times[img_path.stem] = 0.0
                cpu_percents[img_path.stem] = 0.0
                mem_usages[img_path.stem] = {"system_memory_mb": 0.0, "process_memory_mb": 0.0}
                avg_confidences[img_path.stem] = 0.0
                continue
            doc = DocumentFile.from_images(str(preprocessed_path))

        lines, confidences = extract_text(doc)
        result_dict[img_path.stem] = lines

        end_time = time.time()
        per_page_times[img_path.stem] = end_time - start_time

        cpu_percent = psutil.cpu_percent(interval=0.1)
        mem_used_sys = psutil.virtual_memory().used / 1024 / 1024
        mem_used_proc = process.memory_info().rss / 1024 / 1024
        cpu_percents[img_path.stem] = cpu_percent
        mem_usages[img_path.stem] = {
            "system_memory_mb": mem_used_sys,
            "process_memory_mb": mem_used_proc,
        }
        avg_confidences[img_path.stem] = float(np.mean(confidences)) if confidences else 0.0

    return result_dict, per_page_times, cpu_percents, mem_usages, avg_confidences


def build_metadata(doc_start_time, per_page_times, cpu_percents, mem_usages):
    doc_end_time = time.time()
    metadata = {}

    if ZoneInfo is not None:
        try:
            dt = datetime.fromtimestamp(doc_start_time, tz=ZoneInfo("America/New_York"))
            processing_date = dt.strftime("%Y-%m-%d, %-I:%M:%S %p %Z")
        except Exception:
            dt = datetime.fromtimestamp(doc_start_time)
            processing_date = dt.strftime("%Y-%m-%d, %H:%M:%S")
    else:
        dt = datetime.fromtimestamp(doc_start_time)
        processing_date = dt.strftime("%Y-%m-%d, %H:%M:%S")

    cpu_values = list(cpu_percents.values())
    mem_values = [m.get("process_memory_mb", 0) for m in mem_usages.values()]

    metadata = {
        "date_of_ocr_processing": f"Date of OCR Processing: {processing_date}",
        "ocr_model": f"onnxtr {DETECTION_MODEL}+{RECOGNITION_MODEL}",
        #"ocr_model_initialization_time_seconds": predictor_init_time_seconds,
        "python_version": platform.python_version(),
        "libraries": {
            "onnxtr": get_version_safe("onnxtr"),
            "onnxruntime": get_version_safe("onnxruntime"),
            "opencv-python": get_version_safe("opencv-python"),
            "numpy": get_version_safe("numpy"),
            "psutil": get_version_safe("psutil"),
            "py-cpuinfo": get_version_safe("py-cpuinfo"),
        },
        "system": {
            "platform": platform.platform(),
            "cpu": cpuinfo.get_cpu_info().get("brand_raw", "unknown"),
            "cpu_count": psutil.cpu_count(logical=True),
            "total_memory_mb": psutil.virtual_memory().total / 1024 / 1024,
        },
        "timing": {
            "document_start_time": doc_start_time,
            "document_end_time": doc_end_time,
            "total_time_seconds": doc_end_time - doc_start_time,
            "ocr_model_initialization_time_seconds": predictor_init_time_seconds,
            "total_time_with_initialization_seconds": (doc_end_time - doc_start_time)
            + (predictor_init_time_seconds or 0),
            "per_page_seconds": per_page_times,
        },
        "resource_usage": {
            "per_page": {
                "cpu_percent": cpu_percents,
                "memory_mb": mem_usages,
            },
            "document": {
                "avg_cpu_percent": sum(cpu_values) / len(cpu_values) if cpu_values else 0,
                "max_cpu_percent": max(cpu_values) if cpu_values else 0,
                "avg_process_memory_mb": sum(mem_values) / len(mem_values) if mem_values else 0,
                "max_process_memory_mb": max(mem_values) if mem_values else 0,
            },
        },
    }
    return metadata


def process_file(file_path: Path):
    if not file_path.exists():
        print(f"Error: file {file_path} does not exist!")
        return {}, {}

    setup_predictor(DETECTION_MODEL, RECOGNITION_MODEL)

    doc_start_time = time.time()
    results, per_page_times, cpu_percents, mem_usages, avg_conf = ocr_images([file_path])
    metadata = build_metadata(doc_start_time, per_page_times, cpu_percents, mem_usages)
    metadata["confidence"] = avg_conf
    return results, metadata


def process_folder(folder_path: Path):
    if not folder_path.exists():
        print(f"Error: folder {folder_path} does not exist!")
        return {}, {}

    setup_predictor(DETECTION_MODEL, RECOGNITION_MODEL)

    all_results = {}
    all_metadata = {}
    for file in folder_path.iterdir():
        if file.suffix.lower() in [".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif", ".webp"]:
            res, meta = process_file(file)
            all_results.update(res)
            all_metadata[file.name] = meta
    return all_results, all_metadata


def save_json(data, metadata, output_file):
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
        final_output = format_to_doctr(
            data,
            driver_meta=metadata,
            ocr_model_name=f"onnxtr {DETECTION_MODEL}+{RECOGNITION_MODEL}",
            document_name=doc_name,
            poppler_path=None,
            is_pdf=True,
        )
    else:
        final_output = {
            "metadata": metadata,
            "results": data,
        }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=4, ensure_ascii=False)
    print(f"Results saved to: {output_file}")


SCRIPT_DIR = Path(__file__).parent


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parents[2]
    sys.path.append(str(repo_root))
    from driver_interactive import interactive_select

    TEST_FILES_DIR = repo_root / "test_files"
    DEFAULT_OUTPUT_PARENT = SCRIPT_DIR.parent / "paddle_outputs"

    input_path, OUTPUT_DIR, output_json, start_page, end_page = interactive_select(TEST_FILES_DIR, DEFAULT_OUTPUT_PARENT)

    if input_path.is_file():
        results, metadata = process_file(input_path)
    else:
        results, metadata = process_folder(input_path)

    if results:
        save_json(results, metadata, output_json)
