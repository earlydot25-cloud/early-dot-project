import React from 'react';

interface FontSizeControllerProps {
  fontSize: number;
  onIncrease: () => void;
  onDecrease: () => void;
}

const FontSizeController: React.FC<FontSizeControllerProps> = ({ fontSize, onIncrease, onDecrease }) => {
  return (
    <div 
      className="fixed flex flex-col z-50"
      style={{ 
        right: '16px',
        bottom: '80px', // 하단 네비게이션 위에 배치
        gap: '6px'
      }}
    >
      {/* 글자 크게 버튼 */}
      <button
        onClick={onIncrease}
        disabled={fontSize >= 200}
        className="rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95"
        aria-label="글자 크게"
        style={{ 
          width: '44px',
          height: '44px'
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          style={{ width: '20px', height: '20px' }}
        >
          {/* 돋보기 원 */}
          <circle cx="11" cy="11" r="7" />
          {/* 돋보기 손잡이 */}
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          {/* + 기호 */}
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 8v6M8 11h6" />
        </svg>
      </button>

      {/* 현재 크기 표시 */}
      <div 
        className="bg-gray-800 text-white rounded-full flex items-center justify-center font-semibold shadow-md"
        style={{ 
          fontSize: '11px',
          width: '44px',
          height: '24px'
        }}
      >
        {fontSize}%
      </div>

      {/* 글자 작게 버튼 */}
      <button
        onClick={onDecrease}
        disabled={fontSize <= 80}
        className="rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95"
        aria-label="글자 작게"
        style={{ 
          width: '44px',
          height: '44px'
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          style={{ width: '20px', height: '20px' }}
        >
          {/* 돋보기 원 */}
          <circle cx="11" cy="11" r="7" />
          {/* 돋보기 손잡이 */}
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          {/* - 기호 */}
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 11h6" />
        </svg>
      </button>
    </div>
  );
};

export default FontSizeController;

