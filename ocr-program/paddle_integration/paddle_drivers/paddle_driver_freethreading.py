import os
import sys
import json
import time
from pathlib import Path
from pdf2image import convert_from_path
from paddleocr import PaddleOCR
import psutil
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from PIL import Image

# ---------------- CONFIG ----------------
POPPLER_PATH = r"C:\Users\rmander\Documents\poppler-25.07.0\Library\bin"
OCR_MODEL_NAME = "PP-OCRv5_mobile"

# Thread-local storage for OCR instances (free-threading optimized)
_thread_local = threading.local()

def get_ocr_instance():
    """Get or create OCR instance for current thread (optimized for free-threading)"""
    if not hasattr(_thread_local, 'ocr_instance'):
        _thread_local.ocr_instance = PaddleOCR(use_angle_cls=False, lang="en")
    return _thread_local.ocr_instance

# ---------------- FREE-THREADING OPTIMIZED PDF CONVERSION ----------------
def pdf_to_images_with_threading(pdf_path, start_page=None, end_page=None):
    """Convert PDF to images using threading for I/O operations"""
    convert_start = time.time()
    
    try:
        # Step 1: Convert PDF pages (poppler handles its own threading)
        pages = convert_from_path(
            pdf_path, 
            dpi=100,  # Optimized for speed
            poppler_path=POPPLER_PATH,
            first_page=start_page, 
            last_page=end_page,
            thread_count=6  # Poppler internal threading
        )
        
        pdf_dir = Path(pdf_path).parent
        base_name = Path(pdf_path).stem
        
        # Step 2: Use ThreadPoolExecutor for image saving (I/O bound)
        def save_image(page_data):
            page, i = page_data
            img_path = pdf_dir / f"{base_name}_page_{i}.png"
            page.save(img_path, "PNG", compress_level=0)  # No compression for speed
            return img_path
        
        image_paths = []
        
        # More aggressive threading for I/O since we have free-threading
        with ThreadPoolExecutor(max_workers=12) as executor:  # Use all logical cores
            page_data = [(page, i) for i, page in enumerate(pages, start=(start_page or 1))]
            futures = [executor.submit(save_image, pd) for pd in page_data]
            
            for future in as_completed(futures):
                img_path = future.result()
                image_paths.append(img_path)
        
        convert_end = time.time()
        print(f"✅ PDF converted in {convert_end - convert_start:.2f}s (free-threading I/O)")
        
        return sorted(image_paths)
        
    except Exception as e:
        print(f"❌ Error converting PDF: {e}")
        return []

# ---------------- OPTIMIZED IMAGE PREPROCESSING ----------------
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

# ---------------- FREE-THREADING OCR PROCESSING ----------------
def ocr_single_image_freethreading(img_path):
    """Free-threading optimized OCR processing with thread-local OCR instances"""
    start_time = time.time()
    thread_id = threading.current_thread().ident
    
    try:
        # Get thread-local OCR instance (no serialization overhead!)
        ocr = get_ocr_instance()
        
        # Fast preprocessing
        processed_path = preprocess_image_fast(img_path)
        
        # OCR processing - now truly parallel thanks to free-threading!
        results = ocr.predict(str(processed_path))
        text_results = []
        
        if results and len(results) > 0:
            text_results = [
                line.strip() for line in results[0].get("rec_texts", [])
                if isinstance(line, str) and line.strip()
            ]
        
        # Quick cleanup
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

# ---------------- FREE-THREADING PARALLEL PROCESSING ----------------
def ocr_images_freethreading_parallel(image_paths, max_workers=None):
    """Free-threading parallel OCR processing - CPU work in threads!"""
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

    # With free-threading, we can use more threads for CPU-bound work
    if max_workers is None:
        cpu_count = psutil.cpu_count(logical=True)
        # Aggressive threading since GIL won't block CPU-bound operations
        max_workers = min(len(image_paths), cpu_count * 2)
    
    print(f"🚀 Free-Threading Processing: {len(image_paths)} images with {max_workers} threads")
    print(f"🧵 Using ThreadPoolExecutor for CPU-bound OCR work (no GIL!)")
    
    # Key difference: Using ThreadPoolExecutor for CPU-bound work!
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        
        futures = {executor.submit(ocr_single_image_freethreading, img): img for img in image_paths}
        
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
                
                print(f"🚀 {page}: {res['time']:.2f}s (thread-{res['thread_id']}) ({len(res['text'])} lines)")
                
            except Exception as e:
                print(f"❌ Error: {e}")

    doc_end_time = time.time()

    metadata = {
        "ocr_model": OCR_MODEL_NAME,
        "processing_strategy": "free_threading_with_thread_pool_executor",
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
            "executor_type": "ThreadPoolExecutor",
            "dpi": 100,
            "threading_strategy": "cpu_and_io_operations",
            "image_preprocessing": "aggressive_resizing",
            "thread_local_ocr_instances": True
        }
    }

    return result_dict, metadata

# ---------------- MAIN PROCESSING ----------------
def process_file_freethreading(file_path, start_page=None, end_page=None, max_workers=None):
    """Free-threading file processing"""
    file_path = Path(file_path)
    if not file_path.exists():
        return {}, {}

    if file_path.suffix.lower() == ".pdf":
        print("🔄 Converting PDF with free-threading...")
        
        # Use threading for PDF conversion I/O
        images = pdf_to_images_with_threading(file_path, start_page, end_page)
        if not images:
            return {}, {}
        
        print("🔄 Processing with free-threading OCR (CPU work in threads!)...")
        result, metadata = ocr_images_freethreading_parallel(images, max_workers)
        
        # Use threading for cleanup (I/O bound)
        def cleanup_images():
            for img in images:
                try:
                    os.remove(img)
                except:
                    pass
        
        # Run cleanup in background thread
        cleanup_thread = threading.Thread(target=cleanup_images)
        cleanup_thread.start()
        
        return result, metadata
    
    else:
        print(f"❌ Unsupported file type: {file_path.suffix}")
        return {}, {}

def save_json(data, metadata, output_file):
    """Save results to JSON file"""
    # Normalize to doctr format when formatter is available
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
    else:
        final_output = {
            "metadata": metadata,
            "results": data
        }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=4, ensure_ascii=False)
    print(f"\ud83d\udcbe Results saved to: {output_file}")

# ---------------- MAIN ----------------
if __name__ == "__main__":
    # Interactive selection to provide consistent UX
    SCRIPT_DIR = Path(__file__).parent
    repo_root = Path(__file__).resolve().parents[2]
    sys.path.append(str(repo_root))
    from driver_interactive import interactive_select

    TEST_FILES_DIR = repo_root / "test_files"
    DEFAULT_OUTPUT_PARENT = SCRIPT_DIR.parent / "paddle_outputs"

    input_path, OUTPUT_DIR, output_json, start_page, end_page = interactive_select(TEST_FILES_DIR, DEFAULT_OUTPUT_PARENT)

    if input_path.is_file():
        max_workers = psutil.cpu_count(logical=True) * 2
        results, metadata = process_file_freethreading(input_path, start_page, end_page, max_workers)
    else:
        print("❌ Folder processing not supported")
        sys.exit(1)

    if results:
        save_json(results, metadata, output_json)
        print(f"Saved results to {output_json}")
    else:
        print("❌ No results to save")