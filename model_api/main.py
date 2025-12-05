from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import Response
from pathlib import Path
import os
import sys
import logging
import asyncio
# CORS 및 Pydantic 모델 관련 라이브러리
import base64
import numpy as np
import cv2
import torch
import time
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from hair_removal import HairRemovalPipeline
from prediction import PredictionPipeline


DEVICE = 'cpu'

# 장치 자동 결정 로직
try:
    if torch.cuda.is_available():
        DEVICE = 'cuda'
    elif torch.backends.mps.is_available():
        DEVICE = 'mps'
except (NameError, ImportError):
    # torch가 없거나 import 오류 시 기본값 'cpu' 사용
    pass
# -------------------------------------------------------------


# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.StreamHandler(sys.stderr)
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS 미들웨어 설정: 프론트엔드 통신 허용 (OPTIONS 404/CORS 에러 해결)
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # OPTIONS, POST 등 모든 HTTP 메서드 허용
    allow_headers=["*"],  # 모든 헤더 허용
)

# 전역 파이프라인 인스턴스 (서버 시작 시 한 번만 로드)
pipeline: HairRemovalPipeline = None
prediction_pipeline: PredictionPipeline = None


@app.on_event("startup")
async def startup_event():
    """서버 시작 시 모델 로드"""
    global pipeline, prediction_pipeline, DEVICE
    try:
        # 모델 디렉토리 경로 (상대 경로)
        models_dir = Path(__file__).parent / "models"
        logger.info(f"[FastAPI] 모델 디렉토리: {models_dir}")
        logger.info(f"[FastAPI] 모델 디렉토리 존재 여부: {models_dir.exists()}")

        # 털 제거 파이프라인 로드
        pipeline = HairRemovalPipeline(models_dir=models_dir)
        logger.info("[FastAPI] 털 제거 파이프라인 로드 완료")

        # AI 예측 파이프라인 로드
        prediction_pipeline = PredictionPipeline(models_dir=models_dir)
        prediction_pipeline.load_model()
        logger.info("[FastAPI] AI 예측 파이프라인 로드 완료")


    except Exception as e:
        logger.error(f"[FastAPI] 파이프라인 로드 실패: {e}", exc_info=True)
        raise


@app.get("/")
def root():
    return {"message": "Early Dot Model API", "status": "running"}


@app.post("/remove-hair")
async def remove_hair(file: UploadFile = File(...)):
    """
    환부 이미지에서 털 제거 처리
    ... (기존 로직 유지) ...
    """
    logger.info(f"[FastAPI] [1/5] /remove-hair 요청 받음: filename={file.filename}, content_type={file.content_type}")

    if pipeline is None:
        logger.error("[FastAPI] [1/5] 파이프라인이 로드되지 않았습니다")
        raise HTTPException(status_code=503, detail="파이프라인이 로드되지 않았습니다")

    # 파일 읽기
    try:
        image_bytes = await file.read()
        logger.info(f"[FastAPI] [1/5] 파일 읽기 완료: {len(image_bytes)} bytes")
    except Exception as e:
        logger.error(f"[FastAPI] [1/5] 파일 읽기 실패: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"파일 읽기 실패: {str(e)}")

    # 파이프라인 처리
    try:
        logger.info("[FastAPI] [1/5] 파이프라인 처리 시작")
        processed_bytes = await asyncio.to_thread(pipeline.process, image_bytes)
        logger.info(f"[FastAPI] [1/5] 파이프라인 처리 완료: {len(processed_bytes)} bytes")
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"[FastAPI] 이미지 처리 중 에러 발생: {e}")
        logger.error(f"[FastAPI] 에러 상세:\n{error_trace}")
        # stderr에도 출력 (확실하게)
        sys.stderr.write(f"[FastAPI ERROR] {e}\n{error_trace}\n")
        sys.stderr.flush()
        raise HTTPException(
            status_code=500,
            detail=f"이미지 처리 실패: {str(e)}"
        )

    # 결과 반환
    logger.info("[FastAPI] [1/5] 응답 반환")
    return Response(
        content=processed_bytes,
        media_type="image/png",
        headers={"Content-Disposition": "attachment; filename=processed.png"}
    )


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    AI 모델 예측 엔드포인트
    ... (기존 로직 유지) ...
    """
    logger.info(f"[FastAPI] [2/5] /predict 요청 받음: filename={file.filename}, content_type={file.content_type}")

    if prediction_pipeline is None:
        logger.error("[FastAPI] [2/5] 예측 파이프라인이 로드되지 않았습니다")
        raise HTTPException(status_code=503, detail="예측 파이프라인이 로드되지 않았습니다")

    # 파일 읽기
    try:
        image_bytes = await file.read()
        logger.info(f"[FastAPI] [2/5] 파일 읽기 완료: {len(image_bytes)} bytes")
    except Exception as e:
        logger.error(f"[FastAPI] [2/5] 파일 읽기 실패: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"파일 읽기 실패: {str(e)}")

    # 예측 수행
    try:
        logger.info("[FastAPI] [2/5] 예측 시작")
        prediction_result = await asyncio.to_thread(prediction_pipeline.predict, image_bytes)
        logger.info(f"[FastAPI] [2/5] 예측 완료: {prediction_result}")

        # GradCAM 이미지를 base64로 인코딩 (있는 경우)
        grad_cam_base64 = None
        if prediction_result.get("grad_cam_bytes"):
            grad_cam_base64 = base64.b64encode(prediction_result["grad_cam_bytes"]).decode('utf-8')

        return {
            "class_probs": prediction_result["class_probs"],
            "risk_level": prediction_result["risk_level"],
            "disease_name_ko": prediction_result["disease_name_ko"],
            "disease_name_en": prediction_result["disease_name_en"],
            "grad_cam_bytes": grad_cam_base64,
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"[FastAPI] 예측 중 에러 발생: {e}")
        logger.error(f"[FastAPI] 에러 상세:\n{error_trace}")
        sys.stderr.write(f"[FastAPI ERROR] {e}\n{error_trace}\n")
        sys.stderr.flush()
        raise HTTPException(
            status_code=500,
            detail=f"예측 실패: {str(e)}"
        )
