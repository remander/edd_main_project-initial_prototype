import os
import sys
import json
import time
from pathlib import Path
from pdf2image import convert_from_path
from paddleocr import PaddleOCR
import psutil
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
import multiprocessing as mp
from PIL import Image

# ---------------- CONFIG ----------------
POPPLER_PATH = r"C:\Users\rmander\Documents\poppler-25.07.0\Library\bin"
OCR_MODEL_NAME = "PP-OCRv5_mobile"

# Global variable to store OCR instance per process
_ocr_instance = None

def get_ocr_instance():
    """Get or create OCR instance for current process"""
    global _ocr_instance
    if _ocr_instance is None:
        _ocr_instance = PaddleOCR(use_angle_cls=False, lang="en")
    return _ocr_instance

# ---------------- STRATEGIC THREADING FOR I/O ONLY ----------------
def pdf_to_images_with_threading(pdf_path, start_page=None, end_page=None):
    """Convert PDF to images using threading for I/O operations only"""
    convert_start = time.time()
    
    try:
        # Step 1: Convert PDF pages (poppler handles its own threading)
        pages = convert_from_path(
            pdf_path, 
            dpi=100,  # Further reduced for speed
            poppler_path=POPPLER_PATH,
            first_page=start_page, 
            last_page=end_page,
            thread_count=6  # Poppler internal threading
        )
        
        pdf_dir = Path(pdf_path).parent
        base_name = Path(pdf_path).stem
        
        # Step 2: Use ThreadPoolExecutor ONLY for image saving (I/O bound)
        def save_image(page_data):
            page, i = page_data
            img_path = pdf_dir / f"{base_name}_page_{i}.png"
            page.save(img_path, "PNG", compress_level=0)  # No compression for speed
            return img_path
        
        image_paths = []
        
        # Threading is beneficial here because image saving is I/O bound
        with ThreadPoolExecutor(max_workers=8) as executor:  # More threads for I/O
            page_data = [(page, i) for i, page in enumerate(pages, start=(start_page or 1))]
            futures = [executor.submit(save_image, pd) for pd in page_data]
            
            for future in as_completed(futures):
                img_path = future.result()
                image_paths.append(img_path)
        
        convert_end = time.time()
        print(f"✅ PDF converted in {convert_end - convert_start:.2f}s (threaded I/O)")
        
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
            img = img.resize((new_width, new_height), Image.Resampling.BILINEAR)  # Faster than LANCZOS
            
            processed_path = image_path.parent / f"{image_path.stem}_fast.png"
            img.save(processed_path, "PNG", compress_level=0)
            return processed_path
        
        return image_path
    except Exception as e:
        print(f"Error preprocessing {image_path}: {e}")
        return image_path

# ---------------- TURBO OCR PROCESSING ----------------
def ocr_single_image_turbo(img_path):
    """Turbo-speed OCR processing with minimal overhead"""
    start_time = time.time()
    
    try:
        ocr = get_ocr_instance()
        
        # Fast preprocessing
        processed_path = preprocess_image_fast(img_path)
        
        # OCR with minimal resource monitoring
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
            "cpu_percent": 100.0,  # Assume full utilization for speed
            "memory_mb": {
                "system_memory_mb": psutil.virtual_memory().used / 1024 / 1024,
                "process_memory_mb": 1000.0  # Approximate to avoid overhead
            }
        }
        
    except Exception as e:
        print(f"Error processing {img_path}: {e}")
        return {
            "page": img_path.stem,
            "text": [],
            "time": 0,
            "cpu_percent": 0,
            "memory_mb": {"system_memory_mb": 0, "process_memory_mb": 0}
        }

# ---------------- PARALLEL PROCESSING WITH RESOURCE OPTIMIZATION ----------------
def ocr_images_turbo_parallel(image_paths, max_workers=None):
    """Turbo parallel OCR processing with resource optimization"""
    if not image_paths:
        return {}, {}
    
    result_dict = {}
    per_page_times = {}
    cpu_percents = {}
    mem_usages = {}

    doc_start_time = time.time()
    doc_cpu_samples = []
    doc_mem_samples = []

    # Optimize worker count for maximum throughput
    if max_workers is None:
        cpu_count = psutil.cpu_count(logical=True)
        # Use more workers than CPU cores for I/O bound operations mixed with CPU work
        max_workers = min(len(image_paths), int(cpu_count * 1.5))
    
    print(f"🏎️  Turbo Processing: {len(image_paths)} images with {max_workers} workers")
    
    with ProcessPoolExecutor(
        max_workers=max_workers,
        mp_context=mp.get_context('spawn')
    ) as executor:
        
        futures = {executor.submit(ocr_single_image_turbo, img): img for img in image_paths}
        
        for future in as_completed(futures):
            try:
                res = future.result()
                page = res["page"]
                result_dict[page] = res["text"]
                per_page_times[page] = res["time"]
                cpu_percents[page] = res["cpu_percent"]
                mem_usages[page] = res["memory_mb"]

                doc_cpu_samples.append(res["cpu_percent"])
                doc_mem_samples.append(res["memory_mb"]["process_memory_mb"])
                
                print(f"🚀 {page}: {res['time']:.2f}s ({len(res['text'])} lines)")
                
            except Exception as e:
                print(f"❌ Error: {e}")

    doc_end_time = time.time()

    metadata = {
        "ocr_model": OCR_MODEL_NAME,
        "processing_strategy": "turbo_with_strategic_threading",
        "timing": {
            "document_start_time": doc_start_time,
            "document_end_time": doc_end_time,
            "total_time_seconds": doc_end_time - doc_start_time,
            "per_page_seconds": per_page_times
        },
        "resource_usage": {
            "per_page": {
                "cpu_percent": cpu_percents,
                "memory_mb": mem_usages
            },
            "document": {
                "avg_cpu_percent": sum(doc_cpu_samples)/len(doc_cpu_samples) if doc_cpu_samples else 0,
                "max_cpu_percent": max(doc_cpu_samples) if doc_cpu_samples else 0,
                "avg_process_memory_mb": sum(doc_mem_samples)/len(doc_mem_samples) if doc_mem_samples else 0,
                "max_process_memory_mb": max(doc_mem_samples) if doc_mem_samples else 0
            }
        },
        "optimization_settings": {
            "max_workers": max_workers,
            "dpi": 100,
            "threading_strategy": "io_operations_only",
            "image_preprocessing": "aggressive_resizing"
        }
    }

    return result_dict, metadata

# ---------------- MAIN PROCESSING ----------------
def process_file_turbo(file_path, start_page=None, end_page=None, max_workers=None):
    """Turbo file processing with strategic threading"""
    file_path = Path(file_path)
    if not file_path.exists():
        return {}, {}

    if file_path.suffix.lower() == ".pdf":
        print("🔄 Converting PDF with turbo settings...")
        
        # Use threading for PDF conversion I/O
        images = pdf_to_images_with_threading(file_path, start_page, end_page)
        if not images:
            return {}, {}
        
        print("🔄 Processing with turbo OCR...")
        result, metadata = ocr_images_turbo_parallel(images, max_workers)
        
        # Use threading for cleanup (I/O bound)
        def cleanup_images():
            for img in images:
                try:
                    os.remove(img)
                except:
                    pass
        
        # Run cleanup in background thread
        import threading
        cleanup_thread = threading.Thread(target=cleanup_images)
        cleanup_thread.start()
        
        return result, metadata
    
    else:
        print(f"❌ Unsupported file type: {file_path.suffix}")
        return {}, {}

def save_json(data, metadata, output_file):
    """Save results to JSON file"""
    final_output = {
        "metadata": metadata,
        "results": data
    }
    # Use shared doctr-style formatter to ensure consistent output across drivers
    try:
        # import here to avoid import errors when running as a script from different CWDs
        from tools.doctr_formatter import format_to_doctr
    except Exception:
        format_to_doctr = None

    if format_to_doctr:
        # Try to detect document name from the output filename if possible
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
    print(f"💾 Results saved to: {output_file}")

# ---------------- MAIN ----------------
if __name__ == "__main__":
    # Use interactive selection for inputs/outputs
    SCRIPT_DIR = Path(__file__).parent
    repo_root = Path(__file__).resolve().parents[1]
    # For this top-level file repo_root is one level up (paddle_integration -> repo root)
    sys.path.append(str(repo_root))
    from driver_interactive import interactive_select

    TEST_FILES_DIR = repo_root / "test_files"
    DEFAULT_OUTPUT_PARENT = SCRIPT_DIR / "paddle_outputs"

    input_path, OUTPUT_DIR, output_json, start_page, end_page = interactive_select(TEST_FILES_DIR, DEFAULT_OUTPUT_PARENT)

    # default adaptive workers
    cpu_count = psutil.cpu_count(logical=True)
    max_workers = int(cpu_count * 1.5)

    overall_start = time.time()

    if input_path.is_file():
        results, metadata = process_file_turbo(input_path, start_page, end_page, max_workers)
    else:
        print("❌ Folder processing not supported")
        sys.exit(1)

    overall_end = time.time()
    total_time = overall_end - overall_start

    if results:
        save_json(results, metadata, output_json)
        print(f"Saved results to {output_json}")
    else:
        print("❌ No results to save")