# Results 테이블 구조 및 필수 데이터 가이드

## Results 테이블 필드 구조

### 필수 필드 (반드시 채워야 함)

| 필드명 | 타입 | 제약사항 | 설명 |
|--------|------|----------|------|
| `photo` | OneToOneField | 필수 | Photos 테이블과 1:1 관계 (자동 연결) |
| `analysis_date` | DateTimeField | 자동 생성 | 분석 날짜 (auto_now_add=True) |
| `risk_level` | CharField | 필수, max_length=10 | 위험도: "높음", "중간", "낮음", "정상" |
| `class_probs` | JSONField | 필수 | 각 질병별 예측 확률 딕셔너리 |
| `disease` | ForeignKey | 필수 | DiseaseInfo 테이블과 연결 |

### 선택 필드 (없어도 됨)

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `grad_cam_path` | ImageField | GradCAM 이미지 (선택) |
| `vlm_analysis_text` | TextField | VLM 분석 텍스트 (선택) |

## DiseaseInfo 테이블 필드 구조

### 필수 필드

| 필드명 | 타입 | 제약사항 | 설명 |
|--------|------|----------|------|
| `name_ko` | CharField | 필수, max_length=100 | 질병명 (한글) |
| `classification` | CharField | 필수, max_length=20 | 분류 (예: "악성", "양성", "기타") |

### 선택 필드

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `name_en` | CharField | 질병명 (영문) |
| `rep_image_path` | CharField | 대표 이미지 경로 |
| `description` | TextField | 질병 설명 |
| `recommendation` | TextField | 권장사항 |

## 모델이 반환해야 하는 데이터 형식

### 필수 반환 데이터

```python
{
    # 1. class_probs (필수)
    "class_probs": {
        "악성 흑색종": 0.75,
        "기저세포암": 0.15,
        "정상": 0.10
    },
    
    # 2. risk_level (필수, max_length=10 주의!)
    "risk_level": "높음",  # "높음", "중간", "낮음", "정상" 중 하나
    
    # 3. disease_name_ko (필수, DiseaseInfo 생성/조회용)
    "disease_name_ko": "악성 흑색종",  # class_probs에서 가장 높은 확률의 질병명
    
    # 4. disease_name_en (선택, DiseaseInfo 생성용)
    "disease_name_en": "Malignant Melanoma",  # 없으면 "Unknown"으로 설정됨
}
```

### 선택 반환 데이터

```python
{
    # 5. grad_cam_bytes (선택)
    "grad_cam_bytes": bytes or None,  # GradCAM 이미지 바이트 데이터
    
    # 6. vlm_analysis_text (선택)
    "vlm_analysis_text": str or None,  # VLM 분석 텍스트
}
```

## 중요 사항

### 1. risk_level 제약사항
- `max_length=10`이므로 **10자 이내**여야 함
- 권장 값: "높음", "중간", "낮음", "정상"
- 다른 값 사용 시 길이 확인 필요

### 2. class_probs 형식
- 반드시 딕셔너리 형태
- 키: 질병명 (한글 권장, DiseaseInfo의 name_ko와 매칭)
- 값: 확률 (0.0 ~ 1.0 사이의 float)
- 예시:
  ```python
  {
      "악성 흑색종": 0.75,
      "기저세포암": 0.15,
      "정상": 0.10
  }
  ```

### 3. disease_name_ko 매칭
- `disease_name_ko`는 `class_probs`의 키 중 **가장 높은 확률의 질병명**과 일치해야 함
- `DiseaseInfo` 테이블에서 `name_ko`로 조회/생성됨
- 없으면 자동 생성 (classification="기타"로 기본값)

### 4. classification 자동 설정
- `DiseaseInfo`가 없으면 자동 생성 시 `classification="기타"`로 설정됨
- 필요시 수동으로 수정 가능

## 현재 구현된 데이터 흐름

1. **모델 예측** → FastAPI `/predict` 엔드포인트 호출
2. **예측 결과 반환** → 위 형식의 딕셔너리 반환
3. **DiseaseInfo 조회/생성** → `disease_name_ko`로 조회, 없으면 생성
4. **Results 저장** → 예측 결과를 Results 테이블에 저장
5. **의사 계정 표시** → Results가 있으면 의사 계정에서 환자 카드 표시

## 예시: 완전한 반환 데이터

```python
{
    "class_probs": {
        "악성 흑색종": 0.75,
        "기저세포암": 0.15,
        "정상": 0.10
    },
    "risk_level": "높음",
    "disease_name_ko": "악성 흑색종",
    "disease_name_en": "Malignant Melanoma",
    "grad_cam_bytes": <bytes 데이터 또는 None>,
    "vlm_analysis_text": "ABCDE 기법 분석 결과: ..." or None
}
```

