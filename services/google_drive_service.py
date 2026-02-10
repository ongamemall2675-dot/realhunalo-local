"""
Google Drive Service
Google Drive API를 사용한 파일 업로드 및 저장
"""
import os
import json
from typing import Dict, Any, Optional
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request

class GoogleDriveService:
    """Google Drive 파일 업로드 서비스"""

    def __init__(self):
        self.api_key = os.getenv('GOOGLE_DRIVE_API_KEY')
        # Support both old and new env var names
        self.client_id = os.getenv('GOOGLE_DRIVE_CLIENT_ID') or os.getenv('GOOGLE_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_DRIVE_CLIENT_SECRET') or os.getenv('GOOGLE_CLIENT_SECRET')
        self.folder_id = os.getenv('GOOGLE_DRIVE_FOLDER_ID')
        self.credentials = None
        self.service = None
        
        # OAuth 2.0 scopes
        self.scopes = ['https://www.googleapis.com/auth/drive.file']
        
        # 저장된 토큰 로드 시도
        self._load_credentials()
        
        print("[OK] Google Drive Service 초기화 완료")

    def _load_credentials(self):
        """저장된 인증 정보 로드"""
        token_path = os.path.join(os.path.dirname(__file__), 'token.json')
        
        if os.path.exists(token_path):
            try:
                self.credentials = Credentials.from_authorized_user_file(token_path, self.scopes)
                
                # 토큰 갱신 필요시
                if self.credentials and self.credentials.expired and self.credentials.refresh_token:
                    self.credentials.refresh(Request())
                    self._save_credentials()
                
                if self.credentials and self.credentials.valid:
                    self.service = build('drive', 'v3', credentials=self.credentials)
                    print("[OK] Google Drive 인증 완료 (저장된 토큰)")
            except Exception as e:
                print(f"[WARN] 토큰 로드 실패: {e}")

    def _save_credentials(self):
        """인증 정보 저장"""
        token_path = os.path.join(os.path.dirname(__file__), 'token.json')
        
        try:
            with open(token_path, 'w') as token_file:
                token_file.write(self.credentials.to_json())
            print("[OK] Google Drive 인증 정보 저장")
        except Exception as e:
            print(f"[X] 토큰 저장 실패: {e}")

    def get_authorization_url(self) -> Dict[str, Any]:
        """
        OAuth 2.0 인증 URL 생성

        Returns:
            인증 URL 및 상태 정보
        """
        if not self.client_id or not self.client_secret:
            return {"success": False, "error": "Google OAuth 클라이언트 정보가 설정되지 않았습니다."}

        try:
            # OAuth 2.0 클라이언트 설정
            client_config = {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": ["http://localhost:8000/api/google-drive/callback"]
                }
            }

            flow = Flow.from_client_config(
                client_config,
                scopes=self.scopes,
                redirect_uri="http://localhost:8000/api/google-drive/callback"
            )

            authorization_url, state = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true',
                prompt='consent'
            )

            return {
                "success": True,
                "authUrl": authorization_url,
                "state": state
            }

        except Exception as e:
            print(f"[X] OAuth URL 생성 실패: {e}")
            return {"success": False, "error": str(e)}

    def handle_oauth_callback(self, code: str) -> Dict[str, Any]:
        """
        OAuth 2.0 콜백 처리

        Args:
            code: 인증 코드

        Returns:
            인증 결과
        """
        if not self.client_id or not self.client_secret:
            return {"success": False, "error": "Google OAuth 클라이언트 정보가 설정되지 않았습니다."}

        try:
            client_config = {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": ["http://localhost:8000/api/google-drive/callback"]
                }
            }

            flow = Flow.from_client_config(
                client_config,
                scopes=self.scopes,
                redirect_uri="http://localhost:8000/api/google-drive/callback"
            )

            flow.fetch_token(code=code)
            self.credentials = flow.credentials
            self._save_credentials()

            # Drive 서비스 초기화
            self.service = build('drive', 'v3', credentials=self.credentials)

            return {
                "success": True,
                "message": "Google Drive 인증 완료"
            }

        except Exception as e:
            print(f"[X] OAuth 콜백 처리 실패: {e}")
            return {"success": False, "error": str(e)}

    def upload_file(self, file_path: str, filename: Optional[str] = None) -> Dict[str, Any]:
        """
        파일을 Google Drive에 업로드

        Args:
            file_path: 업로드할 파일 경로
            filename: Drive에 저장될 파일명 (None이면 원본 파일명)

        Returns:
            업로드 결과
        """
        if not self.service:
            return {"success": False, "error": "Google Drive 인증이 필요합니다."}

        try:
            if not os.path.exists(file_path):
                return {"success": False, "error": "파일이 존재하지 않습니다."}

            file_name = filename if filename else os.path.basename(file_path)

            # 파일 메타데이터
            file_metadata = {
                'name': file_name
            }

            # 폴더 지정
            if self.folder_id:
                file_metadata['parents'] = [self.folder_id]

            # MIME 타입 자동 감지
            mime_type = self._get_mime_type(file_path)

            media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)

            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink, webContentLink'
            ).execute()

            print(f"[OK] Google Drive 업로드 완료: {file_name}")

            return {
                "success": True,
                "fileId": file.get('id'),
                "viewLink": file.get('webViewLink'),
                "downloadLink": file.get('webContentLink'),
                "filename": file_name
            }

        except Exception as e:
            print(f"[X] Google Drive 업로드 실패: {e}")
            return {"success": False, "error": str(e)}

    def _get_mime_type(self, file_path: str) -> str:
        """파일 MIME 타입 감지"""
        import mimetypes
        mime_type, _ = mimetypes.guess_type(file_path)
        return mime_type if mime_type else 'application/octet-stream'

    def is_authenticated(self) -> bool:
        """인증 상태 확인"""
        return self.service is not None and self.credentials is not None and self.credentials.valid

    def get_status(self) -> Dict[str, Any]:
        """서비스 상태 조회"""
        return {
            "authenticated": self.is_authenticated(),
            "hasFolderId": bool(self.folder_id),
            "hasClientId": bool(self.client_id)
        }

# 싱글톤 인스턴스
google_drive_service = GoogleDriveService()
