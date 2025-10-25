# backend/users/urls.py

from django.urls import path
from .views import UserSignupView, UserProfileView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("signup/",  UserSignupView.as_view(),        name="signup"),         # POST
    path("login/",   TokenObtainPairView.as_view(),   name="login"),          # POST
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"), # POST
    path("profile/", UserProfileView.as_view(),       name="profile"),        # GET/PUT
]

# 최종 URL 예시: /api/auth/login/