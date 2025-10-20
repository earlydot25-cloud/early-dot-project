# backend/users/models.py

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings


class User(AbstractUser):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=100)
    sex = models.CharField(max_length=20)
    age = models.IntegerField()
    family_history = models.CharField(max_length=10)
    is_doctor = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    REQUIRED_FIELDS = ['email', 'name', 'sex', 'age', 'family_history']

    def __str__(self):
        return self.email


class Doctor(models.Model):
    uid = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='doctor_profile'
    )
    name = models.CharField(max_length=100)
    specialty = models.CharField(max_length=100, blank=True, null=True)
    hospital = models.CharField(max_length=100, blank=True, null=True)
    cert_path = models.CharField(max_length=255)
    status = models.CharField(max_length=20)

    def __str__(self):
        return self.name