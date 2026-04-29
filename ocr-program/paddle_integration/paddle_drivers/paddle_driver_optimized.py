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
    """Get or create OCR instance for current process with minimal configuration"""
    global _ocr_instance
    if _ocr_instance is None:
        # Use the most basic configuration for maximum compatibility and speed
        _ocr_instance = PaddleOCR(use_angle_cls=False, lang="en")
    return _ocr_instance

# ---------------- IMAGE PREPROCESSING ----------------
def preprocess_image_for_speed(image_path):
    """Preprocess image for optimal OCR speed"""
    try:
        img = Image.open(image_path)
        
        # Convert to RGB if necessary
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize large images for faster processing
        width, height = img.size
        if width > 1800 or height > 1800:
            ratio = min(1800/width, 1800/height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Save resized image
            resized_path = image_path.parent / f"{image_path.stem}_resized.png"
            img.save(resized_path, "PNG", optimize=True)
            return resized_path
        
        return image_path
    except Exception as e:
        print(f"Error preprocessing {image_path}: {e}")
        return image_path

# ---------------- PDF → IMAGES (OPTIMIZED) ----------------
def pdf_to_images_fast(pdf_path, start_page=None, end_page=None):
    """Fast PDF to images conversion"""
    try:
        pages = convert_from_path(
            pdf_path, 
            dpi=120,  # Reduced DPI for speed
            poppler_path=POPPLER_PATH,
            first_page=start_page, 
            last_page=end_page,
            thread_count=4
        )
        
        image_paths = []
        pdf_dir = Path(pdf_path).parent
        base_name = Path(pdf_path).stem
        
        # Save images in parallel
        with ThreadPoolExecutor(max_workers=4) as executor:
            def save_page(page_info):
                page, i = page_info
                img_path = pdf_dir / f"{base_name}_page_{i}.png"
                page.save(img_path, "PNG", compress_level=1)
                return img_path
            
            page_data = [(page, i) for i, page in enumerate(pages, start=(start_page or 1))]
            futures = [executor.submit(save_page, pd) for pd in page_data]
            
            for future in as_completed(futures):
                img_path = future.result()
                image_paths.append(img_path)
        
        return sorted(image_paths)
    except Exception as e:
        print(f"Error converting PDF to images: {e}")
        return []

# ---------------- FAST OCR PROCESSING ----------------
def ocr_single_image_fast(img_path):
    """Fast OCR processing for a single image"""
    start_time = time.time()
    
    try:
        ocr = get_ocr_instance()
        
        # Preprocess for speed
        processed_path = preprocess_image_for_speed(img_path)
        
        # Process the image
        results = ocr.predict(str(processed_path))
        text_results = []
        
        if results and len(results) > 0:
            for line in results[0].get("rec_texts", []):
                if isinstance(line, str) and line.strip():
                    text_results.append(line.strip())
        
        # Cleanup if we created a resized image
        if processed_path != img_path:
            try:
                os.remove(processed_path)
            except:
                pass
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        return {
            "page": img_path.stem,
            "text": text_results,
            "time": processing_time,
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
            "cpu_percent": 0,
            "memory_mb": {"system_memory_mb": 0, "process_memory_mb": 0}
        }

# ---------------- PARALLEL OCR PROCESSING ----------------
def ocr_images_parallel_fast(image_paths, max_workers=None):
    """Fast parallel OCR processing"""
    if not image_paths:
        return {}, {}
    
    result_dict = {}
    per_page_times = {}
    cpu_percents = {}
    mem_usages = {}

    doc_start_time = time.time()
    doc_cpu_samples = []
    doc_mem_samples = []

    # Use all available CPU cores for maximum speed
    if max_workers is None:
        cpu_count = psutil.cpu_count(logical=True)
        max_workers = min(len(image_paths), cpu_count)
    
    print(f"Processing {len(image_paths)} images with {max_workers} workers")
    
    with ProcessPoolExecutor(
        max_workers=max_workers, 
        mp_context=mp.get_context('spawn')
    ) as executor:
        futures = {executor.submit(ocr_single_image_fast, img): img for img in image_paths}
        
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
                
                print(f"✓ {page}: {res['time']:.2f}s ({len(res['text'])} lines)")
            except Exception as e:
                print(f"Error processing future: {e}")

    doc_end_time = time.time()

    metadata = {
        "ocr_model": OCR_MODEL_NAME,
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
            "dpi": 120,
            "image_preprocessing": "enabled"
        }
    }

    return result_dict, metadata

# ---------------- MAIN PROCESSING ----------------
def process_file_fast(file_path, start_page=None, end_page=None, max_workers=None):
    """Fast file processing"""
    file_path = Path(file_path)
    if not file_path.exists():
        return {}, {}

    if file_path.suffix.lower() == ".pdf":
        print("🔄 Converting PDF to images...")
        convert_start = time.time()
        
        images = pdf_to_images_fast(file_path, start_page, end_page)
        if not images:
            return {}, {}
        
        convert_end = time.time()
        print(f"✓ PDF conversion: {convert_end - convert_start:.2f}s")
        
        print("🔄 Processing images with OCR...")
        result, metadata = ocr_images_parallel_fast(images, max_workers=max_workers)
        
        # Cleanup images in parallel
        with ThreadPoolExecutor(max_workers=4) as executor:
            [executor.submit(lambda x: os.remove(x) if os.path.exists(x) else None, img) for img in images]
        
        return result, metadata
    
    elif file_path.suffix.lower() in [".png", ".jpg", ".jpeg", ".bmp", ".tiff"]:
        return ocr_images_parallel_fast([file_path], max_workers=1)
    else:
        print(f"❌ Unsupported file type: {file_path.suffix}")
        return {}, {}

# ---------------- SAVE RESULTS ----------------
def save_json(data, metadata, output_file):
    """Save results to JSON file"""
    try:
        from tools.doctr_formatter import format_to_doctr
    except Exception:
        format_to_doctr = None

    if format_to_doctr:
        try:
            final_output = format_to_doctr(data, driver_meta=metadata or {}, ocr_model_name=OCR_MODEL_NAME, document_name=None, poppler_path=POPPLER_PATH, is_pdf=True)
        except Exception:
            final_output = {"metadata": metadata, "results": data}
    else:
        final_output = {"metadata": metadata, "results": data}

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=4, ensure_ascii=False)
    print(f"💾 Results saved to: {output_file}")

# ---------------- MAIN ----------------
if __name__ == "__main__":
    # Interactive selection consistent with doctr-driver
    SCRIPT_DIR = Path(__file__).parent
    repo_root = Path(__file__).resolve().parents[2]
    sys.path.append(str(repo_root))
    from driver_interactive import interactive_select

    TEST_FILES_DIR = repo_root / "test_files"
    DEFAULT_OUTPUT_PARENT = SCRIPT_DIR.parent / "paddle_outputs"

    input_path, OUTPUT_DIR, output_json, start_page, end_page = interactive_select(TEST_FILES_DIR, DEFAULT_OUTPUT_PARENT)

    max_workers = psutil.cpu_count(logical=True)

    overall_start = time.time()

    if input_path.is_file():
        results, metadata = process_file_fast(input_path, start_page, end_page, max_workers)
    else:
        print("❌ Folder processing not supported in this version")
        sys.exit(1)

    overall_end = time.time()
    total_time = overall_end - overall_start

    if results:
        save_json(results, metadata, output_json)
        print(f"Saved results to {output_json}")
    else:
        print("❌ No results to save")