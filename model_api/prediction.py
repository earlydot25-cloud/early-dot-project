"""
AI 모델 예측 파이프라인
사용자가 모델 파일을 제공하면 이 파일을 수정하여 예측 로직을 구현합니다.
"""
from pathlib import Path
from typing import Dict, Tuple, Optional, List
import logging

logger = logging.getLogger(__name__)

# 클래스 인덱스/영문명을 한국어 질병명으로 매핑하는 딕셔너리
# TODO: 모델이 예측하는 클래스에 맞게 수정하세요
CLASS_TO_KOREAN = {
    # 클래스 인덱스로 매핑 (일반적인 피부 질환 분류)
    0: "정상",
    1: "악성 흑색종",
    2: "기저세포암",
    3: "편평세포암",
    4: "양성 모반",
    5: "지루각화증",
    
    # 영문명으로 매핑
    "normal": "정상",
    "malignant_melanoma": "악성 흑색종",
    "basal_cell_carcinoma": "기저세포암",
    "squamous_cell_carcinoma": "편평세포암",
    "benign_nevus": "양성 모반",
    "seborrheic_keratosis": "지루각화증",
}

# 한국어 질병명을 영문명으로 매핑하는 딕셔너리
KOREAN_TO_ENGLISH = {
    "정상": "Normal",
    "악성 흑색종": "Malignant Melanoma",
    "기저세포암": "Basal Cell Carcinoma",
    "편평세포암": "Squamous Cell Carcinoma",
    "양성 모반": "Benign Nevus",
    "지루각화증": "Seborrheic Keratosis",
}


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
    
    def _build_combined_model(self, state_dict, device):
        """
        combined_resnet50_effnetb4 모델 아키텍처 정의
        ResNet50과 EfficientNet-B4를 결합한 앙상블 모델로 추정
        """
        import torch
        import torch.nn as nn
        import torchvision.models as models
        
        logger.info("[Prediction] combined_resnet50_effnetb4 모델 아키텍처 정의 시작")
        
        # state_dict 키 분석
        state_dict_keys = list(state_dict.keys())
        
        # ResNet50과 EfficientNet-B4를 결합한 모델 정의
        # 일반적인 앙상블 구조: 두 모델의 특징을 결합하여 분류
        
        class CombinedModel(nn.Module):
            def __init__(self, num_classes=6):  # 기본 6개 클래스 (정상, 악성 흑색종, 기저세포암, 편평세포암, 양성 모반, 지루각화증)
                super(CombinedModel, self).__init__()
                
                # ResNet50 백본
                resnet50 = models.resnet50(pretrained=False)
                self.resnet_backbone = nn.Sequential(*list(resnet50.children())[:-1])  # 마지막 FC 제거
                
                # EfficientNet-B4 백본 (torchvision에 없으면 timm 사용 시도)
                try:
                    import timm
                    self.effnet_backbone = timm.create_model('efficientnet_b4', pretrained=False, num_classes=0)
                except ImportError:
                    # timm이 없으면 EfficientNet-B0로 대체 (구조 유사)
                    logger.warning("[Prediction] timm이 없어 EfficientNet-B0로 대체합니다.")
                    effnet = models.efficientnet_b0(pretrained=False)
                    self.effnet_backbone = nn.Sequential(*list(effnet.children())[:-1])
                
                # 특징 결합 및 분류기
                # ResNet50 특징 차원: 2048, EfficientNet-B4 특징 차원: 1792 (B0는 1280)
                resnet_feat_dim = 2048
                effnet_feat_dim = 1792 if hasattr(self.effnet_backbone, 'num_features') else 1280
                
                # 특징 결합
                combined_dim = resnet_feat_dim + effnet_feat_dim
                self.classifier = nn.Sequential(
                    nn.Dropout(0.5),
                    nn.Linear(combined_dim, 512),
                    nn.ReLU(),
                    nn.Dropout(0.3),
                    nn.Linear(512, num_classes)
                )
            
            def forward(self, x):
                # ResNet50 특징 추출
                resnet_feat = self.resnet_backbone(x)
                resnet_feat = resnet_feat.view(resnet_feat.size(0), -1)
                
                # EfficientNet 특징 추출
                effnet_feat = self.effnet_backbone(x)
                if isinstance(effnet_feat, tuple):
                    effnet_feat = effnet_feat[0]
                effnet_feat = effnet_feat.view(effnet_feat.size(0), -1)
                
                # 특징 결합
                combined_feat = torch.cat([resnet_feat, effnet_feat], dim=1)
                
                # 분류
                output = self.classifier(combined_feat)
                return output
        
        # 모델 생성
        # state_dict 키를 보고 num_classes 추론
        num_classes = 6  # 기본값
        for key in state_dict_keys:
            if 'classifier' in key or 'fc' in key:
                if 'weight' in key:
                    # 마지막 레이어의 출력 차원 확인
                    weight_shape = state_dict[key].shape
                    if len(weight_shape) == 2:
                        num_classes = weight_shape[0]
                        logger.info(f"[Prediction] state_dict에서 num_classes 추론: {num_classes}")
                        break
        
        model = CombinedModel(num_classes=num_classes)
        
        # state_dict 로드 (strict=False로 일부 키가 맞지 않아도 로드)
        try:
            model.load_state_dict(state_dict, strict=False)
            logger.info("[Prediction] state_dict 로드 완료 (strict=False)")
        except Exception as e:
            logger.warning(f"[Prediction] state_dict 로드 중 일부 키 불일치 (무시): {e}")
            # 일부 키만 로드 시도
            model_dict = model.state_dict()
            pretrained_dict = {k: v for k, v in state_dict.items() if k in model_dict and model_dict[k].shape == v.shape}
            model_dict.update(pretrained_dict)
            model.load_state_dict(model_dict)
            logger.info(f"[Prediction] {len(pretrained_dict)}/{len(state_dict)} 키 로드 완료")
        
        return model
        
    def load_model(self):
        """
        모델 로드 메서드
        사용자가 모델 파일을 제공하면 이 메서드를 수정하여 모델을 로드합니다.
        
        예시:
            import torch
            model_path = self.models_dir / "prediction" / "your_model.pth"
            self.model = torch.load(model_path)
            self.model.eval()
        """
        import torch
        import torch.nn as nn
        
        logger.info(f"[Prediction] 모델 디렉토리: {self.models_dir}")
        
        # 모델 파일 경로 확인
        model_path = self.models_dir / "ensemble_finetune_best_60epochst.pt"
        
        if not model_path.exists():
            logger.error(f"[Prediction] 모델 파일을 찾을 수 없습니다: {model_path}")
            raise FileNotFoundError(f"모델 파일을 찾을 수 없습니다: {model_path}")
        
        logger.info(f"[Prediction] 모델 파일 로드 시작: {model_path}")
        
        try:
            # 디바이스 선택
            if torch.cuda.is_available():
                device = torch.device("cuda")
                logger.info("[Prediction] CUDA 사용 가능, GPU 사용")
            else:
                device = torch.device("cpu")
                logger.info("[Prediction] CPU 사용")
            
            # 모델 로드 (map_location으로 CPU/GPU 자동 선택)
            checkpoint = torch.load(model_path, map_location=device)
            
            logger.info(f"[Prediction] 체크포인트 타입: {type(checkpoint)}")
            if isinstance(checkpoint, dict):
                logger.info(f"[Prediction] 체크포인트 키: {list(checkpoint.keys())[:10]}")  # 처음 10개만
            
            # 체크포인트 형식 확인 및 모델 추출
            model_to_load = None
            
            if isinstance(checkpoint, dict):
                # 1. 'model' 키가 있는 경우 (모델 객체)
                if 'model' in checkpoint:
                    model_to_load = checkpoint['model']
                    logger.info("[Prediction] 'model' 키에서 모델 객체 발견")
                # 2. 'net' 키가 있는 경우
                elif 'net' in checkpoint:
                    model_to_load = checkpoint['net']
                    logger.info("[Prediction] 'net' 키에서 모델 객체 발견")
                # 3. 'network' 키가 있는 경우
                elif 'network' in checkpoint:
                    model_to_load = checkpoint['network']
                    logger.info("[Prediction] 'network' 키에서 모델 객체 발견")
                # 4. 'state_dict'만 있는 경우 - 모델 아키텍처 필요
                elif 'state_dict' in checkpoint:
                    logger.error("[Prediction] 'state_dict'만 발견됨. 모델 아키텍처가 필요합니다.")
                    logger.error("[Prediction] 체크포인트에 'model', 'net', 'network' 키가 없습니다.")
                    raise RuntimeError(
                        "모델 파일에 state_dict만 저장되어 있습니다. "
                        "모델 아키텍처를 정의하거나, 모델 객체가 포함된 체크포인트를 사용해야 합니다. "
                        f"체크포인트 키: {list(checkpoint.keys())}"
                    )
                # 5. dict의 모든 값이 모델 객체일 수 있음 (직접 모델이 저장된 경우)
                else:
                    # dict의 값 중 nn.Module을 상속받은 객체 찾기
                    for key, value in checkpoint.items():
                        if isinstance(value, torch.nn.Module):
                            model_to_load = value
                            logger.info(f"[Prediction] '{key}' 키에서 모델 객체 발견")
                            break
                    
                    # 찾지 못한 경우
                    if model_to_load is None:
                        # OrderedDict인 경우 (state_dict만 있는 경우)
                        from collections import OrderedDict
                        if isinstance(checkpoint, OrderedDict):
                            logger.error("[Prediction] OrderedDict (state_dict)만 발견됨. 모델 아키텍처가 필요합니다.")
                            logger.error(f"[Prediction] state_dict 키 샘플 (처음 5개): {list(checkpoint.keys())[:5]}")
                            
                            # state_dict의 키를 분석하여 모델 구조 추론 시도
                            state_dict_keys = list(checkpoint.keys())
                            logger.info(f"[Prediction] state_dict 총 키 개수: {len(state_dict_keys)}")
                            
                            # 모델 아키텍처 정의 필요
                            # combined_resnet50_effnetb4 모델 구조 정의 시도
                            try:
                                model_to_load = self._build_combined_model(checkpoint, device)
                                logger.info("[Prediction] 모델 아키텍처를 정의하여 로드했습니다.")
                            except Exception as build_error:
                                logger.error(f"[Prediction] 모델 아키텍처 정의 실패: {build_error}")
                                raise RuntimeError(
                                    "모델 파일이 state_dict만 포함하고 있습니다. "
                                    "모델 아키텍처를 정의하고 load_state_dict()를 사용해야 합니다. "
                                    f"에러: {str(build_error)}"
                                )
                        else:
                            # 알 수 없는 형식
                            logger.warning("[Prediction] 알 수 없는 체크포인트 형식. 전체를 모델로 시도합니다.")
                            model_to_load = checkpoint
            else:
                # 체크포인트가 모델 객체 자체인 경우
                if isinstance(checkpoint, torch.nn.Module):
                    model_to_load = checkpoint
                    logger.info("[Prediction] 체크포인트가 모델 객체입니다.")
                else:
                    raise RuntimeError(f"알 수 없는 체크포인트 형식: {type(checkpoint)}")
            
            # 모델이 찾아졌는지 확인
            if model_to_load is None:
                raise RuntimeError("모델을 찾을 수 없습니다. 체크포인트 구조를 확인해주세요.")
            
            # 모델이 nn.Module인지 확인
            if not isinstance(model_to_load, torch.nn.Module):
                raise RuntimeError(
                    f"모델이 torch.nn.Module이 아닙니다. 타입: {type(model_to_load)}. "
                    "모델 아키텍처를 정의하고 load_state_dict()를 사용해야 할 수 있습니다."
                )
            
            self.model = model_to_load
            
            # 모델을 eval 모드로 설정
            self.model.eval()
            
            # 모델을 디바이스로 이동
            self.model = self.model.to(device)
            self.device = device
            
            logger.info("[Prediction] ✅ 모델 로드 완료")
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
    
    def predict(self, image_bytes: bytes) -> Dict:
        """
        이미지 예측 메서드
        
        Args:
            image_bytes: 예측할 이미지 바이트 데이터 (털 제거된 이미지)
            
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
        
        logger.info(f"[Prediction] 예측 시작: 이미지 크기 {len(image_bytes)} bytes")
        
        try:
            # 이미지 바이트를 PIL Image로 변환
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            logger.info(f"[Prediction] 이미지 로드 완료: {image.size}")
            
            # 이미지 전처리 (모델에 맞게 조정 필요)
            # 일반적인 전처리: 리사이즈, 정규화, 텐서 변환
            transform = transforms.Compose([
                transforms.Resize((224, 224)),  # 모델 입력 크기에 맞게 조정
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])  # ImageNet 정규화
            ])
            
            image_tensor = transform(image).unsqueeze(0).to(self.device)
            logger.info(f"[Prediction] 이미지 전처리 완료: {image_tensor.shape}")
            
            # 모델 예측
            with torch.no_grad():
                # 모델이 dict인 경우 실제 모델 객체 찾기
                model_to_use = self.model
                if isinstance(self.model, dict):
                    for key in ['model', 'net', 'network', 'state_dict']:
                        if key in self.model and hasattr(self.model[key], '__call__'):
                            model_to_use = self.model[key]
                            break
                    # dict에서 직접 호출 가능한 경우
                    if not hasattr(model_to_use, '__call__'):
                        # state_dict만 있는 경우는 예외 발생
                        raise RuntimeError("모델 구조를 찾을 수 없습니다. 모델 아키텍처가 필요합니다.")
                
                # 예측 수행
                output = model_to_use(image_tensor)
                logger.info(f"[Prediction] 모델 출력 형태: {output.shape if hasattr(output, 'shape') else type(output)}")
                
                # 출력 처리
                if isinstance(output, (list, tuple)):
                    output = output[0]  # 첫 번째 요소 사용
                
                # Softmax 적용하여 확률로 변환
                if hasattr(output, 'shape') and len(output.shape) > 1:
                    probs = torch.softmax(output, dim=1)[0]  # 첫 번째 배치 사용
                else:
                    probs = torch.softmax(output, dim=0)
                
                probs_np = probs.cpu().numpy()
                logger.info(f"[Prediction] 확률 분포: {probs_np}")
            
            # 클래스 인덱스를 확률로 변환
            # 모델 출력이 클래스 개수에 맞는지 확인
            num_classes = len(probs_np)
            logger.info(f"[Prediction] 예측된 클래스 수: {num_classes}")
            
            # 클래스 인덱스를 딕셔너리로 변환
            raw_class_probs = {i: float(probs_np[i]) for i in range(num_classes)}
            logger.info(f"[Prediction] 원시 확률: {raw_class_probs}")
            
            # 한국어로 변환
            korean_class_probs = self._convert_class_probs_to_korean(raw_class_probs)
            logger.info(f"[Prediction] 한국어 변환된 확률: {korean_class_probs}")
            
            # 가장 높은 확률의 질병 찾기
            if not korean_class_probs:
                raise ValueError("예측 결과가 비어있습니다.")
            
            max_class = max(korean_class_probs.items(), key=lambda x: x[1])
            disease_name_ko = max_class[0]
            disease_name_en = self._map_to_english(disease_name_ko)
            
            logger.info(f"[Prediction] 예측된 질병: {disease_name_ko} (확률: {max_class[1]:.4f})")
            
            # 위험도 계산
            risk_level = self.get_risk_level(korean_class_probs)
            logger.info(f"[Prediction] 위험도: {risk_level}")
            
            return {
                "class_probs": korean_class_probs,  # 한국어 키로 변환된 확률
                "risk_level": risk_level,
                "disease_name_ko": disease_name_ko,
                "disease_name_en": disease_name_en,
                "grad_cam_bytes": None,  # TODO: GradCAM 구현
                "vlm_analysis_text": None,  # TODO: VLM 분석 구현
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
            위험도: "높음", "중간", "낮음", "정상"
        """
        if not class_probs:
            return "정상"
        
        # 가장 높은 확률의 질병 찾기
        max_disease, max_prob = max(class_probs.items(), key=lambda x: x[1])
        
        # "정상"이 가장 높은 확률이면 위험도는 "정상"
        if max_disease == "정상":
            return "정상"
        
        # 위험 질병들 (악성 질환)
        high_risk_diseases = ["악성 흑색종", "기저세포암", "편평세포암"]
        # 중간 위험 질병들 (양성 질환)
        medium_risk_diseases = ["양성 모반", "지루각화증"]
        
        # 위험 질병이 가장 높은 확률인 경우
        if max_disease in high_risk_diseases:
            if max_prob >= 0.7:
                return "높음"
            elif max_prob >= 0.4:
                return "중간"
            else:
                return "낮음"
        
        # 중간 위험 질병이 가장 높은 확률인 경우
        elif max_disease in medium_risk_diseases:
            if max_prob >= 0.6:
                return "중간"
            else:
                return "낮음"
        
        # 알 수 없는 질병인 경우 확률 기반으로 판단
        else:
            if max_prob >= 0.7:
                return "높음"
            elif max_prob >= 0.4:
                return "중간"
            elif max_prob >= 0.2:
                return "낮음"
            else:
                return "정상"

