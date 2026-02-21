"""
Redis 캐싱 서비스 확장
인메모리 캐시와 Redis 간 전환 가능한 하이브리드 캐시 시스템
"""

import time
import hashlib
import json
from typing import Any, Optional, Dict, Union
from dataclasses import dataclass
import pickle
try:
    import redis
except ImportError:
    redis = None
from .cache_service import CacheService, CacheEntry


class HybridCacheService:
    """
    하이브리드 캐시 서비스 (인메모리 + Redis)
    
    특징:
    - 인메모리 캐시 (빠른 액세스)
    - Redis 캐시 (분산, 영구적)
    - 자동 페일오버 (Redis 실패 시 인메모리 사용)
    - 통합된 인터페이스
    """
    
    def __init__(self, 
                 redis_host: str = "localhost",
                 redis_port: int = 6379,
                 redis_password: Optional[str] = None,
                 redis_db: int = 0,
                 use_redis: bool = True,
                 max_memory_size: int = 1000,
                 default_ttl: int = 3600):
        """
        Args:
            redis_host: Redis 호스트
            redis_port: Redis 포트
            redis_password: Redis 비밀번호
            redis_db: Redis 데이터베이스
            use_redis: Redis 사용 여부
            max_memory_size: 인메모리 최대 크기
            default_ttl: 기본 TTL(초)
        """
        # 인메모리 캐시
        self.memory_cache = CacheService(
            max_size=max_memory_size,
            default_ttl=default_ttl
        )
        
        # Redis 설정
        self.use_redis = use_redis
        self.redis_available = False
        self.redis_client = None
        
        if use_redis:
            try:
                self.redis_client = redis.Redis(
                    host=redis_host,
                    port=redis_port,
                    password=redis_password,
                    db=redis_db,
                    decode_responses=False,  # 바이트로 유지
                    socket_connect_timeout=3,
                    socket_timeout=3
                )
                
                # 연결 테스트
                self.redis_client.ping()
                self.redis_available = True
                print(f"[OK] Redis 캐시 서비스 연결 성공: {redis_host}:{redis_port}")
                
            except Exception as e:
                print(f"[WARN] Redis 연결 실패, 인메모리 캐시만 사용: {e}")
                self.redis_available = False
                self.redis_client = None
        else:
            print("[INFO] Redis 캐시 비활성화, 인메모리 캐시만 사용")
    
    def _serialize_value(self, value: Any) -> bytes:
        """값을 직렬화 (Redis 저장용)"""
        try:
            return pickle.dumps(value)
        except Exception as e:
            print(f"[WARN] 직렬화 실패, JSON 시도: {e}")
            try:
                return json.dumps(value).encode('utf-8')
            except Exception as e2:
                print(f"[ERROR] JSON 직렬화 실패: {e2}")
                raise
    
    def _deserialize_value(self, data: bytes) -> Any:
        """값을 역직렬화"""
        try:
            return pickle.loads(data)
        except Exception as e:
            print(f"[WARN] 역직렬화 실패, JSON 시도: {e}")
            try:
                return json.loads(data.decode('utf-8'))
            except Exception as e2:
                print(f"[ERROR] JSON 역직렬화 실패: {e2}")
                return None
    
    def get(self, key: str, default: Any = None, use_memory_first: bool = True) -> Any:
        """
        캐시에서 값 조회 (하이브리드)
        
        Args:
            key: 캐시 키
            default: 기본값
            use_memory_first: 메모리 캐시 먼저 조회할지 여부
            
        Returns:
            캐시된 값 또는 default
        """
        # 1. 메모리 캐시 조회
        if use_memory_first:
            memory_value = self.memory_cache.get(key)
            if memory_value is not None:
                return memory_value
        
        # 2. Redis 캐시 조회 (활성화된 경우)
        if self.redis_available and self.redis_client:
            try:
                redis_data = self.redis_client.get(f"cache:{key}")
                if redis_data is not None:
                    value = self._deserialize_value(redis_data)
                    # 메모리 캐시에도 저장 (다음번 빠른 접근)
                    self.memory_cache.set(key, value)
                    return value
            except Exception as e:
                print(f"[WARN] Redis 조회 실패: {e}")
        
        # 3. 모두 실패 시 기본값 반환
        return default
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        캐시에 값 저장 (하이브리드)
        
        Args:
            key: 캐시 키
            value: 저장할 값
            ttl: 캐시 유효시간(초)
            
        Returns:
            성공 여부
        """
        success = True
        
        # 1. 메모리 캐시 저장
        memory_success = self.memory_cache.set(key, value, ttl)
        if not memory_success:
            success = False
        
        # 2. Redis 캐시 저장 (활성화된 경우)
        if self.redis_available and self.redis_client:
            try:
                redis_key = f"cache:{key}"
                redis_value = self._serialize_value(value)
                
                if ttl:
                    self.redis_client.setex(redis_key, ttl, redis_value)
                else:
                    self.redis_client.set(redis_key, redis_value)
                    
            except Exception as e:
                print(f"[WARN] Redis 저장 실패: {e}")
                success = False
        
        return success
    
    def delete(self, key: str) -> bool:
        """캐시 항목 삭제 (하이브리드)"""
        success = True
        
        # 1. 메모리 캐시 삭제
        memory_success = self.memory_cache.delete(key)
        
        # 2. Redis 캐시 삭제 (활성화된 경우)
        if self.redis_available and self.redis_client:
            try:
                redis_key = f"cache:{key}"
                redis_deleted = self.redis_client.delete(redis_key)
                if redis_deleted == 0:
                    success = False
            except Exception as e:
                print(f"[WARN] Redis 삭제 실패: {e}")
                success = False
        
        return memory_success and success
    
    def clear(self, clear_redis: bool = True) -> Dict[str, int]:
        """모든 캐시 삭제"""
        result = {"memory_cleared": 0, "redis_cleared": 0}
        
        # 1. 메모리 캐시 삭제
        result["memory_cleared"] = self.memory_cache.clear()
        
        # 2. Redis 캐시 삭제 (활성화된 경우)
        if clear_redis and self.redis_available and self.redis_client:
            try:
                # Redis 캐시 키만 삭제 (prefix로 필터링)
                cache_keys = self.redis_client.keys("cache:*")
                if cache_keys:
                    deleted = self.redis_client.delete(*cache_keys)
                    result["redis_cleared"] = deleted
            except Exception as e:
                print(f"[WARN] Redis 전체 삭제 실패: {e}")
        
        return result
    
    def get_stats(self) -> Dict[str, Any]:
        """하이브리드 캐시 통계 조회"""
        memory_stats = self.memory_cache.get_stats()
        
        redis_stats = {
            "available": self.redis_available,
            "used": False,
            "key_count": 0,
            "memory_used": 0
        }
        
        if self.redis_available and self.redis_client:
            try:
                # Redis 정보 수집
                cache_keys = self.redis_client.keys("cache:*")
                redis_stats["key_count"] = len(cache_keys)
                redis_stats["used"] = True
                
                # Redis 메모리 정보 (가능한 경우)
                try:
                    info = self.redis_client.info('memory')
                    redis_stats["memory_used"] = info.get('used_memory', 0)
                except:
                    pass
                    
            except Exception as e:
                print(f"[WARN] Redis 통계 수집 실패: {e}")
        
        return {
            "memory_cache": memory_stats,
            "redis_cache": redis_stats,
            "hybrid_enabled": self.use_redis,
            "total_entries": memory_stats["total_entries"] + redis_stats["key_count"]
        }
    
    def prefetch_to_memory(self, key_pattern: str = "cache:*", limit: int = 100):
        """
        Redis 캐시를 메모리 캐시로 프리페치
        
        Args:
            key_pattern: 프리페치할 키 패턴
            limit: 최대 프리페치 수
        """
        if not self.redis_available or not self.redis_client:
            return
        
        try:
            keys = self.redis_client.keys(key_pattern)[:limit]
            
            for redis_key in keys:
                try:
                    # 키에서 prefix 제거
                    if redis_key.startswith(b"cache:"):
                        memory_key = redis_key[6:].decode('utf-8')
                        
                        # Redis에서 값 가져오기
                        redis_data = self.redis_client.get(redis_key)
                        if redis_data:
                            value = self._deserialize_value(redis_data)
                            
                            # 메모리 캐시에 저장
                            self.memory_cache.set(memory_key, value)
                            
                except Exception as e:
                    print(f"[WARN] 키 {redis_key} 프리페치 실패: {e}")
            
            print(f"[OK] {len(keys)}개 항목 메모리로 프리페치 완료")
            
        except Exception as e:
            print(f"[ERROR] 프리페치 실패: {e}")
    
    def sync_to_redis(self, key_pattern: str = None):
        """
        메모리 캐시를 Redis에 동기화
        
        Args:
            key_pattern: 동기화할 키 패턴 (None이면 전체)
        """
        if not self.redis_available or not self.redis_client:
            return
        
        # NOTE: 메모리 캐시 내부 접근이 필요하지만, 간단한 구현을 위해
        # 현재는 메모리 캐시의 모든 항목에 접근할 수 있는 방법이 없음
        # 향후 확장을 위한 인터페이스만 제공
        print("[INFO] Redis 동기화는 향후 구현 예정")
    
    def health_check(self) -> Dict[str, Any]:
        """캐시 서비스 상태 체크"""
        memory_health = {
            "status": "healthy",
            "size": len(self.memory_cache._cache)
        }
        
        redis_health = {
            "available": self.redis_available,
            "status": "unknown",
            "latency_ms": 0
        }
        
        if self.redis_available and self.redis_client:
            try:
                start_time = time.time()
                self.redis_client.ping()
                latency = (time.time() - start_time) * 1000
                
                redis_health["status"] = "healthy"
                redis_health["latency_ms"] = round(latency, 2)
                
            except Exception as e:
                redis_health["status"] = f"unhealthy: {e}"
        
        return {
            "memory_cache": memory_health,
            "redis_cache": redis_health,
            "overall": "healthy" if memory_health["status"] == "healthy" else "degraded",
            "timestamp": time.time()
        }


# 전역 하이브리드 캐시 서비스 인스턴스 (기본은 인메모리만)
hybrid_cache_service = HybridCacheService(
    use_redis=False,  # 기본적으로 Redis 비활성화
    max_memory_size=500,
    default_ttl=1800
)