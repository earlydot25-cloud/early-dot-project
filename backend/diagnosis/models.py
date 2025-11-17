# # backend/diagnosis/models.py
#
import os
from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

def build_upload_path(instance, original_filename):
    """
    이미지 업로드 경로 생성 함수
    instance가 아직 저장되지 않았을 수 있으므로 안전하게 처리
    """
    # 사용자 ID (필수)
    storage_folder = instance.user.id if instance.user else 'unknown'
    
    # 폴더명: instance에 있으면 사용, 없으면 기본값
    folder = getattr(instance, 'folder_name', None) or 'default'
    
    # 파일명: instance에 있으면 사용, 없으면 원본 파일명 사용
    if hasattr(instance, 'file_name') and instance.file_name:
        base_name = instance.file_name
    else:
        base_name = os.path.splitext(os.path.basename(original_filename))[0]
    
    # 확장자: 원본 확장자 유지
    ext = os.path.splitext(original_filename)[1] or '.jpg'
    
    # 최종 파일 이름
    final_filename = f"{base_name}{ext}"

    # 최종 경로
    return f"uploads/{storage_folder}/{folder}/{final_filename}"

class DiseaseInfo(models.Model):
    name_ko = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100, blank=True, null=True)
    classification = models.CharField(max_length=20)
    rep_image_path = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    recommendation = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'disease_info'
        verbose_name = '질병 정보'

    def __str__(self):
        return self.name_ko


class Photos(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    # :star2: 수정된 부분 :star2:
    # 3개의 CharField 대신 ImageField를 사용합니다.
    # 'uploads/'는 settings.py의 MEDIA_ROOT 하위 폴더를 의미합니다.
    upload_storage_path = models.ImageField(upload_to=build_upload_path, blank=True, null=True)

    folder_name = models.CharField(max_length=100)
    file_name = models.CharField(max_length=100)

    body_part = models.CharField(max_length=50)
    hair = models.CharField(max_length=20, blank=True, null=True)
    capture_date = models.DateTimeField(auto_now_add=True)
    symptoms_itch = models.TextField(blank=True, null=True)
    symptoms_pain = models.TextField(blank=True, null=True)
    symptoms_color = models.TextField(blank=True, null=True)
    symptoms_infection = models.TextField(blank=True, null=True)
    symptoms_blood = models.TextField(blank=True, null=True)
    onset_date = models.CharField(max_length=50)
    meta_age = models.IntegerField()
    meta_sex = models.CharField(max_length=20)

    class Meta:
        db_table = 'photos'
        verbose_name = '촬영 이미지'

    def __str__(self):
        return f"Photo {self.id} by {self.user.username}"


class Results(models.Model):
    photo = models.OneToOneField(
        Photos,
        on_delete=models.CASCADE,
        related_name='results'
    )
    analysis_date = models.DateTimeField(auto_now_add=True)
    risk_level = models.CharField(max_length=10)
    class_probs = models.JSONField()
    grad_cam_path = models.ImageField(upload_to='cams/', blank=True, null=True)
    vlm_analysis_text = models.TextField(blank=True, null=True)
    disease = models.ForeignKey(
        DiseaseInfo,
        on_delete=models.RESTRICT,
        related_name='results'
    )

    class Meta:
        db_table = 'results'
        verbose_name = '진단 결과'

    def __str__(self):
        return f"Result {self.id} for Photo {self.photo_id}"
