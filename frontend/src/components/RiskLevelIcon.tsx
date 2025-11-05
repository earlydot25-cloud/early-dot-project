// frontend/src/components/RiskLevelIcon.tsx
import React from 'react';

interface RiskLevelIconProps {
  riskLevel: string;
  source: 'AI' | '의사' | '대기';
  size?: number;
}

const RiskLevelIcon: React.FC<RiskLevelIconProps> = ({ 
  riskLevel, 
  source, 
  size = 20 
}) => {
  // AI 색상 (청록 계열)
  const aiColors = {
    '높음': '#EF4444', // 빨강
    '중간': '#F59E0B', // 주황
    '보통': '#F59E0B', // 주황
    '낮음': '#10B981', // 초록
    '즉시 주의': '#DC2626', // 진한 빨강
    '경과 관찰': '#F59E0B', // 주황
    '정상': '#10B981', // 초록
    '소견 대기': '#6B7280', // 회색
    '분석 대기': '#9CA3AF', // 연한 회색
  };

  // 의사 색상 (파랑 계열)
  const doctorColors = {
    '높음': '#2563EB', // 파랑
    '중간': '#3B82F6', // 밝은 파랑
    '보통': '#3B82F6', // 밝은 파랑
    '낮음': '#60A5FA', // 연한 파랑
    '즉시 주의': '#1E40AF', // 진한 파랑
    '경과 관찰': '#3B82F6', // 밝은 파랑
    '정상': '#60A5FA', // 연한 파랑
    '소견 대기': '#6B7280', // 회색
    '분석 대기': '#9CA3AF', // 연한 회색
  };

  // "대기" source일 때는 항상 회색
  if (source === '대기') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="inline-block"
      >
        <path
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          fill="#9CA3AF"
          stroke="#9CA3AF"
          strokeWidth="1"
        />
      </svg>
    );
  }
  
  const colorMap = source === 'AI' ? aiColors : doctorColors;
  const color = colorMap[riskLevel as keyof typeof colorMap] || '#6B7280';

  // 위험도에 따른 아이콘 모양 결정
  const getIconShape = () => {
    if (riskLevel === '높음' || riskLevel === '즉시 주의') {
      // 경고 삼각형 (exclamation triangle)
      return (
        <path
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          fill={color}
          stroke={color}
          strokeWidth="1"
        />
      );
    } else if (riskLevel === '낮음' || riskLevel === '정상') {
      // 체크 원 (check circle)
      return (
        <path
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          fill={color}
          stroke={color}
          strokeWidth="1"
        />
      );
    } else if (riskLevel === '분석 대기' || riskLevel === '대기') {
      // 시계 아이콘 (clock)
      return (
        <path
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          fill={color}
          stroke={color}
          strokeWidth="1"
        />
      );
    } else {
      // 정보 원 (info circle)
      return (
        <path
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          fill={color}
          stroke={color}
          strokeWidth="1"
        />
      );
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block"
    >
      {getIconShape()}
    </svg>
  );
};

export default RiskLevelIcon;

