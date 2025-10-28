# backend/users/models.py

from django.db import models
from uuid import uuid4
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from django.utils import timezone  # date_joined 기본값 지정을 위해 추가
from uuid import uuid4


# Custom User Manager 정의 (필수)
class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError(_('The Email field must be set'))
        email = self.normalize_email(email)

        # date_joined와 created_at을 모두 NOW()로 명시해주면 DB 오류가 사라집니다.
        # 여기서는 date_joined가 created_at 역할을 대체합니다.
        extra_fields.setdefault('date_joined', timezone.now())

        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('date_joined', timezone.now())

        # 슈퍼유저 생성 시 REQUIRED_FIELDS에 대한 기본값 제공
        extra_fields.setdefault('name', 'Admin')
        extra_fields.setdefault('sex', '남성')
        extra_fields.setdefault('age', 99)
        extra_fields.setdefault('family_history', '없음')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        return self.create_user(email, password, **extra_fields)

# 모델의 cert_path를 FileField로 바꾸고 upload_to 함수에서 경로
def doctor_cert_upload_to(instance, filename):
    # instance.uid는 의사 Users 객체(Doctors.uid OneToOne)
    return f"certs/{instance.uid_id}/{uuid4().hex}_{filename}"

# 모델의 cert_path를 FileField로 바꾸고 upload_to 함수에서 경로
# 이거 이따가 경로 바꿔야 함
def doctor_cert_upload_to(instance, filename):
    # instance.uid는 의사 Users 객체(Doctors.uid OneToOne)
    return f"certs/{instance.uid_id}/{uuid4().hex}_{filename}"

class Doctors(models.Model):
    # 'uid'는 이 테이블의 Primary Key 역할
    uid = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='doctor_profile'
    )
    name = models.CharField(max_length=100)
    specialty = models.CharField(max_length=100, blank=True, null=True)
    hospital = models.CharField(max_length=100, blank=True, null=True)
    cert_path = models.FileField(upload_to=doctor_cert_upload_to, blank=True, null=True)
    status = models.CharField(max_length=20)

    class Meta:
        db_table = 'doctors'
        verbose_name = '의사 정보'

    def __str__(self):
        return self.name


# 🚨 AbstractBaseUser 및 PermissionsMixin 상속
class Users(AbstractBaseUser, PermissionsMixin):
    # Django 필수 인증 필드 (AbstractBaseUser에는 없음)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    # 🌟 'created_at' 필드 대신 'date_joined'를 생성 시간으로 통합
    date_joined = models.DateTimeField(default=timezone.now)  # auto_now_add 대신 default 사용

    # 사용자 정의 필수 필드
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=100)
    sex = models.CharField(max_length=20)
    birth_date = models.DateField(null=False, blank=False)
    age = models.IntegerField()
    family_history = models.CharField(max_length=10, default='모름')
    #family_history = models.CharField(max_length=10, blank=True, null=True)
    is_doctor = models.BooleanField(default=False)

    # 🌟 doctor_uid 외래 키 (db_column 유지)
    doctor = models.ForeignKey(
        'Doctors',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='doctor_uid',
        related_name='patients'
    )

    # Custom Manager 설정
    objects = CustomUserManager()

    # Django의 기본 username 필드를 email로 사용하도록 설정
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name', 'sex', 'age', 'birth_date', 'family_history']

    class Meta:
        db_table = 'users'
        verbose_name = '일반 사용자/환자'

    def __str__(self):
        return self.email