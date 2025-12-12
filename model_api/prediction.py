"""
AI 모델 예측 파이프라인
사용자가 모델 파일을 제공하면 이 파일을 수정하여 예측 로직을 구현합니다.
"""
from pathlib import Path
from typing import Dict, Tuple, Optional, List
import logging
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger(__name__)

# gradcam_web_inference 모듈 import 시도
try:
    from gradcam_web_inference import generate_gradcam_overlay
    HAS_GRADCAM_MODULE = True
    logger.info("[Prediction] gradcam_web_inference 모듈 import 성공")
except ImportError as e:
    HAS_GRADCAM_MODULE = False
    logger.warning(f"[Prediction] gradcam_web_inference 모듈을 import할 수 없습니다: {e}")
    logger.warning("[Prediction] GradCAM 기능을 사용하려면 gradcam_web_inference.py가 필요합니다.")

# 클래스 인덱스/영문명을 한국어 질병명으로 매핑하는 딕셔너리
# 모델이 예측하는 8개 클래스
# ⚠️ 중요: gradcam_web_inference.py의 CLASS_NAMES 순서와 일치해야 함
# CLASS_NAMES = ['ak', 'bcc', 'bkl', 'df', 'mel', 'nv', 'scc', 'vasc'] (알파벳 순서)
CLASS_TO_KOREAN = {
    # 클래스 인덱스로 매핑 (8개 피부 질환 분류) - gradcam_web_inference.py 순서와 일치
    0: "광선 각화증",  # Actinic Keratosis (AK) - 인덱스 0
    1: "기저세포암",  # Basal Cell Carcinoma (BCC) - 인덱스 1
    2: "양성 각화증",  # Benign Keratosis (BKL) - 인덱스 2
    3: "피부섬유종",  # Dermatofibroma (DF) - 인덱스 3
    4: "흑색종",  # Melanoma (MEL) - 인덱스 4
    5: "모반",  # Nevus (NV) - 인덱스 5
    6: "편평세포암",  # Squamous Cell Carcinoma (SCC) - 인덱스 6
    7: "혈관종",  # Vascular (VASC) - 인덱스 7
    
    # 영문명으로 매핑
    "melanoma": "흑색종",
    "nevus": "모반",
    "basal_cell_carcinoma": "기저세포암",
    "squamous_cell_carcinoma": "편평세포암",
    "dermatofibroma": "피부섬유종",
    "benign_keratosis": "양성 각화증",
    "actinic_keratosis": "광선 각화증",
    "vascular": "혈관종",
}

# 한국어 질병명을 영문명으로 매핑하는 딕셔너리
KOREAN_TO_ENGLISH = {
    "흑색종": "Melanoma",
    "모반": "Nevus",
    "기저세포암": "Basal Cell Carcinoma",
    "편평세포암": "Squamous Cell Carcinoma",
    "피부섬유종": "Dermatofibroma",
    "양성 각화증": "Benign Keratosis",
    "광선 각화증": "Actinic Keratosis",
    "혈관종": "Vascular",
}

# ImageNet 정규화 상수
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]

# 클래스 수
NUM_CLASSES = 8

# Soft Voting 앙상블 가중치 (CNN_weight, ViT_weight)
# 환경변수로 변경 가능: ENSEMBLE_CNN_WEIGHT, ENSEMBLE_VIT_WEIGHT
import os
DEFAULT_CNN_WEIGHT = float(os.getenv('ENSEMBLE_CNN_WEIGHT', '0.5'))
DEFAULT_VIT_WEIGHT = float(os.getenv('ENSEMBLE_VIT_WEIGHT', '0.5'))


class SoftVotingEnsemble(nn.Module):
    """Soft Voting 앙상블 모델 (CNN 앙상블 + ViT)"""
    def __init__(self, cnn_model, vit_model, num_classes, weights=[0.5, 0.5]):
        super().__init__()
        self.cnn_model = cnn_model
        self.vit_model = vit_model
        self.num_classes = num_classes
        # 가중치 정규화 (합이 1이 되도록)
        weight_sum = sum(weights)
        self.weights = [w / weight_sum for w in weights]
        logger.info(f"[Ensemble] Soft Voting 가중치: CNN={self.weights[0]:.2f}, ViT={self.weights[1]:.2f}")
        
    def forward(self, x):
        # CNN 앙상블 모델 예측
        cnn_logits = self.cnn_model(x)
        cnn_probs = F.softmax(cnn_logits, dim=1)
        
        # ViT 모델 예측
        vit_logits = self.vit_model(x)
        vit_probs = F.softmax(vit_logits, dim=1)
        
        # 가중 평균
        ensemble_probs = self.weights[0] * cnn_probs + self.weights[1] * vit_probs
        
        # 확률을 logits로 변환 (다음 단계에서 softmax를 다시 적용할 수 있도록)
        # 하지만 이미 확률이므로 그대로 반환
        return ensemble_probs


class PredictionPipeline:
    """
    AI 모델 예측 파이프라인 클래스
    
    사용 방법:
    1. 모델 파일을 model_api/models/prediction/ 디렉토리에 배치
    2. load_model() 메서드에서 모델 로드 로직 구현
    3. predict() 메서드에서 예측 로직 구현
    """
    
    def __init__(self, models_dir: Path):
        """
        Args:
            models_dir: 모델 파일이 있는 디렉토리 경로
        """
        self.models_dir = models_dir
        self.model = None
        self.is_loaded = False
        self.device = None
        self.cnn_model = None
        self.vit_model = None
    
    def _build_combined_model(self, state_dict, device):
        """
        combined_resnet50_effnetb4 모델 아키텍처 정의
        gradcam_visualization.py의 EnsembleModel 구조를 그대로 사용
        """
        import torch
        import torch.nn as nn
        import torchvision.models as models
        
        logger.info("[Prediction] combined_resnet50_effnetb4 모델 아키텍처 정의 시작 (EnsembleModel 구조)")
        
        # state_dict 키 분석
        state_dict_keys = list(state_dict.keys())
        
        # gradcam_visualization.py의 EnsembleModel 구조를 그대로 사용
        class EnsembleModel(nn.Module):
            def __init__(self, num_classes=8):  # 기본 8개 클래스
                super(EnsembleModel, self).__init__()
                
                # ResNet50 (백본 A) - gradcam_visualization.py와 동일
                try:
                    from torchvision.models import ResNet50_Weights
                    self.model_A = models.resnet50(weights=ResNet50_Weights.IMAGENET1K_V1)
                except:
                    self.model_A = models.resnet50(pretrained=True)
                self.model_A.fc = nn.Identity()
                
                # EfficientNetB4 (백본 B) - gradcam_visualization.py와 동일
                try:
                    from torchvision.models import EfficientNet_B4_Weights
                    self.model_B = models.efficientnet_b4(weights=EfficientNet_B4_Weights.IMAGENET1K_V1)
                    num_ftrs_b = self.model_B.classifier[1].in_features
                    self.model_B.classifier = nn.Identity()
                except:
                    try:
                        import timm
                        self.model_B = timm.create_model('efficientnet_b4', pretrained=True, num_classes=0)
                        num_ftrs_b = 1792
                    except ImportError:
                        logger.warning("[Prediction] timm이 없어 EfficientNet-B0로 대체합니다.")
                        self.model_B = models.efficientnet_b0(pretrained=True)
                        num_ftrs_b = 1280
                        self.model_B.classifier = nn.Identity()
                
                # 앙상블 분류기 - ResNet50 + EfficientNetB4 특징 결합
                combined_features_size = 2048 + num_ftrs_b  # 2048 + 1792 = 3840
                self.classifier = nn.Sequential(
                    nn.Dropout(0.6),
                    nn.Linear(combined_features_size, 512),  # 3840 -> 512
                    nn.ReLU(),
                    nn.Dropout(0.4),
                    nn.Linear(512, num_classes)
                )
            
            def forward(self, x):
                # ensemble_model_utils.py와 동일한 구조 (단순 forward)
                features_A = self.model_A(x)
                features_B = self.model_B(x)
                combined_features = torch.cat((features_A, features_B), dim=1)
                output = self.classifier(combined_features)
                return output
        
        # 모델 생성 - EnsembleModel 사용
        num_classes = 8  # 기본값 (8개 클래스)
        # 마지막 classifier 레이어 찾기 (입력 차원이 512인 것)
        classifier_keys = [key for key in state_dict_keys if ('classifier' in key or 'fc' in key) and 'weight' in key]
        if classifier_keys:
            # 입력 차원이 512인 레이어 찾기 (마지막 Linear 레이어)
            for key in classifier_keys:
                weight_shape = state_dict[key].shape
                if len(weight_shape) == 2:
                    # 입력 차원이 512면 마지막 레이어
                    if weight_shape[1] == 512:
                        num_classes = weight_shape[0]
                        logger.info(f"[Prediction] state_dict에서 num_classes 추론: {num_classes} (키: {key})")
                        break
            else:
                # 입력 차원이 512인 레이어를 찾지 못한 경우, 마지막 classifier 레이어 사용
                last_key = classifier_keys[-1]
                weight_shape = state_dict[last_key].shape
                if len(weight_shape) == 2:
                    num_classes = weight_shape[0]
                    logger.info(f"[Prediction] state_dict에서 num_classes 추론 (마지막 레이어): {num_classes} (키: {last_key})")
        
        model = EnsembleModel(num_classes=num_classes)
        
        # state_dict 로드 (strict=False로 일부 키가 맞지 않아도 로드)
        try:
            # 먼저 ResNet 백본과 EfficientNet 백본 가중치는 그대로 로드
            model.load_state_dict(state_dict, strict=False)
            
            logger.info("[Prediction] state_dict 로드 완료 (strict=False, 앙상블 모델)")
        except Exception as e:
            logger.warning(f"[Prediction] state_dict 로드 중 일부 키 불일치 (무시): {e}")
            # 일부 키만 로드 시도
            model_dict = model.state_dict()
            pretrained_dict = {k: v for k, v in state_dict.items() if k in model_dict and model_dict[k].shape == v.shape}
            
            model_dict.update(pretrained_dict)
            model.load_state_dict(model_dict)
            logger.info(f"[Prediction] {len(pretrained_dict)}/{len(state_dict)} 키 로드 완료")
        
        return model
    
    def _get_vit_model_512(self, num_classes: int) -> nn.Module:
        """
        ViT-B/16 모델 생성 (512px 입력 크기)
        Positional Embedding을 224px에서 512px로 interpolation
        """
        import math
        from torchvision.models import vit_b_16, ViT_B_16_Weights
        
        logger.info("[Prediction] ViT-B/16 구조 생성 및 512px 리사이징 (Interpolation) 수행...")
        
        # 1. 기본 모델 로드
        model = vit_b_16(weights=ViT_B_16_Weights.IMAGENET1K_V1)
        model.image_size = 512
        
        # 2. Positional Embedding Interpolation (224 -> 512)
        pos_embed_old = model.encoder.pos_embedding
        
        # Class Token과 Patch Token 분리
        class_pos_embed = pos_embed_old[:, 0:1, :]
        patch_pos_embed = pos_embed_old[:, 1:, :]
        
        # 기존 그리드 사이즈 (14x14)
        num_patches_old = patch_pos_embed.shape[1]
        grid_size_old = int(math.sqrt(num_patches_old))
        
        # [1, 196, 768] -> [1, 768, 14, 14]
        patch_pos_embed = patch_pos_embed.reshape(1, grid_size_old, grid_size_old, 768).permute(0, 3, 1, 2)
        
        # 새로운 그리드 사이즈 (512 / 16 = 32)
        grid_size_new = 512 // 16
        
        # Bicubic Interpolation
        patch_pos_embed_new = F.interpolate(
            patch_pos_embed,
            size=(grid_size_new, grid_size_new),
            mode='bicubic',
            align_corners=False
        )
        
        # 원래 형태로 복구: [1, 768, 32, 32] -> [1, 1024, 768]
        patch_pos_embed_new = patch_pos_embed_new.permute(0, 2, 3, 1).reshape(1, grid_size_new * grid_size_new, 768)
        
        # Class Token과 합체
        pos_embed_new = torch.cat((class_pos_embed, patch_pos_embed_new), dim=1)
        
        # 모델에 적용
        model.encoder.pos_embedding = nn.Parameter(pos_embed_new)
        
        # 3. Head 교체
        in_features = model.heads.head.in_features
        model.heads.head = nn.Linear(in_features, num_classes)
        
        logger.info(f"[Prediction] ViT-B/16 모델 생성 완료 (512px, {num_classes} classes)")
        return model
    
    def _load_cnn_ensemble_model(self, model_path: Path, device: torch.device) -> nn.Module:
        """CNN 앙상블 모델 로드"""
        logger.info(f"[Prediction] CNN 앙상블 모델 로드 시작: {model_path}")
        
        checkpoint = torch.load(model_path, map_location=device, weights_only=False)
        
        # state_dict 추출
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            state_dict = checkpoint['model_state_dict']
            logger.info(f"[Prediction] 체크포인트에서 model_state_dict 발견")
        else:
            state_dict = checkpoint
        
        # 모델 아키텍처 정의 및 로드
        model = self._build_combined_model(state_dict, device)
        model = model.to(device)
        model.eval()
        
        logger.info("[Prediction] ✅ CNN 앙상블 모델 로드 완료")
        return model
    
    def _load_vit_model(self, model_path: Path, device: torch.device) -> nn.Module:
        """ViT 모델 로드"""
        logger.info(f"[Prediction] ViT 모델 로드 시작: {model_path}")
        
        # ViT 모델 생성 (512px 구조)
        model = self._get_vit_model_512(NUM_CLASSES)
        model = model.to(device)
        
        checkpoint = torch.load(model_path, map_location=device, weights_only=False)
        
        # state_dict 추출
        state_dict = None
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            state_dict = checkpoint['model_state_dict']
            logger.info(f"[Prediction] 체크포인트에서 model_state_dict 발견")
        else:
            state_dict = checkpoint
        
        # DataParallel 키 처리
        new_state_dict = {}
        for k, v in state_dict.items():
            name = k.replace("module.", "") if k.startswith("module.") else k
            new_state_dict[name] = v
        
        model.load_state_dict(new_state_dict, strict=False)
        model.eval()
        
        logger.info("[Prediction] ✅ ViT 모델 로드 완료")
        return model
        
    def load_model(self):
        """
        하이브리드 모델 로드 메서드 (CNN 앙상블 + ViT Soft Voting)
        """
        import torch
        
        logger.info(f"[Prediction] 모델 디렉토리: {self.models_dir}")
        
        # 모델 파일 경로 확인
        cnn_model_path = self.models_dir / "ensemble_finetune_best_60epochst.pt"
        vit_model_path = self.models_dir / "vit_b16_512px_best_train_loss_86epochs.pt"
        
        if not cnn_model_path.exists():
            logger.error(f"[Prediction] CNN 앙상블 모델 파일을 찾을 수 없습니다: {cnn_model_path}")
            raise FileNotFoundError(f"CNN 앙상블 모델 파일을 찾을 수 없습니다: {cnn_model_path}")
        
        if not vit_model_path.exists():
            logger.error(f"[Prediction] ViT 모델 파일을 찾을 수 없습니다: {vit_model_path}")
            raise FileNotFoundError(f"ViT 모델 파일을 찾을 수 없습니다: {vit_model_path}")
        
        try:
            # 디바이스 선택
            if torch.cuda.is_available():
                device = torch.device("cuda")
                logger.info("[Prediction] CUDA 사용 가능, GPU 사용")
            elif torch.backends.mps.is_available():
                device = torch.device("mps")
                logger.info("[Prediction] MPS 사용 가능, Apple Silicon GPU 사용")
            else:
                device = torch.device("cpu")
                logger.info("[Prediction] CPU 사용")
            
            self.device = device
            
            # 1. CNN 앙상블 모델 로드
            logger.info("[Prediction] ========== 하이브리드 모델 로드 시작 ==========")
            self.cnn_model = self._load_cnn_ensemble_model(cnn_model_path, device)
            
            # 2. ViT 모델 로드
            self.vit_model = self._load_vit_model(vit_model_path, device)
            
            # 3. Soft Voting 앙상블 생성
            logger.info("[Prediction] Soft Voting 앙상블 모델 생성 중...")
            self.model = SoftVotingEnsemble(
                cnn_model=self.cnn_model,
                vit_model=self.vit_model,
                num_classes=NUM_CLASSES,
                weights=[DEFAULT_CNN_WEIGHT, DEFAULT_VIT_WEIGHT]
            )
            self.model = self.model.to(device)
            self.model.eval()
            
            logger.info("[Prediction] ✅ 하이브리드 모델 로드 완료 (CNN 앙상블 + ViT)")
            self.is_loaded = True
        except Exception as e:
            logger.error(f"[Prediction] 모델 로드 실패: {e}", exc_info=True)
            raise
        
    def _map_to_korean(self, class_name_or_idx) -> str:
        """
        클래스 인덱스나 영문명을 한국어 질병명으로 변환
        
        Args:
            class_name_or_idx: 클래스 인덱스 (int) 또는 클래스명 (str)
            
        Returns:
            한국어 질병명
        """
        if class_name_or_idx in CLASS_TO_KOREAN:
            return CLASS_TO_KOREAN[class_name_or_idx]
        # 매핑에 없으면 그대로 반환 (이미 한국어일 수 있음)
        return str(class_name_or_idx)
    
    def _map_to_english(self, korean_name: str) -> str:
        """
        한국어 질병명을 영문명으로 변환
        
        Args:
            korean_name: 한국어 질병명
            
        Returns:
            영문 질병명
        """
        return KOREAN_TO_ENGLISH.get(korean_name, "Unknown")
    
    def _convert_class_probs_to_korean(self, raw_class_probs: Dict) -> Dict[str, float]:
        """
        모델이 반환한 원시 class_probs를 한국어 질병명으로 변환
        
        Args:
            raw_class_probs: 모델이 반환한 원시 확률 딕셔너리
                            예: {0: 0.8, 1: 0.2} 또는 {"malignant_melanoma": 0.8, "normal": 0.2}
        
        Returns:
            한국어 질병명을 키로 하는 확률 딕셔너리
            예: {"악성 흑색종": 0.8, "정상": 0.2}
        """
        korean_probs = {}
        for class_key, prob in raw_class_probs.items():
            korean_name = self._map_to_korean(class_key)
            korean_probs[korean_name] = prob
        return korean_probs
    
    def predict(self, image_bytes: bytes, generate_gradcam: bool = False) -> Dict:
        """
        이미지 예측 메서드
        
        Args:
            image_bytes: 예측할 이미지 바이트 데이터 (털 제거된 이미지)
            generate_gradcam: GradCAM 생성 여부 (기본값: False)
            
        Returns:
            {
                "class_probs": {"악성 흑색종": 0.8, "정상": 0.2, ...},  # 각 질병별 확률 (한국어 키)
                "risk_level": "높음",  # 위험도: "높음", "중간", "낮음", "정상"
                "disease_name_ko": "악성 흑색종",  # 가장 높은 확률의 질병명 (한글)
                "disease_name_en": "Malignant Melanoma",  # 가장 높은 확률의 질병명 (영문)
                "grad_cam_bytes": Optional[bytes],  # GradCAM 이미지 바이트 (선택적)
                "vlm_analysis_text": Optional[str],  # VLM 분석 텍스트 (선택적)
            }
        """
        if not self.is_loaded:
            raise RuntimeError("모델이 로드되지 않았습니다. load_model()을 먼저 호출하세요.")
        
        import torch
        import torchvision.transforms as transforms
        from PIL import Image
        import io
        import numpy as np
        
        logger.info("[Prediction] ========== 환부 분류 파이프라인 시작 (총 3단계) ==========")
        logger.info(f"[Prediction] [1/3] 예측 시작: 이미지 크기 {len(image_bytes)} bytes")
        
        try:
            # 이미지 바이트를 PIL Image로 변환
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            logger.info(f"[Prediction] [1/3] 이미지 로드 완료: {image.size}")
            
            # 이미지 전처리 (512x512 입력 크기)
            logger.info("[Prediction] [2/3] 이미지 전처리 시작")
            transform = transforms.Compose([
                transforms.Resize((512, 512)),  # 모델 입력 크기: 512x512
                transforms.ToTensor(),
                transforms.Normalize(mean=MEAN, std=STD)  # ImageNet 정규화
            ])
            
            image_tensor = transform(image).unsqueeze(0).to(self.device)
            logger.info(f"[Prediction] [2/3] 이미지 전처리 완료: {image_tensor.shape}")
            
            # 모델 예측 (Soft Voting 앙상블)
            logger.info("[Prediction] [3/3] 하이브리드 모델 예측 시작 (CNN + ViT)")
            with torch.no_grad():
                # Soft Voting 앙상블은 이미 확률을 반환함
                ensemble_probs = self.model(image_tensor)
                
                # 배치 차원 제거 (첫 번째 샘플만 사용)
                if len(ensemble_probs.shape) > 1:
                    probs = ensemble_probs[0]  # [num_classes]
                else:
                    probs = ensemble_probs
                
                probs_np = probs.cpu().numpy()
                logger.info(f"[Prediction] [3/3] 앙상블 확률 분포: {probs_np}")
            
            # 클래스 인덱스를 확률로 변환
            # 모델은 8개 클래스만 분류함
            num_classes = len(probs_np)
            logger.info(f"[Prediction] [3/3] 예측된 클래스 수: {num_classes}")
            
            # 모델 출력이 8개가 아니면 에러
            if num_classes != 8:
                logger.error(f"[Prediction] [3/3] 모델 출력이 8개가 아닙니다: {num_classes}개")
                raise ValueError(f"모델 출력이 8개 클래스가 아닙니다. 실제 출력: {num_classes}개")
            
            # 클래스 인덱스를 딕셔너리로 변환 (8개만)
            raw_class_probs = {i: float(probs_np[i]) for i in range(8)}
            logger.info(f"[Prediction] [3/3] 원시 확률 (8개): {raw_class_probs}")
            
            # 한국어로 변환
            korean_class_probs = self._convert_class_probs_to_korean(raw_class_probs)
            logger.info(f"[Prediction] [3/3] 한국어 변환된 확률: {korean_class_probs}")
            
            # 가장 높은 확률의 질병 찾기
            if not korean_class_probs:
                raise ValueError("예측 결과가 비어있습니다.")
            
            max_class = max(korean_class_probs.items(), key=lambda x: x[1])
            disease_name_ko = max_class[0]
            disease_name_en = self._map_to_english(disease_name_ko)
            
            logger.info(f"[Prediction] [3/3] 예측된 질병: {disease_name_ko} (확률: {max_class[1]:.4f})")
            
            # 위험도 계산
            risk_level = self.get_risk_level(korean_class_probs)
            logger.info(f"[Prediction] [3/3] 위험도: {risk_level}")
            
            # GradCAM 생성 (선택적)
            grad_cam_bytes = None
            if generate_gradcam:
                try:
                    grad_cam_bytes = self._generate_gradcam(original_image=image)
                    logger.info(f"[Prediction] [3/3] GradCAM 생성 완료: {len(grad_cam_bytes) if grad_cam_bytes else 0} bytes")
                except Exception as e:
                    logger.error(f"[Prediction] [3/3] GradCAM 생성 실패: {e}", exc_info=True)
            else:
                logger.info(f"[Prediction] [3/3] GradCAM 생성 스킵 (generate_gradcam=False)")
            
            logger.info("[Prediction] ========== 환부 분류 파이프라인 완료 ==========")
            
            return {
                "class_probs": korean_class_probs,  # 한국어 키로 변환된 확률
                "risk_level": risk_level,
                "disease_name_ko": disease_name_ko,
                "disease_name_en": disease_name_en,
                "grad_cam_bytes": grad_cam_bytes,
                "vlm_analysis_text": None,  # VLM 분석은 제거됨
            }
        except Exception as e:
            logger.error(f"[Prediction] 예측 중 오류 발생: {e}", exc_info=True)
            raise
    
    def get_risk_level(self, class_probs: Dict[str, float]) -> str:
        """
        class_probs를 기반으로 위험도 계산
        질병 종류에 따라 위험도를 다르게 계산합니다.
        
        Args:
            class_probs: 각 질병별 확률 딕셔너리
            
        Returns:
            위험도: "높음", "중간", "낮음"
        """
        if not class_probs:
            return "낮음"
        
        # 가장 높은 확률의 질병 찾기
        max_disease, max_prob = max(class_probs.items(), key=lambda x: x[1])
        
        # 높은 위험 질병들 (악성 질환 및 전암성 병변)
        # 흑색종, 기저세포암, 편평세포암, 광선 각화증
        high_risk_diseases = ["흑색종", "기저세포암", "편평세포암", "광선 각화증"]
        
        # 낮은 위험 질병들 (양성 질환)
        # 모반, 피부섬유종, 양성 각화증, 혈관종
        low_risk_diseases = ["모반", "피부섬유종", "양성 각화증", "혈관종"]
        
        # 높은 위험 질병이 가장 높은 확률인 경우
        if max_disease in high_risk_diseases:
            if max_prob >= 0.7:
                return "높음"
            elif max_prob >= 0.4:
                return "중간"
            else:
                return "낮음"
        
        # 낮은 위험 질병이 가장 높은 확률인 경우
        elif max_disease in low_risk_diseases:
            if max_prob >= 0.7:
                return "낮음"
            else:
                return "중간"  # 확신도가 낮으면 중간
        
        # 알 수 없는 질병인 경우 확률 기반으로 판단
        else:
            if max_prob >= 0.7:
                return "높음"
            elif max_prob >= 0.4:
                return "중간"
            else:
                return "낮음"
    
    def _generate_gradcam(self, original_image) -> Optional[bytes]:
        """
        GradCAM 히트맵 생성 및 이미지 바이트로 반환
        gradcam_web_inference.py의 generate_gradcam_overlay 함수를 사용
        
        Args:
            original_image: 원본 PIL Image
            
        Returns:
            GradCAM 이미지 바이트 또는 None
        """
        if not HAS_GRADCAM_MODULE:
            logger.error("[GradCAM] gradcam_web_inference 모듈을 사용할 수 없습니다.")
            logger.error("[GradCAM] 필요한 패키지가 설치되어 있는지 확인하세요: scipy, matplotlib")
            return None
        
        try:
            import io
            from PIL import Image as PILImage
            
            logger.info("[GradCAM] GradCAM 생성 시작 (gradcam_web_inference 모듈 사용)")
            
            # GradCAM은 CNN 앙상블 모델 사용 (기존 로직 유지)
            model_path = self.models_dir / "ensemble_finetune_best_60epochst.pt"
            if not model_path.exists():
                logger.error(f"[GradCAM] 모델 파일을 찾을 수 없습니다: {model_path}")
                return None
            
            # gradcam_web_inference의 generate_gradcam_overlay 함수 사용
            overlay_image = generate_gradcam_overlay(
                image_input=original_image,  # PIL Image 객체
                model_path=str(model_path),  # 문자열 경로로 변환
                target_class=None,  # 예측된 클래스 사용
                image_size=512,
                device=self.device
            )
            
            # numpy array 검증 및 PIL Image로 변환
            logger.info(f"[GradCAM] overlay_image shape: {overlay_image.shape}, dtype: {overlay_image.dtype}")
            
            # dtype이 uint8이 아니면 변환
            if overlay_image.dtype != np.uint8:
                logger.warning(f"[GradCAM] dtype이 uint8이 아닙니다: {overlay_image.dtype}, 변환합니다.")
                overlay_image = np.clip(overlay_image, 0, 255).astype(np.uint8)
            
            # shape 검증 (H, W, 3) 또는 (H, W)
            if len(overlay_image.shape) == 2:
                # Grayscale인 경우 RGB로 변환
                overlay_image = np.stack([overlay_image] * 3, axis=-1)
                logger.info("[GradCAM] Grayscale 이미지를 RGB로 변환했습니다.")
            elif len(overlay_image.shape) == 3 and overlay_image.shape[2] != 3:
                logger.error(f"[GradCAM] 예상치 못한 이미지 shape: {overlay_image.shape}")
                return None
            
            # PIL Image로 변환 (RGB 모드 명시)
            try:
                cam_pil = PILImage.fromarray(overlay_image, mode='RGB')
            except Exception as e:
                logger.error(f"[GradCAM] PIL Image 변환 실패: {e}")
                logger.error(f"[GradCAM] overlay_image shape: {overlay_image.shape}, dtype: {overlay_image.dtype}, min: {overlay_image.min()}, max: {overlay_image.max()}")
                return None
            
            # 바이트로 변환
            buffer = io.BytesIO()
            try:
                cam_pil.save(buffer, format='PNG')
                buffer.seek(0)  # 버퍼 위치를 처음으로 리셋
                grad_cam_bytes = buffer.getvalue()
                
                # PNG 헤더 검증 (첫 8바이트: 89 50 4E 47 0D 0A 1A 0A)
                if len(grad_cam_bytes) < 8 or grad_cam_bytes[:8] != b'\x89PNG\r\n\x1a\n':
                    logger.error(f"[GradCAM] PNG 헤더가 올바르지 않습니다. 첫 8바이트: {grad_cam_bytes[:8]}")
                    return None
                
                logger.info(f"[GradCAM] 이미지 변환 완료: {len(grad_cam_bytes)} bytes (PNG 검증 통과)")
            except Exception as e:
                logger.error(f"[GradCAM] PNG 저장 실패: {e}", exc_info=True)
                return None
            
            return grad_cam_bytes
            
        except Exception as e:
            logger.error(f"[GradCAM] 생성 중 오류: {e}", exc_info=True)
            return None

