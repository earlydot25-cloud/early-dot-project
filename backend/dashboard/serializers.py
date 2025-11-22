# /Users/tasha/Projects/Early_Dot_Project/backend/dashboard/serializers.py
from datetime import date

from rest_framework import serializers
from diagnosis.models import Results, Photos, DiseaseInfo
from users.models import Users  # 🔴 Users 모델 임포트
from .models import FollowUpCheck


# -----------------------------------
# 💡 0. 중첩 시리얼라이저 정의 (Photos, DiseaseInfo, Users 모델 사용)
# -----------------------------------
class PhotosSerializer(serializers.ModelSerializer):
    """ResultMainSerializer에서 Photos 정보를 중첩하기 위한 시리얼라이저 (환자용)"""
    
    upload_storage_path = serializers.SerializerMethodField()

    class Meta:
        model = Photos
        fields = ['id', 'body_part', 'folder_name', 'file_name', 'capture_date', 'upload_storage_path']
    
    def get_upload_storage_path(self, obj):
        """이미지 URL을 절대 경로로 변환"""
        if obj.upload_storage_path:
            url = obj.upload_storage_path.url
            if url.startswith('http'):
                return url
            # 상대 경로를 절대 경로로 변환
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(url)
            return f"http://127.0.0.1:8000{url}"
        return ''


# 🔴 신규: Photos만 있는 경우를 위한 시리얼라이저 (Results 없을 때)
class PhotoOnlySerializer(serializers.ModelSerializer):
    """Results가 없는 Photos를 표시하기 위한 시리얼라이저"""
    
    photo = PhotosSerializer(source='*', read_only=True)
    
    class Meta:
        model = Photos
        fields = ['id', 'photo']
        
    def to_representation(self, instance):
        """Photos 객체를 Results 형태로 변환"""
        return {
            'id': instance.id,
            'photo': {
                'id': instance.id,
                'folder_name': instance.folder_name,
                'file_name': instance.file_name,
                'body_part': instance.body_part,
                'capture_date': instance.capture_date.isoformat() if instance.capture_date else None,
                'upload_storage_path': instance.upload_storage_path.url if instance.upload_storage_path else '',
            },
            'disease': None,  # Results가 없으므로 None
            'analysis_date': instance.capture_date.isoformat() if instance.capture_date else None,
            'risk_level': '분석 대기',  # Results가 없으므로 기본값
            'vlm_analysis_text': None,
            'followup_check': None,
        }


class DiseaseInfoSerializer(serializers.ModelSerializer):
    """ResultMainSerializer에서 DiseaseInfo 정보를 중첩하기 위한 시리얼라이저"""

    class Meta:
        model = DiseaseInfo
        fields = ['name_ko', 'name_en']

# 🔴 신규: 의사 화면에 필요한 환자 정보 (Users 모델 사용)
# 🔴 신규: 의사 화면에 필요한 환자 정보 (Users 모델 사용)
class UserSimpleSerializer(serializers.ModelSerializer):
    """의사 대시보드에 필요한 환자의 간단 정보 시리얼라이저"""

    # 💡 만 나이 계산을 위한 SerializerMethodField 추가
    calculated_age = serializers.SerializerMethodField()

    class Meta:
        model = Users
        # 기존 age 대신 calculated_age를 포함하도록 fields 수정
        # ⚠️ Users 모델에 date_of_birth 필드가 있다고 가정합니다.
        fields = ['name', 'calculated_age', 'family_history'] # 'age' 필드는 제거 또는 유지 가능

    def get_calculated_age(self, obj):
        """Users 객체에서 생년월일(birth_date)을 기반으로 만 나이를 계산합니다."""
        # birth_date가 있으면 만 나이 계산
        if hasattr(obj, 'birth_date') and obj.birth_date:
            try:
                today = date.today()
                # 만 나이 계산 공식: (오늘 연도 - 생일 연도) - (생일이 지나지 않았으면 1)
                age = today.year - obj.birth_date.year - (
                    (today.month, today.day) < (obj.birth_date.month, obj.birth_date.day)
                )
                return age
            except (AttributeError, TypeError) as e:
                # birth_date가 날짜 객체가 아닌 경우 (예: 정수로 저장된 경우)
                print(f"[UserSimpleSerializer] birth_date 처리 오류: {type(obj.birth_date)} - {str(e)}")
                # age 필드가 있으면 그대로 사용
                if hasattr(obj, 'age') and obj.age:
                    return obj.age
                return None
        # birth_date가 없으면 age 필드 사용
        elif hasattr(obj, 'age') and obj.age:
            return obj.age
        return None # 생년월일 정보가 없으면 None 반환

# 🔴 신규: 의사 화면에 필요한 증상 정보 (Photos 모델 사용)
class PhotoSymptomsSerializer(serializers.ModelSerializer):
    """의사 대시보드 카드 하단에 표시될 증상 정보 시리얼라이저"""
    
    upload_storage_path = serializers.SerializerMethodField()

    class Meta:
        model = Photos
        # 상처로 인한 감염, 통증, 가려움 태그를 위한 필드
        fields = ['body_part', 'folder_name', 'capture_date', 'onset_date', 'symptoms_itch', 'symptoms_pain',
                  'symptoms_infection']
    
    def to_representation(self, instance):
        """날짜 필드를 안전하게 처리"""
        data = super().to_representation(instance)
        # capture_date가 datetime 객체인 경우 ISO 형식으로 변환
        if instance.capture_date:
            try:
                if hasattr(instance.capture_date, 'isoformat'):
                    data['capture_date'] = instance.capture_date.isoformat()
                elif isinstance(instance.capture_date, str):
                    data['capture_date'] = instance.capture_date
                else:
                    data['capture_date'] = str(instance.capture_date)
            except (AttributeError, TypeError) as e:
                print(f"[PhotoSymptomsSerializer] capture_date 처리 오류: {type(instance.capture_date)} - {str(e)}")
                data['capture_date'] = str(instance.capture_date) if instance.capture_date else None
        else:
            data['capture_date'] = None
        
        # onset_date는 CharField이므로 그대로 사용
        data['onset_date'] = instance.onset_date if hasattr(instance, 'onset_date') else None
        
        return data


# 🔴 신규: 상세 페이지용 Photo 시리얼라이저 (모든 증상 필드 포함)
class PhotoDetailSerializer(serializers.ModelSerializer):
    """상세 페이지에서 사용하는 Photo 시리얼라이저"""
    
    upload_storage_path = serializers.SerializerMethodField()

    class Meta:
        model = Photos
        fields = [
            'id', 'folder_name', 'file_name', 'body_part', 'capture_date',
            'upload_storage_path', 'symptoms_itch', 'symptoms_pain', 'symptoms_color',
            'symptoms_infection', 'symptoms_blood', 'onset_date', 'meta_age', 'meta_sex'
        ]
    
    def get_upload_storage_path(self, obj):
        """이미지 URL을 절대 경로로 변환"""
        if obj.upload_storage_path:
            url = obj.upload_storage_path.url
            if url.startswith('http'):
                return url
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(url)
            return f"http://127.0.0.1:8000{url}"
        return ''


# 🔴 신규: 상세 페이지용 Disease 시리얼라이저
class DiseaseDetailSerializer(serializers.ModelSerializer):
    """상세 페이지에서 사용하는 Disease 시리얼라이저"""
    
    class Meta:
        model = DiseaseInfo
        fields = ['name_ko', 'name_en', 'classification', 'description', 'recommendation']
    
    def to_representation(self, instance):
        """DiseaseInfo 인스턴스를 직렬화"""
        if instance is None:
            return None
        return super().to_representation(instance)


# 1. FollowUpCheck (의사 소견) 시리얼라이저
class FollowUpCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = FollowUpCheck
        fields = ['current_status', 'doctor_risk_level', 'doctor_note', 'last_updated_at']


# 🔴 신규: 상세 페이지용 Result 시리얼라이저
class ResultDetailSerializer(serializers.ModelSerializer):
    """상세 페이지에서 사용하는 Result 시리얼라이저"""
    
    photo = PhotoDetailSerializer(read_only=True)
    disease = DiseaseDetailSerializer(read_only=True, allow_null=True)
    followup_check = FollowUpCheckSerializer(read_only=True, required=False)
    user = serializers.SerializerMethodField()
    grad_cam_path = serializers.SerializerMethodField()
    
    class Meta:
        model = Results
        fields = [
            'id', 'photo', 'disease', 'analysis_date', 'risk_level', 'class_probs',
            'grad_cam_path', 'vlm_analysis_text', 'followup_check', 'user'
        ]
    
    def to_representation(self, instance):
        """Results 인스턴스를 직렬화할 때 disease가 None이 아닌지 확인"""
        data = super().to_representation(instance)
        
        # 디버깅: disease 필드 확인
        if hasattr(instance, 'disease') and instance.disease:
            print(f"[ResultDetailSerializer] Disease 존재: {instance.disease.name_ko} (ID: {instance.disease.id})")
        else:
            print(f"[ResultDetailSerializer] ⚠️ Disease가 None입니다!")
        
        return data
    
    def get_user(self, obj):
        """환자 정보 가져오기"""
        user = obj.photo.user
        # Photos에서 메타 정보 사용 (없으면 Users 모델의 정보 사용)
        photo = obj.photo
        return {
            'name': user.name or user.email,
            'sex': photo.meta_sex if photo.meta_sex else (user.sex if hasattr(user, 'sex') else '모름'),
            'age': photo.meta_age if photo.meta_age else (user.age if hasattr(user, 'age') else None),
            'family_history': user.family_history if hasattr(user, 'family_history') else '없음',
        }
    
    def get_grad_cam_path(self, obj):
        """GradCAM 이미지 URL 생성"""
        if obj.grad_cam_path:
            url = obj.grad_cam_path.url
            if url.startswith('http'):
                return url
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(url)
            return f"http://127.0.0.1:8000{url}"
        return ''


# 2. DiagnosisResult (MainPage/DoctorMainPage의 History Card 데이터) 시리얼라이저
class ResultMainSerializer(serializers.ModelSerializer):
    # 🔴 photo 필드 추가 (HistoryDetailPage에서 필요)
    photo = PhotosSerializer(read_only=True)
    disease = DiseaseInfoSerializer(read_only=True)
    followup_check = FollowUpCheckSerializer(read_only=True, required=False)

    class Meta:
        model = Results
        fields = ['id', 'photo', 'disease', 'analysis_date', 'risk_level', 'vlm_analysis_text', 'followup_check']


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
