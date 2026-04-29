import time
from pathlib import Path
import numpy as np
import argparse
import cv2
import tempfile
import atexit
 
# DocTR imports
 
from doctr.io import DocumentFile as DocTRDocumentFile
from doctr.models import ocr_predictor as doctr_ocr_predictor
 
def parse_arguments():
    parser = argparse.ArgumentParser(description="ONNXTR Image Text Extractor with Vertical Text Support")
    parser.add_argument("--output_file", default=None, help="Path to output file for extracted text")
    parser.add_argument("--det_model", default=None, help="Detection model (default: db_resnet50)")
    parser.add_argument("--reco_model", default=None, help="Recognition model (default: parseq)")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--image_folder", help="Path to folder containing images")
    group.add_argument("--image_path", help="Path to a single image file")
    args = parser.parse_args()
    if not args.det_model:
        args.det_model = "db_resnet50"
    if not args.reco_model:
        args.reco_model = "parseq"
    return args
 
def setup_onnxtr(det_model_path, reco_model_path):
    """Initialize ONNXTR predictor."""
    try:
        start_time = time.time()
        print("Initializing ONNXTR OCR predictor...")
        from onnxtr.models import ocr_predictor
        predictor = ocr_predictor(
            det_arch=det_model_path,
            reco_arch=reco_model_path,
            assume_straight_pages=False,
            detect_language=False,
            detect_orientation=True,
            export_as_straight_boxes=False,
            resolve_lines=True,
            resolve_blocks=False,
            det_bs=2,
            reco_bs=128
        )
        predictor.det_predictor.model.postprocessor.box_thresh = 0.1
        predictor.det_predictor.model.postprocessor.bin_thresh = 0.3
        init_time = time.time() - start_time
        print(f"ONNXTR predictor initialized in {init_time:.2f}s")
        return predictor
    except Exception as e:
        print(f"Failed to initialize ONNXTR: {e}")
        raise
 
try:
   
    doctr_available = True
except ImportError:
    doctr_available = False
 
# Configure logging
 
# Temp file cleanup
temp_files = []
 
def cleanup_temp_files():
    """Clean up temporary files on exit."""
    for f in temp_files:
        try:
            if f.exists():
                f.unlink()
                print(f"Cleaned up temp file: {f}")
        except Exception as e:
            print(f"Failed to clean up {f}: {e}")
 
atexit.register(cleanup_temp_files)
 
 
def normalize_word(word):
    """Normalize word by removing punctuation and converting to uppercase."""
    import re, string
    return re.sub(rf'[{re.escape(string.punctuation)}]', '', word).upper()
 
 
def extract_text_from_image_internal(predictor, image_path):
    """Extract text from image using ONNXTR predictor."""
    try:
        from onnxtr.io import DocumentFile
        temp_file_path = None
        if image_path.suffix.lower() != '.pdf':
            img = cv2.imread(str(image_path))
            if img is None:
                return "", 0, {}
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            preprocessed = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
            temp_file_path = Path(tempfile.mktemp(suffix='.jpg', prefix='preprocessed_'))
            temp_files.append(temp_file_path)
            cv2.imwrite(str(temp_file_path), preprocessed)
            doc = DocumentFile.from_images(str(temp_file_path))
        else:
            doc = DocumentFile.from_pdf(str(image_path))
        result = predictor(doc)
        if not result.pages or len(result.pages) == 0:
            return "", 0, {}
        extracted_text_lines = []
        total_words = 0
        confidence_scores = []
        for page in result.pages:
            for block in page.blocks:
                for line in block.lines:
                    line_text = ""
                    line_confidences = []
                    for word in line.words:
                        word_text = word.value
                        word_confidence = word.confidence if hasattr(word, 'confidence') else 1.0
                        line_text += word_text + " "
                        line_confidences.append(word_confidence)
                        total_words += 1
                    if line_text.strip():
                        extracted_text_lines.append(line_text.strip())
                        confidence_scores.extend(line_confidences)
        full_text = '\n'.join(extracted_text_lines)
        confidence_info = {
            'avg_confidence': np.mean(confidence_scores) if confidence_scores else 0.0,
            'min_confidence': np.min(confidence_scores) if confidence_scores else 0.0,
            'max_confidence': np.max(confidence_scores) if confidence_scores else 0.0,
            'word_count': total_words
        }
        return full_text, total_words, confidence_info
    except Exception as e:
        print(f"Error extracting text: {e}")
        return "", 0, {}
 
 
 
def save_results_to_file(results, processing_times, word_counts, confidence_infos, output_file):
    """Save extraction results to a text file."""
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("=" * 40 + "\n\n")
           
            total_time = sum(processing_times.values())
            total_words = sum(word_counts.values())
            avg_confidence = np.mean([info['avg_confidence'] for info in confidence_infos.values()
                                     if info.get('avg_confidence', 0) > 0])
           
            f.write(f"Total Processing Time: {total_time:.2f}s\n")
            f.write(f"Average Time per Image: {total_time/len(results):.2f}s\n")
            f.write(f"Images Processed: {len(results)}\n")
            f.write(f"Total Words Extracted: {total_words}\n")
            f.write(f"Average Confidence: {avg_confidence:.2f}\n\n")
            f.write("=" * 40 + "\n\n")
           
            for image_name, text in results.items():
                proc_time = processing_times.get(image_name, 0)
                word_count = word_counts.get(image_name, 0)
                conf_info = confidence_infos.get(image_name, {})
               
                f.write(f"Image: {image_name}\n")
                f.write(f"Processing Time: {proc_time:.2f}s\n")
                f.write(f"Words Extracted: {word_count}\n")
                f.write(f"Avg Confidence: {conf_info.get('avg_confidence', 0):.2f}\n")
                f.write("-" * 40 + "\n")
                f.write(text if text else "No text extracted")
                f.write("\n\n" + "=" * 40 + "\n\n")
       
            print(f"Results saved to: {output_file}")
    except Exception as e:
            print(f"Error saving results: {e}")
 
 
def is_image_file(file_path):
    """Check if the file is a supported format."""
    supported_formats = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp', '.pdf'}
    return file_path.suffix.lower() in supported_formats
 
 
def main():
    """Main function to process images."""
    overall_start_time = time.time()
   
    args = parse_arguments()
 
    det_model_path = args.det_model
    reco_model_path = args.reco_model
    image_folder = Path(args.image_folder) if args.image_folder else None
    output_file = args.output_file
 
    if args.image_path:
        image_files = [Path(args.image_path)]
        if not image_files[0].is_file() or not is_image_file(image_files[0]):
            print(f"Invalid image file: {args.image_path}")
            print(f"Error: The file '{args.image_path}' is not a valid image.")
            return
    else:
        if not image_folder.exists():
            print(f"Image folder not found: {image_folder}")
            print(f"Error: The folder '{image_folder}' does not exist.")
            return
 
        image_files = [f for f in image_folder.iterdir()
                       if f.is_file() and is_image_file(f)]
 
        if not image_files:
            print(f"No image files found in {image_folder}")
            print(f"No supported image files found in '{image_folder}'")
            return
 
    print(f"Found {len(image_files)} image files to process")
    print(f"ONNXTR OCR Text Extractor")
    print("=" * 30)
    print(f"Found {len(image_files)} image files to process:")
    for img in image_files:
        print(f"  - {img.name}")
    print()
 
    try:
        predictor = setup_onnxtr(det_model_path, reco_model_path)
    except Exception as e:
        print(f"Failed to initialize ONNXTR: {e}")
        return
 
    results = []
    for image_path in image_files:
        text, words, conf_info = extract_text_from_image_internal(predictor, image_path)
        if args.image_folder:
            # For folders, include image name as header
            results.append(f"===== {image_path.name} =====\n{text}\n")
        else:
            # For single file, just the text
            results.append(text)
 
    if output_file:
        try:
            with open(output_file, "w", encoding="utf-8") as f:
                f.write("\n".join(results))
            print(f"Extracted text written to: {output_file}")
        except Exception as e:
            print(f"Failed to write to output file: {e}")
    else:
        for result in results:
            print(result)
 
 
 
if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Process interrupted by user")
        print("\nProcess interrupted by user")
    except Exception as e:
        print(f"Unexpected error: {e}")
        print(f"An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()