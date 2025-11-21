import base64
import json
import numpy as np
import cv2
import torch
import time
from io import BytesIO
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from ultralytics import YOLO

# -------------------------------------------------------------
# 1. 모델 가중치 경로 설정 (사용자 제공 경로)
# -------------------------------------------------------------
MODEL_WEIGHTS_PATH = "models/yolo/yolo_batch8_epoch50_best.pt"

# -------------------------------------------------------------
# 2. FastAPI 애플리케이션 및 모델 로드
# -------------------------------------------------------------
app = FastAPI(title="YOLO Real-time Detection API")
yolo_model: YOLO | None = None
DEVICE = 'cpu'  # 기본 장치 설정

# 💡 [추가] 장치 자동 결정 로직
if torch.cuda.is_available():
    DEVICE = 'cuda'  # NVIDIA GPU (CUDA) 사용 가능
elif torch.backends.mps.is_available():
    DEVICE = 'mps'  # Apple Silicon (MPS) 사용 가능

print(f"✨ 모델 추론 장치 설정: {DEVICE}")


# 서버 시작 시 모델을 미리 로드
@app.on_event("startup")
async def load_model():
    global yolo_model
    print(f"✨ 모델 로드 중: {MODEL_WEIGHTS_PATH}")
    try:
        # 모델 로드 및 결정된 장치로 이동
        yolo_model = YOLO(MODEL_WEIGHTS_PATH)
        yolo_model.to(DEVICE)  # 💡 [수정] 모델을 GPU/MPS 장치로 이동
        print(f"✅ YOLO 모델 로드 완료. (장치: {DEVICE})")
    except Exception as e:
        print(f"🚨 모델 로드 실패: {e}")
        # 실제 운영 환경에서는 서버 시작을 중단해야 할 수 있습니다.


# -------------------------------------------------------------
# 3. 요청 및 응답 데이터 모델 (분류/신뢰도 제거)
# -------------------------------------------------------------

# 프론트엔드에서 보낼 요청 데이터 구조
class ImageRequest(BaseModel):
    # 'data:image/jpeg;base64,...' 형식의 Base64 문자열
    image_base64: str


# 💡 [수정] 탐지 결과 구조: 바운딩 박스 좌표만 포함
class DetectionResult(BaseModel):
    # [x1, y1, x2, y2] - 0부터 1000 사이의 정규화된 좌표
    box: list[int]


# -------------------------------------------------------------
# 4. 이미지 디코딩 및 전처리 함수
# -------------------------------------------------------------
def decode_base64_image(base64_string: str) -> np.ndarray:
    """Base64 문자열을 OpenCV 이미지 배열(numpy ndarray)로 디코딩합니다."""
    try:
        # 'data:image/jpeg;base64,' 부분을 제거하고 실제 Base64 데이터만 추출
        header, encoded = base64_string.split(',', 1)

        # Base64 디코딩
        decoded_data = base64.b64decode(encoded)

        # NumPy 배열로 변환
        np_arr = np.frombuffer(decoded_data, np.uint8)

        # OpenCV로 디코딩 (BGR 형식)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("CV2 이미지 디코딩 실패")

        print(f"📸 [BACKEND] 디코딩 성공. 이미지 크기: {img.shape}")

        return img

    except Exception as e:
        print(f"🚨 [BACKEND] 이미지 디코딩 오류: {e}")
        raise HTTPException(status_code=400, detail=f"이미지 디코딩 오류: {e}")


# -------------------------------------------------------------
# 5. 탐지 API 엔드포인트
# -------------------------------------------------------------
@app.post("/api/detect/stream", response_model=list[DetectionResult])
async def stream_detection(request: ImageRequest):
    """실시간으로 전송된 Base64 이미지에 대해 YOLO 객체 탐지를 수행합니다."""

    if yolo_model is None:
        print("🚨 [BACKEND] 에러: 모델이 로드되지 않았습니다. 503 반환.")
        raise HTTPException(status_code=503, detail="모델이 로드되지 않았습니다.")

    start_time = time.time()

    # 1. Base64 디코딩 및 이미지 로드
    img_bgr = decode_base64_image(request.image_base64)
    H, W, _ = img_bgr.shape  # 이미지의 높이와 너비

    # 2. YOLO 추론 실행
    # 💡 [수정] conf=0.7로 신뢰도 임계값을 설정하여 너무 많은 탐지 결과 방지
    # 프론트엔드에서 300ms 간격으로 호출되므로, 추론 시간(inference time) 자체는 변경하지 않습니다.
    # 만약 프론트엔드에서 너무 느리다면, delay_ms를 늘리는 것이 좋습니다.
    results = yolo_model.predict(
        source=img_bgr,
        device=DEVICE,
        conf=0.7,  # 💡 [추가] 신뢰도 0.7 미만인 결과는 무시
        verbose=False
    )

    end_time = time.time()

    detections: list[DetectionResult] = []

    # 3. 바운딩 박스 결과 처리 및 정규화
    if results and len(results) > 0:
        result = results[0]

        # 💡 [수정] 신뢰도와 라벨을 사용하지 않고, 오직 바운딩 박스만 추출
        for box in result.boxes:
            # 바운딩 박스 좌표 [x1, y1, x2, y2] (픽셀 단위)
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

            # 좌표 정규화 (0~1000 스케일로 변환)
            n_x1 = int((x1 / W) * 1000)
            n_y1 = int((y1 / H) * 1000)
            n_x2 = int((x2 / W) * 1000)
            n_y2 = int((y2 / H) * 1000)

            # 💡 [수정] DetectionResult에 box만 추가
            detections.append(DetectionResult(
                box=[n_x1, n_y1, n_x2, n_y2]
            ))

    print(f"🔍 [BACKEND] 탐지 완료. 객체 수: {len(detections)}, 추론 시간: {end_time - start_time:.4f}s")

    return detections