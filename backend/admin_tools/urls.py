# backend/admin_tools/urls.py

from django.urls import path
from . import views

urlpatterns = [
    # 1. 의사 목록 조회 (status 필터: all/pending/approved/rejected)
    path('doctors/', views.DoctorListView.as_view(), name='doctor_list'),
    
    # 2. 의사 승인/거절
    path('doctors/approve/<int:pk>/', views.DoctorApprovalView.as_view(), name='approve_doctor'),
    path('doctors/reject/<int:pk>/', views.DoctorRejectionView.as_view(), name='reject_doctor'),
    
    # 3. 의사 증빙서류 다운로드
    path('doctors/<int:pk>/cert/', views.DoctorCertDownloadView.as_view(), name='doctor_cert_download'),
]

# 최종 URL 예시: 
# GET /api/admin_tools/doctors/?status=all
# GET /api/admin_tools/doctors/?status=pending
# POST /api/admin_tools/doctors/approve/1/
# POST /api/admin_tools/doctors/reject/1/
# GET /api/admin_tools/doctors/1/cert/