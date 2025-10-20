# backend/dashboard/models.py

from django.db import models
from django.conf import settings

from diagnosis.models import Result
from users.models import Doctor


class FollowUpCheck(models.Model):
    result = models.OneToOneField(
        Result,
        on_delete=models.CASCADE,
        related_name='followup_check'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='followup_checks_requested'
    )
    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='followup_checks_assigned'
    )
    request_date = models.DateTimeField(auto_now_add=True)
    current_status = models.CharField(max_length=20, default='요청중')
    doctor_risk_level = models.CharField(max_length=20, blank=True, null=True)
    doctor_note = models.TextField(blank=True, null=True)
    last_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'followup_check'
        verbose_name = '후속 조치 요청'

    def __str__(self):
        return f"FollowUp Request {self.id} for Result {self.result_id}"


class FollowUpHistory(models.Model):
    request = models.ForeignKey(
        FollowUpCheck,
        on_delete=models.CASCADE,
        related_name='history'
    )
    status = models.CharField(max_length=20)
    changed_by = models.CharField(max_length=10)
    change_date = models.DateTimeField(auto_now_add=True)
    note = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'followup_history'
        verbose_name = '후속 조치 기록'

    def __str__(self):
        return f"History {self.id} for Request {self.request_id}"