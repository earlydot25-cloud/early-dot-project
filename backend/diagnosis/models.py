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


def build_grad_cam_path(instance, original_filename):
    """
    Grad-CAM 이미지 업로드 경로 생성 함수
    Results는 Photos와 OneToOne 관계이므로 Photos의 user와 folder_name을 사용
    uploads와 동일한 폴더 구조: cams/{user_id}/{folder_name}/image_{photo_id}.png
    """
    # Results는 Photos와 OneToOne 관계이므로 photo를 통해 접근
    if hasattr(instance, 'photo') and instance.photo:
        user_id = instance.photo.user.id if instance.photo.user else 'unknown'
        folder_name = instance.photo.folder_name if hasattr(instance.photo, 'folder_name') else 'default'
        photo_id = instance.photo.id
        # Photo의 file_name도 사용 (일관성 유지)
        photo_file_name = instance.photo.file_name if hasattr(instance.photo, 'file_name') else f'photo_{photo_id}'
    else:
        # 안전한 기본값 (일반적으로 발생하지 않지만 방어 코드)
        user_id = 'unknown'
        folder_name = 'default'
        photo_id = getattr(instance, 'id', 'unknown')
        photo_file_name = f'photo_{photo_id}'
    
    # 확장자: 원본 확장자 유지 (없으면 .png)
    ext = os.path.splitext(original_filename)[1] or '.png'
    
    # 최종 경로: cams/{user_id}/{folder_name}/image_{photo_id}.png
    # uploads 구조와 동일하게: uploads/{user_id}/{folder_name}/{file_name}.jpg
    return f"cams/{user_id}/{folder_name}/image_{photo_id}{ext}"

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

    # 수정된 부분: 3개의 CharField 대신 ImageField를 사용합니다.
    # 'uploads/'는 settings.py의 MEDIA_ROOT 하위 폴더를 의미합니다.
    upload_storage_path = models.ImageField(upload_to=build_upload_path, blank=True, null=True)

    folder_name = models.CharField(max_length=100)
    file_name = models.CharField(max_length=100)

    body_part = models.CharField(max_length=50)
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
    grad_cam_path = models.ImageField(upload_to=build_grad_cam_path, blank=True, null=True)
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
