from pathlib import Path
import sys
import os

def _list_candidates(test_files_dir: Path):
    try:
        if test_files_dir.exists():
            candidates = [p for p in sorted(test_files_dir.iterdir()) if p.is_dir() or p.suffix.lower() in ['.pdf', '.png', '.jpg', '.jpeg', '.bmp', '.tiff']]
        else:
            candidates = []
    except Exception:
        candidates = []
    return candidates

def interactive_select(test_files_dir: Path, default_output_parent: Path, default_name=None):
    """Interactive selection helper used by drivers.

    Returns: (input_path: Path, output_dir: Path, output_json: Path, start_page: int|None, end_page: int|None)
    """
    test_files_dir = Path(test_files_dir)
    default_output_parent = Path(default_output_parent)

    print(f"Available items in {test_files_dir}:")
    candidates = _list_candidates(test_files_dir)
    if candidates:
        for i, p in enumerate(candidates, start=1):
            kind = "(dir)" if p.is_dir() else "(file)"
            print(f"  {i}. {p.name} {kind}")
    else:
        print("  (no test files or folders found)")

    input_prompt = (
        "Enter the input file name located in {dir} (or press Enter to process the whole folder).\n"
        "You can also enter the number of an item above, a simple filename to look up in the folder,\n"
        "or an absolute path: ".format(dir=test_files_dir)
    )

    input_str = input(input_prompt).strip()

    if not input_str:
        input_path = test_files_dir.resolve()
        print(f"Using test files folder as input: {input_path}")
    else:
        if input_str.isdigit():
            idx = int(input_str) - 1
            if 0 <= idx < len(candidates):
                input_path = candidates[idx].resolve()
            else:
                candidate = Path(input_str)
                if candidate.is_absolute() or candidate.parent != Path('.'): 
                    input_path = candidate.resolve()
                else:
                    input_path = (test_files_dir / candidate).resolve()
        else:
            candidate = Path(input_str)
            if candidate.is_absolute() or candidate.parent != Path('.'): 
                input_path = candidate.resolve()
            else:
                input_path = (test_files_dir / candidate).resolve()
        print(f"Using input path: {input_path}")

    # Output folder selection
    try:
        default_output_parent.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

    existing_dirs = []
    try:
        existing_dirs = sorted([p for p in default_output_parent.iterdir() if p.is_dir()])
    except Exception:
        existing_dirs = []

    print(f"Existing output folders under {default_output_parent}:")
    if existing_dirs:
        for i, p in enumerate(existing_dirs, start=1):
            print(f"  {i}. {p.name}")
    else:
        print("  (none yet)")

    prompt = (
        "Where do you want the output saved? Enter the number to pick an existing folder, a folder name to create under {parent},\n"
        "an absolute path, or press Enter for default {parent}: ".format(parent=default_output_parent)
    )

    output_folder_str = input(prompt).strip()
    if output_folder_str:
        if output_folder_str.isdigit():
            idx = int(output_folder_str) - 1
            if 0 <= idx < len(existing_dirs):
                OUTPUT_DIR = existing_dirs[idx].resolve()
            else:
                print("Invalid selection number; using default")
                OUTPUT_DIR = default_output_parent
        else:
            cand = Path(output_folder_str)
            if cand.is_absolute() or cand.parent != Path('.'): 
                OUTPUT_DIR = cand.resolve()
            else:
                OUTPUT_DIR = default_output_parent / cand
    else:
        OUTPUT_DIR = default_output_parent

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Writing outputs to: {OUTPUT_DIR}")

    # Output filename
    output_file_str = input("Output JSON filename? (Press Enter to use default): ").strip()
    if output_file_str:
        cand = Path(output_file_str)
        output_json = cand if cand.is_absolute() else OUTPUT_DIR / cand
    else:
        stem = None
        try:
            stem = input_path.stem
        except Exception:
            stem = (test_files_dir.name if test_files_dir.exists() else "output")
        if default_name:
            out_name = default_name
        else:
            out_name = f"{stem}_ocr_output.json"
        output_json = OUTPUT_DIR / out_name

    # Page range
    start_page_str = input("Start page (Press Enter to skip): ").strip()
    end_page_str = input("End page (Press Enter to skip): ").strip()
    start_page = int(start_page_str) if start_page_str else None
    end_page = int(end_page_str) if end_page_str else None

    return Path(input_path), Path(OUTPUT_DIR), Path(output_json), start_page, end_page
