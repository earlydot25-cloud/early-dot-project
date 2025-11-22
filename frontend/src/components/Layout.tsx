// Layout.tsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import Nav from './Nav';
import BottomNav from './BottomNav';
import '../App.css';

const HIDE_CHROME_PATHS = new Set(['/diagnosis/capture']);   // ← 카메라 촬영 화면 경로만 숨김

const Layout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { pathname } = useLocation();
  const hideChrome = HIDE_CHROME_PATHS.has(pathname);

  return (
    <div className="app-container bg-white">
      {!hideChrome && <Nav />}
      <main 
        className={`main-content ${hideChrome ? 'main-content-full' : ''}`}
        style={hideChrome ? { 
          padding: 0
        } : { 
          paddingLeft: 0, 
          paddingRight: 0 
        }}
      >
        <div className={`${hideChrome ? '' : 'w-full'}`}>
          {children}
        </div>
      </main>
      {!hideChrome && <BottomNav />}
    </div>
  );
};

export default Layout;