// frontend/src/components/BottomNav.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { FaHome, FaCamera, FaClipboardList, FaUser } from 'react-icons/fa';

// 💡 react-icons 라이브러리 자체에서 IconType을 가져옵니다.
import { IconType } from 'react-icons';
// (Layout.tsx에서 App.css를 import했으므로 여기서는 추가 import가 필요하지 않습니다.)

const BottomNav: React.FC = () => {
    // navItems 배열에 타입을 명시적으로 적용
    const navItems: { path: string; label: string; Icon: IconType }[] = [
        { path: '/', label: '홈', Icon: FaHome },
        { path: '/diagnosis', label: '촬영', Icon: FaCamera },
        { path: '/dashboard', label: '진단 내역', Icon: FaClipboardList },
        { path: '/profile', label: '내 정보', Icon: FaUser },
    ];

    return (
        // 💡 1. 인라인 스타일을 제거하고 bottom-nav 클래스를 적용합니다.
        <nav className="bottom-nav">
            {navItems.map((item) => {
                // 💡 item.Icon을 명시적으로 React.ElementType으로 변환하여 사용
                const IconComponent = item.Icon as React.ElementType;

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textDecoration: 'none',
                            // 💡 현재 경로에 따라 색상 변경 로직은 유지합니다.
                            fontSize: '0.8em',
                            padding: '5px'
                        }}
                    >
                        {/* 💡 JSX 태그 형식으로 아이콘 컴포넌트 사용 */}
                        <IconComponent size={24} style={{ marginBottom: '3px' }} />

                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
};

export default BottomNav;
export {};