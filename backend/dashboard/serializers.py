# backend/dashboard/serializers.py
from rest_framework import serializers
from diagnosis.models import Results, Photos, DiseaseInfo
from .models import FollowUpCheck


# ✅ Photos 시리얼라이저 (DB folder_name 그대로 사용)
class PhotosSerializer(serializers.ModelSerializer):
    class Meta:
        model = Photos
        fields = [
            "body_part",
            "folder_name",          # DB의 폴더명 그대로
            "capture_date",
            "upload_storage_path",
        ]


class DiseaseInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiseaseInfo
        fields = ["name_ko"]


class FollowUpCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = FollowUpCheck
        fields = ["current_status", "doctor_risk_level", "doctor_note"]


class ResultMainSerializer(serializers.ModelSerializer):
    photo = PhotosSerializer(read_only=True)
    disease = DiseaseInfoSerializer(read_only=True)
    followup_check = FollowUpCheckSerializer(read_only=True, required=False)

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
        ]


class MainDashboardSerializer(serializers.Serializer):
    summary = serializers.DictField()
    history = ResultMainSerializer(many=True)
