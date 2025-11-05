# backend/dashboard/urls.py (유지)

from django.urls import path
from . import views
from .views import UserDashboardMainView, DoctorDashboardMainView

urlpatterns = [
    # 폴더 목록 조회 (GET: /api/dashboard/folders/)
    path('folders/', views.FoldersListView.as_view(), name='folders_list'),
    # 폴더 수정 (PATCH: /api/dashboard/folders/<folder_name>/update/)
    path('folders/<str:folder_name>/update/', views.FolderUpdateView.as_view(), name='folder_update'),
    # 폴더 삭제 (DELETE: /api/dashboard/folders/<folder_name>/delete/)
    path('folders/<str:folder_name>/delete/', views.FolderDeleteView.as_view(), name='folder_delete'),
    # 환자 목록 조회 (의사용) (GET: /api/dashboard/patients/)
    path('patients/', views.PatientsListView.as_view(), name='patients_list'),
    # 모든 사용자가 자신의 '기록 목록'을 조회하는 공통 경로
    path('records/', views.RecordListView.as_view(), name='record_list'),
    # 모든 사용자가 자신의 '기록 상세'를 조회하는 공통 경로
    path('records/<int:pk>/', views.RecordDetailView.as_view(), name='record_detail'),
    # 기록 수정 (PATCH: /api/dashboard/records/<int:pk>/update/)
    path('records/<int:pk>/update/', views.RecordUpdateView.as_view(), name='record_update'),
    # 기록 삭제 (DELETE: /api/dashboard/records/<int:pk>/delete/)
    path('records/<int:pk>/delete/', views.RecordDeleteView.as_view(), name='record_delete'),
    # 일괄 삭제 (DELETE: /api/dashboard/records/bulk/delete/)
    path('records/bulk/delete/', views.BulkDeleteRecordsView.as_view(), name='bulk_delete_records'),
    # 메인화면 - 환자용
    path('main/', UserDashboardMainView.as_view(), name='dashboard_main'),
    # 메인화면 - 의사용
    path('doctor/main/', DoctorDashboardMainView.as_view(), name='doctor-dashboard-main'),

]


