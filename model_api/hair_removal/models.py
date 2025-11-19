"""
털 제거 파이프라인 모델 로딩
"""
import sys
from pathlib import Path
from typing import Optional
import torch
import torch.nn.functional as F
import segmentation_models_pytorch as smp


class InternalResolutionAdapter(torch.nn.Module):
    """내부 해상도 어댑터 (메모리 절약용)"""
    def __init__(self, base_model: torch.nn.Module, internal_size: int = 384):
        super().__init__()
        self.base = base_model
        self.internal_size = int(internal_size)

    @staticmethod
    def _resize_input(x: torch.Tensor, size: int) -> torch.Tensor:
        return F.interpolate(x, size=(size, size), mode="bilinear", align_corners=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.shape[-1] != self.internal_size:
            x = self._resize_input(x, self.internal_size)
        logits_small = self.base(x)
        if isinstance(logits_small, (list, tuple)):
            logits_small = logits_small[0]
        return logits_small


def load_unet_model(checkpoint_path: Path, device: torch.device):
    """U-Net 모델 로드 (털 마스크 추출용)"""
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"체크포인트가 존재하지 않습니다: {checkpoint_path}")
    
    state = torch.load(checkpoint_path, map_location="cpu")
    meta = state.get("meta") or {}
    internal_size = int(meta.get("internal_size", 384))
    
    # 임계값 로드
    thr_path = checkpoint_path.with_name("best_threshold.txt")
    recommended_thr = meta.get("recommended_threshold")
    if thr_path.exists():
        try:
            recommended_thr = float(thr_path.read_text().strip())
        except ValueError:
            pass
    
    threshold = float(recommended_thr if recommended_thr is not None else 0.5)
    
    # 모델 생성
    base_model = smp.UnetPlusPlus(
        encoder_name="resnet18",
        encoder_weights=None,
        in_channels=3,
        classes=1,
        decoder_attention_type=None,
    )
    model = InternalResolutionAdapter(base_model, internal_size=internal_size)
    model.load_state_dict(state["state_dict"], strict=True)
    model.to(device)
    model.eval()
    
    return model, threshold


def load_bsrgan_model(weights_path: Path, network_path: Path, device: torch.device):
    """BSRGAN 모델 로드"""
    if not weights_path.exists():
        return None
    
    # network_rrdbnet.py가 있는 디렉토리를 sys.path에 추가
    network_dir = network_path.parent.resolve()
    if str(network_dir) not in sys.path:
        sys.path.insert(0, str(network_dir))
    
    try:
        from network_rrdbnet import RRDBNet
    except Exception as e:
        raise RuntimeError("network_rrdbnet.py를 가져오지 못했습니다. models 폴더 경로를 확인하세요.") from e

    net = RRDBNet(in_nc=3, out_nc=3, nf=64, nb=23, gc=32, sf=2).to(device)
    ckpt = torch.load(str(weights_path), map_location=device)
    state = ckpt.get("params_ema") or ckpt.get("params") or ckpt.get("state_dict") or ckpt
    net.load_state_dict(state, strict=True)
    net.eval()
    for p in net.parameters():
        p.requires_grad_(False)
    return net

