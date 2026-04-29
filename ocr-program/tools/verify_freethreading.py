#!/usr/bin/env python3
"""
Comprehensive Free-Threading Verification Script for Python 3.13+
Verifies GIL status, threading capabilities, and performance characteristics.
"""

import sys
import threading
import time
import concurrent.futures
import os
import platform
from typing import List

def check_python_version():
    """Check Python version and build type."""
    print("=== Python Version and Build Information ===")
    print(f"Python version: {sys.version}")
    print(f"Platform: {platform.platform()}")
    print(f"Architecture: {platform.architecture()}")
    print()

def check_gil_status():
    """Check if GIL is enabled or disabled."""
    print("=== GIL Status Check ===")
    
    # Check if we have the GIL status function (Python 3.13+)
    if hasattr(sys, '_is_gil_enabled'):
        gil_enabled = sys._is_gil_enabled()
        print(f"GIL enabled: {gil_enabled}")
        if gil_enabled:
            print("✅ GIL is ENABLED - Standard threading behavior")
        else:
            print("🚀 GIL is DISABLED - True free-threading enabled!")
    else:
        print("❌ GIL status checking not available (Python < 3.13)")
    
    # Check environment variables
    gil_env = os.environ.get('PYTHON_GIL', 'default')
    print(f"PYTHON_GIL environment variable: {gil_env}")
    print()

def cpu_bound_task(n: int) -> int:
    """CPU-intensive task for testing threading performance."""
    total = 0
    for i in range(n):
        total += i * i
    return total

def test_threading_performance():
    """Test threading performance with CPU-bound tasks."""
    print("=== Threading Performance Test ===")
    
    # Test parameters
    num_tasks = 8
    task_size = 1000000
    
    print(f"Running {num_tasks} CPU-bound tasks of size {task_size:,}")
    
    # Single-threaded baseline
    print("Running single-threaded baseline...")
    start_time = time.time()
    results_single = []
    for i in range(num_tasks):
        results_single.append(cpu_bound_task(task_size))
    single_threaded_time = time.time() - start_time
    
    # Multi-threaded test
    print("Running multi-threaded test...")
    start_time = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_tasks) as executor:
        futures = [executor.submit(cpu_bound_task, task_size) for _ in range(num_tasks)]
        results_multi = [future.result() for future in futures]
    multi_threaded_time = time.time() - start_time
    
    # Results
    print(f"Single-threaded time: {single_threaded_time:.3f} seconds")
    print(f"Multi-threaded time: {multi_threaded_time:.3f} seconds")
    
    if multi_threaded_time < single_threaded_time:
        speedup = single_threaded_time / multi_threaded_time
        print(f"🚀 Speedup: {speedup:.2f}x faster with threading!")
        print("This suggests the GIL is disabled or significantly reduced.")
    else:
        slowdown = multi_threaded_time / single_threaded_time
        print(f"⚠️ Slowdown: {slowdown:.2f}x slower with threading")
        print("This suggests the GIL is limiting parallel execution.")
    
    print()

def test_concurrent_counter():
    """Test concurrent counter to verify thread safety without GIL."""
    print("=== Concurrent Counter Test ===")
    
    counter = 0
    lock = threading.Lock()
    num_threads = 10
    increments_per_thread = 100000
    
    def increment_counter():
        nonlocal counter
        for _ in range(increments_per_thread):
            # Test both locked and unlocked to see GIL effects
            counter += 1
    
    def increment_counter_locked():
        nonlocal counter
        for _ in range(increments_per_thread):
            with lock:
                counter += 1
    
    # Test without locks (should show race conditions if GIL is disabled)
    print("Testing counter without locks...")
    counter = 0
    start_time = time.time()
    threads = []
    for _ in range(num_threads):
        thread = threading.Thread(target=increment_counter)
        threads.append(thread)
        thread.start()
    
    for thread in threads:
        thread.join()
    
    unlocked_time = time.time() - start_time
    expected_value = num_threads * increments_per_thread
    
    print(f"Expected value: {expected_value:,}")
    print(f"Actual value: {counter:,}")
    print(f"Time taken: {unlocked_time:.3f} seconds")
    
    if counter == expected_value:
        print("✅ Perfect result - GIL likely enabled (serialized execution)")
    else:
        difference = abs(counter - expected_value)
        print(f"❌ Race condition detected! Difference: {difference:,}")
        print("🚀 This suggests GIL is disabled - true parallel execution!")
    
    # Test with locks
    print("\nTesting counter with locks...")
    counter = 0
    start_time = time.time()
    threads = []
    for _ in range(num_threads):
        thread = threading.Thread(target=increment_counter_locked)
        threads.append(thread)
        thread.start()
    
    for thread in threads:
        thread.join()
    
    locked_time = time.time() - start_time
    
    print(f"Expected value: {expected_value:,}")
    print(f"Actual value: {counter:,}")
    print(f"Time taken: {locked_time:.3f} seconds")
    
    if counter == expected_value:
        print("✅ Perfect result with locks")
    else:
        print("❌ Unexpected result even with locks!")
    
    print()

def get_system_info():
    """Display system information relevant to threading."""
    print("=== System Information ===")
    print(f"CPU cores: {os.cpu_count()}")
    print(f"Active threads: {threading.active_count()}")
    print(f"Current thread: {threading.current_thread().name}")
    print()

def main():
    """Run all verification tests."""
    print("🧪 Python Free-Threading Verification Script")
    print("=" * 50)
    print()
    
    check_python_version()
    get_system_info()
    check_gil_status()
    test_threading_performance()
    test_concurrent_counter()
    
    print("=" * 50)
    print("Verification complete!")
    
    # Summary
    if hasattr(sys, '_is_gil_enabled'):
        if sys._is_gil_enabled():
            print("📋 SUMMARY: GIL is enabled - standard Python threading")
        else:
            print("🚀 SUMMARY: GIL is disabled - free-threading enabled!")
            print("You can now use aggressive threading for CPU-bound tasks!")
    else:
        print("📋 SUMMARY: GIL status unknown (Python < 3.13)")

if __name__ == "__main__":
    main()