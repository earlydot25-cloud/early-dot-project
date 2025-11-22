import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaHome, FaCamera, FaClipboardList, FaUser, FaUserPlus } from 'react-icons/fa';

/** Nav와 동일한 구독 훅 (중복이 싫다면 utils/hooks로 분리) */
function useAuthStore() {
  const subscribe = React.useCallback((cb: () => void) => {
    const h = () => cb();
    window.addEventListener('auth:update', h);
    window.addEventListener('storage', h);
    return () => {
      window.removeEventListener('auth:update', h);
      window.removeEventListener('storage', h);
    };
  }, []);
  const getSnapshot = React.useCallback(() => {
    const loggedIn = !!localStorage.getItem('accessToken');
    const name = localStorage.getItem('userName') || '';
    const isDoctor = localStorage.getItem('isDoctor') === '1';
    return JSON.stringify({ loggedIn, name, isDoctor });
  }, []);
  const snap = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return React.useMemo(() => JSON.parse(snap) as { loggedIn: boolean; name: string; isDoctor: boolean }, [snap]);
}

const BottomNav: React.FC = () => {
  const { loggedIn, isDoctor } = useAuthStore();

  const items = [
    { key: 'home', to: loggedIn ? '/home' : '/', label: '메인화면', Icon: FaHome },
    { key: 'diagnosis', to: loggedIn ? '/diagnosis' : '/', label: '촬영', Icon: FaCamera },
    { 
      key: 'history', 
      to: loggedIn 
        ? (isDoctor ? '/dashboard/doctor/history' : '/dashboard/history')
        : '/', 
      label: '진단내역', 
      Icon: FaClipboardList 
    },
    { key: 'profile', to: loggedIn ? '/dashboard/profile' : '/login', label: loggedIn ? '내 정보' : '로그인', Icon: loggedIn ? FaUser : FaUserPlus },
  ];

  return (
    <nav
      id="app-tabbar"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '60px',
        background: 'linear-gradient(to top, #f8fafc, #ffffff)',
        borderTop: '2px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '8px 0',
        zIndex: 1000,
        boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.05)',
      }}
    >
      {items.map(({ key, to, label, Icon }) => (
        <NavLink
          key={key}
          to={to}
          className="bottom-nav-item"
          style={({ isActive }) => {
            // 로그인하지 않은 상태에서는 활성 상태 표시 안 함
            const shouldShowActive = loggedIn && isActive;
            return {
              textDecoration: 'none',
              color: shouldShowActive ? '#2563eb' : '#64748b',
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              minWidth: 64,
              fontWeight: shouldShowActive ? 600 : 400,
              transition: 'color 0.2s ease',
            };
          }}
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
