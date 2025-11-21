import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import Webcam from 'react-webcam';
import { useNavigate, useLocation } from 'react-router-dom';
// Fi 아이콘 사용을 유지합니다.
import { FiArrowLeft, FiZap, FiZapOff, FiImage } from 'react-icons/fi';

const MAX_STAGE_WIDTH = 430;
// 💡 [수정] 카메라 스테이지의 상하 수직 여백을 80px에서 100px로 늘려 화면을 더 축소
const STAGE_VERTICAL_PADDING = 100;

// 💡 YOLO API 호출 주소 (FastAPI 컨테이너 호스트 포트 8001)
const DETECTION_API_URL = 'http://localhost:8001/api/detect/stream';

// 💡 탐지 결과 타입 정의
interface DetectionResult {
  box: [number, number, number, number]; // [x1, y1, x2, y2] (0~1000 스케일)
  label: string;
  confidence: number;
}

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
    // 모바일 주소창/안전영역 변동 대비
    const t = window.setInterval(measure, 500);

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

const styles: Record<string, React.CSSProperties> = {
  /** 화면 전체 래퍼 — 네비 폭과 동일하게 중앙에 stage를 배치 */
  outerWrapper: {
    position: 'fixed',
    inset: 0,            // top:0, right:0, bottom:0, left:0
    display: 'flex',
    justifyContent: 'center', // 중앙 정렬
    alignItems: 'flex-start', // 상단부터 배치되도록 수정 (dynamic style로 margin-top 조정 예정)
    background: 'transparent' // 검정색이 바깥으로 새는걸 방지(배경은 stage가 가짐)
  },

  /** 실제 카메라 스테이지(네비 폭과 일치하도록 maxWidth 제한) */
  stage: {
    position: 'relative',
    width: '100%',
    maxWidth: `${MAX_STAGE_WIDTH}px`, // ← 네비의 max-width와 동일하게
    margin: '0 auto',
    backgroundColor: '#000',
    color: 'white',
    overflow: 'hidden', // 내부 스크롤/넘침 방지
    borderRadius: 12,    // 선택: 네비와 동일하게 라운드 주고싶으면 유지
    fontFamily: 'system-ui, sans-serif',
  },

  webcamWrapper: { position: 'absolute', inset: 0, zIndex: 1 },
  webcam: { objectFit: 'cover', width: '100%', height: '100%' },
  overlay: { position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' },

  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },

  guideBox: {
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: 120, height: 120, border: '3px solid #4CAF50', borderRadius: 10 as any,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
  },
  guideText: {
    position: 'absolute', bottom: 180, width: '100%', textAlign: 'center', fontSize: 16, fontWeight: 500, zIndex: 11,
  },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: 20, zIndex: 20 },
  sideBar: { position: 'absolute', top: 100, right: 20, display: 'flex', flexDirection: 'column', gap: 20, zIndex: 20 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 150,
    display: 'flex', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 28, zIndex: 20,
  },

  iconButton: {
    backgroundColor: 'rgba(30,30,30,0.7)', border: 'none', color: 'white', padding: 12,
    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  captureButton: {
    width: 72, height: 72, borderRadius: '50%', backgroundColor: 'white',
    border: '5px solid white', outline: '3px solid rgba(255,255,255,0.5)', cursor: 'pointer',
  },
  textButton: { backgroundColor: 'transparent', border: 'none', color: 'white', fontSize: 15, fontWeight: 'bold', cursor: 'pointer' },
  hiddenInput: { display: 'none' },
};

const CapturePage: React.FC = () => {
  // BodySelectionPage에서 넘어온 값 사용 (없으면 기본값)
  const location = useLocation() as { state?: { bodyPart?: string } };
  const selectedBodyPart = location.state?.bodyPart || '머리/목';

  const navigate = useNavigate();
  const [torchOn, setTorchOn] = useState(false);

  const webcamRef = useRef<Webcam>(null);
  const { top, bottom } = useNavInsets();

  // 💡 AI 탐지 상태 및 결과
  const [isDetecting, setIsDetecting] = useState(false);
  // NOTE: 탐지된 결과가 환부가 아닌 '사람' 전체를 잡는 문제가 발생하고 있음 (백엔드 AI 모델 문제)
  const [detections, setDetections] = useState<DetectionResult[]>([]);


  // 바디 스크롤 잠금
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

  const handleBack = () => navigate(-1);

  const base64toFile = (base64: string, filename: string): File => {
    const [meta, data] = base64.split(',');
    const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const b = atob(data);
    const u8 = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i);
    return new File([u8], filename, { type: mime });
  };

  // ✅ 촬영 → 업로드하지 말고 저장 페이지로 이동
  const handleCapture = useCallback(() => {
    // 💡 AI 감지 중에도 캡처 허용
    if (isDetecting) {
        console.warn("AI 감지 중 촬영이 완료되었습니다.");
    }

    const shot = webcamRef.current?.getScreenshot();
    if (!shot) return;
    const file = base64toFile(shot, `capture_${Date.now()}.jpg`);
    navigate('/diagnosis/save', {
      state: {
        file,
        previewUrl: shot,          // dataURL
        bodyPart: selectedBodyPart,  // 선택한 신체부위 유지
      },
    });
  }, [navigate, selectedBodyPart, isDetecting]);

  // 갤러리에서 선택 → 저장 페이지로 이동
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const handleGalleryOpen = () => galleryInputRef.current?.click();
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    navigate('/diagnosis/save', {
      state: {
        file: f,
        previewUrl: URL.createObjectURL(f), // objectURL
        bodyPart: selectedBodyPart,
      },
    });
  };

  // 💡 감지 토글 함수
  const handleToggleDetection = useCallback(() => {
    setIsDetecting(v => {
      const newState = !v;
      console.log(`[AI Detection Toggle] State changed from ${v} to ${newState}.`);
      return newState;
    });
  }, []);

  const videoConstraints: MediaStreamConstraints['video'] = {
    width: { ideal: 720 },
    height: { ideal: 1280 },
    facingMode: { ideal: 'environment' },
  };

  // 플래시 적용(지원 기기만)
  const applyTorch = async (enable: boolean) => {
    const webcamAny = webcamRef.current as any;
    const fromRefStream: MediaStream | undefined = webcamAny?.stream;
    const fromVideoStream: MediaStream | undefined =
      (webcamRef.current?.video as HTMLVideoElement | undefined)?.srcObject as MediaStream | undefined;
    const stream: MediaStream | undefined = fromRefStream ?? fromVideoStream;
    if (!stream) return;

    const videoTracks: MediaStreamTrack[] =
      stream.getVideoTracks?.() ?? stream.getTracks?.().filter(t => t.kind === 'video') ?? [];
    const track = videoTracks[0];
    if (!track) return;

    const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
    if (!caps.torch) { console.warn('torch 미지원'); return; }

    try {
      await (track.applyConstraints as any)({ advanced: [{ torch: enable }] });
    } catch (err) {
      console.error('토치 적용 실패:', err);
    }
  };
  useEffect(() => { applyTorch(torchOn); }, [torchOn]);

  // 💡 실시간 탐지 로직: 1초(1000ms) 간격으로 유지
  useEffect(() => {
    const DELAY_MS = 1000;

    if (!isDetecting) {
      // isDetecting이 false일 때: 탐지 중지 및 바운딩 박스 제거
      setDetections([]);
      console.log("AI 감지 모드 중지 완료: 박스 초기화 및 타이머 시작 방지.");
      return;
    }

    // isDetecting이 true인 경우: 타이머 시작
    console.log(`AI 감지 모드 시작: ${DELAY_MS}ms 간격으로 API 호출`);
    const intervalId = window.setInterval(async () => {
        const shot = webcamRef.current?.getScreenshot();
        if (!shot || shot.startsWith('data:,') || !shot.includes('base64')) {
          return;
        }

        try {
            // Base64 Data URL에서 데이터 부분만 추출
            const base64Data = shot.split(',')[1];

            // NOTE: fetch 호출 시 API 키나 인증은 이 환경에서 생략
            const response = await fetch(DETECTION_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_base64: `data:image/jpeg;base64,${base64Data}` }),
            });

            if (!response.ok) {
                console.error(`Detection API failed: ${response.status} ${response.statusText}`);
                return;
            }

            const data: DetectionResult[] = await response.json();

            if (data.length > 0) {
               // [NOTE] 모델이 환부가 아닌 사람/배경을 잡는 경우, 여기로 잘못된 결과가 들어옴
               setDetections(data);
            } else {
               setDetections([]);
            }

        } catch (error) {
            console.error("탐지 요청 실패:", error);
            setDetections([]);
        }

    }, DELAY_MS);

    // 💡 클린업 함수: isDetecting이 false로 바뀌거나 컴포넌트가 언마운트될 때 호출되어 타이머를 중지합니다.
    return () => {
        console.log(`[Cleanup] 타이머 ${intervalId}를 해제합니다.`);
        window.clearInterval(intervalId);
    };
  }, [isDetecting]); // isDetecting 상태에만 의존

  // 네비 사이만 정확히 차도록 (수직 여백 추가)
  const stageDynamicStyle: React.CSSProperties = {
    // [수정] 상단 네비 높이에 증가된 수직 여백(100px)을 더합니다.
    marginTop: top + STAGE_VERTICAL_PADDING,
    // [수정] 전체 사용 가능한 높이에서 상하 여백(2 * PADDING)만큼 꿉니다.
    height: `calc(100dvh - ${top + bottom + 2 * STAGE_VERTICAL_PADDING}px)`,
  };

  // 💡 탐지된 단일 박스
  const detection = detections.length > 0 ? detections[0] : null;

  return (
    <div style={styles.outerWrapper}>
      {/* 스테이지에 수정된 동적 스타일 적용 */}
      <div style={{ ...styles.stage, ...stageDynamicStyle }}>
        <div style={styles.webcamWrapper}>
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            style={styles.webcam}
            mirrored={false}
            onUserMediaError={(err) => console.error('카메라 접근 실패:', err)}
          />
        </div>

        {/* 오버레이(격자 + 가이드) */}
        <div style={styles.overlay}>
          <div style={{ ...styles.gridLineV, left: '33.3%' }} />
          <div style={{ ...styles.gridLineV, left: '66.6%' }} />
          <div style={{ ...styles.gridLineH, top: '33.3%' }} />
          <div style={{ ...styles.gridLineH, top: '66.6%' }} />

          {/* 💡 가이드 박스: AI 감지 중이 아닐 때(!isDetecting)만 표시 */}
          {!isDetecting && <div style={styles.guideBox} />}

          {/* 💡 탐지된 단일 바운딩 박스 렌더링 */}
          {detection && (
            <div
              style={{
                position: 'absolute',
                // YOLO 결과는 0-1000 스케일이므로, 10으로 나누어 %로 변환
                left: `${detection.box[0] / 10}%`,
                top: `${detection.box[1] / 10}%`,
                width: `${(detection.box[2] - detection.box[0]) / 10}%`,
                height: `${(detection.box[3] - detection.box[1]) / 10}%`,
                // 테두리 두께 2px 유지 (시각적 부담 최소화)
                border: '2px solid #FFC107',
                borderRadius: 4,
                boxSizing: 'border-box',
              }}
            >
              {/* 신뢰도 텍스트 제거됨 */}
            </div>
          )}
        </div>

        {/* 💡 가이드 텍스트: isDetecting 상태에 따라 표시 */}
        {!isDetecting && <div style={styles.guideText}>환부를 초록 박스에 맞춰 촬영해주세요</div>}
        {/* 모델이 사람을 잡는 문제에 대한 안내 추가 */}
        {isDetecting && <div style={{...styles.guideText, color: '#FFC107'}}>AI가 환부를 감지 중입니다 (1초 간격)</div>}

        <div style={styles.topBar}>
          <button style={styles.iconButton} onClick={handleBack}><FiArrowLeft size={24} /></button>
        </div>

        <div style={styles.sideBar}>
          <button style={styles.iconButton} onClick={() => setTorchOn(v => !v)}>
            {torchOn ? <FiZapOff size={22} /> : <FiZap size={22} />}
          </button>
        </div>

        <div style={styles.bottomBar}>
          <button style={styles.iconButton} onClick={handleGalleryOpen}><FiImage size={24} /></button>
          <input type="file" accept="image/*" ref={galleryInputRef} style={styles.hiddenInput} onChange={handleGalleryChange} />
          <button style={styles.captureButton} onClick={handleCapture} />

          {/* 💡 감지 토글 버튼: isDetecting 상태에 따라 텍스트 및 스타일 변경 */}
          <button
            style={{
              ...styles.textButton,
              color: isDetecting ? '#FFC107' : 'white', // 감지 중일 때 노란색
              fontWeight: isDetecting ? 'bold' : 'normal'
            }}
            onClick={handleToggleDetection}
            aria-pressed={isDetecting}
          >
            {isDetecting ? '감지 중지' : 'AI 감지 시작'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CapturePage;