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
    return JSON.stringify({ loggedIn, name });
  }, []);
  const snap = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return React.useMemo(() => JSON.parse(snap) as { loggedIn: boolean; name: string }, [snap]);
}

const BottomNav: React.FC = () => {
  const { loggedIn } = useAuthStore();

  const items = [
    { key: 'home', to: loggedIn ? '/home' : '/', label: '메인화면', Icon: FaHome },
    { key: 'diagnosis', to: loggedIn ? '/diagnosis' : '/', label: '촬영', Icon: FaCamera },
    { key: 'history', to: loggedIn ? '/dashboard/history' : '/', label: '진단내역', Icon: FaClipboardList },
    { key: 'profile', to: loggedIn ? '/dashboard/profile' : '/login', label: loggedIn ? '내 정보' : '로그인', Icon: loggedIn ? FaUser : FaUserPlus },
  ];

  return (
    <nav
      id="app-tabbar"                // ← 추가
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        width: 'min(100%, 375px)', // 프레임 폭에 고정
        margin: '0 auto',          // 가운데 정렬
        background: '#fff',
        borderTop: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '8px 0',
        zIndex: 1000,
      }}
    >
      {items.map(({ key, to, label, Icon }) => (
        <NavLink
          key={key}
          to={to}
          style={{
            textDecoration: 'none',
            color: '#334155',
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            minWidth: 64,
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
