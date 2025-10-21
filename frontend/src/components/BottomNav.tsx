import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FaHome, FaCamera, FaClipboardList, FaUser, FaUserPlus } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons';

// 로그인 여부(임시): 실제 프로젝트 토큰 키에 맞춰 수정 가능
const isAuthed = () =>
  Boolean(
    typeof window !== 'undefined' &&
      (localStorage.getItem('accessToken') ||
        localStorage.getItem('refreshToken') ||
        localStorage.getItem('token') ||
        localStorage.getItem('idToken'))
  );

// ---- react-icons 타입 안전 래퍼 ----
type IconCmp = React.FC<IconBaseProps>;
const HomeIcon: IconCmp = (props) => React.createElement(FaHome as any, props);
const CameraIcon: IconCmp = (props) => React.createElement(FaCamera as any, props);
const ClipIcon: IconCmp = (props) => React.createElement(FaClipboardList as any, props);
const UserIcon: IconCmp = (props) => React.createElement(FaUser as any, props);
const UserPlusIcon: IconCmp = (props) => React.createElement(FaUserPlus as any, props);
// -----------------------------------

const BottomNav: React.FC = () => {
  const location = useLocation();
  const loggedIn = isAuthed();

  const iconStyle = { marginBottom: 3 };

  const items: { key: string; path: string; label: string; Icon: IconCmp }[] = [
    { key: 'home',      path: loggedIn ? '/home'      : '/',      label: '홈',       Icon: HomeIcon },
    { key: 'diagnosis', path: loggedIn ? '/diagnosis' : '/',      label: '촬영',     Icon: CameraIcon },
    { key: 'history',   path: loggedIn ? '/dashboard' : '/',      label: '진단 내역', Icon: ClipIcon },
    {
      key: 'profile',
      path: loggedIn ? '/profile' : '/login',
      label: loggedIn ? '내 정보' : '로그인',
      Icon: loggedIn ? UserIcon : UserPlusIcon,
    },
  ];

  return (
    <nav className="bottom-nav">
      {items.map(({ key, path, label, Icon }) => (
        <NavLink
          key={key}
          to={path}
          // ✅ 활성 클래스 판정 로직
          className={({ isActive }) => {
            if (!loggedIn) {
              // 로그아웃: 오직 홈(/)과 로그인(/login)만 선택 표시
              if (label === '홈' && location.pathname === '/') return 'active';
              if (label === '로그인' && location.pathname === '/login') return 'active';
              return undefined;
            }
            // 로그인: NavLink의 isActive 그대로 사용
            return isActive ? 'active' : undefined;
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textDecoration: 'none',
            fontSize: '0.8em',
            padding: '5px',
          }}
        >
          <Icon size={24} style={iconStyle} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
export {};
