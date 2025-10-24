"""
Django settings for early_dot project.
"""

from pathlib import Path
import environ
import os

# =============================================
# 📂 기본 경로 및 미디어 경로
# =============================================
BASE_DIR = Path(__file__).resolve().parent.parent

MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "/media/"

# =============================================
# 📄 .env 환경 변수 로드
# =============================================
env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(
    env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
)

SECRET_KEY = env("Django_SECRET_KEY")
DEBUG = env("DEBUG")

# =============================================
# ⚙️ 앱 설정
# =============================================
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",

    # 🔹 외부 라이브러리
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",

    # 🔹 로컬 앱
    "users",
    "diagnosis",
    "dashboard",
    "admin_tools",
]

SITE_ID = 1
AUTH_USER_MODEL = "users.Users"

# =============================================
# ⚙️ 미들웨어 설정 (🚨 CORS 순서 매우 중요)
# =============================================
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",          # ✅ 반드시 가장 위
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "early_dot.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "early_dot.wsgi.application"

# =============================================
# 🗄 데이터베이스 설정
# =============================================
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST", default="127.0.0.1"),
        "PORT": env("DB_PORT", default="3306"),
    }
}

# =============================================
# 🔐 비밀번호 검증
# =============================================
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# =============================================
# 🌐 국제화 설정
# =============================================
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# =============================================
# 📦 정적 파일 설정
# =============================================
STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# =============================================
# 🔑 REST Framework 기본 설정
# =============================================
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",  # 임시 개발용
    ],
}

# =============================================
# 🔥 CORS 설정
# =============================================

# 🚀 개발 중엔 모든 Origin 허용 (테스트 용)
# 주의: 배포 시엔 반드시 False로 바꾸고 CORS_ALLOWED_ORIGINS만 사용하세요
CORS_ALLOW_ALL_ORIGINS = False

# ✅ React 개발 서버 포트 추가 (3000, 3002, 3004)
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "http://localhost:3004",
    "http://127.0.0.1:3004",
]

# ✅ (필요 시) 쿠키/인증 정보 포함 요청 허용
CORS_ALLOW_CREDENTIALS = True

# ✅ (세션인증 등 사용하는 경우)
# CSRF_TRUSTED_ORIGINS = [
#     "http://localhost:3000",
#     "http://127.0.0.1:3000",
#     "http://localhost:3004",
#     "http://127.0.0.1:3004",
# ]
