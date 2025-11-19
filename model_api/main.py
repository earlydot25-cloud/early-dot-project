# model_api/main.py
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import Response
from pathlib import Path
import os
import sys
import logging

from hair_removal import HairRemovalPipeline
from prediction import PredictionPipeline

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

# 전역 파이프라인 인스턴스 (서버 시작 시 한 번만 로드)
pipeline: HairRemovalPipeline = None
prediction_pipeline: PredictionPipeline = None


@app.on_event("startup")
async def startup_event():
    """서버 시작 시 모델 로드"""
    global pipeline, prediction_pipeline
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
    
    Args:
        file: 업로드된 이미지 파일
        
    Returns:
        처리된 이미지 (PNG 형식)
    """
    logger.info(f"[FastAPI] /remove-hair 요청 받음: filename={file.filename}, content_type={file.content_type}")
    
    if pipeline is None:
        logger.error("[FastAPI] 파이프라인이 로드되지 않았습니다")
        raise HTTPException(status_code=503, detail="파이프라인이 로드되지 않았습니다")
    
    # 파일 읽기
    try:
        image_bytes = await file.read()
        logger.info(f"[FastAPI] 파일 읽기 완료: {len(image_bytes)} bytes")
    except Exception as e:
        logger.error(f"[FastAPI] 파일 읽기 실패: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"파일 읽기 실패: {str(e)}")
    
    # 파이프라인 처리
    try:
        logger.info("[FastAPI] 파이프라인 처리 시작")
        processed_bytes = pipeline.process(image_bytes)
        logger.info(f"[FastAPI] 파이프라인 처리 완료: {len(processed_bytes)} bytes")
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
    logger.info("[FastAPI] 응답 반환")
    return Response(
        content=processed_bytes,
        media_type="image/png",
        headers={"Content-Disposition": "attachment; filename=processed.png"}
    )


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    AI 모델 예측 엔드포인트
    털 제거된 이미지를 받아서 질병 예측을 수행합니다.
    
    Args:
        file: 털 제거된 이미지 파일
        
    Returns:
        {
            "class_probs": {"disease1": 0.8, "disease2": 0.2, ...},
            "risk_level": "높음",
            "disease_name_ko": "악성 흑색종",
            "disease_name_en": "Malignant Melanoma",
            "grad_cam_bytes": Optional[base64_encoded_string],
            "vlm_analysis_text": Optional[str],
        }
    """
    logger.info(f"[FastAPI] /predict 요청 받음: filename={file.filename}, content_type={file.content_type}")
    
    if prediction_pipeline is None:
        logger.error("[FastAPI] 예측 파이프라인이 로드되지 않았습니다")
        raise HTTPException(status_code=503, detail="예측 파이프라인이 로드되지 않았습니다")
    
    # 파일 읽기
    try:
        image_bytes = await file.read()
        logger.info(f"[FastAPI] 파일 읽기 완료: {len(image_bytes)} bytes")
    except Exception as e:
        logger.error(f"[FastAPI] 파일 읽기 실패: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"파일 읽기 실패: {str(e)}")
    
    # 예측 수행
    try:
        logger.info("[FastAPI] 예측 시작")
        prediction_result = prediction_pipeline.predict(image_bytes)
        logger.info(f"[FastAPI] 예측 완료: {prediction_result}")
        
        # GradCAM 이미지를 base64로 인코딩 (있는 경우)
        grad_cam_base64 = None
        if prediction_result.get("grad_cam_bytes"):
            import base64
            grad_cam_base64 = base64.b64encode(prediction_result["grad_cam_bytes"]).decode('utf-8')
        
        return {
            "class_probs": prediction_result["class_probs"],
            "risk_level": prediction_result["risk_level"],
            "disease_name_ko": prediction_result["disease_name_ko"],
            "disease_name_en": prediction_result["disease_name_en"],
            "grad_cam_bytes": grad_cam_base64,
            "vlm_analysis_text": prediction_result.get("vlm_analysis_text"),
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
