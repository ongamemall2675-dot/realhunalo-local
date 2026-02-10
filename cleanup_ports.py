import os
import subprocess
import time
import signal

def kill_port(port):
    print(f"🔍 Port {port} 점유 프로세스 확인 중...")
    try:
        output = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True).decode()
        pids = set()
        for line in output.strip().split('\n'):
            parts = line.split()
            if len(parts) >= 5:
                pid = parts[-1]
                pids.add(pid)
        
        for pid in pids:
            print(f"💥 PID {pid} 종료 시도...")
            subprocess.run(f"taskkill /F /PID {pid}", shell=True)
        
        time.sleep(2)
    except Exception as e:
        print(f"ℹ️ Port {port} is clear or error: {e}")

if __name__ == "__main__":
    kill_port(8000)
    kill_port(8001) # 8001도 정리
    print("✅ Port cleanup 완료. 서버를 새로 시작합니다.")
