import React from "react";

/**
 * EarlyDotNavLogo
 * - 네비게이션 바(고정 상단) 좌측에 쓰는 "작은" 로고.
 * - 두 가지 모드 제공:
 *   1) variant="wordmark": 'EARLY · DOT' 축약 워드마크 (태그라인 없음)
 *   2) variant="glyph": 보라색 포인트 심볼(정사각)
 *
 * 디자인 메모
 * - 기본 높이(height)는 24~32px 권장. 기본값 28px.
 * - 작은 사이즈에서 자간(letterSpacing)을 4로 줄여 가독성 유지.
 * - 워드마크는 배경에 따라 그림자 생략(선명도↑) -> 필요 시 wrap에서 shadow 적용 권장.
 */
export type EarlyDotNavLogoProps = {
  /** 전체 높이(px). 가로는 viewBox 비율로 자동 스케일 */
  height?: number; // 기본 28
  /** 'wordmark' | 'glyph' */
  variant?: "wordmark" | "glyph";
  /** 접근성 레이블 */
  title?: string;
  /** 포인트(·) 색상 */
  accentColor?: string;
  /** 외부 스타일 연결용 */
  className?: string;
};

const EarlyDotNavLogo: React.FC<EarlyDotNavLogoProps> = ({
  height = 28,
  variant = "wordmark",
  title = "EARLY·DOT",
  accentColor = "#A100FF",
  className,
}) => {
  if (variant === "glyph") {
    // ● 아이콘형 심볼 (정사각)
    return (
      <svg
        className={className}
        width={height}
        height={height}
        viewBox="0 0 24 24"
        role="img"
        aria-label={title}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* 작게 써도 살아있는 은은한 하이라이트/헤일로 */}
          <radialGradient id="ed-glyph-halo" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.25" />
          </radialGradient>
        </defs>
        {/* drop-shadow는 작은 사이즈에서 흐려질 수 있어 제거 */}
        <circle cx="12" cy="12" r="10" fill="url(#ed-glyph-halo)" />
        <circle cx="12" cy="12" r="6" fill={accentColor} />
        <circle cx="15.5" cy="9.5" r="1.05" fill="#fff" opacity="0.9" />
      </svg>
    );
  }

  // 축약 워드마크 (EARLY · DOT)
  return (
    <svg
      className={className}
      height={height}
      viewBox="0 0 1200 140"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* 잉크톤 그라디언트 (작은 사이즈 대비 대비 강도 유지) */}
        <linearGradient id="ed-mini-ink" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2c2f3a" />
          <stop offset="100%" stopColor="#0b1220" />
        </linearGradient>
      </defs>
      <text
        x="50%"
        y="96"
        textAnchor="middle"
        fontFamily="Inter, Pretendard, -apple-system, Segoe UI, Roboto, Noto Sans KR, system-ui, sans-serif"
        fontSize="80"        // viewBox 기준(가로 자동 스케일)
        fontWeight="800"
        letterSpacing="4"    // 네비 소형 사이즈용으로 약간 타이트
        fill="url(#ed-mini-ink)"
      >
        {"EARLY "}
        <tspan fill={accentColor} fontWeight="900">{"·"}</tspan>
        {" DOT"}
      </text>
    </svg>
  );
};

export default EarlyDotNavLogo;
