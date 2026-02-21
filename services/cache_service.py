"""
캐싱 서비스 - 메모리 캐시 및 향후 Redis 확장 가능
"""

import time
import hashlib
import json
from typing import Any, Optional, Dict, Union
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class CacheEntry:
    """캐시 엔트리 데이터 클래스"""
    value: Any
    created_at: float
    expires_at: Optional[float] = None  # 만료 시간 (None이면 영구)
    access_count: int = 0
    last_accessed: float = None

    def __post_init__(self):
        if self.last_accessed is None:
            self.last_accessed = self.created_at

    def is_expired(self) -> bool:
        """캐시가 만료되었는지 확인"""
        if self.expires_at is None:
            return False
        return time.time() > self.expires_at

    def touch(self):
        """액세스 시간 업데이트"""
        self.access_count += 1
        self.last_accessed = time.time()

    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "value": self.value,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "access_count": self.access_count,
            "last_accessed": self.last_accessed,
            "ttl": self.expires_at - time.time() if self.expires_at else None,
            "age_seconds": time.time() - self.created_at
        }


class CacheService:
    """
    인메모리 캐시 서비스 (향후 Redis로 확장 가능)
    
    특징:
    - TTL(Time-To-Live) 지원
    - LRU(Least Recently Used) 기반 자동 정리
    - 통계 및 모니터링
    - 키 기반 캐시 무효화
    """
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 3600):
        """
        Args:
            max_size: 최대 캐시 항목 수 (메모리 제한)
            default_ttl: 기본 캐시 유효시간(초)
        """
        self._cache: Dict[str, CacheEntry] = {}
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.hits = 0
        self.misses = 0
        self.evictions = 0
        
        print(f"[OK] Cache Service 초기화 (max_size={max_size}, default_ttl={default_ttl}s)")
    
    def _make_key(self, *args, **kwargs) -> str:
        """
        인자를 기반으로 캐시 키 생성
        
        Args:
            *args: 위치 인자
            **kwargs: 키워드 인자
            
        Returns:
            MD5 해시 기반 캐시 키
        """
        key_parts = []
        
        # 위치 인자 처리
        for arg in args:
            if isinstance(arg, (str, int, float, bool, type(None))):
                key_parts.append(str(arg))
            else:
                # 복잡한 객체는 JSON 문자열로 변환
                try:
                    key_parts.append(json.dumps(arg, sort_keys=True))
                except:
                    key_parts.append(repr(arg))
        
        # 키워드 인자 처리
        if kwargs:
            sorted_kwargs = sorted(kwargs.items())
            for key, value in sorted_kwargs:
                if isinstance(value, (str, int, float, bool, type(None))):
                    key_parts.append(f"{key}:{value}")
                else:
                    try:
                        key_parts.append(f"{key}:{json.dumps(value, sort_keys=True)}")
                    except:
                        key_parts.append(f"{key}:{repr(value)}")
        
        # MD5 해시 생성
        key_string = "|".join(key_parts)
        return f"cache:{hashlib.md5(key_string.encode()).hexdigest()}"
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        캐시에서 값 조회
        
        Args:
            key: 캐시 키
            default: 키가 없을 때 반환할 기본값
            
        Returns:
            캐시된 값 또는 default
        """
        if key in self._cache:
            entry = self._cache[key]
            
            # 만료 체크
            if entry.is_expired():
                del self._cache[key]
                self.misses += 1
                return default
            
            # 액세스 기록
            entry.touch()
            self.hits += 1
            return entry.value
        else:
            self.misses += 1
            return default
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        캐시에 값 저장
        
        Args:
            key: 캐시 키
            value: 저장할 값
            ttl: 캐시 유효시간(초), None이면 default_ttl 사용
            
        Returns:
            성공 여부
        """
        try:
            # LRU 정리 (용량 초과 시)
            if len(self._cache) >= self.max_size:
                self._evict_oldest()
            
            # 만료 시간 계산
            expires_at = None
            if ttl is not None:
                expires_at = time.time() + ttl
            elif self.default_ttl is not None:
                expires_at = time.time() + self.default_ttl
            
            # 캐시 엔트리 생성
            entry = CacheEntry(
                value=value,
                created_at=time.time(),
                expires_at=expires_at
            )
            
            self._cache[key] = entry
            return True
            
        except Exception as e:
            print(f"[WARN] 캐시 저장 실패: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """캐시 항목 삭제"""
        if key in self._cache:
            del self._cache[key]
            return True
        return False
    
    def clear(self) -> int:
        """모든 캐시 삭제 (삭제된 항목 수 반환)"""
        count = len(self._cache)
        self._cache.clear()
        return count
    
    def clear_expired(self) -> int:
        """만료된 항목만 삭제 (삭제된 항목 수 반환)"""
        expired_keys = []
        for key, entry in self._cache.items():
            if entry.is_expired():
                expired_keys.append(key)
        
        for key in expired_keys:
            del self._cache[key]
        
        return len(expired_keys)
    
    def _evict_oldest(self):
        """가장 오래전에 접근된 항목 제거 (LRU)"""
        if not self._cache:
            return
        
        # 가장 오래된 액세스 시간 찾기
        oldest_key = None
        oldest_time = float('inf')
        
        for key, entry in self._cache.items():
            if entry.last_accessed < oldest_time:
                oldest_time = entry.last_accessed
                oldest_key = key
        
        if oldest_key:
            del self._cache[oldest_key]
            self.evictions += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """캐시 통계 조회"""
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0
        
        return {
            "total_entries": len(self._cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate_percent": round(hit_rate, 2),
            "evictions": self.evictions,
            "memory_usage_estimate_kb": len(str(self._cache)) // 1024,
            "oldest_entry_seconds": self._get_oldest_age(),
            "expired_count": self._count_expired()
        }
    
    def _get_oldest_age(self) -> float:
        """가장 오래된 캐시 항목의 나이(초)"""
        if not self._cache:
            return 0
        
        oldest = min(entry.created_at for entry in self._cache.values())
        return time.time() - oldest
    
    def _count_expired(self) -> int:
        """만료된 항목 수"""
        return sum(1 for entry in self._cache.values() if entry.is_expired())
    
    def cache_function(self, ttl: Optional[int] = None, prefix: str = "func"):
        """
        함수 결과 캐싱 데코레이터
        
        사용 예:
            @cache_service.cache_function(ttl=300)
            def expensive_function(param1, param2):
                # 비용이 많이 드는 계산
                return result
        """
        def decorator(func):
            def wrapper(*args, **kwargs):
                # 캐시 키 생성
                cache_key = self._make_key(prefix, func.__name__, *args, **kwargs)
                
                # 캐시에서 조회
                cached = self.get(cache_key)
                if cached is not None:
                    print(f"[CACHE] HIT for {func.__name__}")
                    return cached
                
                # 캐시 미스 - 함수 실행
                print(f"[CACHE] MISS for {func.__name__}, computing...")
                result = func(*args, **kwargs)
                
                # 결과 캐싱
                self.set(cache_key, result, ttl)
                
                return result
            
            return wrapper
        return decorator


# 전역 캐시 서비스 인스턴스
cache_service = CacheService(
    max_size=500,  # 최대 500개 항목
    default_ttl=1800  # 기본 30분 유지
)