# 가짜 데이터 생성 가이드

## 개요

`create_fake_data` 관리 명령어를 사용하여 웹 평가용 가짜 데이터를 생성합니다.

## 기능

- ✅ **환자** 생성 (의사와 연결)
- ✅ **일반 사용자** 생성 (의사 연결 없음)
- ✅ **의사** 생성 (Doctors 모델과 연결)
- ✅ **Photos** 및 **Results** 생성 (진단 데이터)
- ✅ **DiseaseInfo** 생성 (질병 정보)
- ✅ **media 폴더** 파일 생성 (이미지, 인증서 등)
- ✅ **SQL 덤프** 생성 (JSON 형식)

## 사용자 필드 규칙

- `family_history`: `Y` 또는 `N` (가입 시와 동일)
- `sex`: `F` (여성) 또는 `M` (남성)
- 비밀번호: 쉽게 설정되지만 실제 로그인 가능 (Django 해시 적용)
  - 예: `patient1`, `doctor1`, `user1`

## 사용 방법

### 1단계: 기존 데이터 삭제 (선택사항)

기존 데이터베이스의 모든 데이터를 삭제하려면:

#### Docker 환경
```bash
docker compose exec django conda run --no-capture-output -n early_dot_env python manage.py clear_database --confirm
```

#### 로컬 환경
```bash
cd backend
python manage.py clear_database --confirm
```

**⚠️ 주의**: 이 명령어는 모든 사용자, 의사, 사진, 진단 결과 데이터를 삭제합니다. `--confirm` 플래그 없이는 실행되지 않습니다.

### 2단계: 가짜 데이터 생성

#### Docker 환경
```bash
docker compose exec django conda run --no-capture-output -n early_dot_env python manage.py create_fake_data --clear-media
```

#### 로컬 환경 (기본값)

```bash
cd backend
python manage.py create_fake_data --clear-media
```

기본값:
- 의사: 3명
- 환자: 10명
- 일반 사용자: 5명
- 환자당 사진: 3장

### 옵션 지정

#### 로컬 환경
```bash
# 더 많은 데이터 생성
python manage.py create_fake_data \
    --clear-media \
    --num-doctors 5 \
    --num-patients 20 \
    --num-normal-users 10 \
    --photos-per-patient 5
```

#### Docker 환경
```bash
docker compose exec django conda run --no-capture-output -n early_dot_env python manage.py create_fake_data \
    --clear-media \
    --num-doctors 5 \
    --num-patients 20 \
    --num-normal-users 10 \
    --photos-per-patient 5
```

### 옵션 설명

- `--clear-media`: 기존 media 폴더 내용 삭제
- `--num-doctors N`: 생성할 의사 수 (기본값: 3)
- `--num-patients N`: 생성할 환자 수 (기본값: 10)
- `--num-normal-users N`: 생성할 일반 사용자 수 (기본값: 5)
- `--photos-per-patient N`: 환자당 생성할 사진 수 (기본값: 3)
- `--skip-dump`: SQL 덤프 생성 건너뛰기

## 생성되는 데이터

### 사용자 계정

**의사**
- 이메일: `doctor1@example.com`, `doctor2@example.com`, ...
- 비밀번호: `doctor1`, `doctor2`, ...
- 특성: `is_doctor=True`, Doctors 프로필 연결

**환자**
- 이메일: `patient1@example.com`, `patient2@example.com`, ...
- 비밀번호: `patient1`, `patient2`, ...
- 특성: `is_doctor=False`, 의사와 연결 (일부는 연결 없음)

**일반 사용자**
- 이메일: `user1@example.com`, `user2@example.com`, ...
- 비밀번호: `user1`, `user2`, ...
- 특성: `is_doctor=False`, 의사와 연결 없음

### 생성되는 파일

1. **media/uploads/{user_id}/{folder_name}/{file_name}.jpg**
   - 환자/일반 사용자의 촬영 이미지

2. **media/certs/{doctor_id}/cert_{doctor_id}.png**
   - 의사 인증서 이미지

3. **media/cams/image_{photo_id}.png**
   - 진단 결과의 Grad-CAM 이미지

### SQL 덤프

- 위치: `backend/sql_dumps/fake_data_dump_{timestamp}.json`
- 형식: JSON (Django dumpdata 형식)
- 포함 모델:
  - users.Users
  - users.Doctors
  - diagnosis.Photos
  - diagnosis.Results
  - diagnosis.DiseaseInfo
  - dashboard.FollowUpCheck
  - dashboard.FollowUpHistory

## 예시 실행 결과

```
=== 가짜 데이터 생성 시작 ===
media 폴더 내용 삭제 중...
  삭제: uploads/
  삭제: certs/
  삭제: cams/
  media 폴더 정리 완료

질병 정보 생성 중...
  생성: 악성 흑색종
  생성: 기저세포암
  ...

의사 3명 생성 중...
  생성: doctor1@example.com (비밀번호: doctor1)
  생성: doctor2@example.com (비밀번호: doctor2)
  ...

환자 10명 생성 중...
  생성: patient1@example.com (비밀번호: patient1) (담당의: 김의사)
  ...

일반 사용자 5명 생성 중...
  생성: user1@example.com (비밀번호: user1)
  ...

SQL 덤프 생성 중...
  JSON 덤프 생성 완료: backend/sql_dumps/fake_data_dump_20250101_120000.json

=== 가짜 데이터 생성 완료 ===
의사: 3명
환자: 10명
일반 사용자: 5명
사진: 45개
```

## 주의사항

1. **기존 데이터 삭제**: 
   - `--clear-media` 옵션은 media 폴더의 모든 내용을 삭제합니다. 백업이 필요하면 미리 복사하세요.
   - `clear_database` 명령어는 데이터베이스의 모든 데이터를 삭제합니다. `--confirm` 플래그 없이는 실행되지 않습니다.

2. **데이터베이스**: 
   - `create_fake_data` 스크립트는 기존 데이터베이스의 데이터를 덮어쓰지 않습니다.
   - 완전히 새로운 데이터가 필요하면 먼저 `clear_database --confirm` 명령어를 실행한 후 가짜 데이터를 생성하세요.

3. **비밀번호**: 생성된 비밀번호는 테스트용이므로 간단합니다. 실제 운영 환경에서는 사용하지 마세요.

## 문제 해결

### media 폴더 권한 오류
```bash
# media 폴더 권한 확인 및 수정
chmod -R 755 backend/media
```

### 데이터베이스 연결 오류
- `.env` 파일의 데이터베이스 설정 확인
- MySQL 서버 실행 확인

### 이미지 생성 오류
- PIL/Pillow 라이브러리 설치 확인: `pip install pillow`

