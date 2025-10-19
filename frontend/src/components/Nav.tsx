// frontend/src/components/Nav.tsx

import React from 'react';
import { Link } from 'react-router-dom';
// 로고 파일을 import 합니다.
// (실제 파일 경로에 맞게 수정해야 합니다. 예: './logo.png' 또는 '../assets/logo.png')
import logoImage from '../assets/logo.png';
// 💡 CSS 클래스 사용을 위해 App.css 또는 Nav.css 파일을 import해야 합니다.
//    (App.css에 nav-header 클래스를 정의했다면, Layout.tsx에서 이미 import 되었으므로 생략 가능)


const Nav: React.FC = () => {
    // 💡 사용자 정보를 Mocking합니다. (로그인 후 useAuth 훅을 통해 실제 정보를 가져와야 함)
    const userName = "정세랑님";
    const isLoggedIn = true; // 로그인 상태라고 가정

    return (
        // 💡 1. 인라인 스타일을 제거하고 nav-header 클래스를 적용합니다.
        <nav className="nav-header">
            {/* 1. 로고 영역: 클릭 시 홈으로 이동 */}
            <Link to="/" style={{ textDecoration: 'none' }}>
                {/* 로고 텍스트 대신 이미지 컴포넌트 사용 */}
                {/* 로고 이미지가 너무 크지 않도록 스타일을 유지합니다. */}
                <img
                    // 💡 assets 폴더에 logo.png가 있다고 가정
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