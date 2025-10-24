// src/hooks/useCaptureStore.ts
import { create } from 'zustand';

/**
 * ✅ 지원되는 신체 부위 타입
 * 한글/영문 모두 허용 → 타입 안정성 + 유연성 둘 다 확보
 */
export type BodyPart =
  | 'head/neck' | 'upper extremity' | 'lower extremity'
  | 'anterior torso' | 'posterior torso' | 'torso'
  | 'palms/soles' | 'oral/genital'
  | '머리/목' | '상지' | '하지'
  | '몸통(앞)' | '몸통(뒤)' | '손/발바닥' | '구강/성기';

/**
 * ✅ Zustand 상태 정의
 * - bodyPart: 선택된 신체부위
 * - capturedImage: 캡처된 이미지 (base64 or blob URL)
 * - setBodyPart, setCapturedImage: setter 함수
 * - reset: 초기화
 */
interface CaptureState {
  bodyPart: BodyPart | null;
  capturedImage: string | null;
  setBodyPart: (bp: BodyPart | null) => void;
  setCapturedImage: (img: string | null) => void;
  reset: () => void;
}

/**
 * ✅ Zustand Store 생성
 * → 어디서든 `useCaptureStore()` 훅으로 접근 가능
 * 예:
 *   const { bodyPart, capturedImage, setCapturedImage } = useCaptureStore();
 */
export const useCaptureStore = create<CaptureState>()((set) => ({
  bodyPart: null,
  capturedImage: null,
  setBodyPart: (bodyPart) => set({ bodyPart }),
  setCapturedImage: (capturedImage) => set({ capturedImage }),
  reset: () => set({ bodyPart: null, capturedImage: null }),
}));
