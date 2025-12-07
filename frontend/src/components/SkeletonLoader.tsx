import React from 'react';

interface SkeletonLoaderProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = '',
  width,
  height,
  rounded = false,
}) => {
  return (
    <div
      className={`bg-gray-200 animate-pulse ${rounded ? 'rounded-full' : 'rounded'} ${className}`}
      style={{
        width: width || '100%',
        height: height || '1rem',
      }}
    />
  );
};

// 결과 카드 스켈레톤
export const ResultCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 animate-pulse">
      <div className="flex items-start gap-4">
        <SkeletonLoader width={80} height={80} rounded className="flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonLoader height={20} width="60%" />
          <SkeletonLoader height={16} width="40%" />
          <SkeletonLoader height={16} width="80%" />
        </div>
        <SkeletonLoader width={60} height={60} rounded className="flex-shrink-0" />
      </div>
    </div>
  );
};

// 결과 상세 페이지 스켈레톤
export const ResultDetailSkeleton: React.FC = () => {
  return (
    <div className="w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto bg-gray-50 min-h-screen px-4 py-5">
      <SkeletonLoader height={40} width={100} className="mb-4" />
      <div className="space-y-6">
        <SkeletonLoader height={300} className="rounded-lg" />
        <div className="space-y-3">
          <SkeletonLoader height={24} width="50%" />
          <SkeletonLoader height={20} width="70%" />
          <SkeletonLoader height={20} width="60%" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SkeletonLoader height={100} className="rounded-lg" />
          <SkeletonLoader height={100} className="rounded-lg" />
        </div>
      </div>
    </div>
  );
};

