import React from 'react';

export default function PhotoPreview({ src }: { src: string | null }) {
  if (!src) return <div className="border rounded p-4 text-gray-500">미리보기 없음</div>;
  return <img src={src} alt="preview" className="w-full max-h-[360px] object-contain rounded border" />;
}
