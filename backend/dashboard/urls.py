# backend/dashboard/urls.py (유지)

from django.urls import path
from . import views
from .views import UserDashboardMainView, PatientListView, FolderListView, RecordListView, RecordDetailView

urlpatterns = [
    # 모든 사용자가 자신의 '기록 목록'을 조회하는 공통 경로
    path('records/', views.RecordListView.as_view(), name='record_list'),

    # 모든 사용자가 자신의 '기록 상세'를 조회하는 공통 경로
    path('records/<int:pk>/', views.RecordDetailView.as_view(), name='record_detail'),

    # 메인화면
    path('main/', UserDashboardMainView.as_view(), name='dashboard_main'),
path("patients/", PatientListView.as_view()),
    path("folders/", FolderListView.as_view()),
    path("records/", RecordListView.as_view()),
    path("records/<int:pk>/", RecordDetailView.as_view()),


]