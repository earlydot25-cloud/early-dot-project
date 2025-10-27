# backend/dashboard/serializers.py
from rest_framework import serializers
from diagnosis.models import Results, Photos, DiseaseInfo
from .models import FollowUpCheck
from users.models import Users


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = Users
        fields = ['name', 'sex', 'age', 'family_history']

# ✅ Photos 시리얼라이저 (DB folder_name 그대로 사용)
class PhotosSerializer(serializers.ModelSerializer):
    class Meta:
        model = Photos
        fields = [
            "body_part",
            "folder_name",
            "upload_storage_path",
            "symptoms_itch",
            "symptoms_pain",
            "symptoms_color",
            "symptoms_infection",
            "symptoms_blood",
            "onset_date",
            "meta_age",
            "meta_sex",
            "capture_date",
        ]


class DiseaseInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiseaseInfo
        fields = ["name_ko", "name_en", "classification", "description", "recommendation"]


class FollowUpCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = FollowUpCheck
        fields = ["current_status", "doctor_risk_level", "doctor_note", "last_updated_at"]


class ResultMainSerializer(serializers.ModelSerializer):
    photo = PhotosSerializer(read_only=True)
    disease = DiseaseInfoSerializer(read_only=True)
    followup_check = FollowUpCheckSerializer(read_only=True, required=False)
    user = serializers.SerializerMethodField()

    class Meta:
        model = Results
        fields = [
            "id",
            "photo",
            "disease",
            "analysis_date",
            "risk_level",
            "vlm_analysis_text",
            "followup_check",
            'photo',
            'user',
            'class_probs',
            'grad_cam_path',
        ]

    def get_user(self, obj):

        try:
            user = obj.photo.user
            return UserSerializer(user).data
        except:
            return None


class MainDashboardSerializer(serializers.Serializer):
    summary = serializers.DictField()
    history = ResultMainSerializer(many=True)

class ResultDetailSerializer(serializers.ModelSerializer):
    """세부질환정보 페이지용 시리얼라이저"""
    photo = PhotosSerializer(read_only=True)
    disease = DiseaseInfoSerializer(read_only=True)
    followup_check = FollowUpCheckSerializer(read_only=True)

    class Meta:
        model = Results
        fields = [
            "id",
            "analysis_date",
            "risk_level",
            "class_probs",
            "grad_cam_path",
            "vlm_analysis_text",
            "photo",
            "disease",
            "followup_check",
        ]