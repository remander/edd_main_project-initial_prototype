#!/usr/bin/env python3
"""
Ultimate Free-Threading OCR Test
Optimized for Python 3.14+ with GIL disabled using aggressive threading.
"""

import os
import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any
import statistics

# Configure threading for maximum performance
threading.stack_size(32768)  # Reduce stack size for more threads

class UltimateOCRProcessor:
    """Ultra-aggressive OCR processor optimized for free-threaded Python."""
    
    def __init__(self):
        self.thread_local = threading.local()
        self.stats = {
            'pages_processed': 0,
            'total_time': 0,
            'thread_times': [],
            'ocr_times': [],
            'io_times': []
        }
        self.stats_lock = threading.Lock()
    
    def get_ocr_engine(self):
        """Get thread-local OCR engine instance."""
        if not hasattr(self.thread_local, 'ocr'):
            # Import here to avoid issues during module loading
            from paddleocr import PaddleOCR
            
            # Optimize OCR settings for speed
            self.thread_local.ocr = PaddleOCR(
                use_angle_cls=True,
                show_log=False,
                lang='en',
                use_gpu=False,  # CPU optimized for threading
                enable_mkldnn=True,  # Intel optimization
                cpu_threads=1,  # Let Python handle threading
                det_model_dir=None,  # Use default models
                rec_model_dir=None,
                cls_model_dir=None,
                use_space_char=True,
                drop_score=0.3  # Lower threshold for better detection
            )
            print(f"Initialized OCR engine in thread: {threading.current_thread().name}")
        
        return self.thread_local.ocr
    
    def process_single_page(self, pdf_path: str, page_num: int) -> Dict[str, Any]:
        """Process a single PDF page with detailed timing."""
        thread_start = time.perf_counter()
        thread_name = threading.current_thread().name
        
        try:
            # Import fitz here for thread safety
            try:
                import fitz
            except ImportError as ie:
                msg = (
                    "Missing dependency: the module 'fitz' (PyMuPDF) is required to read PDFs.\n"
                    "Install with pip: `pip install pymupdf`\n"
                    "Or with conda: `conda install -c conda-forge pymupdf`\n"
                    "After installing, re-run this script."
                )
                print(f"❌ {msg}")
                return {
                    'page': page_num + 1,
                    'error': str(ie),
                    'processing_time': time.perf_counter() - thread_start,
                    'thread': threading.current_thread().name,
                    'thread_id': threading.get_ident()
                }
            
            # Open PDF and extract page
            io_start = time.perf_counter()
            doc = fitz.open(pdf_path)
            page = doc[page_num]
            
            # Convert to image with high DPI for better OCR
            mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better quality
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            doc.close()
            io_time = time.perf_counter() - io_start
            
            # Process with OCR
            ocr_start = time.perf_counter()
            ocr_engine = self.get_ocr_engine()
            
            # Save temp image for OCR processing
            temp_img_path = f"temp_page_{page_num}_{threading.get_ident()}.png"
            with open(temp_img_path, 'wb') as f:
                f.write(img_data)
            
            # Perform OCR
            results = ocr_engine.ocr(temp_img_path, cls=True)
            
            # Clean up temp file
            try:
                os.remove(temp_img_path)
            except:
                pass
            
            ocr_time = time.perf_counter() - ocr_start
            
            # Process results
            page_text = []
            total_confidence = 0
            detection_count = 0
            
            if results and results[0]:
                for line in results[0]:
                    if len(line) >= 2:
                        text = line[1][0] if isinstance(line[1], (list, tuple)) else str(line[1])
                        confidence = line[1][1] if isinstance(line[1], (list, tuple)) and len(line[1]) > 1 else 0.9
                        
                        page_text.append(text)
                        total_confidence += confidence
                        detection_count += 1
            
            avg_confidence = total_confidence / detection_count if detection_count > 0 else 0
            extracted_text = '\n'.join(page_text)
            
            thread_time = time.perf_counter() - thread_start
            
            # Update stats thread-safely
            with self.stats_lock:
                self.stats['pages_processed'] += 1
                self.stats['thread_times'].append(thread_time)
                self.stats['ocr_times'].append(ocr_time)
                self.stats['io_times'].append(io_time)
            
            result = {
                'page': page_num + 1,
                'text': extracted_text,
                'confidence': avg_confidence,
                'word_count': len(extracted_text.split()),
                'char_count': len(extracted_text),
                'detections': detection_count,
                'processing_time': thread_time,
                'ocr_time': ocr_time,
                'io_time': io_time,
                'thread': thread_name,
                'thread_id': threading.get_ident()
            }
            
            print(f"✅ Page {page_num + 1} completed in {thread_time:.3f}s by {thread_name} (OCR: {ocr_time:.3f}s, I/O: {io_time:.3f}s)")
            return result
            
        except Exception as e:
            error_time = time.perf_counter() - thread_start
            print(f"❌ Error processing page {page_num + 1} in thread {thread_name}: {e}")
            return {
                'page': page_num + 1,
                'error': str(e),
                'processing_time': error_time,
                'thread': thread_name,
                'thread_id': threading.get_ident()
            }

def run_ultimate_ocr_test(pdf_path=None, output_file=None, start_page=None, end_page=None):
    """Run the ultimate OCR test with maximum threading."""
    import os  # Import at function level to avoid scope issues
    
    print("🚀 Ultimate Free-Threading OCR Test")
    print("=" * 60)
    
    # Test configuration
    if pdf_path is None:
        pdf_path = "test_files/Metamorphosis.pdf"
    
    if not os.path.exists(pdf_path):
        print(f"❌ PDF file not found: {pdf_path}")
        return
    
    # Get PDF page count and range
    try:
        try:
            import fitz
        except ImportError as ie:
            print("❌ Missing dependency: the module 'fitz' (PyMuPDF) is required to read PDFs.")
            print("   Install with pip: pip install pymupdf")
            print("   Or with conda: conda install -c conda-forge pymupdf")
            print("   After installing, re-run this script.")
            return

        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        doc.close()
        print(f"📄 PDF has {total_pages} pages")
        
        # Use specified page range if provided
        if start_page is not None and end_page is not None:
            start_page = max(1, start_page)
            end_page = min(total_pages, end_page)
            pages_to_process = list(range(start_page, end_page + 1))
            print(f"🎯 Processing pages {start_page}-{end_page} ({len(pages_to_process)} pages)")
        else:
            pages_to_process = list(range(1, total_pages + 1))
            print(f"🎯 Processing all {total_pages} pages")
    except Exception as e:
        print(f"❌ Error reading PDF: {e}")
        return
    
    # Test different thread counts to find optimal
    processor = UltimateOCRProcessor()
    
    # Aggressive threading - use more threads than cores for I/O heavy workload
    max_workers = min(len(pages_to_process), 48)  # Up to 48 threads for maximum parallelism
    
    print(f"🧵 Using {max_workers} threads for {len(pages_to_process)} pages")
    print(f"💻 System has {os.cpu_count()} CPU cores")
    print()
    
    # Process specified pages
    start_time = time.perf_counter()
    results = []
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit specified pages
        future_to_page = {
            executor.submit(processor.process_single_page, pdf_path, page_num): page_num 
            for page_num in pages_to_process
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_page):
            page_num = future_to_page[future]
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                print(f"❌ Exception for page {page_num + 1}: {e}")
                results.append({
                    'page': page_num + 1,
                    'error': str(e),
                    'processing_time': 0
                })
    
    total_time = time.perf_counter() - start_time
    
    # Sort results by page number
    results.sort(key=lambda x: x['page'])
    
    # Calculate statistics
    successful_pages = [r for r in results if 'error' not in r]
    failed_pages = [r for r in results if 'error' in r]
    
    if successful_pages:
        processing_times = [r['processing_time'] for r in successful_pages]
        ocr_times = [r['ocr_time'] for r in successful_pages if 'ocr_time' in r]
        io_times = [r['io_time'] for r in successful_pages if 'io_time' in r]
        
        # Threading efficiency
        total_processing_time = sum(processing_times)
        threading_efficiency = total_processing_time / total_time if total_time > 0 else 0
        
        print("\n" + "=" * 60)
        print("📊 ULTIMATE OCR RESULTS")
        print("=" * 60)
        print(f"⏱️  Total elapsed time: {total_time:.2f} seconds")
        print(f"📄 Pages processed: {len(successful_pages)}/{total_pages}")
        print(f"❌ Failed pages: {len(failed_pages)}")
        print(f"🧵 Threading efficiency: {threading_efficiency:.2f}x")
        print(f"⚡ Pages per second: {len(successful_pages)/total_time:.2f}")
        print()
        
        print("⏱️  Timing Breakdown:")
        print(f"   Average processing time per page: {statistics.mean(processing_times):.3f}s")
        print(f"   Average OCR time per page: {statistics.mean(ocr_times):.3f}s")
        print(f"   Average I/O time per page: {statistics.mean(io_times):.3f}s")
        print(f"   Min/Max processing time: {min(processing_times):.3f}s / {max(processing_times):.3f}s")
        print()
        
        # Thread usage analysis
        thread_usage = {}
        for result in successful_pages:
            thread = result.get('thread', 'unknown')
            if thread not in thread_usage:
                thread_usage[thread] = 0
            thread_usage[thread] += 1
        
        print(f"🧵 Thread utilization ({len(thread_usage)} threads used):")
        for thread, count in sorted(thread_usage.items()):
            print(f"   {thread}: {count} pages")
        
        # Text extraction summary
        total_words = sum(r.get('word_count', 0) for r in successful_pages)
        total_chars = sum(r.get('char_count', 0) for r in successful_pages)
        total_detections = sum(r.get('detections', 0) for r in successful_pages)
        
        print(f"\n📝 Text extraction summary:")
        print(f"   Total words extracted: {total_words:,}")
        print(f"   Total characters: {total_chars:,}")
        print(f"   Total text detections: {total_detections:,}")
        print(f"   Words per second: {total_words/total_time:.1f}")
        
        # Save detailed results
        output_dir = os.path.join(os.path.dirname(__file__), "..", "paddle_outputs")
        os.makedirs(output_dir, exist_ok=True)
        
        if output_file is not None:
            final_output_file = os.path.join(output_dir, output_file)
        else:
            final_output_file = os.path.join(output_dir, f"ultimate_ocr_results_{int(time.time())}.json")
        # Convert ultimate-results (list of page dicts) into doctr-style results map
        try:
            from tools.doctr_formatter import format_to_doctr
        except Exception:
            format_to_doctr = None

        doc_name = os.path.splitext(os.path.basename(pdf_path))[0]

        # Build simple page->lines map
        results_map = {}
        for r in results:
            key = f"{doc_name}_page_{r.get('page', '?')}"
            text = r.get('text', '') or ''
            # split text into visible lines
            lines = [ln for ln in text.splitlines() if ln.strip()]
            results_map[key] = lines

        # driver metadata summary
        driver_meta = {
            'ocr_model': 'ultimate_ocr',
            'timing': {'total_time_seconds': total_time},
            'resource_usage': {}
        }

        if format_to_doctr:
            final_out = format_to_doctr(results_map, driver_meta=driver_meta, ocr_model_name='ultimate_ocr', document_name=doc_name, is_pdf=True)
        else:
            final_out = {'metadata': driver_meta, 'results': results_map}

        with open(final_output_file, 'w', encoding='utf-8') as f:
            json.dump(final_out, f, indent=2, ensure_ascii=False)

        print(f"\n💾 Detailed results saved to: {final_output_file}")
        
    else:
        print("\n❌ No pages processed successfully!")
    
    if failed_pages:
        print(f"\n❌ Failed pages: {[r['page'] for r in failed_pages]}")

if __name__ == "__main__":
    # Use interactive helper for consistent UX
    from pathlib import Path
    repo_root = Path(__file__).resolve().parents[2]
    import sys
    sys.path.append(str(repo_root))
    from driver_interactive import interactive_select

    SCRIPT_DIR = Path(__file__).parent
    TEST_FILES_DIR = repo_root / "test_files"
    DEFAULT_OUTPUT_PARENT = SCRIPT_DIR.parent / "paddle_outputs"

    input_path, OUTPUT_DIR, output_json, start_page, end_page = interactive_select(TEST_FILES_DIR, DEFAULT_OUTPUT_PARENT)

    pdf_path = str(input_path)
    output_file = output_json.name

    # run with selected page range
    run_ultimate_ocr_test(pdf_path, output_file, start_page, end_page)