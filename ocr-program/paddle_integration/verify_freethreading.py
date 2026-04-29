#!/usr/bin/env python3
"""
Python 3.13 Free-Threading Verification Script
Run this after installing Python 3.13 free-threaded build
"""
import sys
import threading
import time
import os

def test_basic_functionality():
    """Test basic Python functionality"""
    print("🐍 PYTHON VERSION CHECK")
    print("=" * 40)
    print(f"Python version: {sys.version}")
    print(f"Python executable: {sys.executable}")
    print()

def test_gil_support():
    """Test if GIL can be controlled"""
    print("🔓 GIL SUPPORT CHECK")
    print("=" * 40)
    
    # Check if GIL control is available
    has_gil_control = hasattr(sys, '_is_gil_enabled')
    print(f"GIL control available: {has_gil_control}")
    
    if has_gil_control:
        current_gil_status = sys._is_gil_enabled()
        print(f"GIL currently enabled: {current_gil_status}")
        
        # Check environment variable
        gil_env = os.environ.get('PYTHON_GIL', 'default')
        print(f"PYTHON_GIL environment: {gil_env}")
        
        if not current_gil_status:
            print("✅ SUCCESS: GIL is disabled!")
        else:
            print("⚠️  GIL is enabled (this is normal unless you used -X gil=0)")
    else:
        print("❌ ERROR: This Python build doesn't support GIL control")
        print("   You need the free-threaded build of Python 3.13")
        return False
    
    print()
    return has_gil_control

def test_threading_performance():
    """Test threading performance with a CPU-bound task"""
    print("🧵 THREADING PERFORMANCE TEST")
    print("=" * 40)
    
    def cpu_bound_task(n, thread_id):
        """CPU-intensive task for testing"""
        start = time.time()
        # Simple CPU-bound calculation
        result = sum(i * i for i in range(n))
        end = time.time()
        return thread_id, end - start, result
    
    # Test parameters
    task_size = 1000000  # Adjust based on your system
    num_threads = 4
    
    print(f"Testing {num_threads} threads with task size {task_size:,}")
    
    # Sequential execution
    print("🔄 Sequential execution...")
    seq_start = time.time()
    seq_results = [cpu_bound_task(task_size, i) for i in range(num_threads)]
    seq_time = time.time() - seq_start
    print(f"   Sequential time: {seq_time:.3f} seconds")
    
    # Threaded execution
    print("🔄 Threaded execution...")
    threaded_start = time.time()
    threads = []
    threaded_results = [None] * num_threads
    
    def worker(thread_id):
        threaded_results[thread_id] = cpu_bound_task(task_size, thread_id)
    
    # Start threads
    for i in range(num_threads):
        t = threading.Thread(target=worker, args=(i,))
        threads.append(t)
        t.start()
    
    # Wait for completion
    for t in threads:
        t.join()
    
    threaded_time = time.time() - threaded_start
    print(f"   Threaded time: {threaded_time:.3f} seconds")
    
    # Calculate speedup
    speedup = seq_time / threaded_time
    print(f"   Speedup: {speedup:.2f}x")
    
    # Interpret results
    if speedup > 1.5:
        print("✅ SUCCESS: Significant threading speedup detected!")
        print("   This suggests GIL is disabled or significantly reduced.")
    elif speedup > 1.1:
        print("⚠️  PARTIAL: Some threading benefit detected.")
        print("   GIL might be partially disabled or task has I/O components.")
    else:
        print("❌ NO SPEEDUP: Threading shows no CPU benefit.")
        print("   GIL is likely still active for CPU-bound work.")
    
    print()
    return speedup

def main():
    """Main verification function"""
    print("🧪 PYTHON 3.13 FREE-THREADING VERIFICATION")
    print("=" * 50)
    print()
    
    # Test basic functionality
    test_basic_functionality()
    
    # Test GIL support
    gil_support = test_gil_support()
    
    if not gil_support:
        print("❌ VERIFICATION FAILED")
        print("   This is not a free-threaded Python build.")
        print("   Please download and install the correct version.")
        return False
    
    # Test threading performance
    speedup = test_threading_performance()
    
    # Final assessment
    print("🎯 FINAL ASSESSMENT")
    print("=" * 40)
    
    if speedup > 1.5:
        print("✅ EXCELLENT: Free-threading is working optimally!")
        print("   Your OCR code should see significant performance improvements.")
    elif speedup > 1.1:
        print("⚠️  GOOD: Free-threading is partially working.")
        print("   You may need to use -X gil=0 or PYTHON_GIL=0 for full effect.")
    else:
        print("❌ ISSUE: Free-threading not providing expected benefits.")
        print("   Check if you're using -X gil=0 or PYTHON_GIL=0")
    
    print()
    print("🚀 NEXT STEPS")
    print("   If verification passed, you can now run:")
    print("   python -X gil=0 paddle_driver_nogil.py ../test_files/Metamorphosis.pdf")
    print("   OR")
    print("   $env:PYTHON_GIL='0'; python paddle_driver_nogil.py ../test_files/Metamorphosis.pdf")
    
    return True

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        print("   This might indicate an issue with the Python installation.")