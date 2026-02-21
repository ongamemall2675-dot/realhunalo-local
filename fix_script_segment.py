#!/usr/bin/env python3
"""
스크립트 세그먼트 API 오류 수정 스크립트
'await' 키워드 제거 (segment_text는 동기 함수)
"""

import re

def fix_backend_file():
    file_path = "backend.py"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 문제가 되는 부분 찾기
    pattern = r'(@app\.post\("/api/script/segment"\).*?def api_segment_script.*?\n)(.*?)(?=\n@app\.post|\n@app\.get|\n@app\.put|\n@app\.delete|\n\n\n)'
    
    # 더 정확한 패턴: async def process_segmentation 내부의 await 제거
    # await script_service.segment_text(...) -> script_service.segment_text(...)
    fixed_content = re.sub(
        r'result = await script_service\.segment_text\(',
        'result = script_service.segment_text(',
        content
    )
    
    # 변경사항 확인
    if fixed_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        print("✅ 백엔드 파일 수정 완료: await 키워드 제거됨")
        return True
    else:
        print("⚠️  변경사항 없음 (이미 수정되었거나 패턴이 일치하지 않음)")
        return False

if __name__ == "__main__":
    fix_backend_file()