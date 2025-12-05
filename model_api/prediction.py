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

# 클래스 인덱스/영문명을 한국어 질병명으로 매핑하는 딕셔너리
# 모델이 예측하는 8개 클래스
CLASS_TO_KOREAN = {
    # 클래스 인덱스로 매핑 (8개 피부 질환 분류)
    0: "흑색종",  # Melanoma (MEL)
    1: "모반",  # Nevus (NV)
    2: "기저세포암",  # Basal Cell Carcinoma (BCC)
    3: "편평세포암",  # Squamous Cell Carcinoma (SCC)
    4: "피부섬유종",  # Dermatofibroma (DF)
    5: "양성 각화증",  # Benign Keratosis (BKL)
    6: "광선 각화증",  # Actinic Keratosis (AK)
    7: "혈관종",  # Vascular (VASC)
    
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

# 한국어 질병명을 영문 약어로 매핑 (GradCAM 클래스별 임계값 사용)
KOREAN_TO_ABBR = {
    "흑색종": "mel",  # Melanoma
    "모반": "nv",  # Nevus
    "기저세포암": "bcc",  # Basal Cell Carcinoma
    "편평세포암": "scc",  # Squamous Cell Carcinoma
    "피부섬유종": "df",  # Dermatofibroma
    "양성 각화증": "bkl",  # Benign Keratosis
    "광선 각화증": "ak",  # Actinic Keratosis
    "혈관종": "vasc",  # Vascular
}

# 클래스 인덱스를 영문 약어로 매핑
CLASS_IDX_TO_ABBR = {
    0: "mel",   # 흑색종
    1: "nv",    # 모반
    2: "bcc",   # 기저세포암
    3: "scc",   # 편평세포암
    4: "df",    # 피부섬유종
    5: "bkl",   # 양성 각화증
    6: "ak",    # 광선 각화증
    7: "vasc",  # 혈관종
}

# ImageNet 정규화 상수
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]


class GradCAMPlusPlus:
    """GradCAM++ 구현"""
    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        
        # 훅 등록
        self.target_layer.register_forward_hook(self.save_activation)
        self.target_layer.register_full_backward_hook(self.save_gradient)
    
    def save_activation(self, module, input, output):
        # detach하지 않음 - 그래디언트가 흐를 수 있어야 함!
        self.activations = output
    
    def save_gradient(self, module, grad_input, grad_output):
        # 그래디언트 저장 (grad_output은 튜플)
        if grad_output[0] is not None:
            self.gradients = grad_output[0]
        else:
            self.gradients = None
    
    def __call__(self, input_tensor, target_category=None):
        self.model.zero_grad()
        self.gradients = None
        self.activations = None
        
        # 그래디언트 계산 활성화
        input_tensor.requires_grad_(True)
        
        output = self.model(input_tensor)
        
        if target_category is None:
            target_category = torch.argmax(output, dim=1).item()
        
        # One-hot 인코딩
        one_hot = torch.zeros_like(output)
        one_hot[0, target_category] = 1
        
        # 역전파
        output.backward(gradient=one_hot, retain_graph=False)
        
        if self.activations is None or self.gradients is None:
            logger.warning(f"[GradCAM++] activations 또는 gradients가 None입니다")
            return np.zeros((16, 16)), target_category, output.detach()
        
        activations = self.activations  # [B, C, H, W]
        gradients = self.gradients  # [B, C, H, W]
        
        if len(gradients.shape) != 4 or len(activations.shape) != 4:
            logger.warning(f"[GradCAM++] 예상치 못한 형태 - gradients: {gradients.shape}, activations: {activations.shape}")
            return np.zeros((16, 16)), target_category, output.detach()
        
        # GradCAM++ 계산
        # alpha = ReLU(gradients) / (활성화 합 + eps)
        alpha_num = F.relu(gradients)  # [B, C, H, W]
        alpha_den = torch.sum(activations, dim=[2, 3], keepdim=True) + 1e-10  # [B, C, 1, 1]
        alpha = alpha_num / alpha_den  # [B, C, H, W]
        
        # 가중치 조합
        weights = torch.sum(alpha * activations, dim=[2, 3], keepdim=True)  # [B, C, 1, 1]
        heatmap = torch.sum(weights * activations, dim=1)  # [B, H, W]
        heatmap = F.relu(heatmap[0])  # [H, W]
        
        # 정규화
        max_val = torch.max(heatmap)
        min_val = torch.min(heatmap)
        
        if max_val > 0:
            # [0, 1]로 정규화
            heatmap_normalized = (heatmap - min_val) / (max_val - min_val + 1e-8)
            # 약한 활성화를 더 보이게 하기 위한 향상 적용
            heatmap_normalized = torch.pow(heatmap_normalized, 0.8)
            heatmap = heatmap_normalized
        else:
            heatmap = torch.zeros_like(heatmap)
        
        # numpy로 변환 및 GPU 메모리 정리
        heatmap_np = heatmap.cpu().detach().numpy()
        output_detached = output.detach()
        
        # 중간 텐서 정리
        del heatmap, heatmap_normalized, weights, alpha, alpha_num, alpha_den, activations, gradients, one_hot, output
        self.gradients = None
        self.activations = None
        
        return heatmap_np, target_category, output_detached


def denormalize_image(tensor):
    """이미지 텐서 역정규화"""
    mean = np.array(MEAN)
    std = np.array(STD)
    img = tensor.cpu().numpy().transpose((1, 2, 0))
    img = std * img + mean
    img = np.clip(img, 0, 1)
    return img


def show_cam_on_image(img_numpy, cam, alpha=0.6, use_adaptive_threshold=True, predicted_class_abbr=None):
    """
    개선된 시각화로 이미지에 CAM 히트맵 오버레이
    
    Args:
        img_numpy: 원본 이미지 (H, W, 3) [0, 1] 범위
        cam: 히트맵 값 (H, W) [0, 1] 범위
        alpha: 오버레이 투명도 (0-1)
        use_adaptive_threshold: True이면 히트맵 통계 기반 적응형 임계값 사용
        predicted_class_abbr: 클래스별 임계값을 위한 클래스 약어 ('mel', 'ak', 'nv', etc.)
    """
    from scipy.ndimage import zoom
    
    H, W, _ = img_numpy.shape
    
    # 히트맵 리사이즈
    if cam.shape[0] != H or cam.shape[1] != W:
        zoom_factor_h = H / cam.shape[0]
        zoom_factor_w = W / cam.shape[1]
        cam_resized = zoom(cam, (zoom_factor_h, zoom_factor_w), order=3)
    else:
        cam_resized = cam.copy()
    
    # [0, 1] 정규화 확인
    if cam_resized.max() > 1.0 or cam_resized.min() < 0.0:
        cam_min = cam_resized.min()
        cam_max = cam_resized.max()
        if cam_max > cam_min:
            cam_resized = (cam_resized - cam_min) / (cam_max - cam_min + 1e-8)
        else:
            cam_resized = np.zeros_like(cam_resized)
    
    # 클래스별 적응형 임계값
    if use_adaptive_threshold and predicted_class_abbr:
        mean_val = cam_resized.mean()
        max_val = cam_resized.max()
        
        # 클래스별 임계값 파라미터
        if predicted_class_abbr == 'mel':
            percentile = 75
            threshold_multiplier = 0.85
            gamma = 0.85
        elif predicted_class_abbr == 'ak':
            percentile = 50
            threshold_multiplier = 0.60
            gamma = 0.70
        elif predicted_class_abbr == 'df':
            percentile = 85
            threshold_multiplier = 0.92
            gamma = 0.88
        elif predicted_class_abbr == 'nv':
            percentile = 90
            threshold_multiplier = 0.98
            gamma = 0.95
        elif predicted_class_abbr == 'vasc':
            percentile = 85
            threshold_multiplier = 0.95
            gamma = 0.90
        elif predicted_class_abbr == 'bkl':
            percentile = 75
            threshold_multiplier = 0.85
            gamma = 0.85
        elif predicted_class_abbr == 'bcc':
            percentile = 65
            threshold_multiplier = 0.75
            gamma = 0.80
        elif predicted_class_abbr == 'scc':
            percentile = 55
            threshold_multiplier = 0.70
            gamma = 0.75
        else:
            percentile = 65
            threshold_multiplier = 0.75
            gamma = 0.80
        
        if max_val > 0:
            threshold = np.percentile(cam_resized, percentile)
            cam_resized = np.maximum(cam_resized - threshold * threshold_multiplier, 0)
            
            if cam_resized.max() > 0:
                cam_resized = cam_resized / cam_resized.max()
                cam_resized = np.power(cam_resized, gamma)
            else:
                cam_resized = (cam_resized + threshold * threshold_multiplier) / (max_val + 1e-8)
                cam_resized = np.clip(cam_resized, 0, 1)
    
    # 'jet' 컬러맵 사용
    try:
        import matplotlib.cm as cm
        cam_for_colormap = np.clip(cam_resized, 0, 1)
        heatmap = cm.jet(cam_for_colormap)[:, :, :3]  # [H, W, 3] [0, 1] 범위
    except:
        # 대체: 간단한 red 그라디언트
        heatmap = np.zeros((H, W, 3))
        heatmap[:, :, 0] = cam_resized  # Red channel
    
    # 원본 이미지에 오버레이
    img_float = np.float32(img_numpy)
    cam_overlay = np.float32(heatmap) * alpha + img_float * (1 - alpha)
    cam_overlay = np.clip(cam_overlay, 0, 1)
    
    return np.uint8(255 * cam_overlay)


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
            def __init__(self, num_classes=8):  # 기본 8개 클래스 (흑색종, 모반, 기저세포암, 편평세포암, 피부섬유종, 양성 각화증, 광선 각화증, 혈관종)
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
                # 4. 'model_state_dict' 키가 있는 경우 - 모델 아키텍처 필요
                elif 'model_state_dict' in checkpoint:
                    logger.info("[Prediction] 'model_state_dict' 키 발견. 모델 아키텍처를 정의합니다.")
                    try:
                        model_to_load = self._build_combined_model(checkpoint['model_state_dict'], device)
                        logger.info("[Prediction] 모델 아키텍처를 정의하여 로드했습니다.")
                    except Exception as build_error:
                        logger.error(f"[Prediction] 모델 아키텍처 정의 실패: {build_error}")
                        raise RuntimeError(
                            "모델 파일에 model_state_dict만 저장되어 있습니다. "
                            "모델 아키텍처를 정의하고 load_state_dict()를 사용해야 합니다. "
                            f"에러: {str(build_error)}"
                        )
                # 5. 'state_dict'만 있는 경우 - 모델 아키텍처 필요
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
    
    def predict(self, image_bytes: bytes, generate_gradcam: bool = False) -> Dict:
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
            
            # 모델 예측
            logger.info("[Prediction] [3/3] 모델 예측 시작")
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
                logger.info(f"[Prediction] [3/3] 모델 출력 형태: {output.shape if hasattr(output, 'shape') else type(output)}")
                
                # 출력 처리
                if isinstance(output, (list, tuple)):
                    output = output[0]  # 첫 번째 요소 사용
                
                # Softmax 적용하여 확률로 변환
                if hasattr(output, 'shape') and len(output.shape) > 1:
                    probs = torch.softmax(output, dim=1)[0]  # 첫 번째 배치 사용
                else:
                    probs = torch.softmax(output, dim=0)
                
                probs_np = probs.cpu().numpy()
                logger.info(f"[Prediction] [3/3] 확률 분포: {probs_np}")
            
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
                    grad_cam_bytes = self._generate_gradcam(
                        image, 
                        image_tensor, 
                        max_class[1],  # 예측된 클래스 확률
                        disease_name_ko
                    )
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
    
    def _generate_gradcam(self, original_image, image_tensor, pred_prob: float, disease_name_ko: str) -> Optional[bytes]:
        """
        GradCAM 히트맵 생성 및 이미지 바이트로 반환
        
        Args:
            original_image: 원본 PIL Image
            image_tensor: 전처리된 이미지 텐서
            pred_prob: 예측 확률
            disease_name_ko: 예측된 질병명 (한국어)
            
        Returns:
            GradCAM 이미지 바이트 또는 None
        """
        try:
            import io
            from PIL import Image as PILImage
            
            logger.info("[GradCAM] GradCAM 생성 시작")
            
            # 모델이 _build_combined_model로 생성된 경우, 타겟 레이어 찾기
            if hasattr(self.model, 'resnet_backbone'):
                # ResNet backbone이 있으면 마지막 레이어 사용
                if hasattr(self.model.resnet_backbone, '__getitem__'):
                    # Sequential로 감싸진 경우
                    target_layer = self.model.resnet_backbone[-1]
                else:
                    target_layer = self.model.resnet_backbone
            elif hasattr(self.model, 'model_A'):
                # gradcam_visualization.py 스타일의 모델 구조
                target_layer = self.model.model_A.layer4
            else:
                logger.warning("[GradCAM] 적합한 타겟 레이어를 찾을 수 없습니다")
                return None
            
            # GradCAM++ 인스턴스 생성
            gradcam_pp = GradCAMPlusPlus(self.model, target_layer)
            
            # 모델을 train 모드로 설정 (GradCAM을 위해 필요)
            self.model.train()
            
            # GradCAM 계산
            cam, pred_class, _ = gradcam_pp(image_tensor.clone(), target_category=None)
            
            # 모델을 다시 eval 모드로
            self.model.eval()
            
            logger.info(f"[GradCAM] 히트맵 생성 완료: {cam.shape}")
            
            # 원본 이미지 역정규화
            image_denorm = denormalize_image(image_tensor[0])
            
            # 클래스 약어 가져오기
            disease_abbr = KOREAN_TO_ABBR.get(disease_name_ko, None)
            
            # CAM 오버레이
            cam_img = show_cam_on_image(
                image_denorm, 
                cam, 
                alpha=0.5, 
                use_adaptive_threshold=True,
                predicted_class_abbr=disease_abbr
            )
            
            # PIL Image로 변환
            cam_pil = PILImage.fromarray(cam_img)
            
            # 바이트로 변환
            buffer = io.BytesIO()
            cam_pil.save(buffer, format='PNG')
            grad_cam_bytes = buffer.getvalue()
            
            logger.info(f"[GradCAM] 이미지 변환 완료: {len(grad_cam_bytes)} bytes")
            
            return grad_cam_bytes
            
        except Exception as e:
            logger.error(f"[GradCAM] 생성 중 오류: {e}", exc_info=True)
            return None

