# PaddlePaddle build checklist — Windows (Python 3.14)

> Purpose: checklist and step-by-step guidance to build PaddlePaddle from source on Windows for Python 3.14 (CPU-only and GPU). Includes alternatives, estimates, and verification steps.

## TL;DR recommendation
- If you need production stability now: use Python 3.13 and official PaddlePaddle wheels.
- If you need to test free-threading reliably: install a free-threaded Python 3.13 (3.13t) and use existing wheels.
- If you must use Python 3.14 on Windows: expect to build PaddlePaddle from source. This file documents the full checklist and realistic time/cost estimates.

---

## Preconditions (hardware & disk)
- Disk: 80–150 GB free (build artifacts + sources).
- RAM: 16 GB minimum; 32+ GB recommended.
- CPU: 4+ logical cores minimum; 8–16 cores recommended.
- Windows 10/11 (x86_64).

---

## High-level steps
1. Install developer tools (Visual Studio Build Tools 2022, CMake, Ninja, Git).
2. Prepare Python 3.14 environment (conda or venv) and upgrade pip/setuptools/wheel.
3. Clone PaddlePaddle source and choose a release tag.
4. Configure CMake with appropriate flags and build (Ninja recommended).
5. Package a Python wheel and install in your `ocr_py314` env.
6. Run verification / smoke tests.

---

## A. System prerequisites & developer tools (Windows)
Install the following before building. Use the Visual Studio installer and official downloads.

- Microsoft Visual Studio Build Tools 2022
  - Workload: "Desktop development with C++"
  - Include: MSVC v143 toolset, Windows 10/11 SDK, C++ CMake tools
- CMake >= 3.25 (or latest stable)
- Ninja
- Git
- (Optional) Chocolatey for easy installs

Example PowerShell (Chocolatey) installs (run as Administrator):

```powershell
# Install Chocolatey (if you don't have it) - run in elevated PowerShell
Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install build tools (interactive VS build tools may still be required)
choco install -y visualstudio2022buildtools cmake ninja git
```

Note: Visual Studio Build Tools installer is large (several GB). Use the interactive installer to ensure the correct components are selected.

---

## B. Python environment prep
- Use your existing `ocr_py314` conda env or create one:

```powershell
conda create -n ocr_py314 -c conda-forge python=3.14 pip -y
conda activate ocr_py314
python -m pip install --upgrade pip setuptools wheel
```

- Install auxiliary Python packages you’ll want for build/test (optional):

```powershell
pip install numpy pillow py-cpuinfo psutil pdf2image
```

---

## C. Third-party native libraries (may be required)
- protobuf (C++ and Python)
- oneDNN / Intel MKL (optional but recommended for performance)
- OpenBLAS or MKL (use conda-provided MKL if desired)
- zlib, snappy, gflags, glog, leveldb, lmdb (as needed)

Paddle's build scripts may fetch/build some of these automatically; if CMake fails to find them, install or point CMake to prebuilt locations.

---

## D. Clone PaddlePaddle source

```powershell
cd %USERPROFILE%\src
git clone https://github.com/PaddlePaddle/Paddle.git
cd Paddle
# checkout a stable tag that pairs well with your PaddleOCR (if unsure, use latest stable)
git fetch --tags
git checkout tags/v2.x.x -b build-v2.x.x   # replace with desired tag
```

---

## E. Configure the build (CMake)
Create and enter a build directory, then run CMake. Example CPU-only configuration (PowerShell):

```powershell
mkdir build; cd build
cmake .. -G Ninja `
  -DPY_VERSION=3.14 `
  -DWITH_GPU=OFF `
  -DWITH_TESTING=OFF `
  -DWITH_DOC=OFF `
  -DWITH_MKL=ON `
  -DUSE_AVX=ON
```

Notes:
- The exact CMake option names may vary by Paddle version — check `Paddle/README.md` and `cmake/` docs in the repo.
- Use `-DWITH_GPU=ON` and add CUDA/CUDNN paths for GPU builds.
- If CMake complains about missing dependencies, install or point paths using `-D<LIB>_DIR` variables.

---

## F. Build and package the Python wheel

```powershell
# Build with Ninja - adjust -j to number of logical cores
cmake --build . --target paddle_pybind -- -j 8

# Create wheel (method depends on repo version)
# Option A: use setup.py (older versions)
python setup.py bdist_wheel
# Option B: use CMake packaging target (if available)
cmake --build . --target package_python
```

- Resulting wheel should be in `build/dist/` or `dist/` depending on scripts.

---

## G. Install and test the wheel

```powershell
# Install the wheel into active env
pip install dist\paddlepaddle-*.whl

# quick smoke test
python -c "import paddle; print('paddle', paddle.__version__)"
```

Then install paddleocr and run a small script:

```powershell
pip install paddleocr
python -c "from paddleocr import PaddleOCR; ocr = PaddleOCR(use_angle_cls=False, lang='en'); print('ocr instance created')"
```

---

## H. GPU build extra requirements (if needed)
- NVIDIA drivers (matching CUDA), CUDA Toolkit (matching Paddle version), cuDNN
- Ensure `CUDA_HOME` / `CUDA_PATH` environment variables are set
- Example CMake flags for GPU build:

```powershell
cmake .. -G Ninja -DWITH_GPU=ON -DCUDA_TOOLKIT_ROOT_DIR='C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.0' -DWITH_MKL=ON
```

GPU builds are larger and slower. Make sure the Paddle release you build supports your CUDA version.

---

## I. Recommended alternative: build on Linux (WSL2 or cloud) then use wheel on Windows
Building on Linux/WSL2 is usually simpler and faster. Steps:
1. Create Ubuntu WSL2 or a Linux cloud VM (16 vCPU, 32 GB RAM recommended).
2. Install build tools: build-essential, cmake, ninja, git, python3-dev, pip.
3. Clone Paddle repo, run CMake/Ninja, produce wheel.
4. Transfer the wheel to Windows and `pip install`.

This approach saves hours of Windows-specific troubleshooting.

---

## J. Troubleshooting common errors
- "Could not find vswhere.exe" → reinstall Visual Studio Build Tools.
- Linker or unresolved symbol errors → missing 3rd-party dev libs or incorrect architecture (use x64 targets).
- Python ABI mismatch → ensure the same Python executable you used to build is used to install/run the wheel.
- Long compile logs → find the first error message in the output; later errors are often follow-ons.

---

## K. Time & cost estimates
- CPU-only build (Windows local, 8–16 cores, 32 GB RAM): 2–6 hours (includes setup + build + tests).
- GPU-enabled build (including CUDA install): 4–16+ hours (more if driver/CUDA mismatches occur).
- WSL2/Linux on a beefy VM: 1–4 hours build time on a 16vCPU/64GB machine.
- Cloud cost (small estimate):
  - Medium VM: $0.3–$1 / hour (2–4 hours ≈ $1–$4)
  - Large VM: $1–$3 / hour (1–2 hours ≈ $2–$6)
  - GPU VM: varies widely; expect $2–$20+/hour depending on GPU

Labor/effort: expect 2–8 hours of developer time for a successful CPU build, more if debugging issues.

---

## L. Verification / smoke-tests (after wheel install)
```powershell
# verify paddle import
python -c "import paddle; print('paddle', paddle.__version__)"

# quick PaddleOCR smoke
python -c "from paddleocr import PaddleOCR; ocr = PaddleOCR(use_angle_cls=False, lang='en'); print('ocr ok')"

# run an example driver in the repo
cd C:\Users\rmander\Documents\ocr-testing\paddle_integration\paddle_drivers
python paddle_driver_freethreading.py ..\..\test_files\Metamorphosis.pdf
```

---

## M. Next actions (pick one)
- [ ] I will produce a Windows PowerShell script that automates installs and kicks off the build (CPU-only). (Time: ~2–6 hours to run locally.)
- [ ] I will produce a Linux/WSL build script and a recommended cloud VM spec (faster, less painful).
- [ ] I will produce a backout plan and a `conda` YAML + `requirements.txt` for a Python 3.13 environment (fastest route).

Reply with which next action you want me to perform and whether you prefer Windows native build or WSL/Linux cloud build.

---

*File generated: PADDLEPADDLE_BUILD_WINDOWS_PY314.md*
