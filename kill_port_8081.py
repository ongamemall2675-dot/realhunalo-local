
import os
import signal
import subprocess
import sys
import re

def kill_port(port):
    try:
        # Run netstat to find PID
        result = subprocess.run(['netstat', '-aon'], capture_output=True, text=True)
        # Look for the port
        # TCP    0.0.0.0:8081           0.0.0.0:0              LISTENING       1234
        pattern = re.compile(f":{port}\\s+.*\\s+(\\d+)\\s*$")
        pids = set()
        for line in result.stdout.splitlines():
            if f":{port}" in line:
                match = pattern.search(line)
                if match:
                    pids.add(match.group(1))
        
        if not pids:
            print(f"No process found on port {port}")
            return

        for pid in pids:
            print(f"Killing PID {pid} on port {port}")
            subprocess.run(['taskkill', '/F', '/PID', pid])
            
    except Exception as e:
        print(f"Error killing port {port}: {e}")

if __name__ == "__main__":
    kill_port(8081)
