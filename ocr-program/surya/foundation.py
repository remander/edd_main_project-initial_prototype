"""Minimal foundation shim for the local `surya` drivers.

This provides a lightweight `FoundationPredictor` placeholder so the
existing `surya_pdf.py` and `surya_img.py` scripts can import and run
without needing an external `surya` package.

The implementation is intentionally small — it only stores configuration
and provides a consistent API expected by the recognition shim.
"""
from typing import Any


class FoundationPredictor:
    def __init__(self, *args, **kwargs):
        # No heavy ML model loaded — this is a compatibility shim.
        self.config = kwargs

    def info(self) -> dict:
        return {"shim": True, "description": "Local surya foundation shim"}


__all__ = ["FoundationPredictor"]
