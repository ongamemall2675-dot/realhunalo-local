"""
Trend Service
네이버 & 구글 트렌드 분석
"""
import os
import requests
from typing import Dict, Any, List
from datetime import datetime, timedelta
from bs4 import BeautifulSoup

class TrendService:
    """트렌드 분석 서비스"""

    def __init__(self):
        self.naver_client_id = os.getenv('NAVER_CLIENT_ID')
        self.naver_client_secret = os.getenv('NAVER_CLIENT_SECRET')
        print("[OK] Trend Service 초기화 완료")

    def analyze_naver(self, keyword: str) -> Dict[str, Any]:
        """
        네이버 트렌드 분석

        Args:
            keyword: 검색 키워드

        Returns:
            트렌드 데이터
        """
        if not self.naver_client_id or not self.naver_client_secret:
            return {"error": "Naver API 키가 설정되지 않았습니다."}

        try:
            print(f"[NAVER] Starting analysis for keyword: {keyword}")
            print(f"[NAVER] Client ID: {self.naver_client_id[:10]}...")

            # 날짜 범위 설정 (1년)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=365)
            
            date_format = "%Y-%m-%d"
            start_str = start_date.strftime(date_format)
            end_str = end_date.strftime(date_format)

            print(f"[NAVER] Date range: {start_str} to {end_str}")

            # 네이버 데이터랩 API
            url = "https://openapi.naver.com/v1/datalab/search"
            headers = {
                "X-Naver-Client-Id": self.naver_client_id,
                "X-Naver-Client-Secret": self.naver_client_secret,
                "Content-Type": "application/json"
            }

            body = {
                "startDate": start_str,
                "endDate": end_str,
                "timeUnit": "week",
                "keywordGroups": [
                    {
                        "groupName": keyword,
                        "keywords": [keyword]
                    }
                ]
            }

            print(f"[NAVER] Sending request to: {url}")

            response = requests.post(url, headers=headers, json=body, timeout=10)

            if response.status_code != 200:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                print(f"[NAVER HTTP ERROR] {error_msg}")
                return {"error": error_msg}

            data = response.json()
            results = data.get('results', [])

            if not results:
                return {"error": "데이터가 없습니다."}

            trend_data = results[0].get('data', [])

            print(f"[NAVER] Successfully parsed {len(trend_data)} data points")

            return {
                "keyword": keyword,
                "data": trend_data,
                "source": "naver"
            }

        except Exception as e:
            print(f"[X] Naver trend error: {e}")
            return {"error": str(e)}

    def analyze_google(self, keyword: str) -> Dict[str, Any]:
        """
        구글 트렌드 분석 (Google Trends 비공식 API 사용)

        Args:
            keyword: 검색 키워드

        Returns:
            트렌드 데이터
        """
        try:
            print(f"[GOOGLE] Starting analysis for keyword: {keyword}")

            # Google Trends 데이터 크롤링
            from pytrends.request import TrendReq

            pytrends = TrendReq(hl='ko-KR', tz=540)
            pytrends.build_payload([keyword], timeframe='today 12-m', geo='KR')

            interest_over_time = pytrends.interest_over_time()

            if interest_over_time.empty:
                return {"error": "구글 트렌드 데이터가 없습니다."}

            # DataFrame을 리스트로 변환
            trend_data = []
            for date, row in interest_over_time.iterrows():
                trend_data.append({
                    "period": date.strftime("%Y-%m-%d"),
                    "ratio": int(row[keyword])
                })

            print(f"[GOOGLE] Successfully parsed {len(trend_data)} data points")

            return {
                "keyword": keyword,
                "data": trend_data,
                "source": "google"
            }

        except Exception as e:
            print(f"[X] Google trend error: {e}")
            return {"error": str(e)}

# 싱글톤 인스턴스
trend_service = TrendService()
