"""
최적화 서비스 API 라우터
캐싱, 메모리, 성능 모니터링 관련 엔드포인트 제공
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from typing import Dict, Any

from services.cache_service import cache_service
from services.cache_service_with_redis import hybrid_cache_service
from services.memory_monitor_service import memory_monitor_service
from services.async_service import async_service
from services.large_file_processing_service import large_file_processing_service

router = APIRouter(prefix="/api/optimization", tags=["optimization"])


@router.get("/cache/stats")
async def get_cache_stats():
    """
    캐시 서비스 통계 조회
    - 인메모리 캐시 통계
    - Redis 캐시 통계 (활성화된 경우)
    - 하이브리드 캐시 상태
    """
    try:
        # 기본 캐시 서비스 통계
        memory_stats = cache_service.get_stats()
        
        # 하이브리드 캐시 통계
        hybrid_stats = hybrid_cache_service.get_stats()
        
        return {
            "success": True,
            "memory_cache": memory_stats,
            "hybrid_cache": hybrid_stats,
            "cache_service": {
                "type": "in_memory",
                "max_size": cache_service.max_size,
                "default_ttl": cache_service.default_ttl
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"캐시 통계 조회 실패: {e}")


@router.post("/cache/clear")
async def clear_cache(clear_redis: bool = False):
    """
    캐시 데이터 삭제
    
    Args:
        clear_redis: Redis 캐시도 삭제할지 여부 (기본: False)
    """
    try:
        # 기본 캐시 삭제
        memory_cleared = cache_service.clear()
        
        # 하이브리드 캐시 삭제
        hybrid_result = hybrid_cache_service.clear(clear_redis=clear_redis)
        
        return {
            "success": True,
            "message": "캐시 삭제 완료",
            "results": {
                "memory_cache_cleared": memory_cleared,
                "hybrid_cache_cleared": hybrid_result
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"캐시 삭제 실패: {e}")


@router.get("/memory/status")
async def get_memory_status():
    """
    메모리 사용 현황 조회
    - 현재 메모리 사용량
    - 히스토리 데이터
    - 경고 상태
    """
    try:
        # 현재 상태
        current_status = memory_monitor_service.get_current_status()
        
        # 히스토리 데이터 (최근 10개)
        history = memory_monitor_service.get_history(limit=10)
        
        # 경고 상태
        alerts = memory_monitor_service.get_alerts()
        
        # 모니터링 상태
        monitoring = memory_monitor_service.is_monitoring()
        
        return {
            "success": True,
            "current": current_status,
            "history": history,
            "alerts": alerts,
            "monitoring": monitoring,
            "thresholds": {
                "warning_percent": memory_monitor_service.warning_threshold,
                "critical_percent": memory_monitor_service.critical_threshold,
                "check_interval": memory_monitor_service.check_interval
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"메모리 상태 조회 실패: {e}")


@router.post("/memory/monitoring/{action}")
async def control_memory_monitoring(action: str):
    """
    메모리 모니터링 제어
    
    Args:
        action: start, stop, restart 중 하나
    """
    try:
        if action == "start":
            if memory_monitor_service.is_monitoring():
                return {"success": True, "message": "이미 모니터링이 실행 중입니다."}
            
            memory_monitor_service.start_monitoring()
            return {"success": True, "message": "메모리 모니터링 시작됨"}
            
        elif action == "stop":
            if not memory_monitor_service.is_monitoring():
                return {"success": True, "message": "모니터링이 실행 중이지 않습니다."}
            
            memory_monitor_service.stop_monitoring()
            return {"success": True, "message": "메모리 모니터링 중지됨"}
            
        elif action == "restart":
            memory_monitor_service.stop_monitoring()
            memory_monitor_service.start_monitoring()
            return {"success": True, "message": "메모리 모니터링 재시작됨"}
            
        else:
            raise HTTPException(status_code=400, detail="지원하지 않는 액션입니다. (start, stop, restart 중 선택)")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"모니터링 제어 실패: {e}")


@router.get("/async/stats")
async def get_async_stats():
    """
    비동기 서비스 통계 조회
    - 작업 큐 상태
    - 스레드 풀 상태
    - 작업 완료/실패 통계
    """
    try:
        stats = async_service.get_stats()
        
        return {
            "success": True,
            "async_service": {
                "max_workers": async_service.max_workers,
                "thread_pool_size": async_service.thread_pool._max_workers,
                "queue_size": async_service.queue.qsize() if hasattr(async_service, 'queue') else 0
            },
            "statistics": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"비동기 통계 조회 실패: {e}")


@router.get("/large-file-processing/stats")
async def get_large_file_processing_stats():
    """
    대용량 파일 처리 서비스 통계
    - 처리 중인 작업
    - 완료된 작업
    - 에러 통계
    """
    try:
        status = large_file_processing_service.get_status()
        stats = large_file_processing_service.get_statistics()
        
        return {
            "success": True,
            "service_status": status,
            "statistics": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 처리 통계 조회 실패: {e}")


@router.get("/performance/summary")
async def get_performance_summary():
    """
    전체 성능 요약 조회
    - 모든 최적화 서비스 상태
    - 주요 지표
    - 시스템 건강 상태
    """
    try:
        # 각 서비스 상태 수집
        cache_stats_response = await get_cache_stats()
        memory_status_response = await get_memory_status()
        
        # 비동기 서비스 통계
        async_stats = {}
        try:
            async_stats_response = await get_async_stats()
            async_stats = async_stats_response
        except:
            async_stats = {"error": "비동기 서비스 통계 조회 실패"}
        
        # 파일 처리 서비스 통계
        file_processing_stats = {}
        try:
            file_stats_response = await get_large_file_processing_stats()
            file_processing_stats = file_stats_response
        except:
            file_processing_stats = {"error": "파일 처리 서비스 통계 조회 실패"}
        
        # 시스템 건강 상태 평가
        system_health = "healthy"
        warnings = []
        
        # 메모리 사용량 체크
        current_memory = memory_monitor_service.get_current_status().get('current', {}).get('memory_percent', 0)
        if current_memory > 90:
            system_health = "critical"
            warnings.append(f"메모리 사용량 높음: {current_memory}%")
        elif current_memory > 80:
            system_health = "warning"
            warnings.append(f"메모리 사용량 주의: {current_memory}%")
        
        # 캐시 히트율 체크
        cache_hit_rate = cache_service.get_stats().get('hit_rate_percent', 0)
        if cache_hit_rate < 50:
            system_health = "warning" if system_health == "healthy" else system_health
            warnings.append(f"캐시 히트율 낮음: {cache_hit_rate}%")
        
        return {
            "success": True,
            "system_health": system_health,
            "timestamp": memory_monitor_service.get_current_status().get('timestamp'),
            "warnings": warnings,
            "services": {
                "cache": cache_stats_response,
                "memory": memory_status_response,
                "async": async_stats,
                "file_processing": file_processing_stats
            },
            "key_metrics": {
                "memory_usage_percent": current_memory,
                "cache_hit_rate_percent": cache_hit_rate,
                "cache_entries": cache_service.get_stats().get('total_entries', 0),
                "memory_alerts": len(memory_monitor_service.get_alerts())
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"성능 요약 조회 실패: {e}")


@router.get("/health")
async def get_optimization_health():
    """
    최적화 서비스 전체 건강 상태 확인
    """
    try:
        results = {}
        
        # 캐시 서비스 건강 상태
        try:
            cache_stats = cache_service.get_stats()
            results["cache_service"] = {
                "status": "healthy",
                "entries": cache_stats.get('total_entries', 0),
                "hit_rate": cache_stats.get('hit_rate_percent', 0)
            }
        except Exception as e:
            results["cache_service"] = {
                "status": "unhealthy",
                "error": str(e)
            }
        
        # 메모리 모니터링 서비스 건강 상태
        try:
            memory_status = memory_monitor_service.get_current_status()
            results["memory_monitor"] = {
                "status": "healthy",
                "monitoring": memory_monitor_service.is_monitoring(),
                "current_memory": memory_status.get('current', {}).get('memory_percent', 0)
            }
        except Exception as e:
            results["memory_monitor"] = {
                "status": "unhealthy",
                "error": str(e)
            }
        
        # 비동기 서비스 건강 상태
        try:
            async_stats = async_service.get_stats()
            results["async_service"] = {
                "status": "healthy",
                "max_workers": async_service.max_workers
            }
        except Exception as e:
            results["async_service"] = {
                "status": "unhealthy",
                "error": str(e)
            }
        
        # 파일 처리 서비스 건강 상태
        try:
            file_status = large_file_processing_service.get_status()
            results["large_file_processing"] = {
                "status": "healthy",
                "max_concurrent": file_status.get('max_concurrent', 0)
            }
        except Exception as e:
            results["large_file_processing"] = {
                "status": "unhealthy",
                "error": str(e)
            }
        
        # 전체 상태 결정
        all_healthy = all(result["status"] == "healthy" for result in results.values())
        
        return {
            "success": True,
            "overall_status": "healthy" if all_healthy else "degraded",
            "timestamp": memory_monitor_service.get_current_status().get('timestamp'),
            "services": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"건강 상태 조회 실패: {e}")