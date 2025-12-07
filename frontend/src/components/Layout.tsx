// Layout.tsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import Nav from './Nav';
import BottomNav from './BottomNav';
import FontSizeController from './FontSizeController';
import NetworkStatus from './NetworkStatus';
import { useFontSize } from '../hooks/useFontSize';
import '../App.css';

const HIDE_CHROME_PATHS = new Set(['/diagnosis/capture']);   // 카메라 촬영 화면 경로만 숨김
const ADMIN_PATHS = new Set(['/admin/main', '/admin/dashboard']);   // 관리자 페이지 경로

const Layout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { pathname } = useLocation();
  const hideChrome = HIDE_CHROME_PATHS.has(pathname);
  const isAdminPage = ADMIN_PATHS.has(pathname);
  const { fontSize, increaseFontSize, decreaseFontSize } = useFontSize();

  return (
    <div className="app-container bg-white">
      <NetworkStatus />
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
      {!hideChrome && !isAdminPage && <BottomNav />}
      {!hideChrome && (
        <FontSizeController
          fontSize={fontSize}
          onIncrease={increaseFontSize}
          onDecrease={decreaseFontSize}
        />
      )}
    </div>
  );
};

export default Layout;