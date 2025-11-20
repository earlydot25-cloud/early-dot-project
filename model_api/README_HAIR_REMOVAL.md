# 털 제거 파이프라인 통합 가이드

## 개요
환부 이미지에서 털을 제거하는 전처리 파이프라인을 모델 역할로 통합했습니다.

## 파이프라인 구성
1. **U-Net**: 털 마스크 추출
2. **BSRGAN**: 이미지 초해상도 (선택적)
3. **LaMa**: 인페인팅으로 털 제거

## 디렉토리 구조
```
model_api/
├── hair_removal/          # 털 제거 파이프라인 모듈
│   ├── __init__.py
│   ├── pipeline.py        # 메인 파이프라인
│   ├── models.py          # 모델 로딩
│   └── utils.py           # 유틸리티 함수
├── models/                # 모델 파일들
│   ├── hair_mask/         # U-Net 모델
│   │   ├── best_hair_mask_model.pt
│   │   └── best_threshold.txt
│   ├── bsrgan/            # BSRGAN 모델
│   │   ├── BSRGANx2.pth
│   │   └── network_rrdbnet.py
│   └── lama/              # LaMa 모델
│       ├── big-lama/
│       └── bin/predict.py
└── main.py                # FastAPI 엔드포인트
```

## API 엔드포인트
- `POST /remove-hair`: 이미지 업로드하여 털 제거 처리

## 동작 흐름
1. 환자가 이미지 업로드 → Django `PhotoUploadView`
2. 이미지 저장 후 → FastAPI `/remove-hair` 호출
3. 털 제거 처리 → 처리된 이미지로 원본 덮어쓰기

## 모델 파일 복사
원본 파일은 `safezone_bundle/`에 그대로 유지되며, `model_api/models/`로 복사본이 생성됩니다.

## 주의사항
- 모델 파일 크기가 크므로 Docker 이미지 빌드 시 시간이 걸릴 수 있습니다
- LaMa는 subprocess로 실행되므로 경로 설정이 중요합니다
- 처리 시간이 길 수 있으므로 타임아웃을 충분히 설정했습니다 (5분)

