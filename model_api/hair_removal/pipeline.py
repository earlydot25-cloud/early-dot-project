"""
털 제거 파이프라인 - 단일 이미지 처리용
"""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional, Tuple
import io

import cv2
import numpy as np
import torch
import torch.nn.functional as F

from .models import load_unet_model, load_bsrgan_model
from .utils import (
    letterbox_pad,
    restore_mask_to_original,
    normalize_image_and_mask,
    enhance_hairless_image,
)


class HairRemovalPipeline:
    """털 제거 파이프라인 클래스"""
    
    def __init__(
        self,
        models_dir: Path,
        device: Optional[torch.device] = None,
    ):
        """
        Args:
            models_dir: 모델 파일들이 있는 디렉토리 경로
            device: 사용할 디바이스 (None이면 자동 선택)
        """
        self.models_dir = Path(models_dir)
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # 경로 설정
        self.hair_mask_model_path = self.models_dir / "hair_mask" / "best_hair_mask_model.pt"
        self.bsrgan_model_path = self.models_dir / "bsrgan" / "BSRGANx2.pth"
        self.bsrgan_network_path = self.models_dir / "bsrgan" / "network_rrdbnet.py"
        self.lama_dir = self.models_dir / "lama"
        self.lama_weights_dir = self.lama_dir / "big-lama"
        self.lama_predict = self.lama_dir / "bin" / "predict.py"
        
        # 모델 로드
        self.unet_model = None
        self.unet_threshold = 0.5
        self.bsrgan_model = None
        self.bsr_device = None
        
        # 설정
        self.IMG_SIZE = 512
        self.PREP_LONG_EDGE = 512
        self.POST_TARGET_LONG_EDGE = 512
        self.BSRGAN_EDGE_TINY = 160
        self.BSRGAN_EDGE_SMALL = 300
        self.BSRGAN_MAX_PASSES = 2
        
        self._load_models()
    
    def _load_models(self):
        """모델 로드"""
        print(f"[Pipeline] 디바이스: {self.device}")
        
        # U-Net 모델 로드
        if self.hair_mask_model_path.exists():
            self.unet_model, self.unet_threshold = load_unet_model(
                self.hair_mask_model_path,
                self.device
            )
            print(f"[Pipeline] U-Net 모델 로드 완료 (임계값: {self.unet_threshold:.4f})")
        else:
            raise FileNotFoundError(f"U-Net 모델을 찾을 수 없습니다: {self.hair_mask_model_path}")
        
        # BSRGAN 모델 로드 (선택적)
        if self.bsrgan_model_path.exists() and self.bsrgan_network_path.exists():
            try:
                # BSRGAN은 CPU로 실행 (안정성)
                self.bsr_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                if self.device.type == "mps":
                    self.bsr_device = torch.device("cpu")
                self.bsrgan_model = load_bsrgan_model(
                    self.bsrgan_model_path,
                    self.bsrgan_network_path,
                    self.bsr_device
                )
                print(f"[Pipeline] BSRGAN 모델 로드 완료 (device: {self.bsr_device})")
            except Exception as e:
                print(f"[Pipeline] BSRGAN 로드 실패: {e}")
                self.bsrgan_model = None
        else:
            print(f"[Pipeline] BSRGAN 가중치 또는 network 파일을 찾지 못했습니다")
        
        # LaMa 경로 확인
        if not self.lama_predict.exists():
            raise FileNotFoundError(f"LaMa predict.py가 없습니다: {self.lama_predict}")
        if not self.lama_weights_dir.exists():
            raise FileNotFoundError(f"LaMa big-lama 가중치 폴더가 없습니다: {self.lama_weights_dir}")
        print(f"[Pipeline] LaMa 경로 확인 완료")
    
    def _predict_mask(self, bgr: np.ndarray) -> np.ndarray:
        """U-Net으로 털 마스크 예측"""
        # 이미지 전처리 (letterbox padding)
        padded, meta = letterbox_pad(bgr, self.IMG_SIZE)
        
        # 텐서 변환
        rgb = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        tensor = torch.from_numpy(rgb.transpose(2, 0, 1)).unsqueeze(0).to(self.device, dtype=torch.float32)
        
        # 추론
        with torch.no_grad():
            logits_small = self.unet_model(tensor)
            logits_512 = F.interpolate(
                logits_small,
                size=(self.IMG_SIZE, self.IMG_SIZE),
                mode="bilinear",
                align_corners=False
            )
            prob = torch.sigmoid(logits_512)[0, 0].cpu().numpy()
        
        # 마스크 생성
        mask_512 = (prob >= self.unet_threshold).astype(np.uint8) * 255
        
        # 원본 해상도로 복원
        mask_orig = restore_mask_to_original(mask_512, meta).astype(np.uint8)
        mask_binary = (mask_orig > 0).astype(np.uint8) * 255
        
        # 모폴로지 연산 (팽창)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        mask_binary = cv2.dilate(mask_binary, kernel, iterations=1)
        
        return mask_binary
    
    def _run_lama_inpaint(self, prep_img: np.ndarray, prep_mask: np.ndarray) -> np.ndarray:
        """LaMa 인페인팅 실행"""
        print(f"[LaMa] 인페인팅 시작 (이미지 크기: {prep_img.shape}, 마스크 크기: {prep_mask.shape})")
        
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            indir = td_path / "lama_input"
            outdir = td_path / "out"
            indir.mkdir(parents=True, exist_ok=True)
            outdir.mkdir(parents=True, exist_ok=True)
            
            # 입력 파일 저장
            input_img_path = indir / "input.png"
            input_mask_path = indir / "input_mask.png"
            cv2.imwrite(str(input_img_path), prep_img)
            cv2.imwrite(str(input_mask_path), prep_mask)
            print(f"[LaMa] 입력 파일 저장 완료: {input_img_path}, {input_mask_path}")
            
            # NumPy 2.0 패치
            sitecustomize = td_path / "sitecustomize.py"
            sitecustomize.write_text(
                "import numpy as _np\n"
                "if not hasattr(_np, 'sctypes'):\n"
                "    _np.sctypes = {\n"
                "        'float': [_np.float16, _np.float32, _np.float64],\n"
                "        'complex': [_np.complex64, _np.complex128],\n"
                "        'int': [_np.int8, _np.int16, _np.int32, _np.int64],\n"
                "        'uint': [_np.uint8, _np.uint16, _np.uint32, _np.uint64],\n"
                "        'others': [_np.bool_, _np.bytes_, _np.str_, _np.object_],\n"
                "    }\n"
                "if not hasattr(_np, 'float'): _np.float = float\n"
                "if not hasattr(_np, 'int'): _np.int = int\n"
                "if not hasattr(_np, 'bool'): _np.bool = bool\n"
            )
            
            # 환경 변수 설정
            env = os.environ.copy()
            existing_py = env.get("PYTHONPATH", "")
            py_paths = [str(td_path), str(self.lama_dir)]
            if existing_py:
                py_paths.append(existing_py)
            env["PYTHONPATH"] = os.pathsep.join(py_paths)
            env.setdefault("HYDRA_FULL_ERROR", "1")
            env.setdefault("OMP_NUM_THREADS", "1")
            env.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
            
            # LaMa 실행
            cmd = [
                sys.executable,
                str(self.lama_predict),
                f"model.path={str(self.lama_weights_dir)}",
                f"indir={str(indir)}",
                f"outdir={str(outdir)}",
                "dataset.img_suffix=.png",
                "hydra.run.dir=.",
                "hydra.output_subdir=null",
            ]
            
            print(f"[LaMa] 실행 명령: {' '.join(cmd)}")
            print(f"[LaMa] 작업 디렉토리: {self.lama_dir}")
            print(f"[LaMa] LaMa 가중치 경로: {self.lama_weights_dir}")
            
            proc = subprocess.run(
                cmd,
                cwd=str(self.lama_dir),
                env=env,
                capture_output=True,
                text=True
            )
            
            if proc.returncode != 0:
                print(f"[LaMa] 실행 실패 (returncode: {proc.returncode})")
                print(f"[LaMa] STDOUT:\n{proc.stdout}")
                print(f"[LaMa] STDERR:\n{proc.stderr}")
                raise RuntimeError(
                    f"LaMa 실행 실패\n"
                    f"STDOUT:\n{proc.stdout}\n\nSTDERR:\n{proc.stderr}"
                )
            
            print("[LaMa] 실행 성공")
            
            # 결과 읽기
            result_path = outdir / "input.png"
            if not result_path.exists():
                candidates = sorted(
                    outdir.glob("*.png"),
                    key=lambda p: p.stat().st_mtime,
                    reverse=True
                )
                if candidates:
                    result_path = candidates[0]
                else:
                    raise FileNotFoundError("LaMa 출력 파일을 찾을 수 없습니다")
            
            result = cv2.imread(str(result_path), cv2.IMREAD_COLOR)
            if result is None:
                raise FileNotFoundError(f"LaMa 결과를 읽을 수 없습니다: {result_path}")
            
            return result
    
    def process(self, image_bytes: bytes) -> bytes:
        """
        이미지 바이트를 받아서 털 제거 처리 후 결과 바이트 반환
        
        Args:
            image_bytes: 입력 이미지 바이트
            
        Returns:
            처리된 이미지 바이트
        """
        print("[Pipeline] ========== 털 제거 파이프라인 시작 (총 4단계) ==========")
        
        # 바이트를 numpy array로 변환
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if bgr is None:
                raise ValueError("이미지를 디코딩할 수 없습니다")
            print(f"[Pipeline] 이미지 디코딩 완료 (크기: {bgr.shape})")
        except Exception as e:
            print(f"[Pipeline] 이미지 디코딩 실패: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Stage 1: 마스크 추출
        try:
            print("[Pipeline] [1/4] Stage 1: 마스크 추출 시작")
            mask_binary = self._predict_mask(bgr)
            print("[Pipeline] [1/4] Stage 1: 마스크 추출 완료")
        except Exception as e:
            print(f"[Pipeline] Stage 1 실패: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Stage 2: 전처리 (BSRGAN + 정규화)
        try:
            print("[Pipeline] [2/4] Stage 2: 전처리 시작 (해상도 및 선명도 향상)")
            prep_img, prep_mask, prep_meta = normalize_image_and_mask(
                bgr,
                mask_binary,
                target_long_edge=self.PREP_LONG_EDGE,
                bsr_model=self.bsrgan_model,
                bsr_device=self.bsr_device,
                edge_tiny=self.BSRGAN_EDGE_TINY,
                edge_small=self.BSRGAN_EDGE_SMALL,
                max_passes=self.BSRGAN_MAX_PASSES,
            )
            print("[Pipeline] [2/4] Stage 2: 전처리 완료")
        except Exception as e:
            print(f"[Pipeline] Stage 2 실패: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Stage 3: LaMa 인페인팅
        try:
            print("[Pipeline] [3/4] Stage 3: 털 제거 (LaMa 인페인팅) 시작")
            hairless_bgr = self._run_lama_inpaint(prep_img, prep_mask)
            print("[Pipeline] [3/4] Stage 3: 털 제거 완료")
        except Exception as e:
            print(f"[Pipeline] Stage 3 실패: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Stage 4: 후처리
        try:
            print("[Pipeline] [4/4] Stage 4: 후처리 시작")
            enhanced_bgr, enhance_meta = enhance_hairless_image(
                hairless_bgr,
                target_long_edge=self.POST_TARGET_LONG_EDGE,
            )
            print("[Pipeline] [4/4] Stage 4: 후처리 완료")
        except Exception as e:
            print(f"[Pipeline] Stage 4 실패: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # 결과를 바이트로 변환
        try:
            success, encoded_img = cv2.imencode('.png', enhanced_bgr)
            if not success:
                raise RuntimeError("이미지 인코딩 실패")
            print(f"[Pipeline] 이미지 인코딩 완료 (크기: {len(encoded_img.tobytes())} bytes)")
            print("[Pipeline] ========== 털 제거 파이프라인 완료 ==========")
            return encoded_img.tobytes()
        except Exception as e:
            print(f"[Pipeline] 이미지 인코딩 실패: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def process_from_array(self, bgr: np.ndarray) -> np.ndarray:
        """
        BGR numpy array를 받아서 털 제거 처리 후 결과 array 반환
        
        Args:
            bgr: 입력 BGR 이미지 (numpy array)
            
        Returns:
            처리된 BGR 이미지 (numpy array)
        """
        # Stage 1: 마스크 추출
        mask_binary = self._predict_mask(bgr)
        
        # Stage 2: 전처리
        prep_img, prep_mask, prep_meta = normalize_image_and_mask(
            bgr,
            mask_binary,
            target_long_edge=self.PREP_LONG_EDGE,
            bsr_model=self.bsrgan_model,
            bsr_device=self.bsr_device,
            edge_tiny=self.BSRGAN_EDGE_TINY,
            edge_small=self.BSRGAN_EDGE_SMALL,
            max_passes=self.BSRGAN_MAX_PASSES,
        )
        
        # Stage 3: LaMa 인페인팅
        hairless_bgr = self._run_lama_inpaint(prep_img, prep_mask)
        
        # Stage 4: 후처리
        enhanced_bgr, enhance_meta = enhance_hairless_image(
            hairless_bgr,
            target_long_edge=self.POST_TARGET_LONG_EDGE,
        )
        
        return enhanced_bgr

