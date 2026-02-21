"""
비동기 처리 서비스 - asyncio 기반 병렬 처리 및 성능 최적화
"""

import asyncio
import concurrent.futures
from typing import Any, Callable, List, Dict, Optional, TypeVar, Awaitable
from functools import wraps, partial
import time
import logging

T = TypeVar('T')
R = TypeVar('R')

logger = logging.getLogger(__name__)


class AsyncService:
    """
    비동기 처리 서비스
    
    특징:
    - CPU 바운드 작업을 위한 ThreadPoolExecutor 통합
    - I/O 바운드 작업을 위한 asyncio 최적화
    - 병렬 배치 처리 지원
    - 타임아웃 및 재시도 메커니즘
    """
    
    def __init__(self, max_workers: int = None):
        """
        Args:
            max_workers: 스레드 풀 최대 작업자 수 (기본: CPU 코어 수 * 2)
        """
        import os
        self.max_workers = max_workers or (os.cpu_count() or 4) * 2
        self.thread_pool = concurrent.futures.ThreadPoolExecutor(
            max_workers=self.max_workers,
            thread_name_prefix="async_worker"
        )
        
        print(f"[OK] Async Service 초기화 (max_workers={self.max_workers})")
    
    async def run_in_thread(self, func: Callable[..., T], *args, **kwargs) -> T:
        """
        블로킹 함수를 스레드 풀에서 비동기적으로 실행
        
        Args:
            func: 실행할 블로킹 함수
            *args: 함수 인자
            **kwargs: 함수 키워드 인자
            
        Returns:
            함수 실행 결과
        """
        loop = asyncio.get_event_loop()
        func_partial = partial(func, *args, **kwargs)
        
        try:
            result = await loop.run_in_executor(self.thread_pool, func_partial)
            return result
        except Exception as e:
            logger.error(f"스레드 실행 실패: {e}")
            raise
    
    async def parallel_map(self, func: Callable[..., Awaitable[R]], 
                          items: List[Any], 
                          max_concurrent: Optional[int] = None) -> List[R]:
        """
        비동기 함수를 여러 항목에 대해 병렬로 실행
        
        Args:
            func: 비동기 함수
            items: 처리할 항목 목록
            max_concurrent: 최대 동시 실행 수 (None이면 제한 없음)
            
        Returns:
            처리 결과 목록 (입력 순서 유지)
        """
        if not items:
            return []
        
        # 세마포어를 사용한 동시성 제어
        if max_concurrent:
            semaphore = asyncio.Semaphore(max_concurrent)
            
            async def limited_func(item):
                async with semaphore:
                    return await func(item)
            
            target_func = limited_func
        else:
            target_func = func
        
        # 모든 작업 시작
        tasks = [target_func(item) for item in items]
        
        # 결과 수집 (asyncio.gather 사용)
        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 예외 처리
            final_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"항목 {i} 처리 중 오류: {result}")
                    final_results.append(None)
                else:
                    final_results.append(result)
            
            return final_results
            
        except Exception as e:
            logger.error(f"병렬 맵 실행 중 오류: {e}")
            raise
    
    async def with_timeout(self, coro: Awaitable[T], 
                          timeout: float, 
                          default: Any = None) -> T:
        """
        타임아웃이 있는 비동기 작업 실행
        
        Args:
            coro: 비동기 코루틴
            timeout: 타임아웃(초)
            default: 타임아웃 시 반환할 기본값
            
        Returns:
            실행 결과 또는 default
        """
        try:
            return await asyncio.wait_for(coro, timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning(f"작업 타임아웃 ({timeout}초)")
            return default
        except Exception as e:
            logger.error(f"작업 실행 중 오류: {e}")
            raise
    
    def sync_to_async(self, func: Callable[..., T]):
        """
        동기 함수를 비동기 함수로 변환하는 데코레이터
        
        사용 예:
            @async_service.sync_to_async
            def blocking_function():
                # 블로킹 작업
                return result
        """
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            return await self.run_in_thread(func, *args, **kwargs)
        
        return async_wrapper
    
    async def retry_with_backoff(self, coro_func: Callable[[], Awaitable[T]],
                                max_retries: int = 3,
                                initial_delay: float = 1.0,
                                max_delay: float = 10.0,
                                backoff_factor: float = 2.0) -> T:
        """
        지수 백오프 재시도 메커니즘
        
        Args:
            coro_func: 재시도할 코루틴 함수 (매번 새로 호출)
            max_retries: 최대 재시도 횟수
            initial_delay: 초기 지연 시간(초)
            max_delay: 최대 지연 시간(초)
            backoff_factor: 백오프 계수
            
        Returns:
            성공적인 실행 결과
        """
        delay = initial_delay
        
        for attempt in range(max_retries + 1):
            try:
                return await coro_func()
            except Exception as e:
                if attempt == max_retries:
                    logger.error(f"최대 재시도 횟수 초과: {e}")
                    raise
                
                logger.warning(f"시도 {attempt + 1} 실패: {e}. {delay}초 후 재시도...")
                await asyncio.sleep(delay)
                
                # 지연 시간 증가 (최대값 제한)
                delay = min(delay * backoff_factor, max_delay)
        
        # 이 줄은 도달하지 않아야 함
        raise RuntimeError("재시도 로직 오류")
    
    async def batch_process(self, processor: Callable[[List[Any]], Awaitable[List[R]]],
                           items: List[Any],
                           batch_size: int = 10) -> List[R]:
        """
        대량 항목을 배치로 처리
        
        Args:
            processor: 배치 처리 함수 (리스트를 받아 리스트 반환)
            items: 처리할 항목 목록
            batch_size: 배치 크기
            
        Returns:
            모든 항목의 처리 결과
        """
        if not items:
            return []
        
        results = []
        total_batches = (len(items) + batch_size - 1) // batch_size
        
        for batch_idx in range(total_batches):
            start_idx = batch_idx * batch_size
            end_idx = min(start_idx + batch_size, len(items))
            batch = items[start_idx:end_idx]
            
            logger.info(f"배치 {batch_idx + 1}/{total_batches} 처리 중 ({len(batch)}개 항목)")
            
            try:
                batch_results = await processor(batch)
                results.extend(batch_results)
            except Exception as e:
                logger.error(f"배치 {batch_idx + 1} 처리 실패: {e}")
                # 실패한 배치에 대해 None 채우기
                results.extend([None] * len(batch))
        
        return results
    
    async def measure_performance(self, coro: Awaitable[T], 
                                task_name: str = "task") -> Dict[str, Any]:
        """
        비동기 작업 성능 측정
        
        Args:
            coro: 측정할 코루틴
            task_name: 작업 이름
            
        Returns:
            성능 측정 결과 딕셔너리
        """
        start_time = time.time()
        start_cpu = time.process_time()
        
        try:
            result = await coro
            
            end_time = time.time()
            end_cpu = time.process_time()
            
            wall_time = end_time - start_time
            cpu_time = end_cpu - start_cpu
            
            return {
                "success": True,
                "task_name": task_name,
                "result": result,
                "wall_time_seconds": wall_time,
                "cpu_time_seconds": cpu_time,
                "efficiency_percent": (cpu_time / wall_time * 100) if wall_time > 0 else 0,
                "start_time": start_time,
                "end_time": end_time
            }
        except Exception as e:
            end_time = time.time()
            return {
                "success": False,
                "task_name": task_name,
                "error": str(e),
                "wall_time_seconds": end_time - start_time,
                "start_time": start_time,
                "end_time": end_time
            }
    
    async def shutdown(self):
        """서비스 종료 (리소스 정리)"""
        self.thread_pool.shutdown(wait=True)
        print("[OK] Async Service 종료 완료")


# 전역 비동기 서비스 인스턴스
async_service = AsyncService()


# 유틸리티 데코레이터
def async_retry(max_retries: int = 3, delay: float = 1.0):
    """
    비동기 함수 재시도 데코레이터
    
    사용 예:
        @async_retry(max_retries=3, delay=2.0)
        async def unreliable_api_call():
            # 불안정한 API 호출
            return result
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise
                    logger.warning(f"{func.__name__} 시도 {attempt + 1} 실패: {e}. {delay}초 후 재시도...")
                    await asyncio.sleep(delay)
            return None  # 이 줄은 도달하지 않아야 함
        return wrapper
    return decorator


def async_timeout(timeout_seconds: float):
    """
    비동기 함수 타임아웃 데코레이터
    
    사용 예:
        @async_timeout(10.0)
        async def slow_operation():
            # 느린 작업
            return result
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await asyncio.wait_for(
                func(*args, **kwargs),
                timeout=timeout_seconds
            )
        return wrapper
    return decorator