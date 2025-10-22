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

from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # 1. API 라우팅 (API prefix만 사용)
    path('api/auth/', include('users.urls')),  # users 앱 (인증)
    path('api/diagnosis/', include('diagnosis.urls')),  # diagnosis 앱 (실시간 진단)
    path('api/dashboard/', include('dashboard.urls')),  # dashboard 앱 (기록 조회)
    path('api/admin_tools/', include('admin_tools.urls')),  # admin_tools 앱 (관리자)

    # 2. React 라우팅: API가 아닌 모든 요청은 React의 index.html로 전달
    #    (정규식에서 'api/'로 시작하지 않는 모든 경로를 잡도록 수정)
    # 이거는 개발 후에 수정하는 것
    #re_path(r'^(?!api/).*$', TemplateView.as_view(template_name='index.html'), name='react_app'),
]
# *****************************************
# 2. MEDIA 파일 서빙 설정 (DEBUG=True 일 때만)
# *****************************************
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)