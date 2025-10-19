// frontend/src/components/Layout.tsx (배치 예시)

import React from 'react';
import Nav from './Nav';           // 상단 Nav
import BottomNav from './BottomNav'; // 하단 Nav

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="app-layout">
            <Nav />          {/* 화면 상단에 위치 */}
            <main>{children}</main> {/* 중앙 콘텐츠 */}
            <BottomNav />    {/* 화면 하단에 위치 */}
        </div>
    );
};
export default Layout;