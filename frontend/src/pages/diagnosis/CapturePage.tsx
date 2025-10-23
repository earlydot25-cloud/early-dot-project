// frontend/src/pages/diagnosis/CapturePage.tsx
import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import Webcam from 'react-webcam';
import { FiArrowLeft, FiZap, FiZapOff, FiImage } from 'react-icons/fi';

// ===== 앱의 중앙 컨테이너(네비 폭)과 맞추려면 여기를 네비와 동일하게 =====
const MAX_STAGE_WIDTH = 430; // 예: 상/하단 네비가 430px max-width면 430으로
// ===============================================================

// ✅ 백엔드 업로드 엔드포인트 (urls.py 기준)
const API_URL = 'http://127.0.0.1:8000/api/diagnosis/upload/';

// 바디파트 기본값(임시) — 실제로는 신체부위 선택 탭에서 값 받아오면 교체
const DEFAULT_BODY_PART = '머리/목'; // TODO: 신체부위 선택 화면 값으로 대체

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
    inset: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'stretch',
    background: 'transparent'
  },

  /** 실제 카메라 스테이지(네비 폭과 일치하도록 maxWidth 제한) */
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
  const [torchOn, setTorchOn] = useState(false);
  const [guideOn, setGuideOn] = useState(true);
  const webcamRef = useRef<Webcam>(null);
  const { top, bottom } = useNavInsets();

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

  const handleBack = () => console.log('뒤로 가기 클릭');

  const base64toFile = (base64: string, filename: string): File => {
    const [meta, data] = base64.split(',');
    const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const b = atob(data);
    const u8 = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i);
    return new File([u8], filename, { type: mime });
  };

  // ✅ 업로드 함수
    const sendImageToBackend = async (file: File) => {
      const fd = new FormData();
      fd.append('upload_storage_path', file, file.name || 'captured_image.jpg');
      fd.append('body_part', DEFAULT_BODY_PART);
      fd.append('onset_date', '1달 내');
      fd.append('meta_age', String(30));
      fd.append('meta_sex', '남성');

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          body: fd,
        });

        // ✅ 여기에 추가 (이게 중요!)
        if (!res.ok) {
          const errText = await res.text();   // ← 서버 응답 전체를 문자열로 받아옴
          console.error('업로드 실패 (응답 전체):', errText);  // 콘솔에 그대로 출력
          alert('업로드 실패');
          return;
        }

        const data = await res.json();
        console.log('업로드 성공:', data);
        alert('사진이 성공적으로 업로드되었습니다!');
      } catch (e) {
        console.error('업로드 중 예외:', e);
        alert('업로드 실패');
      }
    };


  const handleCapture = useCallback(() => {
    const shot = webcamRef.current?.getScreenshot();
    if (shot) sendImageToBackend(base64toFile(shot, 'capture.jpg'));
  }, []);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const handleGalleryOpen = () => galleryInputRef.current?.click();
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) sendImageToBackend(f);
  };

  const handleToggleGuide = () => setGuideOn(v => !v);

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
      await (track as any).applyConstraints({ advanced: [{ torch: enable }] });
    } catch (err) {
      console.error('토치 적용 실패:', err);
    }
  };
  useEffect(() => { applyTorch(torchOn); }, [torchOn]);

  // 네비 사이만 정확히 차도록 stage 위치/크기 동적 지정
  const stageDynamicStyle: React.CSSProperties = {
    marginTop: top,
    height: `calc(100dvh - ${top + bottom}px)`,
  };

  return (
    <div style={styles.outerWrapper}>
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
          {guideOn && <div style={styles.guideBox} />}
        </div>

        {guideOn && <div style={styles.guideText}>환부를 초록 박스에 맞춰 촬영해주세요</div>}

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
          <button style={styles.textButton} onClick={handleToggleGuide} aria-pressed={guideOn}>감지</button>
        </div>
      </div>
    </div>
  );
};

export default CapturePage;
