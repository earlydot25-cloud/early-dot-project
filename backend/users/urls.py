# backend/users/urls.py

from django.urls import path
from .views import UserSignupView, UserProfileView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


urlpatterns = [
    path("signup/",  UserSignupView.as_view(),        name="signup"),         # POST
    path("login/",   TokenObtainPairView.as_view(),   name="login"),          # POST
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"), # POST
    # 🚨 프로필 조회 (GET) 및 수정 (PATCH)
    path("profile/", UserProfileView.as_view(), name="profile"),

    # 🚨 프로필 업데이트 전용 경로 (PATCH 요청을 위해 분리)
    path("profile/update/", UserProfileView.as_view(), name="profile_update"),  # PATCH

    # 🚨 회원 탈퇴 경로 (DELETE)
    path("profile/delete/", UserDeleteView.as_view(), name="profile_delete"),
]

# 최종 URL 예시: /api/auth/login/