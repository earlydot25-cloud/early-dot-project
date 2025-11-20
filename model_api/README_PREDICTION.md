# AI 모델 예측 파이프라인 구현 가이드

## 개요

털 제거 파이프라인 뒤에 AI 모델 예측을 연결하여 `Results` 테이프에 저장하는 파이프라인입니다.

## 파일 구조

```
model_api/
├── prediction.py          # 예측 파이프라인 클래스 (수정 필요)
├── models/
│   └── prediction/        # 모델 파일을 여기에 배치
│       └── your_model.pth
└── main.py                # FastAPI 엔드포인트 (이미 구현됨)
```

## 구현 단계

### 1. 모델 파일 배치

모델 파일을 `model_api/models/prediction/` 디렉토리에 배치합니다.

예시:
- `model_api/models/prediction/your_model.pth`
- `model_api/models/prediction/your_model.onnx`
- 등등

### 2. `prediction.py` 수정

`model_api/prediction.py` 파일의 두 메서드를 구현합니다:

#### `load_model()` 메서드

모델을 로드하는 로직을 구현합니다.

```python
def load_model(self):
    """모델 로드 메서드"""
    import torch
    
    # 모델 파일 경로
    model_path = self.models_dir / "prediction" / "your_model.pth"
    
    # 모델 로드
    self.model = torch.load(model_path, map_location='cpu')
    self.model.eval()
    
    self.is_loaded = True
    logger.info("[Prediction] 모델 로드 완료")
```

#### `predict()` 메서드

이미지 예측 로직을 구현합니다.

```python
def predict(self, image_bytes: bytes) -> Dict:
    """이미지 예측 메서드"""
    import cv2
    import numpy as np
    from PIL import Image
    import io
    
    # 이미지 바이트를 numpy 배열로 변환
    image = Image.open(io.BytesIO(image_bytes))
    image_array = np.array(image)
    
    # 전처리 (리사이즈, 정규화 등)
    # TODO: 모델에 맞는 전처리 구현
    
    # 예측 수행
    with torch.no_grad():
        predictions = self.model(image_tensor)
    
    # 후처리 (확률 계산, 클래스 매핑 등)
    class_probs = self._process_predictions(predictions)
    
    # 가장 높은 확률의 질병 찾기
    max_class = max(class_probs.items(), key=lambda x: x[1])
    disease_name_ko = self._get_disease_name_ko(max_class[0])
    disease_name_en = self._get_disease_name_en(max_class[0])
    
    # 위험도 계산
    risk_level = self.get_risk_level(class_probs)
    
    # GradCAM 이미지 생성 (선택적)
    grad_cam_bytes = self._generate_gradcam(image_array) if has_gradcam else None
    
    # VLM 분석 텍스트 생성 (선택적)
    vlm_analysis_text = self._generate_vlm_analysis(image_array) if has_vlm else None
    
    return {
        "class_probs": class_probs,
        "risk_level": risk_level,
        "disease_name_ko": disease_name_ko,
        "disease_name_en": disease_name_en,
        "grad_cam_bytes": grad_cam_bytes,
        "vlm_analysis_text": vlm_analysis_text,
    }
```

### 3. 반환 형식

`predict()` 메서드는 다음 형식의 딕셔너리를 반환해야 합니다:

```python
{
    "class_probs": {
        "악성 흑색종": 0.8,
        "기저세포암": 0.15,
        "정상": 0.05
    },
    "risk_level": "높음",  # "높음", "중간", "낮음", "정상"
    "disease_name_ko": "악성 흑색종",
    "disease_name_en": "Malignant Melanoma",
    "grad_cam_bytes": bytes or None,  # GradCAM 이미지 바이트 (선택적)
    "vlm_analysis_text": str or None,  # VLM 분석 텍스트 (선택적)
}
```

## 데이터 흐름

1. **사진 업로드** → `Photos` 테이블에 저장
2. **털 제거** → FastAPI `/remove-hair` 호출 → 털 제거된 이미지로 원본 파일 덮어쓰기
3. **AI 예측** → FastAPI `/predict` 호출 → 예측 결과 반환
4. **Results 저장** → Django에서 예측 결과를 받아서 `Results` 테이블에 저장
5. **의사 계정 표시** → `Results`가 있으면 의사 계정에서 환자 카드 표시

## 테스트

모델 구현 후 다음 명령으로 테스트:

```bash
# FastAPI 서버 재시작
docker compose restart fastapi

# 로그 확인
docker compose logs -f fastapi
```

## 주의사항

1. **모델 파일 크기**: 대용량 모델 파일은 Docker 이미지 빌드 시간이 길어질 수 있습니다.
2. **메모리 사용량**: 모델 로드 시 메모리 사용량을 고려하세요.
3. **예외 처리**: 모델 로드 실패 시 서버가 시작되지 않도록 `startup_event`에서 예외를 발생시킵니다.
4. **타임아웃**: 예측 시간이 길 수 있으므로 Django에서 FastAPI 호출 시 타임아웃을 충분히 설정했습니다 (300초).

## 질병 정보 (DiseaseInfo)

예측 결과의 `disease_name_ko`가 `DiseaseInfo` 테이블에 없으면 자동으로 생성됩니다.
기본값으로 `classification="기타"`가 설정되며, 필요시 수동으로 수정하세요.

