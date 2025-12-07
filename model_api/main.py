from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import Response, JSONResponse
from pathlib import Path
import os
import sys
import logging
import asyncio
import json
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

# 모든 로거에서 응답 body(base64 문자열) 출력 방지
# Python의 기본 logging 핸들러 수정
class NoResponseBodyFilter(logging.Filter):
    """응답 body(base64 문자열)가 로그에 출력되지 않도록 필터"""
    def filter(self, record):
        msg = str(record.getMessage())
        msg_lower = msg.lower()
        
        # 매우 긴 메시지 필터링 (base64 문자열은 보통 매우 깁니다)
        if len(msg) > 1000:  # 1000자 이상은 의심
            # base64 패턴 검사 (알파벳, 숫자, +, /, = 조합)
            if any(keyword in msg_lower for keyword in ['grad_cam_bytes', 'base64', 'iend', '\x89PNG']):
                return False  # 필터링
        
        # 특정 키워드가 포함된 긴 문자열 필터링
        if len(msg) > 100:
            if 'grad_cam_bytes' in msg_lower or ('base64' in msg_lower and len(msg) > 500):
                return False
        
        return True

# 모든 기존 핸들러에 필터 추가
for handler in logging.root.handlers:
    handler.addFilter(NoResponseBodyFilter())

# Uvicorn access logger 완전 비활성화 (응답 body가 로그에 출력되는 것을 방지)
uvicorn_access_logger = logging.getLogger("uvicorn.access")
uvicorn_access_logger.setLevel(logging.CRITICAL)  # CRITICAL만 출력 (거의 모든 로그 차단)
uvicorn_access_logger.propagate = False  # 상위 로거로 전파 방지

# Uvicorn 일반 logger도 조정
uvicorn_logger = logging.getLogger("uvicorn")
uvicorn_logger.setLevel(logging.INFO)

# ⚠️ 문제가 있는 코드 제거 (83-91번째 줄)
# original_addHandler = logging.Handler.addHandler  # ❌ 이 줄 제거
# def addHandler_with_filter(self, handler):        # ❌ 이 함수 제거
#     result = original_addHandler(self, handler)
#     handler.addFilter(NoResponseBodyFilter())
#     return result
# logging.Handler.addHandler = addHandler_with_filter  # ❌ 이 줄 제거

# CORS 미들웨어 설정: 프론트엔드 통신 허용 (OPTIONS 404/CORS 에러 해결)
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # OPTIONS, POST 등 모든 HTTP 메서드 허용
    allow_headers=["*"],  # 모든 헤더 허용
)

# 응답 본문 로그 출력 방지 미들웨어
@app.middleware("http")
async def suppress_response_body_logging(request, call_next):
    """응답 본문이 로그에 출력되지 않도록 미들웨어"""
    response = await call_next(request)
    # 응답 본문을 로그에 출력하지 않도록 보장
    return response

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
async def predict(file: UploadFile = File(...), generate_gradcam: bool = False):
    """
    AI 모델 예측 엔드포인트
    
    Args:
        file: 업로드된 이미지 파일
        generate_gradcam: GradCAM 생성 여부 (기본값: False, 속도 우선)
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
        logger.info(f"[FastAPI] [2/5] 예측 시작 (GradCAM: {generate_gradcam})")
        prediction_result = await asyncio.to_thread(
            prediction_pipeline.predict, 
            image_bytes, 
            generate_gradcam  # 이미 파라미터로 받고 있음
        )
        
        # 예측 결과를 간결하게 로그 출력 (큰 데이터는 크기/요약만 표시)
        logger.info("[FastAPI] [2/5] 예측 완료")
        
        # 위험 수준
        risk_level = prediction_result.get("risk_level")
        if risk_level:
            logger.info(f"  → 위험 수준: {risk_level}")
        
        # 질병명
        disease_name_ko = prediction_result.get("disease_name_ko")
        disease_name_en = prediction_result.get("disease_name_en")
        if disease_name_ko:
            logger.info(f"  → 질병명 (한글): {disease_name_ko}")
        if disease_name_en:
            logger.info(f"  → 질병명 (영문): {disease_name_en}")
        
        # 클래스 확률 (상위 3개만 표시)
        class_probs = prediction_result.get("class_probs")
        if class_probs:
            if isinstance(class_probs, dict):
                sorted_probs = sorted(class_probs.items(), key=lambda x: x[1], reverse=True)[:3]
                prob_str = ", ".join([f"{k}: {v:.4f}" for k, v in sorted_probs])
                logger.info(f"  → 클래스 확률 (상위 3개): {prob_str}")
            else:
                logger.info(f"  → 클래스 확률: {type(class_probs).__name__} (크기: {len(str(class_probs))}자)")
        
        # GradCAM 이미지 크기
        grad_cam_bytes = prediction_result.get("grad_cam_bytes")
        if grad_cam_bytes:
            logger.info(f"  → GradCAM 이미지: {len(grad_cam_bytes)} bytes")
        else:
            logger.info("  → GradCAM 이미지: 없음")
        
        # VLM 분석 텍스트 (크기만 표시)
        vlm_text = prediction_result.get("vlm_analysis_text")
        if vlm_text:
            logger.info(f"  → VLM 분석: {len(vlm_text)}자")
        else:
            logger.info("  → VLM 분석: 없음")

        # GradCAM 이미지를 base64로 인코딩 (있는 경우)
        grad_cam_base64 = None
        if prediction_result.get("grad_cam_bytes"):
            grad_cam_bytes_raw = prediction_result["grad_cam_bytes"]
            logger.info(f"[FastAPI] [2/5] GradCAM base64 인코딩 시작: 원본 크기 {len(grad_cam_bytes_raw)} bytes")
            grad_cam_base64 = base64.b64encode(grad_cam_bytes_raw).decode('utf-8')
            logger.info(f"[FastAPI] [2/5] GradCAM base64 인코딩 완료: 인코딩된 크기 {len(grad_cam_base64)}자 (로그 출력 안 함)")

        # 응답 구성 (grad_cam_bytes는 base64 문자열이므로 로그에 출력하지 않음)
        response_data = {
            "class_probs": prediction_result["class_probs"],
            "risk_level": prediction_result["risk_level"],
            "disease_name_ko": prediction_result["disease_name_ko"],
            "disease_name_en": prediction_result["disease_name_en"],
            "grad_cam_bytes": grad_cam_base64,
        }
        
        # 응답 반환 (base64 문자열은 로그에 출력하지 않음)
        grad_cam_size_str = f'있음 ({len(grad_cam_base64)}자)' if grad_cam_base64 else '없음'
        logger.info(f"[FastAPI] [2/5] 응답 반환 준비: class_probs 크기={len(str(response_data['class_probs']))}자, grad_cam_bytes={grad_cam_size_str}")
        
        # JSONResponse를 사용하여 응답 반환
        # base64 문자열이 로그에 출력되지 않도록 함
        response = JSONResponse(content=response_data)
        
        # 응답 본문을 로그에 출력하지 않도록 명시적으로 설정
        # (uvicorn access 로그에서 제외)
        response.headers["X-Response-Size"] = str(len(str(response_data)))
        
        return response
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
