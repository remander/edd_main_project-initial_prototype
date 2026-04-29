"""
Shared formatter to produce doctr-style JSON outputs from driver results and driver metadata.
Provides format_to_doctr(results, metadata, document_name=None, is_pdf=True)

This formatter is resilient: it fills missing fields using runtime information and
merges driver-provided timing/resource data when available.
"""
from datetime import datetime
import platform
import psutil
import importlib
import importlib.metadata
import os

try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None


def _get_version_safe(name):
    try:
        return importlib.metadata.version(name)
    except Exception:
        return "not installed"


def _make_processing_date_string():
    # Match the format used elsewhere: "Date of OCR Processing: YYYY-MM-DD, H:MM:SS am/pm TZ"
    if ZoneInfo is not None:
        try:
            tz = ZoneInfo("America/New_York")
            dt = datetime.now(tz)
            time_part = dt.strftime("%I:%M:%S %p").lstrip('0').replace('AM', 'am').replace('PM', 'pm')
            return f"Date of OCR Processing: {dt.strftime('%Y-%m-%d')}, {time_part} {dt.tzname()}"
        except Exception:
            pass
    dt = datetime.now()
    time_part = dt.strftime("%I:%M:%S %p").lstrip('0').replace('AM', 'am').replace('PM', 'pm')
    return f"Date of OCR Processing: {dt.strftime('%Y-%m-%d')}, {time_part}"


def build_metadata(driver_meta=None, ocr_model_name=None, poppler_path=None):
    """Construct a doctr-style metadata dict by merging driver_meta when available."""
    dm = driver_meta or {}

    # date
    date_str = dm.get('date_of_ocr_processing') or _make_processing_date_string()

    # ocr model
    ocr_model = dm.get('ocr_model') or ocr_model_name or dm.get('ocr_model_name') or 'unknown_ocr'

    # python version
    python_version = dm.get('python_version') or platform.python_version()

    # libraries (try to preserve any provided, otherwise attempt to detect common libs)
    libs = dm.get('libraries', {}) if isinstance(dm.get('libraries', {}), dict) else {}
    common = {
        'pdf2image': libs.get('pdf2image') or _get_version_safe('pdf2image'),
        'doctr': libs.get('doctr') or libs.get('python-doctr') or _get_version_safe('python-doctr'),
        'Pillow': libs.get('Pillow') or _get_version_safe('Pillow'),
        'psutil': libs.get('psutil') or _get_version_safe('psutil'),
        'cpuinfo': libs.get('cpuinfo') or libs.get('py-cpuinfo') or _get_version_safe('py-cpuinfo')
    }

    # system info
    system = dm.get('system', {}) if isinstance(dm.get('system', {}), dict) else {}
    try:
        cpu_brand = system.get('cpu') or (importlib.import_module('cpuinfo').get_cpu_info().get('brand_raw') if importlib.util.find_spec('cpuinfo') else 'unknown')
    except Exception:
        cpu_brand = system.get('cpu') or 'unknown'

    system_info = {
        'platform': system.get('platform') or platform.platform(),
        'cpu': cpu_brand,
        'cpu_count': system.get('cpu_count') or psutil.cpu_count(logical=True),
        'total_memory_mb': system.get('total_memory_mb') or (psutil.virtual_memory().total / 1024 / 1024),
        'poppler_path': system.get('poppler_path') if 'poppler_path' in system else poppler_path
    }

    # timing: copy if present, otherwise try to use driver-provided fields
    timing = dm.get('timing', {}) if isinstance(dm.get('timing', {}), dict) else {}

    # resource usage
    resource_usage = dm.get('resource_usage', {}) if isinstance(dm.get('resource_usage', {}), dict) else {}

    metadata = {
        'date_of_ocr_processing': date_str,
        'ocr_model': ocr_model,
        'python_version': python_version,
        'libraries': common,
        'system': system_info,
        'timing': timing,
        'resource_usage': resource_usage
    }

    return metadata


def format_to_doctr(results, driver_meta=None, ocr_model_name=None, document_name=None, poppler_path=None, is_pdf=True):
    """
    Build a final JSON structure matching doctr-driver's format.

    - results: dict mapping page_stem -> list[str]
    - driver_meta: metadata produced by specific driver (may be partial)
    - ocr_model_name: fallback name for model
    - document_name: optional base name of document (used when creating per-page keys if needed)
    - is_pdf: if True, returns metadata then results (page->list). If False, wraps into results.pages/summary structure.
    """
    # Ensure results is a dict of page->list
    res = results or {}

    # Build standardized metadata
    metadata = build_metadata(driver_meta or {}, ocr_model_name=ocr_model_name, poppler_path=poppler_path)

    # If driver provided timing/resource keys, respect them; otherwise leave empty dicts
    # Prepare final structure
    if is_pdf:
        final = {
            'metadata': metadata,
            'results': res
        }
        return final

    # Non-pdf aggregated structure
    # Create pages map with minimal enrichments
    results_by_page = {}
    total_lines = 0
    total_characters = 0

    per_page_timing = metadata.get('timing', {}).get('per_page_seconds', {})
    per_page_resources = metadata.get('resource_usage', {}).get('per_page', {})

    for page, lines in res.items():
        lines_list = lines or []
        total_lines += len(lines_list)
        for l in lines_list:
            try:
                total_characters += len(l)
            except Exception:
                pass

        page_timing = per_page_timing.get(page) if isinstance(per_page_timing, dict) else None
        page_resource = None
        try:
            if isinstance(per_page_resources, dict):
                cpu_map = per_page_resources.get('cpu_percent')
                mem_map = per_page_resources.get('memory_mb')
                page_resource = {
                    'cpu_percent': cpu_map.get(page) if isinstance(cpu_map, dict) else None,
                    'memory_mb': mem_map.get(page) if isinstance(mem_map, dict) else None
                }
        except Exception:
            page_resource = None

        results_by_page[page] = {
            'ocr': lines_list,
            'timing_seconds': page_timing,
            'resource_usage': page_resource
        }

    total_pages = len(results_by_page)
    avg_lines_per_page = (total_lines / total_pages) if total_pages else 0

    summary = {
        'total_pages': total_pages,
        'total_lines': total_lines,
        'total_characters': total_characters,
        'avg_lines_per_page': avg_lines_per_page,
        'total_time_seconds': metadata.get('timing', {}).get('total_time_seconds')
    }

    final = {
        'results': {
            'pages': results_by_page,
            'summary': summary
        },
        'metadata': metadata
    }

    return final
