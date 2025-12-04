# 가짜 데이터 생성 스크립트 - 테이블 커버리지

## ✅ 포함된 모든 테이블 (ORM으로 생성)

### 1. **Users** (users 테이블)
- **생성 함수**: `create_doctors()`, `create_patients()`, `create_normal_users()`
- **ORM 사용**: `Users.objects.create_user()`
- **생성 데이터**:
  - 의사 계정 (is_doctor=True)
  - 환자 계정 (is_doctor=False, doctor 연결)
  - 일반 사용자 계정 (is_doctor=False, doctor=None)

### 2. **Doctors** (doctors 테이블)
- **생성 함수**: `create_doctors()`
- **ORM 사용**: `Doctors.objects.create()`
- **생성 데이터**:
  - Users와 OneToOne 관계
  - specialty, hospital, status, cert_path 포함

### 3. **DiseaseInfo** (disease_info 테이블)
- **생성 함수**: `create_disease_info()`
- **ORM 사용**: `DiseaseInfo.objects.get_or_create()`
- **생성 데이터**:
  - 악성 흑색종, 기저세포암, 편평세포암, 정상, 양성 모반 등

### 4. **Photos** (photos 테이블)
- **생성 함수**: `create_photos()`
- **ORM 사용**: `Photos.objects.create()`
- **생성 데이터**:
  - 사용자별 사진 업로드
  - folder_name, file_name, body_part, symptoms 등

### 5. **Results** (results 테이블)
- **생성 함수**: `create_photos()` (Photos 생성 후)
- **ORM 사용**: `Results.objects.create()`
- **생성 데이터**:
  - Photos와 OneToOne 관계
  - risk_level, class_probs (JSON), disease (FK)
  - grad_cam_path 이미지

### 6. **FollowUpCheck** (followup_check 테이블)
- **생성 함수**: `create_followup_checks()`
- **ORM 사용**: `FollowUpCheck.objects.create()`
- **생성 데이터**:
  - Results와 OneToOne 관계
  - 환자 중 일부(약 30%)의 Results에 대해 생성
  - current_status, doctor_risk_level, doctor_note 포함

### 7. **FollowUpHistory** (followup_history 테이블)
- **생성 함수**: `create_followup_checks()` (FollowUpCheck 생성 후)
- **ORM 사용**: `FollowUpHistory.objects.create()`
- **생성 데이터**:
  - FollowUpCheck와 ForeignKey 관계
  - 상태 변경 이력 (요청중 → 확인 완료 등)

## 🗂️ 테이블 관계도

```
Users
├── Doctors (OneToOne) - 의사 전용
├── Photos (ForeignKey) - 모든 사용자
└── FollowUpCheck (ForeignKey) - 환자만

Photos
└── Results (OneToOne)

Results
└── FollowUpCheck (OneToOne)

FollowUpCheck
├── Doctors (ForeignKey)
└── FollowUpHistory (ForeignKey)

Results
└── DiseaseInfo (ForeignKey)
```

## 💾 ORM 사용 방식

모든 테이블은 **Django ORM**으로 직접 생성됩니다:

```python
# 예시: Users 생성
user = Users.objects.create_user(
    email=email,
    password=password,  # Django가 자동으로 해시 처리
    name=name,
    sex=sex,  # 'M' 또는 'F'
    birth_date=birth_date,
    age=age,
    family_history=family_history,  # 'Y' 또는 'N'
    is_doctor=False,
    doctor=doctor,  # 환자인 경우 의사 연결
)

# 예시: Photos 생성
photo = Photos.objects.create(
    user=user,
    folder_name=folder_name,
    file_name=file_name,
    body_part=body_part,
    # ... 기타 필드
)

# 예시: FollowUpCheck 생성
followup_check = FollowUpCheck.objects.create(
    result=result,
    user=user,
    doctor=doctor,
    current_status='요청중',
    # ... 기타 필드
)
```

## 📊 생성 통계

스크립트 실행 시 생성되는 데이터:
- ✅ 의사: 기본 3명
- ✅ 환자: 기본 10명 (일부는 의사 연결 없음)
- ✅ 일반 사용자: 기본 5명
- ✅ 사진: 환자/일반 사용자당 3장
- ✅ 진단 결과: 사진당 1개
- ✅ 후속 조치 요청: 결과의 약 30% (환자만)
- ✅ 후속 조치 이력: 요청당 1-2개

## 🔗 외래 키 관계

모든 외래 키 관계가 올바르게 설정됩니다:
- ✅ Users → Doctors (OneToOne)
- ✅ Users → Doctors (ForeignKey, 환자의 담당의)
- ✅ Photos → Users (ForeignKey)
- ✅ Results → Photos (OneToOne)
- ✅ Results → DiseaseInfo (ForeignKey)
- ✅ FollowUpCheck → Results (OneToOne)
- ✅ FollowUpCheck → Users (ForeignKey)
- ✅ FollowUpCheck → Doctors (ForeignKey)
- ✅ FollowUpHistory → FollowUpCheck (ForeignKey)

## ✅ 모든 필드 검증

- `family_history`: 'Y' 또는 'N' (가입 시와 동일)
- `sex`: 'F' 또는 'M' (가입 시와 동일)
- `risk_level`: '높음', '중간', '낮음', '정상' (10자 이내)
- `current_status`: '요청중', '확인 완료' (choices 확인)
- `doctor_risk_level`: '소견 대기', '즉시 주의', '경과 관찰', '정상' (choices 확인)

## 🎯 결론

**모든 테이블이 ORM으로 적절히 생성되며, 외래 키 관계도 올바르게 설정됩니다!**


