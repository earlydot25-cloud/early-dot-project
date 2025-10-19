// frontend/src/components/BottomNav.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { FaHome, FaCamera, FaClipboardList, FaUser } from 'react-icons/fa';

// 💡 react-icons 라이브러리 자체에서 IconType을 가져옵니다.
//    이 타입이 FaHome, FaCamera 등의 실제 타입과 100% 일치합니다.
import { IconType } from 'react-icons';

// 이전에 정의했던 커스텀 IconType을 제거하고, 대신 라이브러리 타입을 사용합니다.
// type IconType = React.ComponentType<{ size: number; style?: React.CSSProperties }>; <--- 이 줄은 삭제하세요

const BottomNav: React.FC = () => {
    // navItems 배열에 타입을 명시적으로 적용 (IconType은 이제 라이브러리에서 온 것입니다.)
    const navItems: { path: string; label: string; Icon: IconType }[] = [
        { path: '/', label: '홈', Icon: FaHome },
        { path: '/diagnosis', label: '촬영', Icon: FaCamera },
        { path: '/dashboard', label: '진단 내역', Icon: FaClipboardList },
        { path: '/profile', label: '내 정보', Icon: FaUser },
    ];
    return (
        <nav
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: '60px',
                backgroundColor: 'white',
                borderTop: '1px solid #ddd',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                zIndex: 100
            }}
        >
            {navItems.map((item) => {
                // 💡 item.Icon을 명시적으로 React.ElementType으로 변환하여
                //    대문자로 시작하는 컴포넌트 변수에 할당합니다.
                const IconComponent = item.Icon as React.ElementType;

                return ( // 💡 명시적인 return
                    <Link
                        key={item.path}
                        to={item.path}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textDecoration: 'none',
                            color: window.location.pathname === item.path ? '#1e90ff' : '#555',
                            fontSize: '0.8em',
                            padding: '5px'
                        }}
                    >
                        {/* 💡 JSX 태그 형식으로 사용: <Component props /> */}
                        <IconComponent size={24} style={{ marginBottom: '3px' }} />

                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
};

export default BottomNav;