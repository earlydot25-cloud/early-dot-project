# backend/dashboard/urls.py (유지)

from django.urls import path
from . import views

urlpatterns = [
    # 모든 사용자가 자신의 '기록 목록'을 조회하는 공통 경로
    path('records/', views.RecordListView.as_view(), name='record_list'),

    # 모든 사용자가 자신의 '기록 상세'를 조회하는 공통 경로
    path('records/<int:pk>/', views.RecordDetailView.as_view(), name='record_detail'),

    # 메인 화면 데이터 요약 (권한에 따라 내용이 다름)
    path('summary/', views.DashboardSummaryView.as_view(), name='dashboard_summary'),
]