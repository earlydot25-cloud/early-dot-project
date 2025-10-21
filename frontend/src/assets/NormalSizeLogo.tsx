// src/assets/branding/EarlyDotWordmark.tsx
import React from "react";

/**
 * EARLY · DOT 워드마크 (코드 기반 SVG, 자산 컴포넌트)
 * - 상단 "EARLY · DOT"과 하단 "SKIN CANCER AI DIAGNOSIS ASSIST" 포함
 * - 상단 텍스트 실제 렌더 너비를 측정해, 하단 태그라인 자간만 살짝 조정해 거의 같은 폭으로 맞춤
 * - height로 전체 크기 제어 (가로는 viewBox 비율로 자동)
 */
export type EarlyDotWordmarkProps = {
  /** 전체 SVG 높이(px). 가로는 비율에 맞춰 자동 스케일 */
  height?: number;
  /** 접근성 레이블 */
  title?: string;
  /** 태그라인 노출 여부 */
  showTagline?: boolean;
  /** 태그라인을 상단 텍스트 폭에 맞출지 여부 (자간만 조정) */
  matchTopWidth?: boolean;
  /** 맞춤 계수(1보다 작으면 살짝 좁게). 기본 0.99 → 상단보다 1% 좁게 */
  widthBias?: number;
  /** 외부 스타일 연결용 */
  className?: string;
  /** 포인트(·) 색상 */
  accentColor?: string;
};

const EarlyDotWordmark: React.FC<EarlyDotWordmarkProps> = ({
  height = 84,
  title = "EARLY·DOT",
  showTagline = true,
  matchTopWidth = true,
  widthBias = 0.99,
  className,
  accentColor = "#A100FF",
}) => {
  // 상단 텍스트 실제 렌더 너비
  const topRef = React.useRef<SVGTextElement | null>(null);
  // 태그라인 textLength에 줄 값 (없으면 undefined)
  const [tagLen, setTagLen] = React.useState<number | undefined>(undefined);

  React.useLayoutEffect(() => {
    if (!matchTopWidth) {
      setTagLen(undefined);
      return;
    }
    if (topRef.current) {
      const w = topRef.current.getBBox().width;
      setTagLen(w * widthBias);
    }
  }, [height, matchTopWidth, widthBias]);

  return (
    <svg
      className={className}
      height={height}
      viewBox="0 0 1200 220"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* 잉크 느낌의 그라디언트 */}
        <linearGradient id="earlydot-ink" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2c2f3a" />
          <stop offset="100%" stopColor="#0b1220" />
        </linearGradient>
        {/* 약한 드롭섀도우 */}
        <filter id="earlydot-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* 상단: EARLY · DOT */}
      <g filter="url(#earlydot-shadow)">
        <text
          ref={topRef}
          x="50%"
          y="110"
          textAnchor="middle"
          fontFamily="Inter, Pretendard, -apple-system, Segoe UI, Roboto, Noto Sans KR, system-ui, sans-serif"
          fontSize="120"
          fontWeight="800"
          letterSpacing="6"
          fill="url(#earlydot-ink)"
        >
          EARLY <tspan fill={accentColor} fontWeight="900">·</tspan> DOT
        </text>
      </g>

      {/* 하단: 태그라인 (자간만 조정해서 폭 맞춤) */}
      {showTagline ? (
        <text
          x="50%"
          y="170"
          textAnchor="middle"
          fontFamily="Inter, Pretendard, -apple-system, Segoe UI, Roboto, Noto Sans KR, system-ui, sans-serif"
          fontSize="36"
          letterSpacing="6"
          fill="#111827"
          opacity="0.9"
          // textLength를 주면 글자 크기는 그대로 두고 spacing(자간)만 조정함
          lengthAdjust={matchTopWidth ? "spacing" : undefined}
          textLength={matchTopWidth ? tagLen : undefined}
        >
          SKIN CANCER AI DIAGNOSIS ASSIST
        </text>
      ) : null}
    </svg>
  );
};

export default EarlyDotWordmark;
