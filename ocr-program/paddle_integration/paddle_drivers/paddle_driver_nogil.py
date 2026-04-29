#!/usr/bin/env python3
"""
Free-threading OCR processor with GIL explicitly disabled
This version runs with PYTHONGIL=0 environment variable for maximum performance
"""
import os
import sys
import json
import time
from pathlib import Path
from pdf2image import convert_from_path
import platform
from paddleocr import PaddleOCR
import psutil
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from PIL import Image

# ---------------- CONFIG ----------------
# Prefer system poppler on macOS / linux (installed via brew/apt). Keep Windows path as default.
if platform.system() == "Windows":
    POPPLER_PATH = r"C:\Users\rmander\Documents\poppler-25.07.0\Library\bin"
else:
    POPPLER_PATH = None

OCR_MODEL_NAME = "PP-OCRv5_mobile"

# Thread-local storage for OCR instances
_thread_local = threading.local()

def get_ocr_instance():
    """Get or create OCR instance for current thread"""
    if not hasattr(_thread_local, 'ocr_instance'):
        _thread_local.ocr_instance = PaddleOCR(use_angle_cls=False, lang="en")
    return _thread_local.ocr_instance

def preprocess_image_fast(image_path):
    """Fast image preprocessing for OCR optimization"""
    try:
        img = Image.open(image_path)
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Aggressive resizing for speed
        width, height = img.size
        if width > 1400 or height > 1400:
            ratio = min(1400/width, 1400/height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            img = img.resize((new_width, new_height), Image.Resampling.BILINEAR)
            
            processed_path = image_path.parent / f"{image_path.stem}_fast.png"
            img.save(processed_path, "PNG", compress_level=0)
            return processed_path
        
        return image_path
    except Exception as e:
        print(f"Error preprocessing {image_path}: {e}")
        return image_path

def ocr_single_image_nogil(img_path):
    """OCR processing optimized for GIL-free execution"""
    start_time = time.time()
    thread_id = threading.current_thread().ident
    
    try:
        ocr = get_ocr_instance()
        processed_path = preprocess_image_fast(img_path)
        
        # This OCR work can now run in parallel across threads!
        results = ocr.predict(str(processed_path))
        text_results = []
        
        if results and len(results) > 0:
            text_results = [
                line.strip() for line in results[0].get("rec_texts", [])
                if isinstance(line, str) and line.strip()
            ]
        
        # Cleanup
        if processed_path != img_path:
            try:
                os.remove(processed_path)
            except:
                pass
        
        end_time = time.time()
        
        return {
            "page": img_path.stem,
            "text": text_results,
            "time": end_time - start_time,
            "thread_id": thread_id,
            "cpu_percent": psutil.cpu_percent(interval=0.01),
            "memory_mb": {
                "system_memory_mb": psutil.virtual_memory().used / 1024 / 1024,
                "process_memory_mb": psutil.Process().memory_info().rss / 1024 / 1024
            }
        }
        
    except Exception as e:
        print(f"Error processing {img_path}: {e}")
        return {
            "page": img_path.stem,
            "text": [],
            "time": 0,
            "thread_id": thread_id,
            "cpu_percent": 0,
            "memory_mb": {"system_memory_mb": 0, "process_memory_mb": 0}
        }

def process_with_nogil(image_paths, max_workers=None):
    """Process images with GIL disabled"""
    if not image_paths:
        return {}, {}
    
    result_dict = {}
    per_page_times = {}
    cpu_percents = {}
    mem_usages = {}
    thread_usage = {}

    doc_start_time = time.time()
    doc_cpu_samples = []
    doc_mem_samples = []

    if max_workers is None:
        cpu_count = psutil.cpu_count(logical=True)
        # Very aggressive threading since no GIL
        max_workers = min(len(image_paths), cpu_count * 3)
    
    gil_enabled = getattr(sys, '_is_gil_enabled', lambda: True)()
    print(f"🚀 NO-GIL Processing: {len(image_paths)} images with {max_workers} threads")
    print(f"🔓 GIL Status: {'DISABLED' if not gil_enabled else 'Still Enabled'}")
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(ocr_single_image_nogil, img): img for img in image_paths}
        
        for future in as_completed(futures):
            try:
                res = future.result()
                page = res["page"] 
                result_dict[page] = res["text"]
                per_page_times[page] = res["time"]
                cpu_percents[page] = res["cpu_percent"]
                mem_usages[page] = res["memory_mb"]
                thread_usage[page] = res["thread_id"]

                doc_cpu_samples.append(res["cpu_percent"])
                doc_mem_samples.append(res["memory_mb"]["process_memory_mb"])
                
                print(f"⚡ {page}: {res['time']:.2f}s (thread-{res['thread_id']}) ({len(res['text'])} lines)")
                
            except Exception as e:
                print(f"❌ Error: {e}")

    doc_end_time = time.time()

    metadata = {
        "ocr_model": OCR_MODEL_NAME,
        "processing_strategy": "no_gil_threading",
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "gil_enabled": sys._is_gil_enabled() if hasattr(sys, '_is_gil_enabled') else "unknown",
        "timing": {
            "document_start_time": doc_start_time,
            "document_end_time": doc_end_time,
            "total_time_seconds": doc_end_time - doc_start_time,
            "per_page_seconds": per_page_times
        },
        "resource_usage": {
            "per_page": {
                "cpu_percent": cpu_percents,
                "memory_mb": mem_usages,
                "thread_id": thread_usage
            },
            "document": {
                "avg_cpu_percent": sum(doc_cpu_samples)/len(doc_cpu_samples) if doc_cpu_samples else 0,
                "max_cpu_percent": max(doc_cpu_samples) if doc_cpu_samples else 0,
                "avg_process_memory_mb": sum(doc_mem_samples)/len(doc_mem_samples) if doc_mem_samples else 0,
                "max_process_memory_mb": max(doc_mem_samples) if doc_mem_samples else 0,
                "unique_threads_used": len(set(thread_usage.values())),
                "total_threads_available": max_workers
            }
        },
        "optimization_settings": {
            "max_workers": max_workers,
            "executor_type": "ThreadPoolExecutor_NoGIL",
            "dpi": 100,
            "threading_strategy": "massive_parallelism",
            "image_preprocessing": "aggressive_resizing",
            "thread_local_ocr_instances": True
        }
    }

    return result_dict, metadata

def pdf_to_images_fast(pdf_path, start_page=None, end_page=None):
    """Fast PDF to images conversion"""
    try:
        pages = convert_from_path(
            pdf_path, 
            dpi=100,
            poppler_path=POPPLER_PATH,
            first_page=start_page, 
            last_page=end_page,
            thread_count=6
        )
        
        pdf_dir = Path(pdf_path).parent
        base_name = Path(pdf_path).stem
        
        image_paths = []
        with ThreadPoolExecutor(max_workers=12) as executor:
            def save_image(page_data):
                page, i = page_data
                img_path = pdf_dir / f"{base_name}_page_{i}.png"
                page.save(img_path, "PNG", compress_level=0)
                return img_path
            
            page_data = [(page, i) for i, page in enumerate(pages, start=(start_page or 1))]
            futures = [executor.submit(save_image, pd) for pd in page_data]
            
            for future in as_completed(futures):
                img_path = future.result()
                image_paths.append(img_path)
        
        return sorted(image_paths)
        
    except Exception as e:
        print(f"Error converting PDF: {e}")
        return []

def save_json(data, metadata, output_file):
    """Save results to JSON file"""
    final_output = {
        "metadata": metadata,
        "results": data
    }
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
        final_output = format_to_doctr(data, driver_meta=metadata, ocr_model_name=OCR_MODEL_NAME, document_name=doc_name, poppler_path=POPPLER_PATH, is_pdf=True)
        # Ensure the top-level date field is present (some driver metadata may omit it)
        try:
            meta = final_output.get('metadata', {})
            if not meta.get('date_of_ocr_processing'):
                # Ask formatter to generate a default metadata block and copy its date
                default_meta = format_to_doctr({}, driver_meta={}, ocr_model_name=OCR_MODEL_NAME, document_name=doc_name, poppler_path=POPPLER_PATH, is_pdf=True).get('metadata', {})
                if default_meta.get('date_of_ocr_processing'):
                    meta['date_of_ocr_processing'] = default_meta['date_of_ocr_processing']
                    final_output['metadata'] = meta
        except Exception:
            pass
    else:
        final_output = {
            "metadata": metadata,
            "results": data
        }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=4, ensure_ascii=False)
    print(f"💾 Results saved to: {output_file}")

if __name__ == "__main__":
    # Interactive helper for consistent UX
    SCRIPT_DIR = Path(__file__).parent
    repo_root = Path(__file__).resolve().parents[2]
    sys.path.append(str(repo_root))
    from driver_interactive import interactive_select

    TEST_FILES_DIR = repo_root / "test_files"
    DEFAULT_OUTPUT_PARENT = SCRIPT_DIR.parent / "paddle_outputs"

    input_path, OUTPUT_DIR, output_json, start_page, end_page = interactive_select(TEST_FILES_DIR, DEFAULT_OUTPUT_PARENT)

    if not input_path.is_file() or input_path.suffix.lower() != ".pdf":
        print("❌ Please provide a PDF file")
        sys.exit(1)

    # Default very aggressive threading when GIL disabled
    max_workers = psutil.cpu_count(logical=True) * 3

    overall_start = time.time()

    print("🔄 Converting PDF...")
    images = pdf_to_images_fast(input_path, start_page, end_page)
    if images:
        print("🔄 Processing with NO-GIL OCR...")
        results, metadata = process_with_nogil(images, max_workers)

        # Cleanup
        for img in images:
            try:
                os.remove(img)
            except:
                pass
    else:
        results, metadata = {}, {}

    overall_end = time.time()
    total_time = overall_end - overall_start

    if results:
        save_json(results, metadata, output_json)
        print(f"Saved results to {output_json}")
    else:
        print("❌ No results to save")