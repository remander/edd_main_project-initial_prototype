import os
import sys
import json
import time
from pathlib import Path
import platform
import psutil
try:
    import cpuinfo
except Exception:
    cpuinfo = None
import importlib.metadata
import argparse
from datetime import datetime
try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None

# We'll import doctr lazily inside load_doctr_predictor() so that
# installing packages after this module is imported still works.
DocumentFile = None
ocr_predictor = None
DOCTR_AVAILABLE = False

def get_version_safe(package_name):
    try:
        return importlib.metadata.version(package_name)
    except importlib.metadata.PackageNotFoundError:
        return "not installed"
    except Exception:
        return "unknown"

# --- CONFIG ---
POPPLER_PATH = None  # leave None; user can set if needed
ocr_model_name = "doctr_ocr"
# Toggle writing of raw per-page debug dumps (set True to enable)
WRITE_DEBUG = False
doctr_init_time_seconds = None

def pdf_to_images(pdf_path, start_page=None, end_page=None, dpi=200):
    """Convert PDF to images using pdf2image (same approach as paddle driver)."""
    try:
        from pdf2image import convert_from_path
    except Exception as e:
        raise RuntimeError("pdf2image is required to convert PDFs to images: " + str(e))

    pages = convert_from_path(
        pdf_path, dpi=dpi, poppler_path=POPPLER_PATH,
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


def load_doctr_predictor():
    """Try to construct a doctr OCR predictor with sensible defaults.
    We avoid forcing a specific backend; if doctr isn't installed, raise a helpful error.
    """
    global DOCTR_AVAILABLE, ocr_predictor, DocumentFile
    try:
        from doctr.io import DocumentFile as _DocumentFile
        from doctr.models import ocr_predictor as _ocr_predictor
        DocumentFile = _DocumentFile
        ocr_predictor = _ocr_predictor
        DOCTR_AVAILABLE = True
    except Exception as e:
        raise RuntimeError(
            "python-doctr is not importable. Install with: pip install 'python-doctr[torch]'. Original error: "
            + str(e)
        )

    # Many doctr examples use ocr_predictor(pretrained=True) or similar
    try:
        predictor = ocr_predictor(pretrained=True)
    except TypeError:
        predictor = ocr_predictor()
    return predictor


def ocr_images_with_doctr(image_paths, predictor=None):
    global doctr_init_time_seconds
    result_dict = {}
    per_page_times = {}
    cpu_percents = {}
    mem_usages = {}

    doc_start_time = time.time()
    doc_cpu_samples = []
    doc_mem_samples = []

    process = psutil.Process(os.getpid())

    if predictor is None:
        # Capture initialization timing on first use
        if doctr_init_time_seconds is None:
            init_start = time.time()
            predictor = load_doctr_predictor()
            init_end = time.time()
            doctr_init_time_seconds = init_end - init_start
        else:
            predictor = load_doctr_predictor()

    for img_path in image_paths:
        print(f"OCR processing: {img_path.name}")
        start_time = time.time()

        # doctr can accept PIL images or bytes; use DocumentFile.from_images for batch
        try:
            from PIL import Image
            img = Image.open(img_path).convert("RGB")
        except Exception as e:
            print(f"Failed to open image {img_path}: {e}")
            continue

        try:
            # We'll try multiple ways to call the predictor and print debug info so we can adapt to the
            # installed doctr version's expected inputs.
            import inspect
            try:
                sig = inspect.signature(predictor)
                print(f"Predictor signature: {sig}")
            except Exception:
                print("Could not inspect predictor signature")

            res = None

            # 1) Try DocumentFile.from_images if available. Use the saved image path (img_path)
            #    because some versions expect file paths rather than PIL.Image objects.
            try:
                if DocumentFile is not None and hasattr(DocumentFile, 'from_images'):
                    print("Trying DocumentFile.from_images([...]) with image path -> predictor(doc)")
                    try:
                        # pass path string(s) rather than PIL Image
                        doc = DocumentFile.from_images([str(img_path)])
                        res = predictor(doc)
                        print("Succeeded with DocumentFile.from_images(path)")
                    except Exception as e:
                        print(f"DocumentFile.from_images(path) approach failed: {e}")
                        res = None
            except Exception as e:
                print(f"Error while attempting DocumentFile approach: {e}")

            # 2) Try passing a list of PIL Images
            if res is None:
                try:
                    print("Trying predictor([img])")
                    res = predictor([img])
                    print("Succeeded with predictor([img])")
                except Exception as e:
                    print(f"predictor([img]) failed: {e}")
                    res = None

            # 3) Try passing the single PIL Image
            if res is None:
                try:
                    print("Trying predictor(img)")
                    res = predictor(img)
                    print("Succeeded with predictor(img)")
                except Exception as e:
                    print(f"predictor(img) failed: {e}")
                    res = None

            # 4) Try numpy array. Many doctr models expect channels-first (C,H,W) or batched (N,C,H,W).
            if res is None:
                try:
                    import numpy as _np
                    arr = _np.array(img)
                    print(f"Original numpy shape (H,W,C)={arr.shape} dtype={arr.dtype}")
                    if arr.ndim == 3:
                        arr_chw = arr.transpose(2, 0, 1)
                    elif arr.ndim == 2:
                        # grayscale, add channel dim
                        arr_chw = arr[_np.newaxis, ...]
                    else:
                        arr_chw = arr

                    print(f"Trying predictor on channels-first array shape={arr_chw.shape}")
                    try:
                        res = predictor(arr_chw)
                        print("Succeeded with predictor(arr_chw)")
                    except Exception as e:
                        print(f"predictor(arr_chw) failed: {e}")
                        res = None

                    # Try list-of-arrays
                    if res is None:
                        try:
                            print("Trying predictor([arr_chw])")
                            res = predictor([arr_chw])
                            print("Succeeded with predictor([arr_chw])")
                        except Exception as e:
                            print(f"predictor([arr_chw]) failed: {e}")
                            res = None

                    # Try batched numpy with leading batch dim
                    if res is None:
                        try:
                            bat = _np.expand_dims(arr_chw, 0)
                            print(f"Trying predictor(batched) shape={bat.shape}")
                            res = predictor(bat)
                            print("Succeeded with batched numpy input")
                        except Exception as e:
                            print(f"predictor(batched) failed: {e}")
                            res = None
                except Exception as e:
                    print(f"predictor(numpy_array) path failed: {e}")
                    res = None

            # 5) Try raw PNG bytes
            if res is None:
                try:
                    from io import BytesIO
                    buf = BytesIO()
                    img.save(buf, format='PNG')
                    png_bytes = buf.getvalue()
                    print(f"Trying predictor(png_bytes) length={len(png_bytes)}")
                    res = predictor(png_bytes)
                    print("Succeeded with png bytes")
                except Exception as e:
                    print(f"predictor(png_bytes) failed: {e}")
                    res = None

            if res is None:
                print(f"All predictor input attempts failed for {img_path}")
        except Exception as e:
            print(f"Doctr prediction failed for {img_path}: {e}")
            res = None

        # Dump raw result for debugging so we can inspect the predictor's return structure
        def safe_serialize(obj):
            # Try common conversions, otherwise return string repr
            try:
                import numpy as _np
            except Exception:
                _np = None

            if obj is None:
                return None
            # Basic types
            if isinstance(obj, (str, int, float, bool)):
                return obj
            # dict-like
            if isinstance(obj, dict):
                out = {}
                for k, v in obj.items():
                    try:
                        out[k] = safe_serialize(v)
                    except Exception:
                        out[k] = str(v)
                return out
            # lists/tuples
            if isinstance(obj, (list, tuple)):
                out = []
                for v in obj[:50]:
                    out.append(safe_serialize(v))
                return out
            # numpy arrays
            try:
                if _np is not None and isinstance(obj, _np.ndarray):
                    return {
                        "shape": obj.shape,
                        "dtype": str(obj.dtype),
                        "sample": obj.flatten()[:20].tolist()
                    }
            except Exception:
                pass
            # objects with attributes
            try:
                attrs = {a: getattr(obj, a) for a in dir(obj) if not a.startswith('_')}
                simple = {}
                for k, v in list(attrs.items())[:50]:
                    try:
                        simple[k] = safe_serialize(v)
                    except Exception:
                        simple[k] = str(v)
                return {"type": type(obj).__name__, "attrs": simple}
            except Exception:
                return str(obj)

        if res is not None:
            # Optional debug dump of raw predictor object. Controlled by WRITE_DEBUG.
            if WRITE_DEBUG:
                try:
                    debug_out = safe_serialize(res)
                    debug_file = Path(__file__).parent.parent / "doctr_outputs" / f"debug_res_{img_path.stem}.json"
                    with open(debug_file, "w", encoding="utf-8") as df:
                        json.dump(debug_out, df, indent=2, ensure_ascii=False)
                    print(f"Wrote debug result to {debug_file}")
                except Exception as e:
                    print(f"Failed to write debug result for {img_path}: {e}")

        # Normalize results to a list of recognized texts similar to Paddle's rec_texts
        rec_texts = []
        if res is not None:
            try:
                # Prefer the Document.pages -> blocks -> lines -> words structure (doctr 1.x)
                pages = getattr(res, 'pages', None) or res
                if not isinstance(pages, (list, tuple)):
                    pages = [pages]

                for page in pages:
                    # If page has blocks, traverse blocks->lines->words
                    blocks = getattr(page, 'blocks', None)
                    if blocks:
                        for block in blocks:
                            lines = getattr(block, 'lines', None) or []
                            for line in lines:
                                # collect words if available
                                words = getattr(line, 'words', None)
                                if words:
                                    word_texts = []
                                    for word in words:
                                        wtxt = getattr(word, 'value', None) or getattr(word, 'text', None)
                                        if not wtxt:
                                            # some objects expose attrs.value indirectly
                                            wtxt = getattr(getattr(word, 'attrs', {}), 'get', lambda k, d=None: None)('value') if hasattr(word, 'attrs') else None
                                        if wtxt:
                                            word_texts.append(wtxt)
                                    if word_texts:
                                        rec_texts.append(" ".join(word_texts))
                                    else:
                                        # fallback to line-level text
                                        ltxt = getattr(line, 'value', None) or getattr(line, 'text', None)
                                        if ltxt:
                                            rec_texts.append(ltxt)
                                else:
                                    # if no words, try line.value
                                    ltxt = getattr(line, 'value', None) or getattr(line, 'text', None)
                                    if ltxt:
                                        rec_texts.append(ltxt)
                    else:
                        # Older/simple structure: page.lines
                        lines = getattr(page, 'lines', []) or []
                        for line in lines:
                            text = getattr(line, 'value', None) or getattr(line, 'text', None) or ''
                            if text:
                                rec_texts.append(text)
            except Exception:
                # Fallback: try to extract .text on the result
                try:
                    text = getattr(res, 'text', None)
                    if text:
                        rec_texts = [text]
                except Exception:
                    rec_texts = []

        result_dict[img_path.stem] = rec_texts

        end_time = time.time()
        per_page_times[img_path.stem] = end_time - start_time

        cpu_percent = psutil.cpu_percent(interval=0.1)
        mem_used_sys = psutil.virtual_memory().used / 1024 / 1024
        mem_used_proc = process.memory_info().rss / 1024 / 1024

        cpu_percents[img_path.stem] = cpu_percent
        mem_usages[img_path.stem] = {
            "system_memory_mb": mem_used_sys,
            "process_memory_mb": mem_used_proc
        }

        doc_cpu_samples.append(cpu_percent)
        doc_mem_samples.append(mem_used_proc)

    doc_end_time = time.time()

    # Add processing date at top of metadata in format: YYYY-MM-DD, h:MM:SS am/pm ZZZ
    if ZoneInfo is not None:
        try:
            tz = ZoneInfo("America/New_York")
            dt = datetime.now(tz)
            time_part = dt.strftime("%I:%M:%S %p %Z").lstrip('0').replace('AM', 'am').replace('PM', 'pm')
            processing_date = f"{dt.strftime('%Y-%m-%d')}, {time_part}"
        except Exception:
            dt = datetime.now()
            time_part = dt.strftime("%I:%M:%S %p").lstrip('0').replace('AM', 'am').replace('PM', 'pm')
            processing_date = f"{dt.strftime('%Y-%m-%d')}, {time_part} EDT"
    else:
        dt = datetime.now()
        time_part = dt.strftime("%I:%M:%S %p").lstrip('0').replace('AM', 'am').replace('PM', 'pm')
        processing_date = f"{dt.strftime('%Y-%m-%d')}, {time_part} EDT"

    metadata = {
        "date_of_ocr_processing": f"Date of OCR Processing: {processing_date}",
        "ocr_model": ocr_model_name,
        #"ocr_model_initialization_time_seconds": doctr_init_time_seconds,
        "python_version": platform.python_version(),
        "libraries": {
            "pdf2image": get_version_safe("pdf2image"),
            "doctr": get_version_safe("python-doctr"),
            "Pillow": get_version_safe("Pillow"),
            "psutil": get_version_safe("psutil"),
            "cpuinfo": get_version_safe("py-cpuinfo")
        },
        "system": {
            "platform": platform.platform(),
            "cpu": (cpuinfo.get_cpu_info().get('brand_raw') if cpuinfo and getattr(cpuinfo, 'get_cpu_info', None) else 'unknown'),
            "cpu_count": psutil.cpu_count(logical=True),
            "total_memory_mb": psutil.virtual_memory().total / 1024 / 1024,
            "poppler_path": POPPLER_PATH
        },
        "timing": {
            "document_start_time": doc_start_time,
            "document_end_time": doc_end_time,
            "total_time_seconds": doc_end_time - doc_start_time,
            "ocr_model_initialization_time_seconds": doctr_init_time_seconds,
            "total_time_with_initialization_seconds": (doc_end_time - doc_start_time) + doctr_init_time_seconds if doctr_init_time_seconds else (doc_end_time - doc_start_time),
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
        result, metadata = ocr_images_with_doctr(images)
        # Cleanup intermediate PNGs
        for img in images:
            try:
                os.remove(img)
            except:
                pass
    elif file_path.suffix.lower() in [".png", ".jpg", ".jpeg", ".bmp", ".tiff"]:
        result, metadata = ocr_images_with_doctr([file_path])
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


def save_json(data, metadata, output_file, is_pdf=False):
    """Save results and metadata to JSON.

    If is_pdf is True (single-PDF processing) the file structure will match
    the example `metamorphosis_1-2.json`: metadata first, then results where
    results is a map from page-stem -> list-of-lines.

    For non-PDF or aggregated runs we keep the newer results-first structure
    that contains a `results.pages` map and a `results.summary` block.
    """

    if is_pdf:
        # Expected structure: metadata then results (page->list)
        final_output = {
            'metadata': metadata,
            'results': data
        }
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(final_output, f, indent=4, ensure_ascii=False)
        print(f"Results (PDF format) saved to: {output_file}")
        return

    # Non-PDF / aggregated structure (results-first with per-page details and summary)
    results_by_page = {}
    total_lines = 0
    total_characters = 0
    for page, lines in (data or {}).items():
        lines = lines or []
        total_lines += len(lines)
        for l in lines:
            try:
                total_characters += len(l)
            except Exception:
                pass

        # include any timing/resource info if available in metadata
        per_page_timing = None
        per_page_resource = None
        try:
            per_page_timing = metadata.get('timing', {}).get('per_page_seconds', {}).get(page)
        except Exception:
            per_page_timing = None
        try:
            per_page_resource = metadata.get('resource_usage', {}).get('per_page', {})
            if isinstance(per_page_resource, dict):
                cpu_map = per_page_resource.get('cpu_percent', {})
                mem_map = per_page_resource.get('memory_mb', {})
                per_page_resource = {
                    'cpu_percent': cpu_map.get(page) if isinstance(cpu_map, dict) else None,
                    'memory_mb': mem_map.get(page) if isinstance(mem_map, dict) else None,
                }
        except Exception:
            per_page_resource = None

        results_by_page[page] = {
            'ocr': lines,
            'timing_seconds': per_page_timing,
            'resource_usage': per_page_resource
        }

    total_pages = len(results_by_page)
    avg_lines_per_page = (total_lines / total_pages) if total_pages else 0

    summary = {
        'total_pages': total_pages,
        'total_lines': total_lines,
        'total_characters': total_characters,
        'avg_lines_per_page': avg_lines_per_page,
        'total_time_seconds': metadata.get('timing', {}).get('total_time_seconds') if metadata else None
    }

    final_output = {
        
        'metadata': metadata, 
        'results': {
            'pages': results_by_page,
            'summary': summary
        },
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(final_output, f, indent=4, ensure_ascii=False)
    print(f"Results saved to: {output_file}")


SCRIPT_DIR = Path(__file__).parent

if __name__ == "__main__":
    print("=== DOCTR OCR Interactive Runner ===")

    # Ask user for input filename (the name of a file inside repo's test_files).
    # If left blank, the script will process the entire test_files folder.
    TEST_FILES_DIR = SCRIPT_DIR.parent / "test_files"

    # Attempt to list available test files (pdf / images) and subfolders so user can pick one.
    try:
        candidates = []
        if TEST_FILES_DIR.exists():
            for p in sorted(TEST_FILES_DIR.iterdir()):
                # include directories and common image/pdf files
                if p.is_dir() or p.suffix.lower() in [".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".tiff"]:
                    candidates.append(p)
        else:
            candidates = []
    except Exception:
        candidates = []

    print(f"Available items in {TEST_FILES_DIR}:")
    if candidates:
        for i, p in enumerate(candidates, start=1):
            kind = "(dir)" if p.is_dir() else "(file)"
            print(f"  {i}. {p.name} {kind}")
    else:
        print("  (no test files or folders found)")

    input_prompt = (
        "Enter the input file name located in {dir} (or press Enter to process the whole folder).\n"
        "You can also enter the number of an item above, a simple filename to look up in the folder,\n"
        "or an absolute path: ".format(dir=TEST_FILES_DIR)
    )
    input_str = input(input_prompt).strip()

    if not input_str:
        # No input: process the entire test_files folder
        input_path = TEST_FILES_DIR.resolve()
        print(f"Using test files folder as input: {input_path}")
    else:
        # If the user entered a number corresponding to a candidate, use it
        if input_str.isdigit():
            idx = int(input_str) - 1
            if 0 <= idx < len(candidates):
                input_path = candidates[idx].resolve()
            else:
                print("Invalid selection number; interpreting input as filename or path.")
                candidate = Path(input_str)
                if candidate.is_absolute() or candidate.parent != Path('.'):
                    input_path = candidate.resolve()
                else:
                    input_path = (TEST_FILES_DIR / candidate).resolve()
        else:
            candidate = Path(input_str)
            # If user supplied an absolute path or a path containing separators, use it verbatim
            if candidate.is_absolute() or candidate.parent != Path('.'):
                input_path = candidate.resolve()
            else:
                # Treat the input as a filename within test_files
                input_path = (TEST_FILES_DIR / candidate).resolve()
        print(f"Using input path: {input_path}")

    # Ask for output folder (optional)
    # Show existing folders under ./doctr_outputs so user can pick one
    DEFAULT_OUTPUT_PARENT = SCRIPT_DIR.parent / "doctr_outputs"
    # Ensure parent exists so we can list any existing subfolders
    try:
        DEFAULT_OUTPUT_PARENT.mkdir(parents=True, exist_ok=True)
    except Exception:
        # If creation fails, we'll still proceed and let user provide an absolute path
        pass

    existing_dirs = []
    try:
        existing_dirs = sorted([p for p in DEFAULT_OUTPUT_PARENT.iterdir() if p.is_dir()])
    except Exception:
        existing_dirs = []

    print(f"Existing output folders under {DEFAULT_OUTPUT_PARENT}:")
    if existing_dirs:
        for i, p in enumerate(existing_dirs, start=1):
            print(f"  {i}. {p.name}")
    else:
        print("  (none yet)")

    prompt = (
        "Where do you want the output saved? Enter the number to pick an existing folder, a folder name to create under ./doctr_outputs,\n"
        "an absolute path, or press Enter for default ./doctr_outputs: "
    )
    output_folder_str = input(prompt).strip()
    if output_folder_str:
        # If the user entered a number corresponding to an existing folder, use it
        if output_folder_str.isdigit():
            idx = int(output_folder_str) - 1
            if 0 <= idx < len(existing_dirs):
                OUTPUT_DIR = existing_dirs[idx].resolve()
            else:
                print("Invalid selection number; using default ./doctr_outputs")
                OUTPUT_DIR = DEFAULT_OUTPUT_PARENT
        else:
            cand = Path(output_folder_str)
            # If user gave absolute path or a path with separators, use it as-is
            if cand.is_absolute() or cand.parent != Path('.'):
                OUTPUT_DIR = cand.resolve()
            else:
                # treat as a simple folder name under repo/doctr_outputs
                OUTPUT_DIR = DEFAULT_OUTPUT_PARENT / cand
    else:
        OUTPUT_DIR = DEFAULT_OUTPUT_PARENT

    # NOTE: removed interactive timestamped-folder option. Outputs will go
    # directly into the selected OUTPUT_DIR (or default ./doctr_outputs).

    # Create folder(s)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Writing outputs to: {OUTPUT_DIR}")

    # Ask for output JSON filename (optional)
    output_file_str = input("Output JSON filename? (Press Enter to use default): ").strip()
    if output_file_str:
        cand = Path(output_file_str)
        output_json = cand if cand.is_absolute() else OUTPUT_DIR / cand
    else:
        output_json = OUTPUT_DIR / f"{input_path.stem}_doctr_output.json"

    # Optional: ask for page range
    start_page_str = input("Start page (Press Enter to skip): ").strip()
    end_page_str = input("End page (Press Enter to skip): ").strip()
    start_page = int(start_page_str) if start_page_str else None
    end_page = int(end_page_str) if end_page_str else None

    # Process
    if input_path.is_file():
        results, metadata = process_file(input_path, start_page, end_page)
    else:
        results, metadata = process_folder(input_path, start_page, end_page)

    if results:
        # Use PDF-style output when the input was a single PDF file
        is_pdf_output = input_path.is_file() and input_path.suffix.lower() == '.pdf'
        save_json(results, metadata, output_json, is_pdf=is_pdf_output)
        print(f"✅ OCR completed and saved to {output_json}")
    else:
        print("⚠️ No results produced.")
