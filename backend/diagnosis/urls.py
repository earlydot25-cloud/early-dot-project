# backend/diagnosis/urls.py

from django.urls import path
from . import views

urlpatterns = [
    # 1. 이미지 업로드 (ncp 저장) 및 진단 요청 시작
    path('upload/', views.ImageUploadView.as_view(), name='image_upload'),  # POST: 이미지 업로드

    # 2. 모델 예측 요청 (FastAPI 연동)
    path('predict/', views.ModelPredictionView.as_view(), name='model_predict'),  # POST: 이미지 ID를 받아 모델 실행
]

# 최종 URL 예시: /api/diag/predict/