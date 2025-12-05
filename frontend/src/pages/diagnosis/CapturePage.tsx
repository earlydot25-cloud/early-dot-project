import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import Webcam from 'react-webcam';
import { useNavigate, useLocation } from 'react-router-dom';
// Fi 아이콘 사용을 유지합니다.
import { FiArrowLeft, FiZap, FiZapOff, FiImage } from 'react-icons/fi';

const MAX_STAGE_WIDTH = 430;
// 💡 [수정] 카메라 스테이지의 상하 수직 여백을 80px에서 100px로 늘려 화면을 더 축소
const STAGE_VERTICAL_PADDING = 100;

// 모바일 디바이스 감지
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

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
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { top, bottom } = useNavInsets();

  // 바디 스크롤 잠금 (모든 경우에 적용)
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

  // 모바일이면 네이티브 카메라를 바로 열고 저장 페이지로 이동
  useEffect(() => {
    if (isMobile) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      // input.capture = 'environment'; // 후면 카메라 고정 해제: 갤러리에서도 선택 가능
      
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          // 바로 저장 페이지로 이동
          navigate('/diagnosis/save', {
            state: {
              file,
              previewUrl: URL.createObjectURL(file),
              bodyPart: selectedBodyPart,
            },
          });
        } else {
          // 취소하면 이전 페이지로
          navigate(-1);
        }
      };
      
      // 컴포넌트 마운트 시 바로 카메라 열기
      input.click();
    }
  }, [navigate, selectedBodyPart]);

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
    // 데스크톱에서는 웹 카메라 사용
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
  }, [navigate, selectedBodyPart]);

  // 갤러리에서 선택 → 저장 페이지로 이동
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
  
  useEffect(() => { 
    if (!isMobile) {
      applyTorch(torchOn);
    }
  }, [torchOn]);

  // 모바일이면 아무것도 렌더링하지 않음
  if (isMobile) {
    return null;
  }

  // 네비 사이만 정확히 차도록 (수직 여백 추가)
  const stageDynamicStyle: React.CSSProperties = {
    // [수정] 상단 네비 높이에 증가된 수직 여백(100px)을 더합니다.
    marginTop: top + STAGE_VERTICAL_PADDING,
    // [수정] 전체 사용 가능한 높이에서 상하 여백(2 * PADDING)만큼 꿉니다.
    height: `calc(100dvh - ${top + bottom + 2 * STAGE_VERTICAL_PADDING}px)`,
  };

  return (
    <div style={styles.outerWrapper}>
      {/* 스테이지에 수정된 동적 스타일 적용 */}
      <div style={{ ...styles.stage, ...stageDynamicStyle }}>
        {/* 데스크톱에서만 웹 카메라 표시 */}
        {!isMobile && (
          <>
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

              {/* 가이드 박스 */}
              <div style={styles.guideBox} />
            </div>

            {/* 가이드 텍스트 */}
            <div style={styles.guideText}>환부를 초록 박스에 맞춰 촬영해주세요</div>
          </>
        )}

        {/* 모바일에서는 안내 메시지만 표시 */}
        {isMobile && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '40px',
            textAlign: 'center',
            color: 'white',
          }}>
            <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              카메라 버튼을 눌러 촬영하세요
            </div>
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              네이티브 카메라 앱이 열립니다
            </div>
          </div>
        )}

        <div style={styles.topBar}>
          <button style={styles.iconButton} onClick={handleBack}><FiArrowLeft size={24} /></button>
        </div>

        {/* 데스크톱에서만 플래시 버튼 표시 */}
        {!isMobile && (
          <div style={styles.sideBar}>
            <button style={styles.iconButton} onClick={() => setTorchOn(v => !v)}>
              {torchOn ? <FiZapOff size={22} /> : <FiZap size={22} />}
            </button>
          </div>
        )}

        <div style={styles.bottomBar}>
          <button style={styles.iconButton} onClick={handleGalleryOpen}><FiImage size={24} /></button>
          <input type="file" accept="image/*" ref={galleryInputRef} style={styles.hiddenInput} onChange={handleGalleryChange} />
          <button style={styles.captureButton} onClick={handleCapture} />
        </div>
      </div>
    </div>
  );
};

export default CapturePage;