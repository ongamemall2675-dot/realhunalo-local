"""
Kill processes running on port 8000
"""
import os
import subprocess

def kill_port_8000():
    try:
        # Find PIDs using port 8000
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True,
            text=True,
            encoding='cp949'
        )

        pids = set()
        for line in result.stdout.split('\n'):
            if ':8000' in line and 'LISTENING' in line:
                parts = line.split()
                if len(parts) >= 5:
                    pid = parts[-1]
                    if pid.isdigit():
                        pids.add(pid)

        if not pids:
            print("No processes found on port 8000")
            return

        print(f"Found PIDs on port 8000: {pids}")

        # Kill each PID
        for pid in pids:
            try:
                subprocess.run(['taskkill', '/F', '/PID', pid], check=True)
                print(f"[OK] Killed PID {pid}")
            except Exception as e:
                print(f"[FAIL] Failed to kill PID {pid}: {e}")

        print("\n[OK] All processes killed")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    kill_port_8000()
