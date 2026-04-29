# Installing Python 3.13t Free-Threaded Build

## Overview

To fully test free-threading capabilities, you need the experimental free-threaded build of Python 3.13, which allows disabling the Global Interpreter Lock (GIL).

## Installation Options

### Option 1: Download Pre-built Binary (Recommended)

1. **Visit Python.org Downloads**
   - Go to https://www.python.org/downloads/
   - Look for Python 3.13 experimental builds
   - Download the "free-threaded" or "nogil" build for Windows

2. **Alternative: Python.org FTP**
   - Visit https://www.python.org/ftp/python/3.13.0/
   - Look for files with `freethreaded` in the name
   - Example: `python-3.13.0-freethreaded-win_amd64.exe`

### Option 2: Conda-forge (If Available)

```bash
# Check if conda-forge has free-threaded builds
conda search python=3.13 -c conda-forge
conda install python=3.13t -c conda-forge
```

### Option 3: Build from Source (Advanced)

```bash
# Clone Python source
git clone https://github.com/python/cpython.git
cd cpython
git checkout v3.13.0

# Configure with GIL disabled
./configure --disable-gil --prefix=/path/to/install
make -j$(nproc)
make install
```

## Installation Steps (Windows)

1. **Download the free-threaded installer**
2. **Install to separate directory** (e.g., `C:\Python313t\`)
3. **Add to PATH** or use full path to executable
4. **Verify installation**:
   ```cmd
   C:\Python313t\python.exe -c "import sys; print('GIL enabled:', sys._is_gil_enabled())"
   ```

## Usage

### Method 1: Use the t suffix executable
```bash
python3.13t your_script.py
```

### Method 2: Disable GIL with command line
```bash
python -X gil=0 your_script.py
```

### Method 3: Environment variable
```bash
# Windows PowerShell
$env:PYTHON_GIL="0"
python your_script.py

# Windows CMD
set PYTHON_GIL=0
python your_script.py

# Linux/Mac
export PYTHON_GIL=0
python your_script.py
```

## Testing Free-Threading with Your OCR Code

Once you have the free-threaded build:

```bash
# Test with GIL disabled
python -X gil=0 paddle_driver_nogil.py "../test_files/Metamorphosis.pdf" "nogil_results.json" 5 10

# Or using environment variable
$env:PYTHON_GIL="0"
python paddle_driver_nogil.py "../test_files/Metamorphosis.pdf" "nogil_results.json" 5 10
```

## Expected Performance with True Free-Threading

Based on current results showing 28-31% improvement with threading **despite** GIL limitations:

| Scenario | Current Time | Projected Time | Total Speedup |
|----------|-------------|---------------|---------------|
| **Multiprocessing (baseline)** | 61.93s | - | 1.0x |
| **Threading with GIL** | 40.53s | - | 1.53x |
| **Threading without GIL** | - | **25-30s** | **2.0-2.5x** |

## Verification Commands

After installation, verify your setup:

```python
# Check if GIL can be disabled
python -c "import sys; print('Can disable GIL:', not sys._is_gil_enabled())"

# Check free-threading build
python -c "import sys; print('Free-threading build:', hasattr(sys, '_is_gil_enabled'))"

# Test GIL disabling
python -X gil=0 -c "
import sys
import threading
print(f'GIL enabled: {sys._is_gil_enabled()}')
print(f'Threading available: {threading.active_count()}')
"
```

## Current Status

Your system currently has:
- ✅ Python 3.13.7 (standard build)
- ❌ Free-threaded build (needed for GIL disabling)
- ✅ Threading optimization code ready
- ✅ Performance gains already achieved (28-31%)

## Next Steps

1. **Immediate**: Deploy the threading approach for production use
2. **Short-term**: Install Python 3.13t for testing true free-threading
3. **Long-term**: Evaluate migration to free-threaded Python for production

The threading architecture you now have is already delivering significant performance improvements and is future-ready for when you install the true free-threaded build!