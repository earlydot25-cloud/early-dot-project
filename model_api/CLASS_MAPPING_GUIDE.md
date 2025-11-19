# 클래스 매핑 가이드

## 개요

모델이 예측한 클래스 인덱스나 영문명을 한국어 질병명으로 매핑하는 방법입니다.

## 매핑 딕셔너리 설정

`prediction.py` 파일의 `CLASS_TO_KOREAN` 딕셔너리를 모델이 예측하는 클래스에 맞게 수정하세요.

### 예시 1: 클래스 인덱스로 매핑

모델이 클래스 인덱스 (0, 1, 2, ...)를 반환하는 경우:

```python
CLASS_TO_KOREAN = {
    0: "정상",
    1: "악성 흑색종",
    2: "기저세포암",
    3: "편평세포암",
    4: "양성 모반",
    5: "지루각화증",
}
```

### 예시 2: 영문명으로 매핑

모델이 영문 클래스명을 반환하는 경우:

```python
CLASS_TO_KOREAN = {
    "normal": "정상",
    "malignant_melanoma": "악성 흑색종",
    "basal_cell_carcinoma": "기저세포암",
    "squamous_cell_carcinoma": "편평세포암",
    "benign_nevus": "양성 모반",
    "seborrheic_keratosis": "지루각화증",
}
```

### 예시 3: 혼합 (인덱스와 영문명 모두 지원)

```python
CLASS_TO_KOREAN = {
    # 인덱스
    0: "정상",
    1: "악성 흑색종",
    # 영문명
    "normal": "정상",
    "malignant_melanoma": "악성 흑색종",
}
```

## 영문명 매핑

`KOREAN_TO_ENGLISH` 딕셔너리도 함께 수정하세요:

```python
KOREAN_TO_ENGLISH = {
    "정상": "Normal",
    "악성 흑색종": "Malignant Melanoma",
    "기저세포암": "Basal Cell Carcinoma",
    "편평세포암": "Squamous Cell Carcinoma",
    "양성 모반": "Benign Nevus",
    "지루각화증": "Seborrheic Keratosis",
}
```

## 데이터 흐름

1. **모델 예측** → 클래스 인덱스나 영문명 반환
   - 예: `{0: 0.8, 1: 0.15, 2: 0.05}` 또는 `{"malignant_melanoma": 0.8, "normal": 0.15, ...}`

2. **한국어 변환** → `_convert_class_probs_to_korean()` 메서드로 변환
   - 예: `{"악성 흑색종": 0.8, "정상": 0.15, "기저세포암": 0.05}`

3. **Results 저장** → 한국어 질병명으로 저장
   - `class_probs`: `{"악성 흑색종": 0.8, "정상": 0.15, ...}`
   - `disease_name_ko`: `"악성 흑색종"`
   - `disease_name_en`: `"Malignant Melanoma"`

4. **결과 화면 표시** → `data.disease.name_ko`와 `data.disease.name_en` 표시
   - 예: `"Malignant Melanoma (악성 흑색종)"`

## 구현 예시

`predict()` 메서드에서 모델 예측 후 변환:

```python
def predict(self, image_bytes: bytes) -> Dict:
    # 모델 예측 (원시 결과)
    raw_predictions = self.model(image_tensor)  # 예: [0.8, 0.15, 0.05]
    
    # 클래스 인덱스로 확률 딕셔너리 생성
    num_classes = len(raw_predictions)
    raw_class_probs = {i: float(raw_predictions[i]) for i in range(num_classes)}
    # 결과: {0: 0.8, 1: 0.15, 2: 0.05}
    
    # 한국어로 변환
    korean_class_probs = self._convert_class_probs_to_korean(raw_class_probs)
    # 결과: {"악성 흑색종": 0.8, "정상": 0.15, "기저세포암": 0.05}
    
    # 가장 높은 확률의 질병 찾기
    max_class = max(korean_class_probs.items(), key=lambda x: x[1])
    disease_name_ko = max_class[0]  # "악성 흑색종"
    disease_name_en = self._map_to_english(disease_name_ko)  # "Malignant Melanoma"
    
    return {
        "class_probs": korean_class_probs,
        "risk_level": self.get_risk_level(korean_class_probs),
        "disease_name_ko": disease_name_ko,
        "disease_name_en": disease_name_en,
        ...
    }
```

