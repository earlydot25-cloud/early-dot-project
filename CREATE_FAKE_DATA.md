# 가짜 데이터 생성 가이드

## 🗑️ 기존 데이터 삭제 방법

기존 데이터베이스를 삭제하고 가짜 데이터를 생성하는 방법입니다.

### 방법 1: Django flush 명령어 사용 (추천)

```bash
# Docker 컨테이너 내에서 실행
docker compose exec django python manage.py flush --no-input
```

### 방법 2: 커스텀 clear_database 명령어 사용

```bash
# 모든 데이터 삭제 (테이블 구조는 유지)
docker compose exec django python manage.py clear_database --confirm
```

### 방법 3: MySQL에서 직접 삭제 (완전 초기화)

```bash
# MySQL 접속
docker compose exec db mysql -u root -p${DB_PASSWORD}

# 데이터베이스 삭제 후 재생성
DROP DATABASE early_dot_db;
CREATE DATABASE early_dot_db;

# Django 마이그레이션 (테이블 구조 재생성)
docker compose exec django python manage.py migrate
```

### 방법 4: Docker Volume 삭제 (완전 초기화)

```bash
# 컨테이너 중지
docker compose down

# 데이터베이스 볼륨 삭제
docker volume rm early_dot_db_data

# 다시 시작
docker compose up -d

# 마이그레이션
docker compose exec django python manage.py migrate
```

## 🎯 가짜 데이터 생성

### 1단계: 기존 데이터 삭제

```bash
# 방법 1: flush 사용
docker compose exec django python manage.py flush --no-input

# 또는 방법 2: 커스텀 명령어 사용
docker compose exec django python manage.py clear_database --confirm
```

### 2단계: 가짜 데이터 생성

```bash
# 기본 설정으로 생성
docker compose exec django python manage.py create_fake_data --clear-media

# 더 많은 데이터 생성
docker compose exec django python manage.py create_fake_data \
    --clear-media \
    --num-doctors 5 \
    --num-patients 20 \
    --num-normal-users 10 \
    --photos-per-patient 5
```

## 📋 전체 프로세스 (한 번에)

```bash
# 1. 기존 데이터 삭제
docker compose exec django python manage.py flush --no-input

# 2. 가짜 데이터 생성
docker compose exec django python manage.py create_fake_data --clear-media

# 3. 생성 결과 확인 (선택)
docker compose exec django python manage.py shell -c "from users.models import Users; print(f'Users: {Users.objects.count()}개')"
```

## ⚠️ 주의사항

1. **기존 데이터 백업**: 중요한 데이터가 있다면 미리 백업하세요.
2. **media 폴더**: `--clear-media` 옵션은 media 폴더의 모든 내용을 삭제합니다.
3. **DiseaseInfo**: 기본 질병 정보는 유지됩니다 (get_or_create 사용).

## 🔍 생성된 데이터 확인

```bash
# 컨테이너 내에서 Django shell 실행
docker compose exec django python manage.py shell

# Python shell에서 확인
>>> from users.models import Users, Doctors
>>> from diagnosis.models import Photos, Results
>>> from dashboard.models import FollowUpCheck
>>> print(f'의사: {Doctors.objects.count()}명')
>>> print(f'사용자: {Users.objects.count()}명')
>>> print(f'사진: {Photos.objects.count()}개')
>>> print(f'진단 결과: {Results.objects.count()}개')
>>> print(f'후속 조치: {FollowUpCheck.objects.count()}개')
```


