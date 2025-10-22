# /Users/tasha/Projects/Early_Dot_Project/backend/dashboard/serializers.py

from rest_framework import serializers
# 💡 Photos 모델과 DiseaseInfo 모델 임포트 (모델 경로가 diagnosis 앱이라고 가정)
from diagnosis.models import Results, Photos, DiseaseInfo
from .models import FollowUpCheck

# -----------------------------------
# 💡 0. 중첩 시리얼라이저 정의 (Photos 모델 사용)
# -----------------------------------
class PhotosSerializer(serializers.ModelSerializer):
    """ResultMainSerializer에서 Photos 정보를 중첩하기 위한 시리얼라이저"""
    class Meta:
        # 🔴 모델명 Photos 사용
        model = Photos
        # MainPage에 필요한 Photos 필드만 정의합니다.
        fields = ['body_part', 'folder_name', 'capture_date', 'upload_storage_path']

class DiseaseInfoSerializer(serializers.ModelSerializer):
    """ResultMainSerializer에서 DiseaseInfo 정보를 중첩하기 위한 시리얼라이저"""
    class Meta:
        model = DiseaseInfo
        # MainPage에 필요한 DiseaseInfo 필드만 정의합니다.
        fields = ['name_ko']
# -----------------------------------


# 1. FollowUpCheck (의사 소견) 시리얼라이저
class FollowUpCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = FollowUpCheck
        fields = ['current_status', 'doctor_risk_level', 'doctor_note']

# 2. DiagnosisResult (MainPage의 History Card 데이터) 시리얼라이저
class ResultMainSerializer(serializers.ModelSerializer):
    # 🔴 PhotosSerializer 사용
    photo = PhotosSerializer(read_only=True)
    disease = DiseaseInfoSerializer(read_only=True)

    # FollowUpCheck 역참조 필드 추가 (OneToOne)
    followup_check = FollowUpCheckSerializer(read_only=True, required=False) # key가 'followup_check'

    class Meta:
        model = Results
        fields = ['id', 'photo', 'disease', 'analysis_date', 'risk_level', 'vlm_analysis_text', 'followup_check']


# 3. 메인 페이지 최종 응답 구조를 위한 시리얼라이저 (데이터 구조를 확정할 때 유용)
class MainDashboardSerializer(serializers.Serializer):
    summary = serializers.DictField()
    history = ResultMainSerializer(many=True)