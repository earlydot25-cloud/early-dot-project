# backend/admin_tools/serializers.py

from rest_framework import serializers
from users.models import Doctors


class DoctorApplicationSerializer(serializers.ModelSerializer):
    """관리자가 의사 가입 신청을 조회/승인/거절할 때 사용하는 시리얼라이저"""
    
    # Users 모델의 정보 포함
    user_id = serializers.IntegerField(source='uid.id', read_only=True)
    user_email = serializers.EmailField(source='uid.email', read_only=True)
    user_name = serializers.CharField(source='uid.name', read_only=True)
    
    # 인증서 파일 URL
    cert_file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Doctors
        fields = [
            'user_id',
            'user_email',
            'user_name',
            'name',
            'specialty',
            'hospital',
            'status',
            'rejection_reason',
            'cert_path',
            'cert_file_url',
        ]
        read_only_fields = ['status', 'rejection_reason']
    
    def get_cert_file_url(self, obj):
        """인증서 파일의 절대 URL 반환"""
        if obj.cert_path and hasattr(obj.cert_path, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.cert_path.url)
            return obj.cert_path.url
        return None

