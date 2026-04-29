"""Recognition shim for `surya` drivers that uses the Tesseract CLI.

This provides a small, dependency-free prediction object compatible with
the expected interface in `surya_pdf.py` and `surya_img.py`:

- `RecognitionPredictor` is callable: `predictions = RecognitionPredictor()(images, det_predictor=...)`
- Each `prediction` in `predictions` has a `.text_lines` attribute which
  is a list of simple objects with a `.text` property.

The shim invokes the Tesseract executable directly (using an environment
variable `TESSERACT_CMD` if present, otherwise `tesseract` on PATH).
"""
from dataclasses import dataclass
from typing import List, Any
import subprocess
import tempfile
import os


@dataclass
class TextLine:
    text: str


class Prediction:
    def __init__(self, lines: List[str]):
        self.text_lines = [TextLine(t) for t in lines]


class RecognitionPredictor:
    def __init__(self, foundation=None, tesseract_cmd: str | None = None):
        self.foundation = foundation
        # prefer explicit env var
        self.tesseract_cmd = tesseract_cmd or os.environ.get("TESSERACT_CMD") or os.environ.get("TESSERACT_PATH") or "tesseract"
        if os.path.isdir(self.tesseract_cmd):
            # if a folder was provided, append exe name
            self.tesseract_cmd = os.path.join(self.tesseract_cmd, "tesseract.exe")

    def __call__(self, images: List[Any], det_predictor=None):
        predictions = []
        for img in images:
            # Save the PIL image to a temporary PNG file
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp_path = tmp.name
                try:
                    img.save(tmp_path)
                except Exception:
                    # If img is already a path string, use it directly
                    tmp_path = img if isinstance(img, str) else tmp_path

            try:
                # Run tesseract to stdout
                cmd = [self.tesseract_cmd, tmp_path, "stdout"]
                proc = subprocess.run(cmd, capture_output=True)
                text = proc.stdout.decode("utf-8", errors="ignore") if proc.stdout else ""
                # Split into lines and strip
                lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
                predictions.append(Prediction(lines))
            finally:
                # remove temporary file if we created it
                try:
                    if os.path.exists(tmp_path) and tmp_path.endswith('.png'):
                        os.remove(tmp_path)
                except Exception:
                    pass

        return predictions


__all__ = ["RecognitionPredictor", "Prediction", "TextLine"]
