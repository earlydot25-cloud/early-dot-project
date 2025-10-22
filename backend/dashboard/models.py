# backend/dashboard/models.py

from django.db import models
from django.conf import settings

# 여기 에러 무시
from diagnosis.models import Results
from users.models import Doctors


STATUS_CHOICES = (
    ('요청중', '요청중'),
    ('확인 완료', '확인 완료'),
)

RISK_CHOICES = (
    ('소견 대기', '소견 대기'),
    ('즉시 주의', '즉시 주의'),
    ('경과 관찰', '경과 관찰'),
    ('정상', '정상'),
)


class FollowUpCheck(models.Model):
    # FK 필드명은 단순하게 유지하는 것이 Django 관례입니다.
    result = models.OneToOneField(
        Results,
        on_delete=models.CASCADE,
        related_name='followup_check'
    )
    user = models.ForeignKey(  # 요청자 (환자)
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='followup_checks_requested'
    )
    doctor = models.ForeignKey(  # 할당된 의사
        Doctors,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='followup_checks_assigned'
    )
    request_date = models.DateTimeField(auto_now_add=True)
    current_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES, # choices 추가
        default='요청중'
    )
    doctor_risk_level = models.CharField(
        max_length=20,
        choices=RISK_CHOICES, # choices 추가
        blank=True,
        null=True
    )
    doctor_note = models.TextField(blank=True, null=True)
    last_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'followup_check'
        verbose_name = '후속 조치 요청'

    def __str__(self):
        return f"FollowUp Request {self.id} for Result {self.result_id}"


class FollowUpHistory(models.Model):
    # FK 필드명은 단순하게 유지
    request = models.ForeignKey(
        FollowUpCheck,
        on_delete=models.CASCADE,
        related_name='history'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES) # choices 추가
    changed_by = models.CharField(max_length=10)
    change_date = models.DateTimeField(auto_now_add=True)
    note = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'followup_history'
        verbose_name = '후속 조치 기록'

    def __str__(self):
        # request_id는 Django가 자동으로 만들어주는 DB 컬럼 이름입니다.
        return f"History {self.id} for Request {self.request_id}"