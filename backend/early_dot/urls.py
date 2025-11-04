"""
URL configuration for early_dot project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

# early_dot/urls.py
from django.contrib import admin
from django.urls import path, include
from users.views import UserSignupView, UserProfileView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    # 회원
    path("api/auth/signup/",  UserSignupView.as_view(),   name="signup"),
    path("api/auth/profile/", UserProfileView.as_view(),  name="profile"),
    path("api/auth/login/",   TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path('api/diagnosis/', include('diagnosis.urls')),  # diagnosis 앱 (진단 업로드)
    path('api/dashboard/', include('dashboard.urls')),  # dashboard 앱 (기록 조회)
    path('api/admin_tools/', include('admin_tools.urls')),  # admin_tools 앱 (관리자)
 ] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
