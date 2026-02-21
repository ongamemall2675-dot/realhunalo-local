#!/usr/bin/env python3
"""
스크립트 세그먼트 API의 async/await 문제 해결
async def process_segmentation -> def process_segmentation으로 변경
"""

import re

def fix_backend_file():
    file_path = "backend.py"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 문제 패턴 찾기: @app.post("/api/script/segment") 이후의 process_segmentation 함수
    # async def process_segmentation(tid: str, req: SegmentScriptRequest):
    pattern = r'(@app\.post\("/api/script/segment"\).*?)async def process_segmentation'
    
    # 전체 내용에서 해당 부분 찾기
    if 'async def process_segmentation' in content:
        # async def -> def 로 변경
        fixed_content = content.replace('async def process_segmentation', 'def process_segmentation')
        print("✅ async 키워드 제거: async def -> def")
    else:
        print("⚠️  async def process_segmentation을 찾을 수 없음")
        fixed_content = content
    
    # await 키워드가 남아있는지 확인 (이미 fix_script_segment.py에서 처리했지만 다시 확인)
    if 'await script_service.segment_text' in fixed_content:
        fixed_content = fixed_content.replace('await script_service.segment_text', 'script_service.segment_text')
        print("✅ 남은 await 키워드 제거")
    
    # 변경사항 확인
    if fixed_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        print("✅ 백엔드 파일 수정 완료")
        return True
    else:
        print("⚠️  변경사항 없음 (이미 수정되었거나 패턴이 일치하지 않음)")
        
        # 디버깅: 해당 라인 찾기
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'process_segmentation' in line:
                print(f"  라인 {i+1}: {line.strip()}")
        
        return False

if __name__ == "__main__":
    fix_backend_file()