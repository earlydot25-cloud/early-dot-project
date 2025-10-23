# backend/diagnosis/serializers.py

from rest_framework import serializers
from .models import Photos
import os
from datetime import datetime


class PhotoUploadSerializer(serializers.ModelSerializer):
    """
    이미지 업로드 전용 시리얼라이저.
    React(프론트)에서 FormData로 보낸 이미지 및 정보(body_part 등)를 받아
    Photos 테이블에 저장합니다.
    """

    # user는 request.user로 자동 주입되므로 프론트에서는 안 보냄
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Photos
        fields = [
            'id',
            'user',
            'upload_storage_path',   # 파일 (FormData key와 일치해야 함)
            'body_part',
            'symptoms_itch',
            'symptoms_pain',
            'symptoms_color',
            'symptoms_infection',
            'symptoms_blood',
            'onset_date',
            'meta_age',
            'meta_sex',
            'folder_name',           # 자동 생성
            'file_name',             # 자동 생성
        ]
        read_only_fields = ['folder_name', 'file_name']

    # ✅ 파일 저장 시 folder_name / file_name 자동 생성
    def create(self, validated_data):
        """
        1) 업로드된 파일 이름에 user.id를 반영하여 폴더 구조를 정리합니다.
           → uploads/<user.id>/<파일명>
        2) DB 저장 후 file_name / folder_name을 자동으로 채웁니다.
        """
        user = validated_data.get('user', None)
        file_field = validated_data.get('upload_storage_path', None)

        # 1️⃣ 실제 저장 경로를 user.id 기반으로 설정
        if user and file_field:
            original_name = os.path.basename(file_field.name)
            file_field.name = f"{user.id}/{original_name}"

        # 2️⃣ DB에 우선 저장
        photo = super().create(validated_data)

        # 3️⃣ 저장 완료 후 file_name / folder_name 자동 채움
        photo.file_name = os.path.basename(photo.upload_storage_path.name)
        uname = getattr(user, 'name', None) or getattr(user, 'email', 'user')
        photo.folder_name = f"{uname}_{datetime.now().strftime('%y')}"
        photo.save(update_fields=['file_name', 'folder_name'])

        return photo


class PhotoDetailSerializer(serializers.ModelSerializer):
    """
    저장된 사진의 상세 정보를 보여주는 시리얼라이저.
    """
    user = serializers.StringRelatedField()  # user의 이름(또는 __str__)으로 표시

    class Meta:
        model = Photos
        fields = '__all__'
