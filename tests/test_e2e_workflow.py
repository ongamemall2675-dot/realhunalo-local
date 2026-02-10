"""
End-to-End 워크플로우 테스트
대본 → TTS → Vrew 전체 프로세스 실행 및 검증

실행 방법:
    python tests/test_e2e_workflow.py

    또는 서버 실행 후:
    python tests/test_e2e_workflow.py --with-server
"""
import os
import sys
import json
import time
import argparse
import requests
from typing import Dict, Any

# 프로젝트 루트 경로 추가
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

# 설정
API_BASE_URL = "http://localhost:8000"
TEST_SCRIPTS = [
    "안녕하세요, 오늘은 인공지능에 대해 알아보겠습니다.",
    "AI는 우리의 일상을 변화시키고 있습니다.",
    "감사합니다."
]


class E2ETestRunner:
    """E2E 테스트 실행기"""

    def __init__(self, api_base: str = API_BASE_URL):
        self.api_base = api_base
        self.results = {
            "tts": [],
            "vrew": None,
            "errors": []
        }

    def check_server(self) -> bool:
        """서버 상태 확인"""
        print("\n" + "=" * 60)
        print("🔍 서버 상태 확인 중...")
        print("=" * 60)

        try:
            response = requests.get(f"{self.api_base}/api/tts/status", timeout=5)
            if response.status_code == 200:
                status = response.json()
                print(f"✅ 서버 연결 성공")
                print(f"   - Primary Engine: {status.get('primaryEngine')}")
                print(f"   - Available Engines: {status.get('availableEngines')}")
                return True
            else:
                print(f"❌ 서버 응답 오류: {response.status_code}")
                return False
        except requests.exceptions.ConnectionError:
            print(f"❌ 서버에 연결할 수 없습니다: {self.api_base}")
            print("   backend.py를 먼저 실행하세요: python backend.py")
            return False
        except Exception as e:
            print(f"❌ 서버 확인 실패: {e}")
            return False

    def test_tts_generation(self, scripts: list = None) -> bool:
        """TTS 생성 테스트"""
        print("\n" + "=" * 60)
        print("🎤 TTS 생성 테스트")
        print("=" * 60)

        scripts = scripts or TEST_SCRIPTS
        all_success = True

        for i, script in enumerate(scripts):
            print(f"\n[Scene {i + 1}] \"{script[:30]}...\"")

            try:
                start_time = time.time()

                response = requests.post(
                    f"{self.api_base}/api/generate-tts",
                    json={
                        "text": script,
                        "sceneId": f"test-scene-{i + 1}",
                        "settings": {
                            "engine": "elevenlabs",
                            "voiceId": "zcAOhNBS3c14rBihAFp1",
                            "stability": 0.5,
                            "speed": 1.0
                        }
                    },
                    timeout=60
                )

                elapsed = time.time() - start_time
                result = response.json()

                if result.get("success"):
                    print(f"   ✅ 성공 (엔진: {result.get('usedEngine', 'N/A')}, 시간: {elapsed:.2f}s)")

                    # Fallback 확인
                    if result.get("fallbackUsed"):
                        print(f"   ⚠️ Fallback 사용됨: {result.get('originalEngine')} → {result.get('usedEngine')}")

                    # alignment 확인
                    alignment = result.get("alignment", {})
                    word_count = len(alignment.get("words", []))
                    print(f"   📊 타임스탬프: {word_count}개 단어")

                    # SRT 확인
                    srt = result.get("srtData") or result.get("srt")
                    if srt:
                        print(f"   📝 SRT 데이터: {len(srt)} bytes")

                    self.results["tts"].append({
                        "sceneId": f"test-scene-{i + 1}",
                        "script": script,
                        "success": True,
                        "audioUrl": result.get("audioUrl"),
                        "srtData": srt,
                        "engine": result.get("usedEngine"),
                        "processingTime": elapsed
                    })
                else:
                    print(f"   ❌ 실패: {result.get('error')}")
                    self.results["errors"].append({
                        "scene": i + 1,
                        "error": result.get("error")
                    })
                    all_success = False

            except Exception as e:
                print(f"   ❌ 예외 발생: {e}")
                self.results["errors"].append({
                    "scene": i + 1,
                    "error": str(e)
                })
                all_success = False

        return all_success

    def test_vrew_export(self) -> bool:
        """Vrew 내보내기 테스트"""
        print("\n" + "=" * 60)
        print("🎨 Vrew 내보내기 테스트")
        print("=" * 60)

        if not self.results["tts"]:
            print("   ⚠️ TTS 결과가 없어 Vrew 테스트를 건너뜁니다.")
            return False

        try:
            # 타임라인 데이터 구성
            standalone = []
            for tts_result in self.results["tts"]:
                if tts_result.get("success"):
                    standalone.append({
                        "audioUrl": tts_result.get("audioUrl"),
                        "visualUrl": None,
                        "duration": 5.0,
                        "script": tts_result.get("script"),
                        "srtData": tts_result.get("srtData")
                    })

            print(f"   📦 {len(standalone)}개 씬 포함")

            # Vrew 내보내기 요청
            response = requests.post(
                f"{self.api_base}/api/export-vrew",
                json={
                    "mergedGroups": [],
                    "standalone": standalone
                },
                timeout=30
            )

            result = response.json()

            if result.get("success"):
                task_id = result.get("taskId")
                print(f"   ✅ 작업 시작됨 (Task ID: {task_id})")

                # 작업 완료 대기
                print("   ⏳ 작업 완료 대기 중...")
                for _ in range(30):  # 최대 30초 대기
                    time.sleep(1)
                    task_response = requests.get(f"{self.api_base}/api/tasks/{task_id}")
                    task = task_response.json()

                    if task.get("status") == "completed":
                        vrew_url = task.get("result", {}).get("vrewUrl")
                        print(f"   ✅ Vrew 파일 생성 완료!")
                        print(f"   📁 URL: {vrew_url}")
                        self.results["vrew"] = vrew_url
                        return True

                    elif task.get("status") == "failed":
                        print(f"   ❌ Vrew 생성 실패: {task.get('error')}")
                        return False

                print("   ⚠️ 작업 시간 초과")
                return False

            else:
                print(f"   ❌ 요청 실패: {result.get('error')}")
                return False

        except Exception as e:
            print(f"   ❌ 예외 발생: {e}")
            self.results["errors"].append({
                "stage": "vrew",
                "error": str(e)
            })
            return False

    def test_fallback(self) -> bool:
        """Fallback 로직 테스트 (잘못된 엔진 요청)"""
        print("\n" + "=" * 60)
        print("🔄 Fallback 로직 테스트")
        print("=" * 60)

        try:
            # 존재하지 않는 엔진으로 요청
            response = requests.post(
                f"{self.api_base}/api/generate-tts",
                json={
                    "text": "Fallback 테스트 문장입니다.",
                    "sceneId": "fallback-test",
                    "settings": {
                        "engine": "nonexistent_engine",  # 없는 엔진
                        "voiceId": None
                    }
                },
                timeout=60
            )

            result = response.json()

            if result.get("success"):
                print(f"   ✅ Fallback 성공: {result.get('usedEngine')} 엔진 사용됨")
                if result.get("fallbackUsed"):
                    print(f"   📌 원래 요청: {result.get('originalEngine')}")
                return True
            else:
                # Fallback도 실패하면 모든 엔진에 문제가 있는 것
                print(f"   ⚠️ 모든 엔진 실패: {result.get('error')}")
                return False

        except Exception as e:
            print(f"   ❌ 예외 발생: {e}")
            return False

    def print_summary(self):
        """결과 요약 출력"""
        print("\n" + "=" * 60)
        print("📊 테스트 결과 요약")
        print("=" * 60)

        # TTS 결과
        tts_success = sum(1 for r in self.results["tts"] if r.get("success"))
        tts_total = len(self.results["tts"])
        print(f"\n🎤 TTS 생성: {tts_success}/{tts_total} 성공")

        for r in self.results["tts"]:
            status = "✅" if r.get("success") else "❌"
            print(f"   {status} Scene {r.get('sceneId')}: {r.get('engine', 'N/A')} ({r.get('processingTime', 0):.1f}s)")

        # Vrew 결과
        print(f"\n🎨 Vrew 내보내기: {'✅ 성공' if self.results['vrew'] else '❌ 실패/미실행'}")
        if self.results["vrew"]:
            print(f"   📁 {self.results['vrew']}")

        # 에러
        if self.results["errors"]:
            print(f"\n⚠️ 발생한 오류: {len(self.results['errors'])}건")
            for err in self.results["errors"]:
                print(f"   - {err}")

        print("\n" + "=" * 60)


def run_local_tests():
    """서버 없이 로컬 모듈 테스트"""
    print("\n" + "=" * 60)
    print("🧪 로컬 모듈 테스트 (서버 미사용)")
    print("=" * 60)

    try:
        from services.tts_service import tts_service
        from services.vrew_formatter import VrewFormatter
        from services.vrew_service import VrewService

        # TTS 서비스 상태
        if tts_service:
            print(f"\n✅ TTS Service 로드 완료")
            print(f"   - Primary: {tts_service.primary_engine}")
            print(f"   - Engines: {tts_service.get_available_engines()}")
        else:
            print("❌ TTS Service 로드 실패")

        # Vrew 포맷터
        formatter = VrewFormatter()
        print(f"\n✅ VrewFormatter 로드 완료")

        # Vrew 서비스
        vrew_svc = VrewService()
        print(f"✅ VrewService 로드 완료")

        print("\n✅ 모든 모듈 로드 성공!")
        return True

    except Exception as e:
        print(f"\n❌ 모듈 로드 실패: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="E2E 워크플로우 테스트")
    parser.add_argument("--with-server", action="store_true", help="서버 테스트 포함")
    parser.add_argument("--local-only", action="store_true", help="로컬 모듈 테스트만 실행")
    args = parser.parse_args()

    print("=" * 60)
    print("🚀 RealHunalo E2E 워크플로우 테스트")
    print("=" * 60)

    # 로컬 모듈 테스트
    local_ok = run_local_tests()

    if args.local_only:
        return 0 if local_ok else 1

    if not args.with_server:
        print("\n💡 서버 테스트를 실행하려면 --with-server 옵션을 사용하세요.")
        return 0 if local_ok else 1

    # 서버 테스트
    runner = E2ETestRunner()

    if not runner.check_server():
        return 1

    # TTS 테스트
    tts_ok = runner.test_tts_generation()

    # Fallback 테스트
    runner.test_fallback()

    # Vrew 테스트
    vrew_ok = runner.test_vrew_export()

    # 요약
    runner.print_summary()

    return 0 if (tts_ok and vrew_ok) else 1


if __name__ == "__main__":
    sys.exit(main())
