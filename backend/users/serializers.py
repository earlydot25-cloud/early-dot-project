# backend/users/serializers.py
from uuid import uuid4
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core import exceptions as django_exceptions
from django.core.files.storage import default_storage
from rest_framework import serializers
from .models import Doctors
from diagnosis.models import Results


User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    # Users ←(OneToOne/ForeignKey related_name='doctor')→ Doctors
    # 응답에서 의사 프로필 pk만 정수로 노출
    doctor_uid = serializers.IntegerField(source='doctor.id', read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'name',
            'sex',
            'age',
            'family_history',
            'is_doctor',
            'doctor_uid',
        )


class RegisterSerializer(serializers.ModelSerializer):
    # 권고 가입 식별코드(선택)
    referral_uid = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    # 의사 전용 입력(Users 모델 필드 아님 → create 전에 pop)
    specialty = serializers.CharField(write_only=True, required=False, allow_blank=True)
    hospital = serializers.CharField(write_only=True, required=False, allow_blank=True)
    license_file = serializers.FileField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = (
            "email", "password", "name", "sex", "age", "family_history",
            "is_doctor", "specialty", "hospital", "license_file", "referral_uid",
        )
        extra_kwargs = {
            "password": {"write_only": True},
        }

    # --------- helpers ---------
    def _to_bool(self, v):
        if isinstance(v, bool):
            return v
        if v is None:
            return False
        return str(v).strip().lower() in ("1", "true", "yes", "y")

    @staticmethod
    def _norm_sex(v):
        """sex 정규화 → 'M' / 'F'만 허용"""
        if v is None:
            return None
        s = str(v).strip().upper()
        if s in ("M", "MALE", "남", "남성"):
            return "M"
        if s in ("F", "FEMALE", "여", "여성"):
            return "F"
        return None

    @staticmethod
    def _norm_fh(v):
        """family_history 정규화: None/빈값 → 'N', 그 외 'Y'/'U'만 유지"""
        if v in (None, "", "null"):
            return "N"
        s = str(v).strip().upper()
        if s in ("Y", "YES", "있음"):
            return "Y"
        if s in ("U", "UNKNOWN", "모름"):
            return "U"
        return "N"

    # --------- validation ---------
    def validate(self, attrs):
        # 0) 비밀번호 정책
        try:
            validate_password(attrs.get("password") or "")
        except django_exceptions.ValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})

        # 1) sex / family_history 정규화
        attrs["sex"] = self._norm_sex(self.initial_data.get("sex", attrs.get("sex")))
        attrs["family_history"] = self._norm_fh(self.initial_data.get("family_history", attrs.get("family_history")))

        # 2) 공통 필수
        required = ["email", "password", "name", "sex", "age"]
        missing = [k for k in required if not attrs.get(k)]
        if missing:
            raise serializers.ValidationError({k: ["이 필드는 필수입니다."] for k in missing})

        # 3) 이메일 중복
        if User._default_manager.filter(email=attrs["email"]).exists():
            raise serializers.ValidationError({"email": ["이미 사용 중입니다."]})

        # 4) 의사/환자 분기 (여기서는 절대 return 하지 말 것!)
        is_doctor = self._to_bool(self.initial_data.get("is_doctor", attrs.get("is_doctor", False)))
        attrs["is_doctor"] = is_doctor

        if is_doctor:
            # 의사 필수 3종
            specialty = self.initial_data.get("specialty") or attrs.get("specialty")
            hospital = self.initial_data.get("hospital") or attrs.get("hospital")
            license_file = self.initial_data.get("license_file") or attrs.get("license_file")
            if not specialty or not hospital or license_file is None:
                raise serializers.ValidationError({"doctor": ["specialty / hospital / license_file 모두 필요합니다."]})
            # ⚠ 여기서 return 금지
        else:
            # 환자 권고가입 uid 검증 (있을 때만)
            ref_raw = self.initial_data.get("referral_uid", attrs.get("referral_uid"))
            if ref_raw not in (None, "", "null"):
                try:
                    n = int(ref_raw)
                    if n <= 0:
                        raise ValueError()
                except ValueError:
                    raise serializers.ValidationError({"referral_uid": ["식별 코드는 양의 정수여야 합니다."]})
                doctor_obj = Doctors.objects.filter(uid=n).first()
                if not doctor_obj:
                    raise serializers.ValidationError({"referral_uid": ["유효하지 않은 의사 식별번호(uid)입니다."]})
                attrs["doctor"] = doctor_obj
            else:
                attrs.pop("doctor", None)

        # ✅ 모든 분기 끝난 후 "항상" attrs 리턴
        assert isinstance(attrs, dict), "internal: attrs must be dict"
        return attrs

    def create(self, validated_data):
        # 1️⃣ 공통 필드 분리
        is_doctor = validated_data.pop("is_doctor", False)
        doctor_obj = validated_data.pop("doctor", None)
        validated_data.pop("referral_uid", None)
        password = validated_data.pop("password")

        # 2️⃣ Users 모델에 없는 의사 전용 필드 제거
        specialty = validated_data.pop("specialty", None)
        hospital = validated_data.pop("hospital", None)
        license_file = validated_data.pop("license_file", None)

        # 3️⃣ Users 객체 생성
        user = User.objects.create(**validated_data, is_doctor=is_doctor)
        user.set_password(password)
        user.save()

        # 4️⃣ 환자 권고가입인 경우 doctor FK 연결

        if is_doctor:
            saved_path = None

        if license_file:
            # certs/<doctor_user_id>/<uuid>_원본파일명
            #orig = os.path.basename(getattr(license_file, "name", "license"))
            #filename = f"certs/{user.id}/{uuid4().hex}_{orig}"
            #saved_path = default_storage.save(filename, license_file)

            Doctors.objects.create(
                uid=user,
                name=user.name,
                specialty=specialty or "",
                hospital=hospital or "",
                cert_path=license_file,  # ← 업로드 파일 객체를 그대로 전달
                status="pending",
            )

        return user


# -----------------------------------
# 1. DoctorProfileSerializer (Doctors 모델)
# -----------------------------------
class DoctorProfileSerializer(serializers.ModelSerializer):
    """Users 모델에 중첩될 Doctors 정보"""

    class Meta:
        model = Doctors
        fields = ['specialty', 'hospital', 'status']

    # -----------------------------------


# 2. PatientListItemSerializer (의사가 보는 환자 목록)
# -----------------------------------
class PatientListItemSerializer(serializers.ModelSerializer):
    """의사에게 할당된 환자 목록의 간소화된 정보"""

    class Meta:
        model = User
        fields = ['id', 'email', 'name']


# -----------------------------------
# 3. UserProfileSerializer (GET 요청 응답 구조)
# -----------------------------------
class UserProfileSerializer(serializers.ModelSerializer):
    """마이페이지(ProfilePage)에 필요한 모든 사용자 정보 (읽기 전용)"""

    # doctor_profile = DoctorProfileSerializer(source='doctor', read_only=True, required=False)
    # assigned_doctor = serializers.SerializerMethodField(required=False)
    # patients = serializers.SerializerMethodField(required=False)

    class Meta:
        model = User
        # 'phone', 'address' 필드는 Users 모델에 실제 존재해야 합니다.
        fields = ['id', 'email', 'name', 'sex', 'age', 'family_history', 'is_doctor'
                  ]
        read_only_fields = ['email', 'is_doctor', 'date_joined']

    def get_assigned_doctor(self, obj: User):
        """환자일 경우, 연결된 담당 의사 정보(Doctors 객체)를 가져옵니다."""
        if not obj.is_doctor and obj.doctor:
            try:
                return {
                    'id': obj.doctor.uid.id,
                    'name': obj.doctor.name,
                    'specialty': obj.doctor.specialty,
                    'hospital': obj.doctor.hospital,
                }
            except Exception as e:
                # 임시 디버깅용: 오류 발생 시 None 반환
                print(f"Error in get_assigned_doctor: {e}")
                return None
        return None

    def get_patients(self, obj: User):
        """의사일 경우, 담당하는 환자 목록을 가져옵니다."""
        if obj.is_doctor and hasattr(obj, 'doctor'):
            # 쿼리 로직을 모두 건너뛰고 빈 리스트 반환
            return []

        return []


# -----------------------------------
# 4. UserProfileUpdateSerializer (PATCH 요청 처리)
# -----------------------------------
class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """프로필 정보 수정을 위한 시리얼라이저 (PATCH)"""

    specialty = serializers.CharField(write_only=True, required=False, allow_blank=True)
    hospital = serializers.CharField(write_only=True, required=False, allow_blank=True)
    assigned_doctor_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['specialty', 'hospital', 'assigned_doctor_name']

    def update(self, instance, validated_data):
        # 2. 의사 전용 필드 업데이트 (Doctors 모델)
        if instance.is_doctor and instance.doctor:
            doctor_profile = instance.doctor
            doctor_profile.specialty = validated_data.get('specialty', doctor_profile.specialty)
            doctor_profile.hospital = validated_data.get('hospital', doctor_profile.hospital)
            doctor_profile.save()

        # 3. 환자 전용 필드 업데이트 (담당의사 연결)
        elif not instance.is_doctor and 'assigned_doctor_name' in validated_data:
            assigned_doctor_name = validated_data.pop('assigned_doctor_name').strip()

            # 🚨 입력된 이름이 있다면 연결 로직 실행
            if assigned_doctor_name:
                doctor_user = User.objects.filter(
                    is_doctor=True,
                    name=assigned_doctor_name
                ).first()

                if doctor_user and doctor_user.doctor:
                    instance.doctor = doctor_user.doctor
                else:
                    raise serializers.ValidationError({
                        "assigned_doctor_name": [f"이름이 '{assigned_doctor_name}'인 등록된 의사를 찾을 수 없습니다."]
                    })
            else:
                instance.doctor = None

        # 4. 모든 변경 사항 저장
        instance.save()

        return instance