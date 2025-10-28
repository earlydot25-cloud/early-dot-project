// Layout.tsx
import React from 'react';
import { useLocation } from 'react-router-dom';      // ← 추가
import Nav from './Nav';
import BottomNav from './BottomNav';
import '../App.css';

const HIDE_CHROME_PATHS = new Set(['/diagnosis']);   // ← 촬영 화면 경로만 숨김

const Layout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { pathname } = useLocation();
  const hideChrome = HIDE_CHROME_PATHS.has(pathname);

  return (
    <div className="app-container">
      {!hideChrome && <Nav />}                       {/* ← 상단 네비 조건부 */}
      <main className="main-content" style={hideChrome ? { padding: 0 } : undefined}>
        <div style={{ padding: hideChrome ? 0 : 20 }}>
          {children}
        </div>
      </main>
      {!hideChrome && <BottomNav />}                 {/* ← 하단 네비 조건부 */}
    </div>
  );
};

export default Layout;