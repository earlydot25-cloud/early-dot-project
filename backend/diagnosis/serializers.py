# backend/diagnosis/serializers.py

from rest_framework import serializers
from .models import Photos


class PhotoUploadSerializer(serializers.ModelSerializer):
    """
    이미지 업로드 전용 시리얼라이저.
    React(프론트)에서 'upload_storage_path', 'body_part' 등 Photos 모델 필드를 받습니다.
    """

    # user 필드를 읽기 전용으로 설정 (request.user에서 받아올 것이기 때문)
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    
    # meta_age를 문자열로 받아서 정수로 변환
    meta_age = serializers.IntegerField(required=True)

    class Meta:
        model = Photos

        # 🌟 중요: React의 FormData.append()에서 사용하는 'key'와 일치해야 함
        # 'user'는 read_only이지만 fields에 포함해야 합니다.

        # 'capture_date'는 auto_now_add=True이므로 제외
        fields = [
            'id',  # id는 read_only_fields로도 처리
            'user',  # user 필드를 fields에 포함 (read_only로 선언되어 있음)
            'upload_storage_path',  # 모델의 실제 필드명 사용 (ImageField)
            'folder_name',
            'file_name',
            'body_part',
            'symptoms_itch',
            'symptoms_pain',
            'symptoms_color',
            'symptoms_infection',
            'symptoms_blood',
            'onset_date',
            'meta_age',
            'meta_sex'
        ]
        read_only_fields = ['id', 'user']  # id와 user는 읽기 전용
        
    def validate_meta_age(self, value):
        """meta_age 유효성 검사 및 변환"""
        try:
            # 문자열로 들어올 경우 정수로 변환
            if isinstance(value, str):
                return int(value)
            return int(value)
        except (ValueError, TypeError):
            raise serializers.ValidationError("meta_age는 정수여야 합니다.")
    
    def to_representation(self, instance):
        """응답에서 이미지 URL을 절대 경로로 변환"""
        representation = super().to_representation(instance)
        if instance.upload_storage_path:
            url = instance.upload_storage_path.url
            if url.startswith('http'):
                representation['upload_storage_path'] = url
            else:
                request = self.context.get('request')
                if request:
                    representation['upload_storage_path'] = request.build_absolute_uri(url)
                else:
                    representation['upload_storage_path'] = f"http://127.0.0.1:8000{url}"
        return representation


class PhotoDetailSerializer(serializers.ModelSerializer):
    """
    (선택 사항) 저장된 사진의 상세 정보를 보여줄 때 사용
    """
    user = serializers.StringRelatedField()  # ID 대신 사용자 이름(username)을 보여줌

    class Meta:
        model = Photos
        fields = '__all__'  # 모든 필드를 보여줌
