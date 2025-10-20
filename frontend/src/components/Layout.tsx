import React from 'react';
import Nav from './Nav';
import BottomNav from './BottomNav';
import '../App.css'; // 💡 App.css를 import하여 스타일 적용

const Layout: React.FC<React.PropsWithChildren> = ({ children }) => {
    return (
        // 💡 1. App 컨테이너 고정 (width: 375px, height: 812px)
        <div className="app-container">

            {/* Nav와 BottomNav는 이미 fixed 속성으로 고정됩니다. */}
            <Nav />

            {/* 💡 2. 메인 콘텐츠 영역: 스크롤 가능하게 만듭니다. */}
            <main className="main-content">
                {/* App.tsx에서 Routes가 이 {children} 자리에 들어옵니다. */}
                <div style={{ padding: '20px' }}> {/* App.tsx에서 가져온 내부 패딩 */}
                    {children}
                </div>
            </main>

            <BottomNav />
        </div>
    );
};

export default Layout;
export {};