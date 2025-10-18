# backend/admin_tools/urls.py

from django.urls import path
from . import views

urlpatterns = [
    # 1. 의사 승인 관리
    path('doctors/pending/', views.PendingDoctorListView.as_view(), name='pending_doctors'),  # GET: 승인 대기 의사 목록
    path('doctors/approve/<int:pk>/', views.DoctorApprovalView.as_view(), name='approve_doctor'),  # POST: 의사 승인 처리

    # 2. 전체 사용자 및 기록 조회 (관리자용)
    path('users/', views.UserManagementView.as_view(), name='manage_users'),  # GET: 전체 사용자 목록
]

# 최종 URL 예시: /api/mng/doctors/pending/