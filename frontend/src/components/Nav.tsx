// frontend/src/components/Nav.tsx
import React from 'react';
import { Link } from 'react-router-dom';
// ✅ 코드형 로고 컴포넌트 사용
import SmallSizeLogo from '../assets/SmallSizeLogo';

const Nav: React.FC = () => {
  const userName = "정세랑님";
  const isLoggedIn = true; // 추후 실제 로그인 상태로 교체

  return (
    <nav className="nav-header">
      {/* 로고: 클릭 시 홈으로 이동 */}
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
        {/* 코드형 로고, 높이만 맞춰주면 선명하게 스케일 */}
        <SmallSizeLogo height={30} aria-label="EARLY·DOT logo" />
      </Link>

      {/* 사용자 영역 */}
      <div className="user-info">
        {isLoggedIn ? (
          <Link to="/profile" style={{ color: '#555', textDecoration: 'none', fontWeight: 'bold' }}>
            {userName}
          </Link>
        ) : (
          <Link to="/login" style={{ color: '#555', textDecoration: 'none' }}>
            로그인
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Nav;
export {};
