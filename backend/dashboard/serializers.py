# /Users/tasha/Projects/Early_Dot_Project/backend/dashboard/serializers.py

from rest_framework import serializers
from diagnosis.models import Results, Photos, DiseaseInfo
from users.models import Users  # 🔴 Users 모델 임포트
from .models import FollowUpCheck


# -----------------------------------
# 💡 0. 중첩 시리얼라이저 정의 (Photos, DiseaseInfo, Users 모델 사용)
# -----------------------------------
class PhotosSerializer(serializers.ModelSerializer):
    """ResultMainSerializer에서 Photos 정보를 중첩하기 위한 시리얼라이저 (환자용)"""

    class Meta:
        model = Photos
        fields = ['body_part', 'folder_name', 'capture_date', 'upload_storage_path']


class DiseaseInfoSerializer(serializers.ModelSerializer):
    """ResultMainSerializer에서 DiseaseInfo 정보를 중첩하기 위한 시리얼라이저"""

    class Meta:
        model = DiseaseInfo
        fields = ['name_ko']


# 🔴 신규: 의사 화면에 필요한 환자 정보 (Users 모델 사용)
class UserSimpleSerializer(serializers.ModelSerializer):
    """의사 대시보드에 필요한 환자의 간단 정보 시리얼라이저"""

    class Meta:
        model = Users
        # 만 45세, 가족력: 있음 표시를 위한 필드
        fields = ['name', 'age', 'family_history']


# 🔴 신규: 의사 화면에 필요한 증상 정보 (Photos 모델 사용)
class PhotoSymptomsSerializer(serializers.ModelSerializer):
    """의사 대시보드 카드 하단에 표시될 증상 정보 시리얼라이저"""

    class Meta:
        model = Photos
        # 상처로 인한 감염, 통증, 가려움 태그를 위한 필드
        fields = ['body_part', 'folder_name', 'capture_date', 'onset_date', 'symptoms_itch', 'symptoms_pain',
                  'symptoms_infection']
    # -----------------------------------


# 1. FollowUpCheck (의사 소견) 시리얼라이저
class FollowUpCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = FollowUpCheck
        fields = ['current_status', 'doctor_risk_level', 'doctor_note']


# 2. DiagnosisResult (MainPage/DoctorMainPage의 History Card 데이터) 시리얼라이저
class ResultMainSerializer(serializers.ModelSerializer):
    # 🔴 photo 필드는 DoctorCardSerializer에서 재정의할 수 있도록 임시로 제거
    disease = DiseaseInfoSerializer(read_only=True)
    followup_check = FollowUpCheckSerializer(read_only=True, required=False)

    class Meta:
        model = Results
        fields = ['id', 'disease', 'analysis_date', 'risk_level', 'vlm_analysis_text', 'followup_check']


# 🔴 신규: 의사 대시보드용 Result 시리얼라이저
class DoctorCardSerializer(ResultMainSerializer):
    # 🔴 환자 정보 (Users) 역참조: photo.user를 통해 접근해야 함
    #    - SerializerMethodField를 사용하여 photo__user 정보를 가져옵니다.
    patient = serializers.SerializerMethodField()

    # 🔴 Photos 정보 재정의: 증상 필드를 포함하도록 변경
    photo = PhotoSymptomsSerializer(read_only=True)

    def get_patient(self, obj):
        """Result 객체에서 연결된 Photo 객체의 User 정보를 가져옵니다."""
        # obj는 Results 인스턴스입니다.
        user = obj.photo.user  # photo__user 연결
        # UserSimpleSerializer를 사용하여 필요한 필드만 직렬화합니다.
        return UserSimpleSerializer(user).data

    class Meta(ResultMainSerializer.Meta):
        # ResultMainSerializer의 필드를 상속받고, patient와 photo 필드를 추가
        fields = ResultMainSerializer.Meta.fields + ['patient', 'photo']


# 3. 메인 페이지 최종 응답 구조를 위한 시리얼라이저
class MainDashboardSerializer(serializers.Serializer):
    summary = serializers.DictField()
    history = ResultMainSerializer(many=True)  # 환자용


# 🔴 신규: 의사 메인 페이지 최종 응답 구조를 위한 시리얼라이저
class DoctorDashboardSerializer(serializers.Serializer):
    summary = serializers.DictField()
    history = DoctorCardSerializer(many=True)  # 의사 전용 카드 시리얼라이저 사용