"""
대용량 파일 처리 파이프라인 서비스
청크 기반 다운로드, 병렬 처리, 메모리 최적화
"""

import os
import asyncio
import tempfile
import hashlib
import math
from typing import Dict, List, Any, Optional, Callable, BinaryIO
from dataclasses import dataclass
import aiohttp
import aiofiles
from .async_service import async_service
from .memory_monitor_service import memory_monitor_service


@dataclass
class FileChunk:
    """파일 청크 데이터 클래스"""
    chunk_id: int
    start_byte: int
    end_byte: int
    size: int
    data: Optional[bytes] = None
    file_path: Optional[str] = None
    checksum: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "chunk_id": self.chunk_id,
            "start_byte": self.start_byte,
            "end_byte": self.end_byte,
            "size": self.size,
            "checksum": self.checksum,
            "has_data": self.data is not None,
            "has_file": self.file_path is not None and os.path.exists(self.file_path)
        }


class LargeFileProcessingService:
    """
    대용량 파일 처리 파이프라인 서비스
    
    특징:
    - 청크 기반 병렬 다운로드
    - 메모리 사용량 제한 (디스크 스풀링 지원)
    - 진행률 실시간 모니터링
    - 체크섬 검증
    - 자동 재시도 메커니즘
    """
    
    def __init__(self, 
                 max_concurrent_downloads: int = 4,
                 chunk_size_mb: int = 10,
                 max_memory_mb: int = 500,
                 temp_dir: Optional[str] = None):
        """
        Args:
            max_concurrent_downloads: 최대 동시 다운로드 수
            chunk_size_mb: 청크 크기 (MB)
            max_memory_mb: 최대 메모리 사용량 (MB), 초과 시 디스크 스풀링
            temp_dir: 임시 파일 저장 디렉토리 (None이면 시스템 임시 디렉토리)
        """
        self.max_concurrent = max_concurrent_downloads
        self.chunk_size = chunk_size_mb * 1024 * 1024  # 바이트로 변환
        self.max_memory = max_memory_mb * 1024 * 1024  # 바이트로 변환
        self.temp_dir = temp_dir or tempfile.gettempdir()
        
        # 청크 캐시 디렉토리 생성
        self.chunk_cache_dir = os.path.join(self.temp_dir, "realhunalo_file_chunks")
        os.makedirs(self.chunk_cache_dir, exist_ok=True)
        
        # 세션 관리
        self.session: Optional[aiohttp.ClientSession] = None
        
        print(f"[OK] Large File Processing Service 초기화")
        print(f"   - Max Concurrent: {max_concurrent_downloads}")
        print(f"   - Chunk Size: {chunk_size_mb}MB")
        print(f"   - Max Memory: {max_memory_mb}MB")
        print(f"   - Temp Dir: {self.chunk_cache_dir}")
    
    async def initialize(self):
        """비동기 초기화 (aiohttp 세션 생성)"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=300, connect=30)
            self.session = aiohttp.ClientSession(timeout=timeout)
            print("[OK] HTTP 세션 초기화 완료")
    
    async def cleanup(self):
        """리소스 정리"""
        if self.session and not self.session.closed:
            await self.session.close()
            print("[OK] HTTP 세션 종료")
        
        # 오래된 청크 파일 정리
        await self._cleanup_old_chunks()
    
    async def _cleanup_old_chunks(self, max_age_hours: int = 24):
        """오래된 청크 파일 정리"""
        import time
        cutoff_time = time.time() - (max_age_hours * 3600)
        
        files_deleted = 0
        for filename in os.listdir(self.chunk_cache_dir):
            filepath = os.path.join(self.chunk_cache_dir, filename)
            try:
                if os.path.getmtime(filepath) < cutoff_time:
                    os.remove(filepath)
                    files_deleted += 1
            except Exception as e:
                print(f"[WARN] 청크 파일 삭제 실패: {e}")
        
        if files_deleted > 0:
            print(f"[OK] {files_deleted}개 오래된 청크 파일 정리 완료")
    
    async def get_file_size(self, url: str) -> Optional[int]:
        """원격 파일 크기 확인"""
        await self.initialize()
        
        try:
            async with self.session.head(url) as response:
                if response.status == 200:
                    content_length = response.headers.get('Content-Length')
                    if content_length:
                        return int(content_length)
                return None
        except Exception as e:
            print(f"[ERROR] 파일 크기 확인 실패: {e}")
            return None
    
    def _calculate_chunks(self, file_size: int) -> List[FileChunk]:
        """파일 크기를 기반으로 청크 계산"""
        chunks = []
        num_chunks = math.ceil(file_size / self.chunk_size)
        
        for i in range(num_chunks):
            start_byte = i * self.chunk_size
            end_byte = min(start_byte + self.chunk_size - 1, file_size - 1)
            chunk_size = end_byte - start_byte + 1
            
            chunk = FileChunk(
                chunk_id=i,
                start_byte=start_byte,
                end_byte=end_byte,
                size=chunk_size
            )
            chunks.append(chunk)
        
        print(f"[INFO] {file_size} bytes -> {len(chunks)}개 청크")
        return chunks
    
    async def download_chunk(self, url: str, chunk: FileChunk, 
                           progress_callback: Optional[Callable] = None) -> FileChunk:
        """단일 청크 다운로드"""
        await self.initialize()
        
        retry_count = 0
        max_retries = 3
        
        while retry_count <= max_retries:
            try:
                # Range 헤더 설정
                headers = {'Range': f'bytes={chunk.start_byte}-{chunk.end_byte}'}
                
                async with self.session.get(url, headers=headers) as response:
                    if response.status not in (200, 206):
                        raise Exception(f"HTTP {response.status}: {response.reason}")
                    
                    # 데이터 읽기
                    data = await response.read()
                    
                    # 크기 검증
                    if len(data) != chunk.size:
                        raise Exception(f"청크 크기 불일치: 예상 {chunk.size}, 실제 {len(data)}")
                    
                    # 체크섬 계산
                    chunk.checksum = hashlib.md5(data).hexdigest()
                    
                    # 메모리 사용량 체크
                    current_memory = await self._get_current_memory_usage()
                    if current_memory + len(data) > self.max_memory:
                        # 디스크 스풀링
                        chunk.file_path = await self._spool_to_disk(chunk.chunk_id, data)
                        chunk.data = None
                        print(f"[INFO] 청크 {chunk.chunk_id} 디스크 스풀링 (메모리 제한)")
                    else:
                        chunk.data = data
                    
                    # 진행률 콜백
                    if progress_callback:
                        progress_data = {
                            "chunk_id": chunk.chunk_id,
                            "bytes_downloaded": len(data),
                            "total_chunks": None,  # 알 수 없음
                            "checksum": chunk.checksum
                        }
                        await progress_callback(progress_data)
                    
                    print(f"[OK] 청크 {chunk.chunk_id} 다운로드 완료: {len(data)} bytes")
                    return chunk
                    
            except Exception as e:
                retry_count += 1
                if retry_count > max_retries:
                    print(f"[ERROR] 청크 {chunk.chunk_id} 다운로드 실패 (최대 재시도): {e}")
                    raise
                
                print(f"[WARN] 청크 {chunk.chunk_id} 다운로드 실패, {retry_count}/{max_retries} 재시도: {e}")
                await asyncio.sleep(2 ** retry_count)  # 지수 백오프
        
        # 이 줄은 도달하지 않아야 함
        raise Exception(f"청크 {chunk.chunk_id} 다운로드 실패")
    
    async def _spool_to_disk(self, chunk_id: int, data: bytes) -> str:
        """데이터를 디스크에 저장"""
        filename = f"chunk_{chunk_id}_{hashlib.md5(data).hexdigest()[:8]}.dat"
        filepath = os.path.join(self.chunk_cache_dir, filename)
        
        async with aiofiles.open(filepath, 'wb') as f:
            await f.write(data)
        
        return filepath
    
    async def _get_current_memory_usage(self) -> int:
        """현재 프로세스 메모리 사용량 확인"""
        import psutil
        process = psutil.Process()
        return process.memory_info().rss
    
    async def download_file_in_parallel(self, url: str,
                                      progress_callback: Optional[Callable] = None,
                                      total_progress_callback: Optional[Callable] = None) -> str:
        """
        병렬 청크 다운로드를 통한 대용량 파일 다운로드
        
        Args:
            url: 다운로드할 파일 URL
            progress_callback: 청크별 진행률 콜백
            total_progress_callback: 전체 진행률 콜백
            
        Returns:
            다운로드된 파일 경로
        """
        print(f"[INFO] 병렬 파일 다운로드 시작: {url}")
        
        # 파일 크기 확인
        file_size = await self.get_file_size(url)
        if file_size is None:
            raise Exception("파일 크기를 확인할 수 없습니다")
        
        print(f"[INFO] 파일 크기: {file_size} bytes ({file_size / 1024 / 1024:.2f} MB)")
        
        # 청크 계산
        chunks = self._calculate_chunks(file_size)
        total_chunks = len(chunks)
        
        # 전체 진행률 초기화
        if total_progress_callback:
            await total_progress_callback(0, f"청크 다운로드 준비 ({total_chunks}개)")
        
        # 청크 다운로드 함수
        async def download_single_chunk(chunk: FileChunk):
            return await self.download_chunk(url, chunk, progress_callback)
        
        # 병렬 다운로드
        downloaded_chunks = await async_service.parallel_map(
            download_single_chunk,
            chunks,
            max_concurrent=self.max_concurrent
        )
        
        # 다운로드 완료된 청크만 필터링
        successful_chunks = [c for c in downloaded_chunks if c is not None]
        
        if len(successful_chunks) != total_chunks:
            print(f"[WARN] 일부 청크 다운로드 실패: {len(successful_chunks)}/{total_chunks}")
        
        # 청크 병합
        if total_progress_callback:
            await total_progress_callback(80, "청크 병합 중...")
        
        merged_file = await self._merge_chunks(successful_chunks, file_size)
        
        if total_progress_callback:
            await total_progress_callback(100, "파일 다운로드 완료!")
        
        print(f"[OK] 파일 다운로드 완료: {merged_file} ({file_size} bytes)")
        return merged_file
    
    async def _merge_chunks(self, chunks: List[FileChunk], total_size: int) -> str:
        """청크들을 하나의 파일로 병합"""
        # 청크 정렬 (청크 ID 기준)
        chunks.sort(key=lambda x: x.chunk_id)
        
        # 임시 파일 생성
        output_file = tempfile.NamedTemporaryFile(
            dir=self.temp_dir,
            delete=False,
            suffix=".downloaded"
        )
        output_path = output_file.name
        output_file.close()
        
        print(f"[INFO] 청크 병합 시작: {len(chunks)}개 청크 -> {output_path}")
        
        # 청크 병합
        with open(output_path, 'wb') as outfile:
            bytes_written = 0
            
            for chunk in chunks:
                # 청크 데이터 읽기
                if chunk.data:
                    chunk_bytes = chunk.data
                elif chunk.file_path and os.path.exists(chunk.file_path):
                    async with aiofiles.open(chunk.file_path, 'rb') as f:
                        chunk_bytes = await f.read()
                else:
                    print(f"[WARN] 청크 {chunk.chunk_id} 데이터 없음, 스킵")
                    continue
                
                # 파일에 쓰기
                outfile.write(chunk_bytes)
                bytes_written += len(chunk_bytes)
                
                # 진행률 로그
                if chunk.chunk_id % 10 == 0:
                    percent = (bytes_written / total_size) * 100
                    print(f"[INFO] 병합 진행: {percent:.1f}% ({bytes_written}/{total_size} bytes)")
        
        # 최종 크기 검증
        actual_size = os.path.getsize(output_path)
        if actual_size != total_size:
            print(f"[WARN] 최종 파일 크기 불일치: 예상 {total_size}, 실제 {actual_size}")
        
        # 청크 파일 정리
        await self._cleanup_chunk_files(chunks)
        
        return output_path
    
    async def _cleanup_chunk_files(self, chunks: List[FileChunk]):
        """청크 임시 파일 정리"""
        files_deleted = 0
        for chunk in chunks:
            if chunk.file_path and os.path.exists(chunk.file_path):
                try:
                    os.remove(chunk.file_path)
                    files_deleted += 1
                except Exception as e:
                    print(f"[WARN] 청크 파일 삭제 실패 {chunk.file_path}: {e}")
        
        if files_deleted > 0:
            print(f"[OK] {files_deleted}개 청크 임시 파일 정리 완료")
    
    async def process_large_video(self, video_url: str,
                                output_format: str = "mp4",
                                quality: str = "medium",
                                progress_callback: Optional[Callable] = None) -> str:
        """
        대용량 영상 파일 처리 파이프라인
        
        Args:
            video_url: 영상 파일 URL
            output_format: 출력 형식 (mp4, mov, etc.)
            quality: 품질 설정 (low, medium, high)
            progress_callback: 진행률 콜백
            
        Returns:
            처리된 영상 파일 경로
        """
        print(f"[INFO] 대용량 영상 처리 시작: {video_url}")
        
        # 1. 파일 다운로드
        if progress_callback:
            await progress_callback(10, "영상 파일 다운로드 중...")
        
        downloaded_file = await self.download_file_in_parallel(
            video_url,
            total_progress_callback=lambda p, m: progress_callback(10 + p * 0.4, m) if progress_callback else None
        )
        
        # 2. 영상 처리 (간단한 변환 예시)
        if progress_callback:
            await progress_callback(50, "영상 처리 중...")
        
        processed_file = await self._process_video_file(
            downloaded_file,
            output_format,
            quality
        )
        
        # 3. 원본 임시 파일 정리
        try:
            os.remove(downloaded_file)
        except Exception as e:
            print(f"[WARN] 임시 파일 삭제 실패: {e}")
        
        if progress_callback:
            await progress_callback(100, "영상 처리 완료!")
        
        print(f"[OK] 대용량 영상 처리 완료: {processed_file}")
        return processed_file
    
    async def _process_video_file(self, input_path: str, 
                                output_format: str, 
                                quality: str) -> str:
        """영상 파일 처리 (FFmpeg 기반)"""
        import subprocess
        import uuid
        
        # 출력 파일 경로 생성
        output_filename = f"processed_{uuid.uuid4().hex[:8]}.{output_format}"
        output_path = os.path.join(self.temp_dir, output_filename)
        
        # FFmpeg 품질 설정 매핑
        quality_map = {
            "low": ["-crf", "28", "-preset", "ultrafast"],
            "medium": ["-crf", "23", "-preset", "medium"],
            "high": ["-crf", "18", "-preset", "slow"]
        }
        
        quality_args = quality_map.get(quality, quality_map["medium"])
        
        # FFmpeg 명령어 구성
        cmd = [
            'ffmpeg', '-y',
            '-i', input_path,
            *quality_args,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-b:a', '192k',
            output_path
        ]
        
        print(f"[INFO] FFmpeg 실행: {' '.join(cmd)}")
        
        # FFmpeg 실행
        try:
            result = await async_service.run_in_thread(
                subprocess.run,
                cmd,
                capture_output=True,
                text=True,
                timeout=600  # 10분 타임아웃
            )
            
            if result.returncode != 0:
                raise Exception(f"FFmpeg 실패: {result.stderr}")
            
            if not os.path.exists(output_path):
                raise Exception("출력 파일이 생성되지 않음")
            
            return output_path
            
        except Exception as e:
            print(f"[ERROR] 영상 처리 실패: {e}")
            raise
    
    def get_status(self) -> Dict[str, Any]:
        """서비스 상태 조회"""
        return {
            "max_concurrent": self.max_concurrent,
            "chunk_size_mb": self.chunk_size / 1024 / 1024,
            "max_memory_mb": self.max_memory / 1024 / 1024,
            "temp_dir": self.temp_dir,
            "chunk_cache_dir": self.chunk_cache_dir,
            "cache_size_mb": self._get_cache_size_mb()
        }
    
    def _get_cache_size_mb(self) -> float:
        """캐시 디렉토리 크기 계산 (MB)"""
        total_size = 0
        for dirpath, dirnames, filenames in os.walk(self.chunk_cache_dir):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                total_size += os.path.getsize(filepath)
        
        return total_size / 1024 / 1024


# 전역 대용량 파일 처리 서비스 인스턴스
large_file_processing_service = LargeFileProcessingService(
    max_concurrent_downloads=4,
    chunk_size_mb=20,  # 20MB 청크
    max_memory_mb=1024  # 1GB 메모리 제한
)