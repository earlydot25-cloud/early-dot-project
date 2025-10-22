# backend/diagnosis/serializers.py

from rest_framework import serializers
from .models import Photos


class PhotoUploadSerializer(serializers.ModelSerializer):
    """
    이미지 업로드 전용 시리얼라이저.
    React(프론트)에서 'image'와 'body_part' 등 Photos 모델 필드를 받는다고 가정합니다.
    """

    # user 필드를 읽기 전용으로 설정 (request.user에서 받아올 것이기 때문)
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Photos

        # 🌟 중요: React의 FormData.append()에서 사용하는 'key'와 일치해야 함
        # 'user'는 request에서 직접 받아 처리하므로 'fields'에 포함시키되,
        # 'read_only_fields'로 지정하여 유효성 검사에서는 제외할 수 있습니다.
        # 하지만 여기서는 'fields'에서 'user'를 아예 빼고, view에서 직접 주입하는 것이 더 명확합니다.

        # 'capture_date'는 auto_now_add=True이므로 제외
        fields = [
            'id',
            'image',
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

        # (참고) 만약 프론트에서 'image'와 'body_part'만 먼저 보낸다면,
        # 'fields'를 ['id', 'image', 'body_part']로 줄이면 됩니다.
        # (이 경우, 나머지 필드들은 models.py에서 null=True, blank=True여야 함)


class PhotoDetailSerializer(serializers.ModelSerializer):
    """
    (선택 사항) 저장된 사진의 상세 정보를 보여줄 때 사용
    """
    user = serializers.StringRelatedField()  # ID 대신 사용자 이름(username)을 보여줌

    class Meta:
        model = Photos
        fields = '__all__'  # 모든 필드를 보여줌
