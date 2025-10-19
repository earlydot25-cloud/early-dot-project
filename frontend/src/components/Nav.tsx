// frontend/src/components/Nav.tsx
import React from 'react';
import { Link } from 'react-router-dom';
// 로고 파일을 import 합니다.
// (실제 파일 경로에 맞게 수정해야 합니다. 예: './logo.png' 또는 '../logo.png')
import logoImage from '../assets/logo.png';

const Nav: React.FC = () => {
    // 💡 사용자 정보를 Mocking합니다. (로그인 후 useAuth 훅을 통해 실제 정보를 가져와야 함)
    const userName = "정세랑님";
    const isLoggedIn = true; // 로그인 상태라고 가정

    return (
        <nav
            style={{
                padding: '15px 30px',
                backgroundColor: 'white',
                borderBottom: '1px solid #eee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
        >
            {/* 1. 로고 영역: 클릭 시 홈으로 이동 */}
            <Link to="/" style={{ textDecoration: 'none' }}>
                {/* 로고 텍스트 대신 이미지 컴포넌트 사용 */}
                <img
                    src={logoImage}
                    alt="Early Dot Project Logo"
                    style={{ height: '30px', verticalAlign: 'middle' }}
                />
            </Link>

            {/* 2. 사용자 정보 영역 */}
            <div className="user-info">
                {isLoggedIn ? (
                    // 사용자 이름 클릭 시 /profile로 이동
                    <Link
                        to="/profile"
                        style={{ color: '#555', textDecoration: 'none', fontWeight: 'bold' }}
                    >
                        {userName}
                    </Link>
                ) : (
                    // 로그인하지 않은 경우 로그인 페이지 링크 표시
                    <Link
                        to="/login"
                        style={{ color: '#555', textDecoration: 'none' }}
                    >
                        로그인
                    </Link>
                )}
            </div>
        </nav>
    );
};

export default Nav;