import json
from pathlib import Path
from difflib import SequenceMatcher
import re

ROOT = Path.cwd()
PADDLE_DIR = ROOT / 'paddle_integration' / 'paddle_outputs'
DOCTR_DIR = ROOT / 'doctr_outputs'

def load_json(path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return None

def flatten_paddle_results(paddle_json):
    # paddle driver saved: {metadata, results} where results maps page-stem -> [texts]
    if not paddle_json:
        return {}
    return paddle_json.get('results', {})

def flatten_doctr_simple(doctr_json):
    if not doctr_json:
        return {}
    return doctr_json.get('results', {})


PAGE_RE = re.compile(r"^(?P<stem>.+?)_page_(?P<idx>\d+)$")

def normalize_results(results):
    """Return a dict mapping normalized_page_name -> list-of-lines.

    Normalization rule: if a key already ends with _page_N, keep it. If not,
    treat it as a single-page doc and map key -> key_page_0. This aligns
    Paddle single-page keys (e.g. 'book') with DocTR keys ('book_page_0').
    """
    out = {}
    for k, v in (results or {}).items():
        m = PAGE_RE.match(k)
        if m:
            norm = k
        else:
            norm = f"{k}_page_0"

        # normalize value to list of strings
        if v is None:
            lines = []
        elif isinstance(v, list):
            lines = [str(x) for x in v]
        else:
            lines = [str(v)]

        out[norm] = lines

    return out

def compare_texts(a, b):
    ratio = SequenceMatcher(None, a, b).ratio()
    a_words = a.split()
    b_words = b.split()
    if not a_words:
        word_acc = 1.0 if not b_words else 0.0
    else:
        matches = sum(1 for i, w in enumerate(a_words) if i < len(b_words) and b_words[i] == w)
        word_acc = matches / len(a_words)
    return {'char_ratio': ratio, 'word_accuracy': word_acc, 'len_a': len(a), 'len_b': len(b)}

def main():
    # build lists of files present in both
    paddle_files = list(PADDLE_DIR.glob('*.json')) if PADDLE_DIR.exists() else []
    # include any doctr JSON (not only *_simple) to improve matching
    doctr_files = list(DOCTR_DIR.glob('*.json')) if DOCTR_DIR.exists() else []

    # build a map of possible keys -> path to improve matching
    doctr_map = {}
    for p in doctr_files:
        stem = p.stem
        doctr_map[stem] = p
        # also map common variants
        doctr_map[stem.replace('_simple', '')] = p
        doctr_map[stem.replace('_output', '')] = p
        doctr_map[stem.replace('_doctr_output', '')] = p
        doctr_map[stem.replace('_doctr', '')] = p
        doctr_map[stem + '_page_0'] = p

    summary = {}
    for pf in paddle_files:
        name = pf.stem
        # try to map paddle filename to doctr simple name
        doctr_key = name.replace('_output', '')  # paddle outputs may use _output
        doctr_path = doctr_map.get(doctr_key) or doctr_map.get(name)
        # fallback: try substring matching (e.g. 'handwriting' -> 'handwriting-sample')
        if not doctr_path:
            for dk, p in doctr_map.items():
                if doctr_key and doctr_key in dk:
                    doctr_path = p
                    break
                if dk and dk in doctr_key:
                    doctr_path = p
                    break
        paddle_json = load_json(pf)
        paddle_results_raw = flatten_paddle_results(paddle_json)
        paddle_results = normalize_results(paddle_results_raw)

        if doctr_path:
            doctr_json = load_json(doctr_path)
            doctr_results_raw = flatten_doctr_simple(doctr_json)
            doctr_results = normalize_results(doctr_results_raw)
        else:
            doctr_results = {}

        # union of normalized page keys
        pages = sorted(set(list(paddle_results.keys()) + list(doctr_results.keys())))
        per_page = {}
        for p in pages:
            a = '\n'.join(paddle_results.get(p, []))
            b = '\n'.join(doctr_results.get(p, []))
            per_page[p] = compare_texts(a, b)

        summary[name] = {
            'pages_compared': len(per_page),
            'per_page': per_page
        }

    print(json.dumps(summary, indent=2))

if __name__ == '__main__':
    main()
