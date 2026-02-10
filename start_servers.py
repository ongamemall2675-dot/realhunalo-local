"""
RealHunalo Studio - 서버 관리 스크립트

백엔드, 프론트엔드, 그리고 Cloudflare Tunnel을 동시에 시작하고 모니터링합니다.
서버나 터널이 예상치 못하게 종료되면 자동으로 재시작합니다.

사용법:
    python start_servers.py
"""

import subprocess
import sys
import time
import signal
import os
from pathlib import Path

class ServerManager:
    def __init__(self):
        self.backend_process = None
        self.frontend_process = None
        self.tunnel_process = None
        self.running = True
        
    def start_backend(self):
        """백엔드 서버 시작 (FastAPI)"""
        print("\n" + "="*60)
        print("[시작] 백엔드 서버를 시작합니다...")
        print("="*60)
        
        try:
            self.backend_process = subprocess.Popen(
                [sys.executable, "backend.py"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            # 서버 시작 확인 (최대 10초 대기)
            for i in range(10):
                if self.backend_process.poll() is not None:
                    print(f"[오류] 백엔드 서버가 시작 직후 종료되었습니다 (exit code: {self.backend_process.returncode})")
                    return False
                time.sleep(1)
                
            print(f"[OK] 백엔드 서버 실행 중 (PID: {self.backend_process.pid})")
            return True
            
        except Exception as e:
            print(f"[오류] 백엔드 시작 실패: {e}")
            return False
    
    def start_frontend(self):
        """프론트엔드 서버 시작 (HTTP Server)"""
        print("\n" + "="*60)
        print("[시작] 프론트엔드 서버를 시작합니다...")
        print("="*60)
        
        try:
            self.frontend_process = subprocess.Popen(
                [sys.executable, "-m", "http.server", "8080", "--bind", "127.0.0.1"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            
            time.sleep(2)  # 시작 대기
            
            if self.frontend_process.poll() is not None:
                print(f"[오류] 프론트엔드 서버가 시작 직후 종료되었습니다")
                return False
                
            print(f"[OK] 프론트엔드 서버 실행 중 (PID: {self.frontend_process.pid})")
            print(f"[접속] http://localhost:8080")
            return True
            
        except Exception as e:
            print(f"[오류] 프론트엔드 시작 실패: {e}")
            return False

    def start_tunnel(self):
        """Cloudflare Tunnel 시작"""
        print("\n" + "="*60)
        print("[시작] Cloudflare Tunnel을 시작합니다...")
        print("="*60)
        
        try:
            # cloudflared 명령어 확인
            try:
                subprocess.run(["cloudflared", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            except (subprocess.CalledProcessError, FileNotFoundError):
                print("[경고] 'cloudflared' 명령어를 찾을 수 없습니다. 터널을 시작하지 않습니다.")
                return False

            config_path = str(Path("config.yml").resolve())
            self.tunnel_process = subprocess.Popen(
                ["cloudflared", "tunnel", "--config", config_path, "run"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            
            time.sleep(3)  # 시작 대기
            
            if self.tunnel_process.poll() is not None:
                print(f"[오류] Cloudflare Tunnel이 시작 직후 종료되었습니다")
                return False
                
            print(f"[OK] Cloudflare Tunnel 실행 중 (PID: {self.tunnel_process.pid})")
            print(f"[도메인] https://alo.hyehwa72.org -> http://localhost:8080")
            return True
            
        except Exception as e:
            print(f"[오류] Cloudflare Tunnel 시작 실패: {e}")
            return False
    
    def monitor_servers(self):
        """서버 상태 모니터링 및 자동 재시작"""
        print("\n" + "="*60)
        print("[모니터링] 서버 및 터널 상태를 모니터링합니다...")
        print("[종료] Ctrl+C를 눌러 모든 프로세스를 종료할 수 있습니다.")
        print("="*60 + "\n")
        
        restart_count = 0
        max_restarts = 5
        
        while self.running:
            try:
                # 백엔드 상태 확인
                if self.backend_process and self.backend_process.poll() is not None:
                    print(f"\n[경고] 백엔드 서버가 종료되었습니다 (exit code: {self.backend_process.returncode})")
                    if restart_count < max_restarts:
                        restart_count += 1
                        print(f"[재시작] 백엔드 서버를 재시작합니다... ({restart_count}/{max_restarts})")
                        time.sleep(2)
                        if not self.start_backend():
                            print("[오류] 백엔드 재시작 실패")
                    else:
                        print(f"[중단] 백엔드 재시작 한도 초과")
                
                # 프론트엔드 상태 확인
                if self.frontend_process and self.frontend_process.poll() is not None:
                    print(f"\n[경고] 프론트엔드 서버가 종료되었습니다")
                    if restart_count < max_restarts:
                        restart_count += 1
                        print(f"[재시작] 프론트엔드 서버를 재시작합니다... ({restart_count}/{max_restarts})")
                        time.sleep(1)
                        if not self.start_frontend():
                            print("[오류] 프론트엔드 재시작 실패")
                    else:
                        print(f"[중단] 프론트엔드 재시작 한도 초과")

                # 터널 상태 확인
                if self.tunnel_process and self.tunnel_process.poll() is not None:
                    print(f"\n[경고] Cloudflare Tunnel이 종료되었습니다")
                    if restart_count < max_restarts:
                        restart_count += 1
                        print(f"[재시작] Cloudflare Tunnel을 재시작합니다... ({restart_count}/{max_restarts})")
                        time.sleep(3)
                        self.start_tunnel()
                    else:
                        print(f"[중단] 터널 재시작 한도 초과")
                
                # 5초마다 체크
                time.sleep(5)
                
            except KeyboardInterrupt:
                print("\n[종료] 사용자가 중단했습니다.")
                break
    
    def stop_servers(self):
        """모든 서버 종료"""
        print("\n" + "="*60)
        print("[종료] 서버를 종료합니다...")
        print("="*60)
        
        self.running = False
        
        processes = [
            ("백엔드", self.backend_process),
            ("프론트엔드", self.frontend_process),
            ("터널", self.tunnel_process)
        ]

        for name, proc in processes:
            if proc:
                try:
                    proc.terminate()
                    proc.wait(timeout=3)
                    print(f"[OK] {name} 종료됨")
                except:
                    proc.kill()
                    print(f"[강제] {name} 강제 종료됨")
    
    def validate_config(self):
        """config.yml 파일이 포트 8080(프론트엔드)을 가리키는지 확인하고 자동 수정"""
        config_path = "config.yml"
        if not os.path.exists(config_path):
            print(f"[경고] {config_path} 파일이 없습니다.")
            return

        try:
            with open(config_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # 8000번 포트로 잘못 설정되어 있다면수정
            if "service: http://localhost:8000" in content:
                print("[자동 수정] config.yml의 포트 설정이 8000으로 되어 있어 8080(프론트엔드)으로 변경합니다.")
                new_content = content.replace("service: http://localhost:8000", "service: http://localhost:8080")
                with open(config_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print("[완료] config.yml 업데이트 완료")
        except Exception as e:
            print(f"[오류] config.yml 검증 실패: {e}")

    def run(self):
        """서버 관리 시작"""
        print("\n" + "="*60)
        print("     RealHunalo Studio - 통합 서버 관리자")
        print("="*60)
        
        # 설정 파일 검증 및 자동 수정
        self.validate_config()
        
        # 시그널 핸들러 등록
        def signal_handler(signum, frame):
            self.stop_servers()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        try:
            # 순차적 시작
            if not self.start_backend():
                print("\n[오류] 백엔드 서버 시작 실패. 중단합니다.")
                return
            
            if not self.start_frontend():
                print("\n[오류] 프론트엔드 서버 시작 실패. 중단합니다.")
                self.stop_servers()
                return

            if not self.start_tunnel():
                print("\n[주의] Cloudflare Tunnel 시작 실패. 로컬에서만 접속 가능합니다.")
            
            # 모니터링 시작
            self.monitor_servers()
            
        finally:
            self.stop_servers()

if __name__ == "__main__":
    manager = ServerManager()
    manager.run()
