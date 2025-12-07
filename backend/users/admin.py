from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Users, Doctors


@admin.register(Users)
class UserAdmin(BaseUserAdmin):
    """커스텀 유저 모델을 위한 Admin 설정"""
    list_display = ('email', 'name', 'is_doctor', 'is_staff', 'is_superuser', 'is_active', 'date_joined')
    list_filter = ('is_doctor', 'is_staff', 'is_superuser', 'is_active', 'date_joined')
    search_fields = ('email', 'name')
    ordering = ('-date_joined',)
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('개인 정보', {'fields': ('name', 'sex', 'birth_date', 'age', 'family_history')}),
        ('권한', {'fields': ('is_doctor', 'is_staff', 'is_active', 'is_superuser', 'groups', 'user_permissions')}),
        ('의사 연결', {'fields': ('doctor',)}),
        ('중요한 날짜', {'fields': ('date_joined', 'last_login')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'name', 'sex', 'birth_date', 'age', 'family_history', 'is_doctor', 'is_staff', 'is_superuser'),
        }),
    )
    
    readonly_fields = ('date_joined', 'last_login')


@admin.register(Doctors)
class DoctorAdmin(admin.ModelAdmin):
    """의사 모델을 위한 Admin 설정"""
    list_display = ('uid', 'name', 'hospital', 'specialty', 'status')
    list_filter = ('status',)
    search_fields = ('name', 'hospital', 'specialty', 'uid__email')
    readonly_fields = ('uid',)
    
    fieldsets = (
        ('기본 정보', {'fields': ('uid', 'name', 'hospital', 'specialty')}),
        ('승인 상태', {'fields': ('status', 'rejection_reason')}),
        ('증빙서류', {'fields': ('cert_path',)}),
    )
