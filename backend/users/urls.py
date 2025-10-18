# backend/users/urls.py

from django.urls import path
from . import views
# JWT 관련 뷰 임포트 (추후 설치 및 설정 필요)
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    # 1. 인증/토큰 관리
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),  # POST: 토큰 발급 (로그인)
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),  # POST: 토큰 갱신

    # 2. 사용자 기능
    path('signup/', views.UserSignupView.as_view(), name='user_signup'),  # POST: 회원가입
    path('profile/', views.UserProfileView.as_view(), name='user_profile'),  # GET/PUT: 내 정보 조회/수정
]

# 최종 URL 예시: /api/auth/login/