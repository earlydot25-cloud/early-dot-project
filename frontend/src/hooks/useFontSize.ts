import { useState, useEffect } from 'react';

const FONT_SIZE_KEY = 'earlydot-font-size';
const DEFAULT_FONT_SIZE = 100;
const MIN_FONT_SIZE = 80;
const MAX_FONT_SIZE = 200;
const STEP = 10;

export const useFontSize = () => {
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_FONT_SIZE;
  });

  useEffect(() => {
    // 폰트 크기를 localStorage에 저장
    localStorage.setItem(FONT_SIZE_KEY, fontSize.toString());
    
    // HTML root 요소에 폰트 크기 적용
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, [fontSize]);

  const increaseFontSize = () => {
    setFontSize((prev) => Math.min(prev + STEP, MAX_FONT_SIZE));
  };

  const decreaseFontSize = () => {
    setFontSize((prev) => Math.max(prev - STEP, MIN_FONT_SIZE));
  };

  const resetFontSize = () => {
    setFontSize(DEFAULT_FONT_SIZE);
  };

  return {
    fontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    canIncrease: fontSize < MAX_FONT_SIZE,
    canDecrease: fontSize > MIN_FONT_SIZE,
  };
};

