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
    # 응답에서 의사 프로필 pk만 정수로 노출 (환자가 배정된 의사 프로필을 가리킴)
    doctor_uid = serializers.IntegerField(source='doctor.id', read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'name',
            'sex',
            'birth_date',
            'age',
            'family_history',
            'is_doctor',
            'doctor_uid',
        )


class RegisterSerializer(serializers.ModelSerializer):
    # 권고 가입 식별코드(선택)
    referral_uid = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    # 프론트엔드에서 YYYY-MM-DD 형식의 문자열로 전송된 값을 Date 객체로 파싱합니다.
    birth_date = serializers.DateField(format="%Y-%m-%d", input_formats=["%Y-%m-%d"], required=True)
    # 의사 전용 입력(Users 모델 필드 아님 → create 전에 pop)
    specialty = serializers.CharField(write_only=True, required=False, allow_blank=True)
    hospital = serializers.CharField(write_only=True, required=False, allow_blank=True)
    license_file = serializers.FileField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = (
            "email", "password", "name", "sex", "age", "family_history",
            "is_doctor", "specialty", "hospital", "license_file", "referral_uid", "birth_date",
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
        print("--- RegisterSerializer.validate START ---")

        # 0) 비밀번호 정책
        try:
            validate_password(attrs.get("password") or "")
        except django_exceptions.ValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})

        # 1) sex / family_history 정규화
        attrs["sex"] = self._norm_sex(self.initial_data.get("sex", attrs.get("sex")))
        attrs["family_history"] = self._norm_fh(self.initial_data.get("family_history", attrs.get("family_history")))

        # 2) 공통 필수
        required = ["email", "password", "name", "sex", "age", "birth_date"]
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

                # Doctors 모델의 uid 필드가 User FK이므로, User ID를 기준으로 찾기 위해 `uid__id`를 사용합니다.
                doctor_obj = Doctors.objects.filter(uid__id=n).first()
                if not doctor_obj:
                    # 이전 로직: Doctors.objects.filter(uid=n).first()
                    # 새 로직: Doctors.objects.filter(uid__id=n).first()
                    raise serializers.ValidationError(
                        {"referral_uid": ["유효하지 않은 의사 식별번호(User ID)입니다. 해당 ID를 가진 의사 프로필이 존재하지 않습니다."]})
                attrs["doctor"] = doctor_obj
            else:
                attrs.pop("doctor", None)

        # ✅ 모든 분기 끝난 후 "항상" attrs 리턴
        assert isinstance(attrs, dict), "internal: attrs must be dict"

        print("--- RegisterSerializer.validate END (OK) ---")
        return attrs

    def create(self, validated_data):
        print("--- RegisterSerializer.create START ---")
        print("Final Validated Data in create:", validated_data)

        # 1️⃣ 공통 필드 분리
        is_doctor = validated_data.pop("is_doctor", False)
        doctor_obj = validated_data.pop("doctor", None)
        validated_data.pop("referral_uid", None)
        password = validated_data.pop("password")

        birth_date = validated_data.pop("birth_date")
        age = validated_data.pop("age")  # 정수여야 함

        # 2️⃣ Users 모델에 없는 의사 전용 필드 제거
        specialty = validated_data.pop("specialty", None)
        hospital = validated_data.pop("hospital", None)
        license_file = validated_data.pop("license_file", None)

        # 3️⃣ Users 객체 생성
        user = User.objects.create(
            **validated_data,
            is_doctor=is_doctor,
            birth_date=birth_date,
            age=age  # 👈 명시적으로 전달
        )
        user.set_password(password)
        user.save()

        # 4️⃣ 의사 가입인 경우 Doctors 객체 생성
        if is_doctor:
            if not license_file:
                raise serializers.ValidationError({"license_file": ["의사 가입 시 면허증 파일은 필수입니다."]})
            
            # Doctors.uid 필드는 User 객체에 대한 FK이므로 user 객체를 직접 할당
            try:
                Doctors.objects.create(
                    uid=user,  # ✅ uid는 User에 대한 ForeignKey 필드
                    name=user.name,
                    specialty=specialty or "",
                    hospital=hospital or "",
                    cert_path=license_file,  # ← 업로드 파일 객체를 그대로 전달
                    status="미승인",
                )
            except Exception as e:
                print(f"Error creating Doctors object: {e}")
                raise serializers.ValidationError({"doctor": [f"의사 정보 생성 중 오류가 발생했습니다: {str(e)}"]})

        # 5️⃣ 환자일 경우 담당 의사 연결
        if doctor_obj:
            user.doctor = doctor_obj
            user.save()

        print("--- RegisterSerializer.create END (User Created) ---")
        return user


# -----------------------------------
# 1. DoctorProfileSerializer (Doctors 모델)
# -----------------------------------
class DoctorProfileSerializer(serializers.ModelSerializer):
    """Users 모델에 중첩될 Doctors 정보 (의사 본인 프로필 조회용)"""

    # 의사 본인의 User ID를 노출
    user_id = serializers.IntegerField(source='uid.id', read_only=True)

    class Meta:
        model = Doctors
        fields = ['user_id', 'specialty', 'hospital', 'status']


# 2. PatientListItemSerializer (의사가 보는 환자 목록)
# -----------------------------------
class PatientListItemSerializer(serializers.ModelSerializer):
    """의사에게 할당된 환자 목록의 간소화된 정보"""

    # 마지막 진료 결과의 날짜를 가져오는 필드 추가 (Results 모델 사용 가정)
    last_diagnosis_date = serializers.SerializerMethodField()
    # ✅ 추가: 소견 필요 여부
    needs_review = serializers.SerializerMethodField()
    # ✅ 추가: AI 진단 심각도
    ai_risk_level = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'birth_date', 'age', 'sex', 'last_diagnosis_date', 'needs_review', 'ai_risk_level']

    def get_last_diagnosis_date(self, obj: User):
        # ✅ 수정: Results는 photo를 통해 Photos와 연결되고, Photos가 user와 연결됨
        # Results 모델에는 user 필드가 없고, photo__user를 통해 접근해야 함
        # analysis_date 필드를 사용 (created_at이 아님)
        try:
            last_result = Results.objects.filter(photo__user=obj).order_by('-analysis_date').first()
            if last_result:
                return last_result.analysis_date.date()  # 날짜만 반환
        except Exception as e:
            print(f"Error in get_last_diagnosis_date: {e}")
        return None

    def get_needs_review(self, obj: User):
        """소견 필요 여부 확인"""
        try:
            from dashboard.models import FollowUpCheck
            # 최신 Results의 FollowUpCheck 확인
            last_result = Results.objects.filter(photo__user=obj).order_by('-analysis_date').first()
            if last_result:
                followup = getattr(last_result, 'followup_check', None)
                if followup is None:
                    return True  # FollowUpCheck가 없으면 소견 필요
                if followup.doctor_risk_level == '소견 대기':
                    return True  # 소견 대기 상태면 소견 필요
            return False
        except Exception as e:
            print(f"Error in get_needs_review: {e}")
        return False

    def get_ai_risk_level(self, obj: User):
        """AI 진단 심각도 (최신 Results의 risk_level)"""
        try:
            last_result = Results.objects.filter(photo__user=obj).order_by('-analysis_date').first()
            if last_result:
                return last_result.risk_level  # '높음', '보통', '낮음' 등
        except Exception as e:
            print(f"Error in get_ai_risk_level: {e}")
        return None


# -----------------------------------
# 3. UserProfileSerializer (GET 요청 응답 구조)
# -----------------------------------
class UserProfileSerializer(serializers.ModelSerializer):
    """마이페이지(ProfilePage)에 필요한 모든 사용자 정보 (읽기 전용)"""

    # 의사일 경우: 본인의 Doctors 프로필 정보
    doctor_profile = serializers.SerializerMethodField(read_only=True)
    # 환자일 경우: 배정된 담당 의사 요약 정보
    assigned_doctor = serializers.SerializerMethodField(read_only=True)
    # 의사일 경우: 담당 환자 목록 (PatientListItemSerializer 사용)
    patients = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        # 'birth_date'는 User 모델에 있다고 가정. 없으면 제거 필요.
        fields = ['id', 'email', 'name', 'sex', 'age', 'birth_date', 'family_history', 'is_doctor',
                  'doctor_profile', 'assigned_doctor', 'patients'
                  ]
        read_only_fields = ['email', 'is_doctor', 'date_joined']

    def get_doctor_profile(self, obj: User):
        """사용자가 의사일 경우, 자신의 Doctors 프로필 정보를 반환"""
        if obj.is_doctor:
            # Users ←(ForeignKey related_name='doctors_set')→ Doctors (default reverse lookup)
            # Doctors.uid (FK to User)의 related_name은 'doctor_profile'입니다.
            profile = getattr(obj, 'doctor_profile', None)
            if profile:
                return DoctorProfileSerializer(profile).data
        return None

    def get_assigned_doctor(self, obj: User):
        """사용자가 환자일 경우, 연결된 담당 의사 정보(Doctors 객체)를 요약하여 반환"""
        # obj.doctor는 환자에게 할당된 Doctors 모델 인스턴스입니다.
        if not obj.is_doctor and obj.doctor:
            try:
                # obj.doctor.uid는 Doctors 인스턴스가 연결된 User 객체입니다.
                doctor_user = obj.doctor.uid
                return {
                    'id': doctor_user.id,
                    'name': doctor_user.name,
                    'specialty': obj.doctor.specialty,
                    'hospital': obj.doctor.hospital,
                }
            except Exception as e:
                print(f"Error in get_assigned_doctor: {e}")
                return None
        return None

    def get_patients(self, obj: User):
        """사용자가 의사일 경우, 담당하는 환자 목록을 가져와 PatientListItemSerializer로 직렬화"""
        if obj.is_doctor:
            try:
                # 1. 의사 본인의 Doctors 프로필 객체를 가져옴
                doctor_profile = getattr(obj, 'doctor_profile', None)

                if doctor_profile:
                    # 2. 해당 Doctors 프로필 객체를 'doctor' 필드(FK)로 가진 User들을 쿼리
                    patient_users = User.objects.filter(doctor=doctor_profile).filter(is_doctor=False)
                    return PatientListItemSerializer(patient_users, many=True).data
            except Exception as e:
                # 예외 시 디버깅을 위해 print(e)를 남겨두는 것이 좋습니다.
                print(f"Error in get_patients: {e}")
                return []
        return []


# -----------------------------------
# 4. UserProfileUpdateSerializer (PATCH 요청 처리)
# -----------------------------------
class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """프로필 정보 수정을 위한 시리얼라이저 (PATCH)"""

    # User 모델 필드
    name = serializers.CharField(required=False, allow_blank=True)
    sex = serializers.CharField(required=False, allow_blank=True)
    age = serializers.IntegerField(required=False)
    family_history = serializers.CharField(required=False, allow_blank=True)
    birth_date = serializers.DateField(required=False, allow_null=True, format="%Y-%m-%d", input_formats=["%Y-%m-%d"])

    # 의사 전용 필드 (Doctors 모델 업데이트용)
    specialty = serializers.CharField(write_only=True, required=False, allow_blank=True)
    hospital = serializers.CharField(write_only=True, required=False, allow_blank=True)

    # 환자 전용 필드 (담당 의사 연결/해제용)
    assigned_doctor_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['name', 'sex', 'age', 'birth_date', 'family_history', 'specialty', 'hospital', 'assigned_doctor_name']

    def update(self, instance: User, validated_data):
        # 1. User 모델의 일반 필드 업데이트
        instance.name = validated_data.get('name', instance.name)
        instance.sex = validated_data.get('sex', instance.sex)
        instance.age = validated_data.get('age', instance.age)
        instance.family_history = validated_data.get('family_history', instance.family_history)
        instance.birth_date = validated_data.get('birth_date', instance.birth_date)

        # 2. 의사 전용 필드 업데이트 (Doctors 모델)
        if instance.is_doctor and hasattr(instance, 'doctor_profile'):
            doctor_profile = instance.doctor_profile  # 의사 본인의 Doctors 프로필
            if doctor_profile:
                doctor_profile.specialty = validated_data.get('specialty', doctor_profile.specialty)
                doctor_profile.hospital = validated_data.get('hospital', doctor_profile.hospital)
                doctor_profile.save()

        # 3. 환자 전용 필드 업데이트 (담당의사 연결)
        elif not instance.is_doctor:
            assigned_doctor_name = validated_data.pop('assigned_doctor_name', None)

            if assigned_doctor_name is not None:
                assigned_doctor_name = assigned_doctor_name.strip()

                # 🚨 입력된 이름이 있다면 연결 로직 실행
                if assigned_doctor_name:
                    # 이름으로 User 찾기 (is_doctor=True이고 이름 일치)
                    doctor_user = User.objects.filter(
                        is_doctor=True,
                        name=assigned_doctor_name
                    ).first()

                    # 해당 User의 Doctors 프로필 객체 확인 (doctor_profile은 OneToOneField로 가정)
                    if doctor_user and hasattr(doctor_user, 'doctor_profile'):
                        # ✅ 수정된 부분: 검색된 의사의 Doctors 객체(doctor_user.doctor_profile)를 할당
                        instance.doctor = doctor_user.doctor_profile  # ⬅️ 올바른 할당
                    else:
                        raise serializers.ValidationError({
                            "assigned_doctor_name": [f"이름이 '{assigned_doctor_name}'인 등록된 의사를 찾을 수 없습니다."]
                        })
                else:
                    # 이름이 빈 문자열이면 담당 의사 연결 해제
                    instance.doctor = None

        # 4. 모든 변경 사항 저장
        instance.save()

        return instance
