"""
메모리 사용량 모니터링 서비스
실시간 메모리 사용량 추적 및 경고 시스템
"""

import time
import threading
import psutil
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass
from datetime import datetime
import json


@dataclass
class MemorySnapshot:
    """메모리 스냅샷 데이터 클래스"""
    timestamp: float
    memory_percent: float
    memory_mb: float
    process_memory_mb: float
    available_memory_mb: float
    total_memory_mb: float
    swap_percent: float
    process_count: int
    thread_count: int
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "timestamp": self.timestamp,
            "timestamp_iso": datetime.fromtimestamp(self.timestamp).isoformat(),
            "memory_percent": round(self.memory_percent, 2),
            "memory_mb": round(self.memory_mb, 2),
            "process_memory_mb": round(self.process_memory_mb, 2),
            "available_memory_mb": round(self.available_memory_mb, 2),
            "total_memory_mb": round(self.total_memory_mb, 2),
            "swap_percent": round(self.swap_percent, 2),
            "process_count": self.process_count,
            "thread_count": self.thread_count
        }


class MemoryMonitorService:
    """
    메모리 사용량 모니터링 서비스
    
    특징:
    - 주기적인 메모리 스냅샷 수집
    - 메모리 누수 감지
    - 임계값 경고 시스템
    - 히스토리 데이터 저장
    - 실시간 모니터링 API
    """
    
    def __init__(self, 
                 interval_seconds: float = 5.0,
                 warning_threshold_percent: float = 80.0,
                 critical_threshold_percent: float = 90.0,
                 history_limit: int = 1000):
        """
        Args:
            interval_seconds: 모니터링 간격(초)
            warning_threshold_percent: 경고 임계값 (%)
            critical_threshold_percent: 위험 임계값 (%)
            history_limit: 히스토리 최대 저장 개수
        """
        self.interval = interval_seconds
        self.warning_threshold = warning_threshold_percent
        self.critical_threshold = critical_threshold_percent
        self.history_limit = history_limit
        
        # 데이터 저장소
        self.history: List[MemorySnapshot] = []
        self.alerts: List[Dict[str, Any]] = []
        self.is_monitoring = False
        self.monitor_thread = None
        
        # 통계
        self.start_time = time.time()
        self.total_snapshots = 0
        self.warning_count = 0
        self.critical_count = 0
        
        # 콜백 함수
        self.warning_callback: Optional[Callable] = None
        self.critical_callback: Optional[Callable] = None
        
        print(f"[OK] Memory Monitor Service 초기화 (interval={interval_seconds}s)")
    
    def take_snapshot(self) -> MemorySnapshot:
        """현재 메모리 상태 스냅샷 생성"""
        # 시스템 전체 메모리 정보
        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()
        
        # 현재 프로세스 메모리 정보
        process = psutil.Process()
        process_memory = process.memory_info()
        
        # 스냅샷 생성
        snapshot = MemorySnapshot(
            timestamp=time.time(),
            memory_percent=mem.percent,
            memory_mb=mem.used / 1024 / 1024,
            process_memory_mb=process_memory.rss / 1024 / 1024,
            available_memory_mb=mem.available / 1024 / 1024,
            total_memory_mb=mem.total / 1024 / 1024,
            swap_percent=swap.percent,
            process_count=len(psutil.pids()),
            thread_count=process.num_threads()
        )
        
        return snapshot
    
    def _monitoring_loop(self):
        """모니터링 루프 (별도 스레드에서 실행)"""
        print(f"[MEMORY] 모니터링 시작 (간격: {self.interval}초)")
        
        while self.is_monitoring:
            try:
                snapshot = self.take_snapshot()
                self._process_snapshot(snapshot)
                
                # 히스토리 관리
                self.history.append(snapshot)
                self.total_snapshots += 1
                
                # 히스토리 제한
                if len(self.history) > self.history_limit:
                    self.history = self.history[-self.history_limit:]
                
            except Exception as e:
                print(f"[MEMORY ERROR] 스냅샷 생성 실패: {e}")
            
            # 간격 대기
            time.sleep(self.interval)
    
    def _process_snapshot(self, snapshot: MemorySnapshot):
        """스냅샷 처리 및 경고 체크"""
        # 위험 임계값 체크
        if snapshot.memory_percent >= self.critical_threshold:
            self._add_alert("CRITICAL", snapshot, 
                          f"메모리 사용량 위험: {snapshot.memory_percent}%")
            self.critical_count += 1
            
            if self.critical_callback:
                self.critical_callback(snapshot)
        
        # 경고 임계값 체크
        elif snapshot.memory_percent >= self.warning_threshold:
            self._add_alert("WARNING", snapshot,
                          f"메모리 사용량 경고: {snapshot.memory_percent}%")
            self.warning_count += 1
            
            if self.warning_callback:
                self.warning_callback(snapshot)
    
    def _add_alert(self, level: str, snapshot: MemorySnapshot, message: str):
        """경고 추가"""
        alert = {
            "level": level,
            "timestamp": snapshot.timestamp,
            "timestamp_iso": datetime.fromtimestamp(snapshot.timestamp).isoformat(),
            "message": message,
            "snapshot": snapshot.to_dict()
        }
        
        self.alerts.append(alert)
        print(f"[MEMORY {level}] {message}")
        
        # 최근 100개 경고만 유지
        if len(self.alerts) > 100:
            self.alerts = self.alerts[-100:]
    
    def start_monitoring(self):
        """모니터링 시작"""
        if self.is_monitoring:
            print("[MEMORY] 이미 모니터링 중입니다.")
            return
        
        self.is_monitoring = True
        self.monitor_thread = threading.Thread(
            target=self._monitoring_loop,
            daemon=True,
            name="MemoryMonitor"
        )
        self.monitor_thread.start()
        
        print("[OK] 메모리 모니터링 시작됨")
    
    def stop_monitoring(self):
        """모니터링 중지"""
        self.is_monitoring = False
        
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5.0)
            self.monitor_thread = None
        
        print("[OK] 메모리 모니터링 중지됨")
    
    def get_current_status(self) -> Dict[str, Any]:
        """현재 메모리 상태 조회"""
        snapshot = self.take_snapshot()
        
        return {
            "monitoring": self.is_monitoring,
            "current": snapshot.to_dict(),
            "thresholds": {
                "warning": self.warning_threshold,
                "critical": self.critical_threshold
            },
            "stats": self.get_stats()
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """통계 정보 조회"""
        uptime = time.time() - self.start_time
        
        # 최근 10개 스냅샷의 평균 메모리 사용률
        recent_snapshots = self.history[-10:] if self.history else []
        avg_memory = 0.0
        if recent_snapshots:
            avg_memory = sum(s.memory_percent for s in recent_snapshots) / len(recent_snapshots)
        
        # 메모리 사용량 추세 (분당 증가율)
        trend = 0.0
        if len(self.history) >= 2:
            oldest = self.history[0]
            newest = self.history[-1]
            time_diff_minutes = (newest.timestamp - oldest.timestamp) / 60
            if time_diff_minutes > 0:
                trend = (newest.memory_percent - oldest.memory_percent) / time_diff_minutes
        
        return {
            "uptime_seconds": uptime,
            "total_snapshots": self.total_snapshots,
            "warning_count": self.warning_count,
            "critical_count": self.critical_count,
            "avg_memory_percent": round(avg_memory, 2),
            "memory_trend_per_minute": round(trend, 4),
            "history_size": len(self.history),
            "alert_count": len(self.alerts)
        }
    
    def get_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """히스토리 데이터 조회"""
        history_data = self.history[-limit:] if self.history else []
        return [snapshot.to_dict() for snapshot in history_data]
    
    def get_alerts(self, limit: int = 50) -> List[Dict[str, Any]]:
        """경고 목록 조회"""
        return self.alerts[-limit:] if self.alerts else []
    
    def clear_history(self):
        """히스토리 데이터 초기화"""
        self.history.clear()
        print("[MEMORY] 히스토리 데이터 초기화됨")
    
    def set_warning_callback(self, callback: Callable[[MemorySnapshot], None]):
        """경고 콜백 설정"""
        self.warning_callback = callback
    
    def set_critical_callback(self, callback: Callable[[MemorySnapshot], None]):
        """위험 콜백 설정"""
        self.critical_callback = callback
    
    def check_for_memory_leak(self, window_minutes: int = 30) -> Dict[str, Any]:
        """
        메모리 누수 감지
        
        Args:
            window_minutes: 분석 시간 창(분)
            
        Returns:
            누수 감지 결과
        """
        if len(self.history) < 10:
            return {
                "detected": False,
                "reason": "충분한 데이터가 없습니다.",
                "confidence": 0.0
            }
        
        # 지정된 시간 창 내 데이터 필터링
        cutoff_time = time.time() - (window_minutes * 60)
        window_data = [s for s in self.history if s.timestamp >= cutoff_time]
        
        if len(window_data) < 5:
            return {
                "detected": False,
                "reason": f"지난 {window_minutes}분 동안 충분한 데이터가 없습니다.",
                "confidence": 0.0
            }
        
        # 선형 회귀를 사용한 추세 분석 (단순화)
        times = [(s.timestamp - window_data[0].timestamp) / 60 for s in window_data]  # 분 단위
        memory_values = [s.memory_percent for s in window_data]
        
        # 기울기 계산 (간단한 방법)
        n = len(times)
        sum_x = sum(times)
        sum_y = sum(memory_values)
        sum_xy = sum(times[i] * memory_values[i] for i in range(n))
        sum_x2 = sum(t ** 2 for t in times)
        
        if n * sum_x2 - sum_x * sum_x == 0:
            slope = 0
        else:
            slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
        
        # 프로세스 메모리 증가율도 체크
        proc_memory_values = [s.process_memory_mb for s in window_data]
        proc_slope = 0
        if n * sum_x2 - sum_x * sum_x != 0:
            sum_proc_xy = sum(times[i] * proc_memory_values[i] for i in range(n))
            proc_slope = (n * sum_proc_xy - sum_x * sum(proc_memory_values)) / (n * sum_x2 - sum_x * sum_x)
        
        # 누수 판단 기준
        system_leak_detected = slope > 0.5  # 분당 0.5% 이상 증가
        process_leak_detected = proc_slope > 10.0  # 분당 10MB 이상 증가
        
        confidence = 0.0
        if system_leak_detected and process_leak_detected:
            confidence = 0.9
        elif system_leak_detected or process_leak_detected:
            confidence = 0.6
        
        return {
            "detected": system_leak_detected or process_leak_detected,
            "system_memory_slope_per_minute": round(slope, 3),
            "process_memory_slope_mb_per_minute": round(proc_slope, 3),
            "system_leak_detected": system_leak_detected,
            "process_leak_detected": process_leak_detected,
            "confidence": round(confidence, 2),
            "window_minutes": window_minutes,
            "data_points": len(window_data)
        }


# 전역 메모리 모니터링 서비스 인스턴스
memory_monitor_service = MemoryMonitorService(
    interval_seconds=10.0,  # 10초 간격
    warning_threshold_percent=75.0,
    critical_threshold_percent=85.0
)

# 애플리케이션 시작 시 자동 모니터링 시작
try:
    memory_monitor_service.start_monitoring()
    print("[OK] 메모리 모니터링 자동 시작됨")
except Exception as e:
    print(f"[WARN] 메모리 모니터링 시작 실패: {e}")