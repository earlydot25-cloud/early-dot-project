// src/pages/diagnosis/CapturePage.tsx
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
} from 'react';
import Webcam from 'react-webcam';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiZap, FiZapOff, FiImage } from 'react-icons/fi';
import { useCaptureStore } from '@/hooks/useCaptureStore';
import type { BodyPart } from '@/hooks/useCaptureStore';

// ===== 앱의 중앙 컨테이너(네비 폭)과 맞추려면 여기를 네비와 동일하게 =====
const MAX_STAGE_WIDTH = 430;
// ===============================================================

// 상/하단 네비 실제 높이를 측정하는 훅
function useNavInsets() {
  const [insets, setInsets] = useState({ top: 0, bottom: 0 });

  const measure = useCallback(() => {
    const topEl = document.getElementById('app-topbar');
    const bottomEl = document.getElementById('app-tabbar');
    const top = topEl ? topEl.getBoundingClientRect().height : 0;
    const bottom = bottomEl ? bottomEl.getBoundingClientRect().height : 0;
    setInsets({ top, bottom });
  }, []);

  useLayoutEffect(() => {
    measure();

    let roTop: ResizeObserver | undefined;
    let roBottom: ResizeObserver | undefined;

    if ((window as any).ResizeObserver) {
      roTop = new (window as any).ResizeObserver(measure);
      roBottom = new (window as any).ResizeObserver(measure);
    }

    const topEl = document.getElementById('app-topbar');
    const bottomEl = document.getElementById('app-tabbar');
    topEl && roTop?.observe(topEl);
    bottomEl && roBottom?.observe(bottomEl);

    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    const t = window.setInterval(measure, 500); // 안전하게 주기 측정

    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.clearInterval(t);
      roTop?.disconnect();
      roBottom?.disconnect();
    };
  }, [measure]);

  return insets;
}

// 스타일 정의
const styles: Record<string, React.CSSProperties> = {
  outerWrapper: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'stretch',
    background: 'transparent',
    zIndex: 9999,
  },
  stage: {
    position: 'relative',
    width: '100%',
    maxWidth: `${MAX_STAGE_WIDTH}px`,
    margin: '0 auto',
    backgroundColor: '#000',
    color: 'white',
    overflow: 'hidden',
    borderRadius: 12,
    fontFamily: 'system-ui, sans-serif',
  },
  webcamWrapper: { position: 'absolute', inset: 0, zIndex: 1 },
  webcam: { objectFit: 'cover', width: '100%', height: '100%' },
  overlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 10,
    pointerEvents: 'none',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  guideBox: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 120,
    height: 120,
    border: '3px solid #4CAF50',
    borderRadius: 10 as any,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
  },
  guideText: {
    position: 'absolute',
    bottom: 180,
    width: '100%',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 500,
    zIndex: 11,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-between',
    padding: 20,
    zIndex: 20,
  },
  sideBar: {
    position: 'absolute',
    top: 100,
    right: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    zIndex: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 28,
    zIndex: 20,
  },
  iconButton: {
    backgroundColor: 'rgba(30,30,30,0.7)',
    border: 'none',
    color: 'white',
    padding: 12,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    backgroundColor: 'white',
    border: '5px solid white',
    outline: '3px solid rgba(255,255,255,0.5)',
    cursor: 'pointer',
  },
  textButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  hiddenInput: { display: 'none' },
};

const CapturePage: React.FC = () => {
  // 1) BodySelectionPage에서 넘어온 신체 부위
  // 예: navigate('/diagnosis/capture', { state: { bodyPart: '머리/목' } })
  const location = useLocation() as { state?: { bodyPart?: string } };

  // BodyPart 타입으로 캐스팅 (우리는 유효한 값만 보낸다고 가정하니까)
  const selectedBodyPart = (
    location.state?.bodyPart || '머리/목'
  ) as BodyPart;

  // 2) zustand store 훅
  const { setCapturedImage, setBodyPart } = useCaptureStore();

  // 3) react-router
  const navigate = useNavigate();

  // 4) UI 상태들
  const [torchOn, setTorchOn] = useState(false);
  const [guideOn, setGuideOn] = useState(true);

  // 5) 카메라 ref
  const webcamRef = useRef<Webcam>(null);

  // 6) 상/하단 네비 높이에 맞춰 stage 높이 계산
  const { top, bottom } = useNavInsets();

  // 7) 바디 스크롤 잠금 (촬영 중 배경 스크롤 방지)
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflowY;
    const prevBody = document.body.style.overflowY;
    document.documentElement.style.overflowY = 'hidden';
    document.body.style.overflowY = 'hidden';
    return () => {
      document.documentElement.style.overflowY = prevHtml;
      document.body.style.overflowY = prevBody;
    };
  }, []);

  // 뒤로가기 (바디 선택 화면 등으로 돌아감)
  const handleBack = () => {
    navigate(-1);
  };

  // 파일 → base64 변환 (갤러리에서 고른 이미지도 SavePhotoPage에서 미리보려면 base64 필요)
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('파일을 base64로 변환할 수 없습니다.'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // 촬영 버튼 -> 캡처 -> zustand 저장 -> 저장 페이지로 이동
  const handleCapture = useCallback(async () => {
    const shot = webcamRef.current?.getScreenshot();
    if (!shot) {
      console.warn('캡처 실패: 스크린샷을 얻지 못했습니다.');
      return;
    }

    // 1) zustand에 이미지와 부위 저장
    setCapturedImage(shot);
    setBodyPart(selectedBodyPart);

    // 2) SavePhotoPage로 이동하여 최종 저장 여부/추가 입력 받기
    navigate('/diagnosis/save');
  }, [navigate, selectedBodyPart, setCapturedImage, setBodyPart]);

  // 갤러리에서 이미지 고른 경우도 같은 처리
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const handleGalleryOpen = () => galleryInputRef.current?.click();

  const handleGalleryChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const b64 = await fileToBase64(f);

    setCapturedImage(b64);
    setBodyPart(selectedBodyPart);

    navigate('/diagnosis/save');
  };

  // 가이드 박스 on/off
  const handleToggleGuide = () => setGuideOn((v) => !v);

  // 카메라 세팅
  const videoConstraints: MediaStreamConstraints['video'] = {
    width: { ideal: 720 },
    height: { ideal: 1280 },
    facingMode: { ideal: 'environment' }, // 후면 카메라 우선 시도
  };

  // 🌟 토치(플래시) 시도 - 지원 기기에서만 동작
  const applyTorch = async (enable: boolean) => {
    const webcamAny = webcamRef.current as any;

    const fromRefStream: MediaStream | undefined = webcamAny?.stream;
    const fromVideoStream: MediaStream | undefined = (
      webcamRef.current?.video as HTMLVideoElement | undefined
    )?.srcObject as MediaStream | undefined;

    const stream: MediaStream | undefined = fromRefStream ?? fromVideoStream;
    if (!stream) return;

    const videoTracks: MediaStreamTrack[] =
      stream.getVideoTracks?.() ??
      stream.getTracks?.().filter((t: MediaStreamTrack) => t.kind === 'video') ??
      [];

    const track = videoTracks[0];
    if (!track) return;

    const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
    if (!caps.torch) {
      console.warn('torch 미지원 기기');
      return;
    }

    try {
      await (track as any).applyConstraints({ advanced: [{ torch: enable }] });
    } catch (err) {
      console.error('토치 적용 실패:', err);
    }
  };

  // torchOn 상태 바뀔 때마다 실제 토치 적용 시도
  useEffect(() => {
    applyTorch(torchOn);
  }, [torchOn]);

  // 실제 카메라 영역 높이 계산 (상단 네비 + 하단 네비 피해서 정확히 맞추기)
  const stageDynamicStyle: React.CSSProperties = {
    marginTop: top,
    height: `calc(100dvh - ${top + bottom}px)`,
  };

  return (
    <div style={styles.outerWrapper}>
      <div style={{ ...styles.stage, ...stageDynamicStyle }}>
        {/* 카메라 미리보기 */}
        <div style={styles.webcamWrapper}>
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            style={styles.webcam}
            mirrored={false}
            onUserMediaError={(err) => {
              console.error('카메라 접근 실패:', err);
            }}
          />
        </div>

        {/* 오버레이 (격자 + 가이드 박스) */}
        <div style={styles.overlay}>
          <div style={{ ...styles.gridLineV, left: '33.3%' }} />
          <div style={{ ...styles.gridLineV, left: '66.6%' }} />
          <div style={{ ...styles.gridLineH, top: '33.3%' }} />
          <div style={{ ...styles.gridLineH, top: '66.6%' }} />
          {guideOn && <div style={styles.guideBox} />}
        </div>

        {/* 안내 텍스트 */}
        {guideOn && (
          <div style={styles.guideText}>
            환부를 초록 박스에 맞춰 촬영해주세요
          </div>
        )}

        {/* 상단 영역: 뒤로가기 */}
        <div style={styles.topBar}>
          <button style={styles.iconButton} onClick={handleBack}>
            <FiArrowLeft size={24} />
          </button>
          {/* 오른쪽 상단 비워둠 (원하면 부위 표시 가능) */}
          <div style={{ width: 24, height: 24 }} />
        </div>

        {/* 우측 사이드: 플래시 토글 */}
        <div style={styles.sideBar}>
          <button
            style={styles.iconButton}
            onClick={() => setTorchOn((v) => !v)}
          >
            {torchOn ? <FiZapOff size={22} /> : <FiZap size={22} />}
          </button>
        </div>

        {/* 하단 컨트롤 바 */}
        <div style={styles.bottomBar}>
          {/* 갤러리에서 불러오기 버튼 */}
          <button style={styles.iconButton} onClick={handleGalleryOpen}>
            <FiImage size={24} />
          </button>
          <input
            type="file"
            accept="image/*"
            ref={galleryInputRef}
            style={styles.hiddenInput}
            onChange={handleGalleryChange}
          />

          {/* 촬영 버튼 */}
          <button style={styles.captureButton} onClick={handleCapture} />

          {/* 가이드 토글 */}
          <button
            style={styles.textButton}
            onClick={handleToggleGuide}
            aria-pressed={guideOn}
          >
            감지
          </button>
        </div>
      </div>
    </div>
  );
};

export default CapturePage;
