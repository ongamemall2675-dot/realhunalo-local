"""
YouTube Service
YouTube Data API v3를 사용한 채널 분석 및 키워드 조사
"""
import os
from typing import Dict, Any, List, Optional
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


class YouTubeService:
    """YouTube API 서비스"""

    def __init__(self):
        self.api_key = os.getenv('YOUTUBE_API_KEY')
        if not self.api_key:
            print("[WARN] YOUTUBE_API_KEY가 설정되지 않았습니다.")
            self.youtube = None
        else:
            try:
                self.youtube = build('youtube', 'v3', developerKey=self.api_key)
                print("[OK] YouTube API 초기화 완료")
            except Exception as e:
                print(f"[X] YouTube API 초기화 실패: {e}")
                self.youtube = None

    def analyze_channel(self, channel_id: str) -> Dict[str, Any]:
        """
        채널 분석

        Args:
            channel_id: YouTube 채널 ID 또는 핸들

        Returns:
            채널 정보 및 효율성 지표
        """
        if not self.youtube:
            return {"success": False, "error": "YouTube API가 초기화되지 않았습니다."}

        try:
            # 1. 채널 정보 조회
            # @ 핸들인 경우 채널 ID 조회
            if channel_id.startswith('@'):
                search_response = self.youtube.search().list(
                    part='snippet',
                    q=channel_id,
                    type='channel',
                    maxResults=1
                ).execute()

                if not search_response.get('items'):
                    return {"success": False, "error": "채널을 찾을 수 없습니다."}

                channel_id = search_response['items'][0]['snippet']['channelId']

            # 채널 통계 가져오기
            channel_response = self.youtube.channels().list(
                part='snippet,statistics',
                id=channel_id
            ).execute()

            if not channel_response.get('items'):
                return {"success": False, "error": "채널 정보를 가져올 수 없습니다."}

            channel_data = channel_response['items'][0]
            snippet = channel_data['snippet']
            stats = channel_data['statistics']

            channel_info = {
                "title": snippet['title'],
                "description": snippet.get('description', ''),
                "thumbnail": snippet['thumbnails'].get('high', {}).get('url', ''),
                "subscriberCount": int(stats.get('subscriberCount', 0)),
                "viewCount": int(stats.get('viewCount', 0)),
                "videoCount": int(stats.get('videoCount', 0))
            }

            # 2. 최근 영상 조회
            videos = self._get_recent_videos(channel_id, max_results=10)

            # 3. 효율성 지표 계산
            efficiency = self._calculate_efficiency(channel_info, videos)

            return {
                "success": True,
                "channel": channel_info,
                "recentVideos": videos,
                "efficiency": efficiency
            }

        except HttpError as e:
            return {"success": False, "error": f"YouTube API 오류: {e.error_details}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _get_recent_videos(self, channel_id: str, max_results: int = 10) -> List[Dict[str, Any]]:
        """채널의 최근 영상 조회"""
        try:
            # 채널의 업로드 플레이리스트 ID 가져오기
            channel_response = self.youtube.channels().list(
                part='contentDetails',
                id=channel_id
            ).execute()

            uploads_playlist_id = channel_response['items'][0]['contentDetails']['relatedPlaylists']['uploads']

            # 최근 영상 가져오기
            playlist_response = self.youtube.playlistItems().list(
                part='contentDetails',
                playlistId=uploads_playlist_id,
                maxResults=max_results
            ).execute()

            video_ids = [item['contentDetails']['videoId'] for item in playlist_response['items']]

            # 영상 통계 가져오기
            videos_response = self.youtube.videos().list(
                part='snippet,statistics',
                id=','.join(video_ids)
            ).execute()

            videos = []
            for video in videos_response['items']:
                snippet = video['snippet']
                stats = video['statistics']

                videos.append({
                    "videoId": video['id'],
                    "title": snippet['title'],
                    "thumbnail": snippet['thumbnails'].get('medium', {}).get('url', ''),
                    "publishedAt": snippet['publishedAt'],
                    "viewCount": int(stats.get('viewCount', 0)),
                    "likeCount": int(stats.get('likeCount', 0)),
                    "commentCount": int(stats.get('commentCount', 0))
                })

            return videos

        except Exception as e:
            print(f"[X] 영상 조회 실패: {e}")
            return []

    def _calculate_efficiency(self, channel: Dict[str, Any], videos: List[Dict[str, Any]]) -> Dict[str, float]:
        """효율성 지표 계산"""
        if not videos or channel['subscriberCount'] == 0:
            return {
                "avgViewsPerSub": 0,
                "avgLikesPerView": 0,
                "efficiencyScore": 0
            }

        total_views = sum(v['viewCount'] for v in videos)
        total_likes = sum(v['likeCount'] for v in videos)

        avg_views = total_views / len(videos)
        avg_likes = total_likes / len(videos)

        # 조회수/구독자 비율 (%)
        views_per_sub = (avg_views / channel['subscriberCount']) * 100

        # 좋아요/조회수 비율 (%)
        likes_per_view = (avg_likes / avg_views * 100) if avg_views > 0 else 0

        # 종합 효율성 점수 (0-100)
        # 높은 조회수/구독자 비율 + 높은 참여율 = 높은 점수
        efficiency_score = min(100, (views_per_sub * 2) + (likes_per_view * 10))

        return {
            "avgViewsPerSub": views_per_sub,
            "avgLikesPerView": likes_per_view,
            "efficiencyScore": efficiency_score
        }

    def search_keyword(self, keyword: str, order: str = 'relevance', max_results: int = 20) -> Dict[str, Any]:
        """
        키워드로 영상 검색

        Args:
            keyword: 검색 키워드
            order: 정렬 순서 (relevance, date, viewCount, rating)
            max_results: 최대 결과 수

        Returns:
            검색 결과
        """
        if not self.youtube:
            return {"success": False, "error": "YouTube API가 초기화되지 않았습니다."}

        try:
            search_response = self.youtube.search().list(
                part='snippet',
                q=keyword,
                type='video',
                order=order,
                maxResults=max_results
            ).execute()

            video_ids = [item['id']['videoId'] for item in search_response['items']]

            # 영상 통계 가져오기
            videos_response = self.youtube.videos().list(
                part='snippet,statistics',
                id=','.join(video_ids)
            ).execute()

            videos = []
            for video in videos_response['items']:
                snippet = video['snippet']
                stats = video['statistics']

                videos.append({
                    "videoId": video['id'],
                    "title": snippet['title'],
                    "channelTitle": snippet['channelTitle'],
                    "thumbnail": snippet['thumbnails'].get('medium', {}).get('url', ''),
                    "publishedAt": snippet['publishedAt'][:10],  # YYYY-MM-DD
                    "viewCount": int(stats.get('viewCount', 0))
                })

            return {
                "success": True,
                "videos": videos,
                "keyword": keyword,
                "count": len(videos)
            }

        except HttpError as e:
            return {"success": False, "error": f"YouTube API 오류: {e.error_details}"}
        except Exception as e:
            return {"success": False, "error": str(e)}


# 싱글톤 인스턴스
youtube_service = YouTubeService()
