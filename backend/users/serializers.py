# backend/users/serializers.py
from uuid import uuid4
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core import exceptions as django_exceptions
from django.core.files.storage import default_storage
from rest_framework import serializers
from .models import Doctors

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
        if doctor_obj is not None:
            user.doctor = doctor_obj
            user.save()

        # 5️⃣ 의사 본인 가입일 경우 Doctors 프로필 생성
        if is_doctor:
            saved_path = ""
            if license_file:
                filename = f"certs/{uuid4().hex}_{getattr(license_file, 'name', 'license')}"
                saved_path = default_storage.save(filename, license_file)

            Doctors.objects.create(
                uid=user,  # ✅ uid는 ForeignKey(=User) 필드
                name=user.name,
                specialty=specialty or "",
                hospital=hospital or "",
                cert_path=saved_path,  # ✅ 모델 필드명과 일치
                status="pending",
            )

        return user

