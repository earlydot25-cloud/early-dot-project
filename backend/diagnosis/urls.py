# # backend/diagnosis/urls.py
#
# from django.urls import path
# from . import views
#
# urlpatterns = [
#     # 1. 이미지 업로드 (ncp 저장) 및 진단 요청 시작
#     path('upload/', views.ImageUploadView.as_view(), name='image_upload'),  # POST: 이미지 업로드
#
#     # 2. 모델 예측 요청 (FastAPI 연동)
#     path('predict/', views.ModelPredictionView.as_view(), name='model_predict'),  # POST: 이미지 ID를 받아 모델 실행
# ]
#
# # 최종 URL 예시: /api/diag/predict/

# backend/diagnosis/urls.py

from django.urls import path
# 중요: views.py에서 PhotoUploadView를 import 합니다.
from .views import PhotoUploadView

# (만약 ModelPredictionView도 사용한다면 함께 import)
# from .views import PhotoUploadView, ModelPredictionView

app_name = 'diagnosis'

urlpatterns = [
    # 중요: path('upload/', ...)
    # React(프론트)에서 /api/diag/upload/ (가정) 주소로 POST 요청을 보낼 때,
    # PhotoUploadView(views.py의 클래스)가 실행되도록 연결합니다.
    path('upload/', PhotoUploadView.as_view(), name='photo-upload'),

    # (기존 임시 URL 주석 처리)
    # path('upload/', ImageUploadView.as_view(), name='image-upload'),

    # (ModelPredictionView를 위한 URL은 그대로 둡니다)
    # path('predict/', ModelPredictionView.as_view(), name='model-predict'),
]

