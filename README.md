# 🩺 EARLY DOT: AI 기반 피부 진단 시스템

> AI 모델을 활용한 피부 질환 자동 진단 및 의사-환자 관리 플랫폼

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.10-blue.svg)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.2-green.svg)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)

## 📋 목차

- [프로젝트 개요](#-프로젝트-개요)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [프로젝트 구조](#-프로젝트-구조)
- [빠른 시작](#-빠른-시작)
- [환경 설정](#-환경-설정)
- [배포](#-배포)
- [개발 가이드](#-개발-가이드)
- [기여하기](#-기여하기)

---

## 🎯 프로젝트 개요

EARLY DOT은 AI 기반 피부 질환 진단 시스템으로, 환자가 촬영한 피부 사진을 분석하여 8가지 피부 질환을 자동으로 분류하고 위험도를 평가합니다. 의사와 환자를 연결하여 후속 조치를 관리할 수 있는 통합 플랫폼입니다.

### 지원하는 피부 질환 (8종)

- **악성 질환**: 흑색종, 기저세포암, 편평세포암
- **경계성 질환**: 양성 각화증
- **양성 질환**: 모반, 피부섬유종, 광선 각화증, 혈관종

### 주요 특징

- 🤖 **AI 자동 진단**: CNN 앙상블(ResNet50 + EfficientNetB4)과 ViT-B/16을 Soft Voting으로 결합한 하이브리드 모델
- 🔍 **GradCAM 시각화**: 진단 근거를 시각적으로 확인
- 🧹 **털 제거 전처리**: U-Net + LaMa을 활용한 이미지 전처리
- 👨‍⚕️ **의사-환자 연결**: 담당 의사 지정 및 후속 조치 관리
- 📱 **반응형 웹**: 모바일 및 데스크톱 지원

---

## ✨ 주요 기능

### 👤 환자 기능
- **사진 촬영 및 업로드**: 신체 부위 선택 후 피부 사진 촬영
- **AI 자동 진단**: 털 제거 전처리 → 하이브리드 모델(CNN 앙상블 + ViT) 예측 → GradCAM 시각화
- **진단 결과 확인**: 위험도 평가, 질병명, 확률 분포, GradCAM 히트맵 제공
- **진단 내역 관리**: 과거 진단 기록 조회 및 상세 정보 확인
- **의사 연결**: 담당 의사 지정 및 후속 조치 요청

### 👨‍⚕️ 의사 기능
- **환자 관리**: 담당 환자 목록 조회 및 진단 내역 확인
- **후속 조치 검토**: 환자의 후속 조치 요청 확인 및 의견 작성
- **위험도 평가**: AI 진단 결과에 대한 의사 의견 및 위험도 재평가

### 🔧 관리자 기능
- **의사 계정 승인**: 의사 가입 신청 검토 및 승인/거부
- **시스템 관리**: 사용자 및 데이터 관리

---

## 📚 기술 스택

| 구분 | 기술 |
| :--- | :--- |
| **백엔드 (API)** | Python 3.10, Django 5.2, Django REST Framework, SimpleJWT, MySQL 8 |
| **모델 서빙** | FastAPI, PyTorch, OpenCV |
| **AI 모델** | ResNet50 + EfficientNetB4 (CNN 앙상블) + ViT-B/16 (Soft Voting 하이브리드 모델) (8-class classification), GradCAM, U-Net (털 마스크), LaMa (털 제거), BSRGAN (초해상도) |
| **프론트엔드 (UI)** | React 19, TypeScript, React Router, Tailwind CSS |
| **인프라** | Docker, Docker Compose, Nginx |
| **환경 관리** | Conda, npm |

---

## 📁 프로젝트 구조

```
early-dot-project/
├── backend/                 # Django 백엔드
│   ├── users/              # 사용자 인증 및 관리
│   ├── diagnosis/          # 진단 관련 API (사진 업로드, 결과 조회)
│   ├── dashboard/          # 대시보드 API (진단 내역, 환자 관리)
│   ├── admin_tools/        # 관리자 도구
│   └── early_dot/          # Django 설정
│
├── frontend/               # React 프론트엔드
│   ├── src/
│   │   ├── pages/         # 페이지 컴포넌트
│   │   │   ├── auth/      # 로그인, 회원가입
│   │   │   ├── diagnosis/ # 진단 플로우
│   │   │   ├── dashboard/ # 대시보드 (환자/의사)
│   │   │   └── admin/     # 관리자 페이지
│   │   ├── components/    # 공통 컴포넌트
│   │   ├── services/      # API 서비스
│   │   └── hooks/         # 커스텀 훅
│   └── public/
│
├── model_api/              # FastAPI 모델 서빙 서버
│   ├── hair_removal/      # 털 제거 파이프라인
│   ├── prediction.py      # AI 예측 모델
│   ├── gradcam_web_inference.py  # GradCAM 생성
│   └── main.py            # FastAPI 엔드포인트
│
├── docker-compose.yml     # Docker Compose 설정
└── .env.example           # 환경 변수 예시 파일
```

---

## 🚀 빠른 시작

### 사전 요구사항

- Docker & Docker Compose
- 또는 Python 3.10+, Node.js 18+, MySQL 8, Conda

### Docker를 사용한 실행 (권장)

```bash
# 1. 저장소 클론
git clone https://github.com/your-username/early-dot-project.git
cd early-dot-project

# 2. 환경 변수 파일 생성
cp .env.example .env
# .env 파일을 열어 필요한 환경 변수 설정

# 3. Docker 컨테이너 빌드 및 실행
docker compose up -d --build

# 4. 데이터베이스 마이그레이션
docker compose exec django conda run --no-capture-output -n early_dot_env python manage.py migrate

# 5. 가짜 데이터 생성 (선택사항)
docker compose exec django conda run --no-capture-output -n early_dot_env python manage.py create_fake_data --clear-media
```

### 접속 주소

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:8000
- **모델 API**: http://localhost:8001
- **MySQL**: localhost:3307

### 테스트 계정 (가짜 데이터 생성 시)

- **의사**: `doctor1@example.com` / `doctor1`
- **환자**: `patient1@example.com` / `patient1`
- **일반 사용자**: `user1@example.com` / `user1`

---

## ⚙️ 환경 설정

### 1. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 변수를 설정하세요:

```env
# 데이터베이스
DB_NAME=early_dot_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=db
DB_PORT=3306

# Django
DJANGO_SECRET_KEY=your-secret-key-here
DEBUG=True
DJANGO_ENV=local

# API URL
REACT_APP_API_BASE_URL=http://localhost:8000
VITE_API_BASE=http://localhost:8000

# 모델 앙상블 가중치 (선택사항, 기본값: 0.5, 0.5)
ENSEMBLE_CNN_WEIGHT=0.5
ENSEMBLE_VIT_WEIGHT=0.5
```

`.env.example` 파일을 참고하세요.

**참고**: 모델 앙상블 가중치는 CNN 앙상블과 ViT 모델의 Soft Voting 비율을 조절합니다. 합이 1이 되도록 자동 정규화됩니다.

### 2. 백엔드 환경 (Conda)

#### 최초 환경 생성

```bash
cd backend

# Conda 환경 생성
conda env create -f unified_environment.yml

# 가상환경 활성화
conda activate early_dot_env

# pip 패키지 설치
pip install -r requirements_base.txt

# OS별 추가 패키지 설치
# macOS
pip install -r requirements_macos.txt

# Windows
pip install -r requirements_windows.txt
```

#### 환경 업데이트

```bash
cd backend
conda activate early_dot_env

# Conda 패키지 업데이트
conda env update -f unified_environment.yml

# pip 패키지 업데이트
pip install -r requirements_base.txt --upgrade

# OS별 패키지 업데이트
pip install -r requirements_macos.txt --upgrade  # macOS
# 또는
pip install -r requirements_windows.txt --upgrade  # Windows
```

#### 데이터베이스 마이그레이션

```bash
cd backend
conda activate early_dot_env

# 모델 변경 시에만 실행
python manage.py makemigrations users
python manage.py makemigrations diagnosis
python manage.py makemigrations dashboard
python manage.py migrate
```

### 3. 프론트엔드 환경 (Node/NPM)

```bash
cd frontend
npm install
npm start
```

### 4. 로컬 실행 (Docker 없이)

터미널 2개를 열어 각각 실행:

| 구분 | 실행 위치 | 명령어 | 주소 |
| :--- | :--- |:------------------------------------------| :--- |
| **백엔드 (API)** | `backend/` | `python manage.py runserver` | `http://127.0.0.1:8000` |
| **프론트엔드 (UI)** | `frontend/` | `npm start` | `http://localhost:3000` |

---

## 🐳 배포

### Docker Compose 서비스 구성

- **db**: MySQL 8 데이터베이스
- **django**: Django 백엔드 서버
- **fastapi**: FastAPI 모델 서빙 서버
- **frontend**: React 프론트엔드 (Nginx)

### 배포 명령어

```bash
# 빌드 및 실행
docker compose up -d --build

# 로그 확인
docker compose logs -f

# 특정 서비스 로그 확인
docker compose logs -f django
docker compose logs -f fastapi
docker compose logs -f frontend

# 서비스 재시작
docker compose restart [service_name]

# 서비스 중지
docker compose down

# 볼륨 포함 완전 삭제
docker compose down -v
```

---

## 🗄️ 데이터베이스 및 가짜 데이터

### 가짜 데이터 생성

웹 평가를 위한 가짜 데이터를 생성하려면:

#### Docker 환경

```bash
# 1. 기존 데이터베이스 데이터 삭제
docker compose exec django conda run --no-capture-output -n early_dot_env python manage.py clear_database --confirm

# 2. 가짜 데이터 생성 (media 폴더도 함께 초기화)
docker compose exec django conda run --no-capture-output -n early_dot_env python manage.py create_fake_data --clear-media
```

#### 로컬 환경

```bash
cd backend
conda activate early_dot_env

# 1. 기존 데이터베이스 데이터 삭제
python manage.py clear_database --confirm

# 2. 가짜 데이터 생성
python manage.py create_fake_data --clear-media
```

### 생성되는 데이터

- **의사**: 3명 (기본값)
  - 이메일: `doctor1@example.com`, `doctor2@example.com`, ...
  - 비밀번호: `doctor1`, `doctor2`, ...
- **환자**: 10명 (기본값)
  - 이메일: `patient1@example.com`, `patient2@example.com`, ...
  - 비밀번호: `patient1`, `patient2`, ...
- **일반 사용자**: 5명 (기본값)
  - 이메일: `user1@example.com`, `user2@example.com`, ...
  - 비밀번호: `user1`, `user2`, ...
- **사진**: 환자당 3장씩 (기본값)
- **진단 결과**: 각 사진마다 생성

### 옵션 설정

더 많은 데이터를 생성하려면:

```bash
# Docker 환경
docker compose exec django conda run --no-capture-output -n early_dot_env python manage.py create_fake_data \
    --clear-media \
    --num-doctors 5 \
    --num-patients 20 \
    --num-normal-users 10 \
    --photos-per-patient 5

# 로컬 환경
cd backend
python manage.py create_fake_data \
    --clear-media \
    --num-doctors 5 \
    --num-patients 20 \
    --num-normal-users 10 \
    --photos-per-patient 5
```

더 자세한 내용은 `backend/FAKE_DATA_GUIDE.md` 파일을 참조하세요.

---

## 🔧 개발 가이드

### 주요 API 엔드포인트

#### 인증
- `POST /api/users/signup/` - 회원가입
- `POST /api/users/login/` - 로그인
- `POST /api/users/token/refresh/` - 토큰 갱신

#### 진단
- `POST /api/diagnosis/photos/upload/` - 사진 업로드
- `GET /api/diagnosis/photos/{id}/` - 사진 상세 조회
- `GET /api/diagnosis/results/{id}/` - 진단 결과 조회

#### 대시보드
- `GET /api/dashboard/main/` - 사용자 대시보드 메인
- `GET /api/dashboard/history/` - 진단 내역 목록
- `GET /api/dashboard/doctor/patients/` - 의사용 환자 목록

#### 모델 API (FastAPI)
- `POST /remove-hair` - 털 제거 처리
- `POST /predict` - AI 예측 수행

### 데이터베이스 구조

주요 테이블:
- **Users**: 사용자 정보 (환자/의사)
- **Doctors**: 의사 상세 정보
- **Photos**: 업로드된 사진
- **Results**: AI 진단 결과
- **DiseaseInfo**: 질병 정보
- **FollowUpCheck**: 후속 조치 요청
- **FollowUpHistory**: 후속 조치 이력

자세한 내용은 `backend/TABLES_COVERAGE.md` 참조.

### 협업 및 폴더 구조

- **백엔드**: `backend/` 폴더의 각 앱(users, diagnosis, dashboard 등)에 분담된 API를 구현합니다.
- **프론트엔드**: `frontend/src/pages/` 아래의 기능 폴더(auth, diagnosis, dashboard)에 UI를 구현합니다.

### Mac 환경에서 IP 변경 없이 실행

#### 내 Mac 호스트명 확인

```bash
scutil --get LocalHostName
# 예: sondongbin-ui-MacBookPro
```

#### 수정해야 하는 부분

- **backend/.env**
  - `REACT_APP_API_BASE_URL=http://<내맥호스트명>.local:8000`
  - `VITE_API_BASE=http://<내맥호스트명>.local:8000`

- **backend/early_dot/settings.py**
  - `ALLOWED_HOSTS`
  - `CORS_ALLOWED_ORIGINS`
  - `CSRF_TRUSTED_ORIGINS`

#### 실행 명령어

| 구분 | 실행 위치 | 명령어 | 주소 |
|:----------| :---------- |:--------------------------------------------------------------------------| :--------------------------- |
| **백엔드** | `backend/` | `python manage.py runserver 0.0.0.0:8000` | `http://<내맥호스트명>.local:8000` |
| **프론트** | `frontend/` | `DANGEROUSLY_DISABLE_HOST_CHECK=true WDS_SOCKET_HOST=<내맥호스트명>.local HOST=0.0.0.0 PORT=3000 npm start` | `http://<내맥호스트명>.local:3000` |


---

## 📖 추가 문서

- [가짜 데이터 생성 가이드](backend/FAKE_DATA_GUIDE.md)
- [테이블 커버리지](backend/TABLES_COVERAGE.md)
- [AI 모델 예측 가이드](model_api/README_PREDICTION.md)
- [털 제거 파이프라인 가이드](model_api/README_HAIR_REMOVAL.md)

---

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

---

## 👥 팀

EARLY DOT 개발팀

---

## 🙏 감사의 말

이 프로젝트는 다음 오픈소스 프로젝트들을 사용합니다:
- [Django](https://www.djangoproject.com/)
- [React](https://reactjs.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [PyTorch](https://pytorch.org/)
- [LaMa](https://github.com/saic-mdal/lama)
