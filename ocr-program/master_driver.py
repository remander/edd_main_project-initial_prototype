"""Master OCR driver: run multiple OCR drivers on a single file.

This script provides `run_all_drivers(file_path, ...)` which calls the
different OCR drivers found in the repo and collects their outputs.

Usage (CLI):
  python master_driver.py /path/to/file --output_dir outputs

Drivers invoked (by default): paddle, doctr, easy, surya, tesseract
"""
import sys
import os
from pathlib import Path
import importlib
import importlib.util
import traceback
import json

# Fix OpenMP conflict when multiple libraries try to initialize it
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'


REPO_ROOT = Path(__file__).resolve().parent
if str(REPO_ROOT) not in sys.path:
    sys.path.append(str(REPO_ROOT))


def load_module_by_path(name, path):
    """Load a Python module from a file path.
    Returns the module object or raises Exception.
    """
    spec = importlib.util.spec_from_file_location(name, str(path))
    if spec is None:
        raise ImportError(f"Can't load module {name} from {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def try_import(module_name, fallback_path=None):
    try:
        return importlib.import_module(module_name)
    except Exception:
        if fallback_path:
            return load_module_by_path(module_name.replace('.', '_'), fallback_path)
        raise


def call_paddle(file_path, output_dir=None, save_full=False, start_page=None, end_page=None):
    try:
        mod = try_import('paddle_integration.paddle_drivers.paddle_driver', REPO_ROOT / 'paddle_integration' / 'paddle_drivers' / 'paddle_driver.py')
        res, meta = mod.process_file(str(file_path), start_page=start_page, end_page=end_page)
        if save_full and res:
            try:
                outp = Path(output_dir) / f"{Path(file_path).stem}_paddle_full.json"
                mod.save_json(res, meta, str(outp))
            except Exception:
                pass
        return {'metadata': meta, 'results': res}
    except Exception as e:
        return {'error': traceback.format_exc()}


def call_onnx(file_path, output_dir=None, save_full=False, start_page=None, end_page=None):
    try:
        mod = try_import('paddle_integration.paddle_drivers.onnx_driver', REPO_ROOT / 'paddle_integration' / 'paddle_drivers' / 'onnx_driver.py')
        res, meta = mod.process_file(Path(file_path))
        if save_full and res:
            try:
                outp = Path(output_dir) / f"{Path(file_path).stem}_onnx_full.json"
                mod.save_json(res, meta, str(outp))
            except Exception:
                pass
        return {'metadata': meta, 'results': res}
    except Exception:
        return {'error': traceback.format_exc()}


def call_doctr(file_path, output_dir=None, save_full=False, start_page=None, end_page=None):
    try:
        path = REPO_ROOT / 'doctr' / 'doctr-driver.py'
        mod = load_module_by_path('doctr_driver', path)
        res, meta = mod.process_file(str(file_path), start_page=start_page, end_page=end_page)
        if save_full and res:
            try:
                outp = Path(output_dir) / f"{Path(file_path).stem}_doctr_full.json"
                # doctr expects is_pdf True for single PDF inputs; detect
                is_pdf = Path(file_path).suffix.lower() == '.pdf'
                mod.save_json(res, meta, str(outp), is_pdf=is_pdf)
            except Exception:
                pass
        return {'metadata': meta, 'results': res}
    except Exception as e:
        return {'error': traceback.format_exc()}


def call_easy(file_path, output_dir=None, save_full=False, start_page=None, end_page=None):
    try:
        mod = try_import('easy.easy_driver', REPO_ROOT / 'easy' / 'easy_driver.py')
        res, meta = mod.process_file(str(file_path), start_page=start_page, end_page=end_page)
        if save_full and res:
            try:
                p = Path(file_path)
                outp = Path(output_dir) / f"{p.stem}_easy_full.json"
                mod.save_json(res, meta, str(outp))
            except Exception:
                pass
        return {'metadata': meta, 'results': res}
    except Exception as e:
        return {'error': traceback.format_exc()}


def call_surya(file_path, output_dir=None, save_full=False, start_page=None, end_page=None):
    try:
        # unified surya driver (handles both images and PDFs)
        mod = try_import('surya.surya_driver', REPO_ROOT / 'surya' / 'surya_driver.py')
        res, meta = mod.process_file(str(file_path), start_page=start_page, end_page=end_page)
        if save_full and res:
            try:
                outp = Path(output_dir) / f"{Path(file_path).stem}_surya_full.json"
                if hasattr(mod, 'save_json'):
                    mod.save_json(res, meta, str(outp))
                else:
                    with open(outp, 'w', encoding='utf-8') as f:
                        json.dump({'results': res, 'metadata': meta}, f, indent=2, ensure_ascii=False)
            except Exception:
                pass
        return {'metadata': meta, 'results': res}
    except Exception:
        return {'error': traceback.format_exc()}


def call_tesseract(file_path, output_dir=None, save_full=False, start_page=None, end_page=None):
    try:
        # unified tesseract driver (handles both images and PDFs)
        mod = try_import('tesseract.tesseract_driver', REPO_ROOT / 'tesseract' / 'tesseract_driver.py')
        res, meta = mod.process_file(str(file_path), start_page=start_page, end_page=end_page)
        if save_full and res:
            try:
                outp = Path(output_dir) / f"{Path(file_path).stem}_tesseract_full.json"
                if hasattr(mod, 'save_json'):
                    mod.save_json(res, meta, str(outp))
                else:
                    with open(outp, 'w', encoding='utf-8') as f:
                        json.dump({'results': res, 'metadata': meta}, f, indent=2, ensure_ascii=False)
            except Exception:
                pass
        return {'metadata': meta, 'results': res}
    except Exception:
        return {'error': traceback.format_exc()}


DRIVER_FUNCS = {
    'paddle': call_paddle,
    'onnx': call_onnx,
    'doctr': call_doctr,
    'easy': call_easy,
    'surya': call_surya,
    'tesseract': call_tesseract,
}


def run_all_drivers(file_path, output_dir=None, drivers=None, start_page=None, end_page=None, save_full=False):
    """Run the selected OCR drivers on `file_path`.

    Returns a mapping driver_name -> result dict. Each driver result will
    contain either `results` and optionally `metadata`, or `error` with traceback.
    """
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"Input file not found: {file_path}")

    if drivers is None:
        drivers = list(DRIVER_FUNCS.keys())

    output_dir = Path(output_dir) if output_dir else (REPO_ROOT / 'master_outputs')
    output_dir.mkdir(parents=True, exist_ok=True)

    results = {}
    for d in drivers:
        func = DRIVER_FUNCS.get(d)
        if func is None:
            results[d] = {'error': f'Unknown driver {d}'}
            continue

        try:
            print(f"Running driver: {d}")
            out = func(str(file_path), output_dir=output_dir, save_full=save_full, start_page=start_page, end_page=end_page)
            # attempt to save driver's returned results to json
            # NOTE: Commented out to avoid creating individual per-driver JSON files
            # Uncomment if you want separate JSON files for each driver in addition to the aggregated file
            # try:
            #     safe = out.copy() if isinstance(out, dict) else {'results': out}
            #     # remove long image lists from JSON body if present
            #     if 'images' in safe:
            #         safe.pop('images')
            #     json_path = output_dir / f"{file_path.stem}_{d}_result.json"
            #     with open(json_path, 'w', encoding='utf-8') as f:
            #         json.dump(safe, f, indent=2, ensure_ascii=False)
            #     print(f"Saved {d} summary to {json_path}")
            # except Exception:
            #     pass

            results[d] = out
        except Exception:
            results[d] = {'error': traceback.format_exc()}

    return results


def _cli():
    import argparse

    parser = argparse.ArgumentParser(description='Master OCR driver — run multiple drivers on one file')
    # Optional flag for input file; keep positional fallback for convenience
    parser.add_argument('--input', '-i', dest='input', help='Path to input file (PDF or image). If omitted, a file from `test_files` will be used')
    parser.add_argument('positional_input', nargs='?', help=argparse.SUPPRESS)
    parser.add_argument('--output_dir', '-o', help='Directory to write per-driver JSON summaries', default=str(REPO_ROOT / 'master_outputs'))
    parser.add_argument('--drivers', '-d', help='Comma-separated driver names to run (paddle,doctr,easy,surya,tesseract)', default=None)
    parser.add_argument('--start_page', type=int, default=None)
    parser.add_argument('--end_page', type=int, default=None)
    parser.add_argument('--save_full', action='store_true', help='Attempt to save each driver\'s full doctr/text output to the output dir')

    args = parser.parse_args()
    # Accept either `--input/-i` or a positional filename (flag wins if present)
    input_path = args.input or args.positional_input
    OUTPUT_DIR = None
    output_json = None
    start_page = args.start_page
    end_page = args.end_page

    if not input_path:
        # Launch the same interactive selector used by individual drivers
        from driver_interactive import interactive_select

        TEST_FILES_DIR = REPO_ROOT / 'test_files'
        DEFAULT_OUTPUT_PARENT = REPO_ROOT / 'master_outputs'

        input_path_obj, out_dir, out_json, sel_start, sel_end = interactive_select(TEST_FILES_DIR, DEFAULT_OUTPUT_PARENT)
        input_path = str(input_path_obj)
        OUTPUT_DIR = out_dir
        output_json = out_json
        # prefer interactive selection for page range unless CLI flags provided
        if sel_start is not None and start_page is None:
            start_page = sel_start
        if sel_end is not None and end_page is None:
            end_page = sel_end

    else:
        # When input is provided non-interactively, offer the default
        # master_outputs location, but allow the user to pick an existing
        # subfolder under master_outputs or create a new one.
        default_parent = REPO_ROOT / 'master_outputs'
        default_parent.mkdir(parents=True, exist_ok=True)

        stem = None
        try:
            stem = Path(input_path).stem
        except Exception:
            stem = 'output'

        suggested = default_parent / f"{stem}.json"
        try:
            resp = input(f"Aggregated output will be saved by default to {suggested}\nSave to default location? (Y/n): ").strip().lower()
        except Exception:
            resp = 'y'

        if resp in ('', 'y', 'yes'):
            OUTPUT_DIR = default_parent
            output_json = suggested
        else:
            # list existing subfolders under master_outputs
            existing_dirs = []
            try:
                existing_dirs = sorted([p for p in default_parent.iterdir() if p.is_dir()])
            except Exception:
                existing_dirs = []

            print(f"Existing folders under {default_parent}:")
            if existing_dirs:
                for i, p in enumerate(existing_dirs, start=1):
                    print(f"  {i}. {p.name}")
            else:
                print("  (none yet)")

            sel = input("Enter the number to choose an existing folder, a new folder name to create under master_outputs, or press Enter to use default: ").strip()
            if sel.isdigit():
                idx = int(sel) - 1
                if 0 <= idx < len(existing_dirs):
                    OUTPUT_DIR = existing_dirs[idx]
                else:
                    print("Invalid selection; using default master_outputs")
                    OUTPUT_DIR = default_parent
            elif sel:
                OUTPUT_DIR = default_parent / sel
            else:
                OUTPUT_DIR = default_parent

            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            # Ask for output filename under chosen directory
            out_name = input(f"Output JSON filename under {OUTPUT_DIR} (press Enter to use {stem}.json): ").strip()
            if out_name:
                outp = Path(out_name)
                output_json = outp if outp.is_absolute() else (OUTPUT_DIR / outp)
            else:
                output_json = OUTPUT_DIR / f"{stem}.json"

    drv_list = args.drivers.split(',') if args.drivers else None

    # If user passed --output_dir, treat non-absolute paths as subfolders under master_outputs
    if args.output_dir:
        od = Path(args.output_dir)
        if not od.is_absolute():
            chosen_output_dir = REPO_ROOT / 'master_outputs' / od
        else:
            chosen_output_dir = od
    else:
        chosen_output_dir = OUTPUT_DIR if OUTPUT_DIR is not None else Path(args.output_dir or (REPO_ROOT / 'master_outputs'))

    chosen_output_dir.mkdir(parents=True, exist_ok=True)

    res = run_all_drivers(input_path, output_dir=chosen_output_dir, drivers=drv_list, start_page=start_page, end_page=end_page, save_full=args.save_full)

    # write aggregated output — use interactive-selected filename when available
    if output_json:
        agg_file = Path(output_json)
    else:
        agg_file = Path(chosen_output_dir) / (Path(input_path).stem + '.json')

    with open(agg_file, 'w', encoding='utf-8') as f:
        json.dump(res, f, indent=2, ensure_ascii=False)
    print(f"Wrote aggregated results to: {agg_file}")


if __name__ == '__main__':
    _cli()
