"""
Force kill all Python processes on port 8000
"""
import subprocess
import time

print("Forcefully killing all processes on port 8000...")

# Get all PIDs
result = subprocess.run(['netstat', '-ano'], capture_output=True, text=True, encoding='cp949')

pids = set()
for line in result.stdout.split('\n'):
    if ':8000' in line:
        parts = line.split()
        if len(parts) >= 5:
            pid = parts[-1]
            if pid.isdigit():
                pids.add(pid)

if pids:
    print(f"Found {len(pids)} process(es): {pids}")

    for pid in pids:
        try:
            # Use /F to force kill
            subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True)
            print(f"  Killed PID {pid}")
        except:
            pass

    time.sleep(2)

    # Verify
    result2 = subprocess.run(['netstat', '-ano'], capture_output=True, text=True, encoding='cp949')
    remaining = []
    for line in result2.stdout.split('\n'):
        if ':8000' in line and 'LISTENING' in line:
            parts = line.split()
            if len(parts) >= 5:
                remaining.append(parts[-1])

    if remaining:
        print(f"\nWARNING: {len(remaining)} process(es) still running: {remaining}")
    else:
        print("\n[OK] All processes killed, port 8000 is free")
else:
    print("[OK] No processes found on port 8000")
