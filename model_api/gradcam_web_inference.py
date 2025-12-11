"""
웹 서버용 GradCAM++ 추론 (오버레이 이미지만 생성)

사용 방법:
    from gradcam_web_inference import generate_gradcam_overlay
    
    # 이미지 경로 또는 PIL Image 객체로 GradCAM 오버레이 생성
    overlay_image = generate_gradcam_overlay(
        image_input="path/to/image.jpg",
        model_path="ensemble_finetune_best_60epochst.pt"
    )
    
    # overlay_image는 numpy array (H, W, 3) uint8 형식
    # PIL Image로 변환하려면:
    # from PIL import Image
    # pil_image = Image.fromarray(overlay_image)
"""

import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from PIL import Image
from torchvision import transforms
from torchvision.models import resnet50, ResNet50_Weights
from torchvision.models import efficientnet_b4, EfficientNet_B4_Weights
from scipy.ndimage import zoom
import matplotlib.cm as cm

# 정규화 상수 (ImageNet 표준)
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]

# 클래스 이름
CLASS_NAMES = ['ak', 'bcc', 'bkl', 'df', 'mel', 'nv', 'scc', 'vasc']
NUM_CLASSES = len(CLASS_NAMES)

# 디바이스 설정
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu')


class EnsembleModel(nn.Module):
    """학습 코드와 일치하는 앙상블 모델 구조"""
    def __init__(self, num_classes):
        super().__init__()
        
        # ResNet50 (백본 A)
        self.model_A = resnet50(weights=ResNet50_Weights.IMAGENET1K_V1)
        self.model_A.fc = nn.Identity()
        
        # EfficientNetB4 (백본 B)
        self.model_B = efficientnet_b4(weights=EfficientNet_B4_Weights.IMAGENET1K_V1)
        num_ftrs_b = self.model_B.classifier[1].in_features
        self.model_B.classifier = nn.Identity()
        
        # 앙상블 분류기
        combined_features_size = 2048 + num_ftrs_b
        self.classifier = nn.Sequential(
            nn.Dropout(0.6),
            nn.Linear(combined_features_size, 512),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(512, num_classes)
        )
    
    def forward(self, x):
        # GradCAM을 위해 공간 특징을 보존하는 수동 forward
        # ResNet50 forward
        x_resnet = self.model_A.conv1(x)
        x_resnet = self.model_A.bn1(x_resnet)
        x_resnet = self.model_A.relu(x_resnet)
        x_resnet = self.model_A.maxpool(x_resnet)
        x_resnet = self.model_A.layer1(x_resnet)
        x_resnet = self.model_A.layer2(x_resnet)
        x_resnet = self.model_A.layer3(x_resnet)
        x_resnet = self.model_A.layer4(x_resnet)  # [B, 2048, H, W] - 공간 특징
        features_A = self.model_A.avgpool(x_resnet)  # [B, 2048, 1, 1]
        features_A = torch.flatten(features_A, 1)  # [B, 2048]
        
        # EfficientNetB4 forward
        features_B = self.model_B.features(x)  # [B, 1792, H, W] - 공간 특징
        features_B = self.model_B.avgpool(features_B)  # [B, 1792, 1, 1]
        features_B = torch.flatten(features_B, 1)  # [B, 1792]
        
        combined_features = torch.cat((features_A, features_B), dim=1)
        output = self.classifier(combined_features)
        return output


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
        self.activations = output
    
    def save_gradient(self, module, grad_input, grad_output):
        if grad_output[0] is not None:
            self.gradients = grad_output[0]
        else:
            self.gradients = None
    
    def __call__(self, input_tensor, target_category=None):
        self.model.zero_grad()
        self.gradients = None
        self.activations = None
        
        input_tensor.requires_grad_(True)
        output = self.model(input_tensor)
        
        if target_category is None:
            target_category = torch.argmax(output, dim=1).item()
        
        one_hot = torch.zeros_like(output)
        one_hot[0, target_category] = 1
        
        output.backward(gradient=one_hot, retain_graph=False)
        
        if self.activations is None or self.gradients is None:
            return np.zeros((16, 16)), target_category, output.detach()
        
        activations = self.activations
        gradients = self.gradients
        
        if len(gradients.shape) != 4 or len(activations.shape) != 4:
            return np.zeros((16, 16)), target_category, output.detach()
        
        # GradCAM++ 계산
        alpha_num = F.relu(gradients)
        alpha_den = torch.sum(activations, dim=[2, 3], keepdim=True) + 1e-10
        alpha = alpha_num / alpha_den
        
        weights = torch.sum(alpha * activations, dim=[2, 3], keepdim=True)
        heatmap = torch.sum(weights * activations, dim=1)
        heatmap = F.relu(heatmap[0])
        
        # 정규화 (gradcam_visualization.py와 동일)
        max_val = torch.max(heatmap)
        min_val = torch.min(heatmap)
        mean_val = torch.mean(heatmap)
        std_val = torch.std(heatmap)
        
        if max_val > 0:
            # [0, 1]로 정규화하되 상대적 차이 보존 (gradcam_visualization.py와 동일)
            heatmap_normalized = (heatmap - min_val) / (max_val - min_val + 1e-8)
            # 약한 활성화를 더 보이게 하기 위한 약간의 향상 적용
            heatmap_normalized = torch.pow(heatmap_normalized, 0.8)
            heatmap = heatmap_normalized
        else:
            heatmap = torch.zeros_like(heatmap)
        
        heatmap_np = heatmap.cpu().detach().numpy()
        output_detached = output.detach()
        
        del heatmap, heatmap_normalized, weights, alpha, alpha_num, alpha_den, activations, gradients, one_hot, output
        self.gradients = None
        self.activations = None
        
        return heatmap_np, target_category, output_detached


def load_model(model_path, device=DEVICE):
    """모델 로드"""
    model = EnsembleModel(num_classes=NUM_CLASSES).to(device)
    
    checkpoint = torch.load(model_path, map_location=device, weights_only=False)
    if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
        state_dict = checkpoint['model_state_dict']
        if any(k.startswith('module.') for k in state_dict.keys()):
            state_dict = {k.replace('module.', ''): v for k, v in state_dict.items()}
        model.load_state_dict(state_dict, strict=False)
    else:
        model.load_state_dict(checkpoint, strict=False)
    
    model.eval()
    return model


def preprocess_image(image_input, image_size=512, device=DEVICE):
    """
    이미지 전처리
    
    Args:
        image_input: PIL Image 객체 또는 이미지 경로
        image_size: 리사이즈할 크기 (기본값: 512)
        device: 사용할 디바이스 (기본값: 전역 DEVICE)
    
    Returns:
        image_tensor: 전처리된 텐서 (1, 3, H, W)
        image_denorm: 역정규화된 이미지 numpy array (H, W, 3) [0, 1]
    """
    # 이미지 로드
    if isinstance(image_input, str):
        image = Image.open(image_input).convert('RGB')
    elif isinstance(image_input, Image.Image):
        image = image_input.convert('RGB')
    else:
        raise ValueError("image_input은 PIL Image 객체 또는 이미지 경로여야 합니다.")
    
    # 전처리 파이프라인
    transform = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=MEAN, std=STD)
    ])
    
    image_tensor = transform(image).unsqueeze(0).to(device)
    
    # 역정규화된 이미지 (시각화용)
    image_denorm = image_tensor[0].cpu().numpy().transpose((1, 2, 0))
    image_denorm = np.array(STD) * image_denorm + np.array(MEAN)
    image_denorm = np.clip(image_denorm, 0, 1)
    
    return image_tensor, image_denorm


def apply_class_specific_threshold(cam, predicted_class):
    """
    클래스별 적응형 임계값 적용 (gradcam_visualization.py와 동일)
    
    Args:
        cam: 히트맵 numpy array (H, W)
        predicted_class: 예측된 클래스 인덱스
    
    Returns:
        처리된 히트맵
    """
    class_name = CLASS_NAMES[predicted_class]
    
    # 클래스별 임계값 설정 (gradcam_visualization.py와 동일)
    if class_name == 'mel':
        # MEL: 병변 전체 커버를 위해 더 완화 (병변 크기가 큰 경우 고려)
        percentile = 60  # 상위 40% 값
        threshold_multiplier = 0.70  # 약한 임계값
        gamma = 0.80  # 약한 압축
    elif class_name == 'ak':
        # AK: 병변 전체 커버를 위해 더 완화
        percentile = 55  # 상위 45% 값
        threshold_multiplier = 0.65  # 약한 임계값
        gamma = 0.75  # 약한 압축
    elif class_name == 'df':
        # DF: 병변 전체 커버를 위해 더 완화
        percentile = 65  # 상위 35% 값
        threshold_multiplier = 0.75  # 중간 임계값
        gamma = 0.80  # 약한 압축
    elif class_name == 'nv':
        # NV: 병변 전체 커버를 위해 더 완화 (병변 크기가 큰 경우 많음)
        percentile = 60  # 상위 40% 값
        threshold_multiplier = 0.70  # 약한 임계값
        gamma = 0.80  # 약한 압축
    elif class_name == 'vasc':
        # VASC: 병변 전체 커버를 위해 더 완화
        percentile = 60  # 상위 40% 값
        threshold_multiplier = 0.70  # 약한 임계값
        gamma = 0.80  # 약한 압축
    elif class_name == 'bkl':
        # BKL: 병변 전체 커버를 위해 더 완화
        percentile = 60  # 상위 40% 값
        threshold_multiplier = 0.70  # 약한 임계값
        gamma = 0.80  # 약한 압축
    elif class_name == 'bcc':
        # BCC: 병변 전체 커버를 위해 더 완화
        percentile = 55  # 상위 45% 값
        threshold_multiplier = 0.65  # 약한 임계값
        gamma = 0.75  # 약한 압축
    elif class_name == 'scc':
        # SCC: 병변 전체 커버를 위해 더 완화
        percentile = 60  # 상위 40% 값
        threshold_multiplier = 0.70  # 약한 임계값
        gamma = 0.80  # 약한 압축
    else:
        # 알 수 없는 클래스: 균형잡힌 임계값
        percentile = 65  # 상위 35% 값
        threshold_multiplier = 0.75  # 중간 임계값
        gamma = 0.80  # 중간 압축
    
    # 히트맵 통계 (gradcam_visualization.py와 동일한 로직)
    cam_resized = cam.copy()
    max_val = np.max(cam_resized)
    
    if max_val > 0:
        threshold = np.percentile(cam_resized, percentile)
        
        # 임계값 적용 (gradcam_visualization.py와 동일)
        cam_resized = np.maximum(cam_resized - threshold * threshold_multiplier, 0)
        
        # 임계값 적용 후 재정규화
        if cam_resized.max() > 0:
            # [0, 1]로 정규화
            cam_resized = cam_resized / cam_resized.max()
            # 감마 보정 적용
            cam_resized = np.power(cam_resized, gamma)
            
            # 추가 후처리: 상위 30% 픽셀 유지하여 병변 전체 커버 (gradcam_visualization.py와 동일)
            top_30_percentile = np.percentile(cam_resized, 70)
            cam_resized = np.where(cam_resized >= top_30_percentile, cam_resized, cam_resized * 0.5)
            
            # 재정규화
            if cam_resized.max() > 0:
                cam_resized = cam_resized / cam_resized.max()
        else:
            # 모든 값이 임계값보다 낮으면 원본 정규화된 값 사용
            cam_resized = (cam_resized + threshold * threshold_multiplier) / (max_val + 1e-8)
            cam_resized = np.clip(cam_resized, 0, 1)
    else:
        cam_resized = np.zeros_like(cam_resized)
    
    return cam_resized


def create_overlay_image(image_denorm, heatmap, alpha=0.5):
    """
    히트맵을 이미지에 오버레이 (gradcam_visualization.py와 동일)
    
    Args:
        image_denorm: 역정규화된 이미지 (H, W, 3) [0, 1]
        heatmap: 히트맵 (H, W) [0, 1]
        alpha: 오버레이 투명도
    
    Returns:
        오버레이된 이미지 (H, W, 3) [0, 255] uint8
    """
    H, W, _ = image_denorm.shape
    
    # 히트맵 리사이즈
    if heatmap.shape != (H, W):
        zoom_factors = (H / heatmap.shape[0], W / heatmap.shape[1])
        heatmap_resized = zoom(heatmap, zoom_factors, order=3)
    else:
        heatmap_resized = heatmap
    
    # 컬러맵 적용 (jet: blue -> red) - gradcam_visualization.py와 동일
    cam_for_colormap = np.clip(heatmap_resized, 0, 1)
    heatmap_colored = cm.jet(cam_for_colormap)[:, :, :3]  # (H, W, 3) [0, 1]
    
    # 오버레이
    overlay = heatmap_colored * alpha + image_denorm * (1 - alpha)
    overlay = np.clip(overlay, 0, 1)
    overlay_uint8 = (overlay * 255).astype(np.uint8)
    
    return overlay_uint8


def generate_gradcam_overlay(
    image_input,
    model_path,
    target_class=None,
    image_size=512,
    device=DEVICE
):
    """
    단일 이미지에 대한 GradCAM++ 오버레이 이미지 생성 (웹 서버용)
    
    Args:
        image_input: PIL Image 객체 또는 이미지 경로
        model_path: 학습된 모델 체크포인트 경로
        target_class: 특정 클래스에 대한 GradCAM 생성 (None이면 예측 클래스 사용)
        image_size: 이미지 리사이즈 크기 (기본값: 512)
        device: 사용할 디바이스
    
    Returns:
        numpy array (H, W, 3) uint8 - 오버레이된 이미지
    """
    # 모델 로드
    model = load_model(model_path, device)
    
    # 이미지 전처리
    image_tensor, image_denorm = preprocess_image(image_input, image_size, device)
    
    # 예측
    with torch.no_grad():
        output = model(image_tensor)
        pred_class = torch.argmax(output, dim=1).item()
        pred_prob = torch.softmax(output, dim=1)[0, pred_class].item()
    
    # 타겟 클래스 결정
    if target_class is None:
        target_class = pred_class
    
    # GradCAM++ 생성 (ResNet50 layer4 사용 - 단일 레이어)
    target_layer = model.model_A.layer4
    gradcampp = GradCAMPlusPlus(model, target_layer)
    
    # 히트맵 계산
    heatmap, _, _ = gradcampp(image_tensor, target_category=target_class)
    
    # 클래스별 임계값 적용
    heatmap_processed = apply_class_specific_threshold(heatmap, pred_class)
    
    # 오버레이 이미지 생성
    overlay_image = create_overlay_image(image_denorm, heatmap_processed)
    
    # 메모리 정리
    del model, image_tensor, gradcampp
    if device.type == 'cuda':
        torch.cuda.empty_cache()
    elif device.type == 'mps':
        torch.mps.empty_cache()
    
    return overlay_image


# 사용 예시
if __name__ == "__main__":
    # 예시: 이미지 경로로 GradCAM 오버레이 생성
    overlay = generate_gradcam_overlay(
        image_input="test_data/ISIC_0000173_mel.jpg",
        model_path="ensemble_finetune_best_60epochst.pt"
    )
    
    # PIL Image로 저장
    from PIL import Image
    pil_image = Image.fromarray(overlay)
    pil_image.save("test_overlay_output.png")
    print(f"✅ 오버레이 이미지 저장됨: test_overlay_output.png")
    print(f"이미지 형태: {overlay.shape}")

