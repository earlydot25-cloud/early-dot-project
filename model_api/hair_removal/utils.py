"""
털 제거 파이프라인 유틸리티 함수
"""
import cv2
import numpy as np
from typing import Tuple, Optional
import torch

# NumPy 2.0 호환성
if not hasattr(np, "sctypes"):
    np.sctypes = {
        "float": [np.float16, np.float32, np.float64],
        "complex": [np.complex64, np.complex128],
        "int": [np.int8, np.int16, np.int32, np.int64],
        "uint": [np.uint8, np.uint16, np.uint32, np.uint64],
        "others": [np.bool_, np.bytes_, np.str_, np.object_],
    }


def letterbox_pad(bgr: np.ndarray, target: int) -> Tuple[np.ndarray, dict]:
    """이미지를 정사각형 캔버스에 중앙 정렬"""
    h, w = bgr.shape[:2]
    scale = min(target / h, target / w)
    new_h = max(1, int(round(h * scale)))
    new_w = max(1, int(round(w * scale)))
    interp = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC
    resized = cv2.resize(bgr, (new_w, new_h), interpolation=interp)
    canvas = np.zeros((target, target, 3), dtype=np.uint8)
    top = (target - new_h) // 2
    left = (target - new_w) // 2
    canvas[top : top + new_h, left : left + new_w] = resized
    meta = dict(top=top, left=left, new_h=new_h, new_w=new_w, orig_h=h, orig_w=w)
    return canvas, meta


def restore_mask_to_original(mask_sq: np.ndarray, meta: dict) -> np.ndarray:
    """마스크를 원본 해상도로 복원"""
    top, left = meta["top"], meta["left"]
    new_h, new_w = meta["new_h"], meta["new_w"]
    orig_h, orig_w = meta["orig_h"], meta["orig_w"]
    crop = mask_sq[top : top + new_h, left : left + new_w]
    if crop.size == 0:
        return np.zeros((orig_h, orig_w), dtype=np.uint8)
    return cv2.resize(crop, (orig_w, orig_h), interpolation=cv2.INTER_NEAREST)


def _bgr_to_tensor01(bgr: np.ndarray) -> torch.Tensor:
    """BGR 이미지를 [0,1] 범위 텐서로 변환"""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    return torch.from_numpy(rgb.transpose(2, 0, 1)).unsqueeze(0)


def _tensor01_to_bgr(t: torch.Tensor) -> np.ndarray:
    """[0,1] 범위 텐서를 BGR 이미지로 변환"""
    rgb = (t.detach().clamp_(0, 1).squeeze(0).permute(1, 2, 0).cpu().numpy() * 255.0 + 0.5).astype(np.uint8)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def decide_bsrgan_passes(h: int, w: int, edge_tiny: int = 160, edge_small: int = 300, max_passes: int = 2) -> int:
    """BSRGAN 업스케일 횟수 결정"""
    m = min(h, w)
    if m <= edge_tiny:
        return min(2, max_passes)
    if m <= edge_small:
        return min(1, max_passes)
    return 0


def normalize_image_and_mask(
    bgr: np.ndarray,
    mask_binary: np.ndarray,
    target_long_edge: int,
    bsr_model=None,
    bsr_device: Optional[torch.device] = None,
    edge_tiny: int = 160,
    edge_small: int = 300,
    max_passes: int = 2,
) -> Tuple[np.ndarray, np.ndarray, dict]:
    """이미지와 마스크를 정규화 (BSRGAN 업스케일 + 리사이즈 + 캔버싱)"""
    img = bgr.copy()
    mask = mask_binary.copy()
    passes = 0

    # 조건부 BSRGAN
    if bsr_model is not None and bsr_device is not None:
        want_passes = decide_bsrgan_passes(*img.shape[:2], edge_tiny, edge_small, max_passes)
        for _ in range(want_passes):
            try:
                tensor = _bgr_to_tensor01(img).to(device=bsr_device, dtype=torch.float32)
                with torch.no_grad():
                    out = bsr_model(tensor)
                up = _tensor01_to_bgr(out)
            except Exception as e:
                print(f"[BSRGAN] 업스케일 실패 → 중단: {e}")
                break
            mask = cv2.resize(mask, (up.shape[1], up.shape[0]), interpolation=cv2.INTER_NEAREST)
            img = up
            passes += 1

    # 타깃 해상도 기반 리사이즈
    h, w = img.shape[:2]
    long_edge = max(h, w)
    if long_edge > target_long_edge:
        scale = target_long_edge / long_edge
        new_w = max(1, int(round(w * scale)))
        new_h = max(1, int(round(h * scale)))
        blurred = cv2.GaussianBlur(img, (0, 0), 0.55)
        img = cv2.resize(blurred, (new_w, new_h), interpolation=cv2.INTER_AREA)
        mask = cv2.resize(mask, (new_w, new_h), interpolation=cv2.INTER_NEAREST)
    elif long_edge < target_long_edge:
        scale = target_long_edge / long_edge
        new_w = max(1, int(round(w * scale)))
        new_h = max(1, int(round(h * scale)))
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
        mask = cv2.resize(mask, (new_w, new_h), interpolation=cv2.INTER_NEAREST)
        blur = cv2.GaussianBlur(img, (0, 0), 0.7)
        img = cv2.addWeighted(img, 1.10, blur, -0.10, 0)
    else:
        blur = cv2.GaussianBlur(img, (0, 0), 0.4)
        img = cv2.addWeighted(img, 1.02, blur, -0.02, 0)

    # 512×512 정사각형 캔버스 중앙정렬
    canvas_img = np.zeros((target_long_edge, target_long_edge, 3), dtype=np.uint8)
    canvas_mask = np.zeros((target_long_edge, target_long_edge), dtype=np.uint8)
    top = (target_long_edge - img.shape[0]) // 2
    left = (target_long_edge - img.shape[1]) // 2
    canvas_img[top : top + img.shape[0], left : left + img.shape[1]] = img
    canvas_mask[top : top + mask.shape[0], left : left + mask.shape[1]] = mask

    meta = {"bsr_passes": passes, "prep_hw": (img.shape[0], img.shape[1]), "target_long_edge": target_long_edge}
    return canvas_img, canvas_mask, meta


def enhance_hairless_image(
    bgr: np.ndarray,
    target_long_edge: int = 512,
) -> Tuple[np.ndarray, dict]:
    """인페인팅 결과 후처리"""
    img = bgr.copy()
    meta = dict(original_hw=(int(bgr.shape[0]), int(bgr.shape[1])))

    h, w = img.shape[:2]
    long_edge = max(h, w)
    if long_edge > target_long_edge:
        scale = target_long_edge / long_edge
        new_w = max(1, int(round(w * scale)))
        new_h = max(1, int(round(h * scale)))
        blurred = cv2.GaussianBlur(img, (0, 0), 0.55)
        img = cv2.resize(blurred, (new_w, new_h), interpolation=cv2.INTER_AREA)
    elif long_edge < target_long_edge:
        scale = target_long_edge / long_edge
        new_w = max(1, int(round(w * scale)))
        new_h = max(1, int(round(h * scale)))
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
        blur = cv2.GaussianBlur(img, (0, 0), 0.7)
        img = cv2.addWeighted(img, 1.12, blur, -0.12, 0)
    else:
        blur = cv2.GaussianBlur(img, (0, 0), 0.5)
        img = cv2.addWeighted(img, 1.05, blur, -0.05, 0)

    canvas = np.zeros((target_long_edge, target_long_edge, 3), dtype=np.uint8)
    top = (target_long_edge - img.shape[0]) // 2
    left = (target_long_edge - img.shape[1]) // 2
    canvas[top : top + img.shape[0], left : left + img.shape[1]] = img
    meta["final_hw"] = (int(img.shape[0]), int(img.shape[1]))
    meta["target_long_edge"] = target_long_edge
    return canvas, meta

