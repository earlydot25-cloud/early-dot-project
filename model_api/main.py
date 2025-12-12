from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import Response, JSONResponse
from pathlib import Path
import sys
import logging
import asyncio
import base64
from fastapi.middleware.cors import CORSMiddleware

from hair_removal import HairRemovalPipeline
from prediction import PredictionPipeline

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 전역 파이프라인 인스턴스
pipeline: HairRemovalPipeline = None
prediction_pipeline: PredictionPipeline = None


@app.on_event("startup")
async def startup_event():
    """서버 시작 시 모델 로드"""
    global pipeline, prediction_pipeline
    try:
        models_dir = Path(__file__).parent / "models"
        logger.info(f"모델 디렉토리: {models_dir}")

        # 털 제거 파이프라인 로드
        pipeline = HairRemovalPipeline(models_dir=models_dir)
        logger.info("털 제거 파이프라인 로드 완료")

        # AI 예측 파이프라인 로드
        prediction_pipeline = PredictionPipeline(models_dir=models_dir)
        prediction_pipeline.load_model()
        logger.info("AI 예측 파이프라인 로드 완료")

    except Exception as e:
        logger.error(f"파이프라인 로드 실패: {e}", exc_info=True)
        raise


@app.get("/")
def root():
    return {"message": "Early Dot Model API", "status": "running"}


@app.post("/remove-hair")
async def remove_hair(file: UploadFile = File(...)):
    """환부 이미지에서 털 제거 처리"""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="파이프라인이 로드되지 않았습니다")

    try:
        image_bytes = await file.read()
        processed_bytes = await asyncio.to_thread(pipeline.process, image_bytes)
        return Response(
            content=processed_bytes,
            media_type="image/png",
            headers={"Content-Disposition": "attachment; filename=processed.png"}
        )
    except Exception as e:
        logger.error(f"털 제거 처리 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"이미지 처리 실패: {str(e)}")


@app.post("/predict")
async def predict(file: UploadFile = File(...), generate_gradcam: bool = False):
    """AI 모델 예측 엔드포인트"""
    if prediction_pipeline is None:
        raise HTTPException(status_code=503, detail="예측 파이프라인이 로드되지 않았습니다")

    try:
        image_bytes = await file.read()
        prediction_result = await asyncio.to_thread(
            prediction_pipeline.predict,
            image_bytes,
            generate_gradcam
        )

        # GradCAM 이미지를 base64로 인코딩 (있는 경우)
        grad_cam_base64 = None
        if prediction_result.get("grad_cam_bytes"):
            grad_cam_base64 = base64.b64encode(
                prediction_result["grad_cam_bytes"]
            ).decode('utf-8')

        response_data = {
            "class_probs": prediction_result["class_probs"],
            "risk_level": prediction_result["risk_level"],
            "disease_name_ko": prediction_result["disease_name_ko"],
            "disease_name_en": prediction_result["disease_name_en"],
            "grad_cam_bytes": grad_cam_base64,
        }

        return JSONResponse(content=response_data)

    except Exception as e:
        logger.error(f"예측 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"예측 실패: {str(e)}")
