"""Minimal detection shim used by the `surya` drivers.

This detection shim is a no-op placeholder. It exists so the recognition
shim can accept a `det_predictor` parameter without requiring an external
dependency.
"""
class DetectionPredictor:
    def __init__(self, *args, **kwargs):
        pass

    def __call__(self, image):
        # Return None / do-nothing detection — recognition will just run
        # on the whole image.
        return None


__all__ = ["DetectionPredictor"]
