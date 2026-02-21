"""
Restart backend server on port 8000
"""
import subprocess
import time
import sys
import os

def kill_process(pid):
    """Kill a process by PID"""
    try:
        subprocess.run(['taskkill', '/F', '/PID', str(pid)],
                      capture_output=True, check=False)
        return True
    except:
        return False

def get_pids_on_port(port):
    """Get all PIDs listening on a specific port"""
    try:
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True,
            text=True,
            encoding='cp949'
        )

        pids = set()
        for line in result.stdout.split('\n'):
            if f':{port}' in line and 'LISTENING' in line:
                parts = line.split()
                if len(parts) >= 5:
                    pid = parts[-1]
                    if pid.isdigit():
                        pids.add(pid)
        return pids
    except Exception as e:
        print(f"Error getting PIDs: {e}")
        return set()

def main():
    print("=" * 50)
    print("RealHunalo Backend Restart")
    print("=" * 50)
    print()

    # Step 1: Kill processes on port 8000
    print("[1/3] Checking port 8000...")
    pids = get_pids_on_port(8000)

    if pids:
        print(f"      Found {len(pids)} process(es): {', '.join(pids)}")
        for pid in pids:
            print(f"      Killing PID {pid}...")
            kill_process(pid)
        time.sleep(2)

        # Verify
        remaining = get_pids_on_port(8000)
        if remaining:
            print(f"      WARNING: {len(remaining)} process(es) still running")
        else:
            print("      [OK] Port 8000 is now free")
    else:
        print("      [OK] Port 8000 is already free")

    print()

    # Step 2: Start backend
    print("[2/3] Starting backend server...")

    # Start in a new window
    subprocess.Popen(
        ['cmd', '/c', 'start', 'RealHunalo Backend', 'cmd', '/k',
         'python', 'backend.py'],
        cwd=os.path.dirname(os.path.abspath(__file__))
    )

    time.sleep(3)
    print("      [OK] Backend server started")
    print()

    # Step 3: Verify
    print("[3/3] Verifying server...")
    pids = get_pids_on_port(8000)
    if pids:
        print(f"      [OK] Server running on port 8000 (PID: {', '.join(pids)})")
    else:
        print("      [WARNING] Server may not have started properly")

    print()
    print("=" * 50)
    print("Restart complete!")
    print("=" * 50)
    print()
    print("Backend: http://localhost:8000")
    print()

if __name__ == "__main__":
    main()
