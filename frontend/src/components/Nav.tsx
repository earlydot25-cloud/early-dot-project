import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SmallSizeLogo from '../assets/SmallSizeLogo';

/** -----------------------------------------------
 * 로컬스토리지 기반 인증 상태를 "정식 구독"하는 훅
 * - React 18 동시 렌더링에서 외부 상태를 안전하게 쓰려면
 *   useSyncExternalStore를 사용해야 함.
 * - snapshot은 문자열(JSON)로 돌려서 Object.is 비교가 안정적으로 작동.
 * ----------------------------------------------- */
function useAuthStore() {
  const subscribe = React.useCallback((cb: () => void) => {
    const handler = () => cb();
    // 로그인/로그아웃 시 커스텀 이벤트, 탭 간 동기화는 storage 이벤트
    window.addEventListener('auth:update', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('auth:update', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const getSnapshot = React.useCallback(() => {
    const loggedIn = !!localStorage.getItem('accessToken');
    const name = localStorage.getItem('userName') || '';
    // 문자열로 반환 → 같으면 Object.is === true
    return JSON.stringify({ loggedIn, name });
  }, []);

  // 서버 사이드가 없으니 동일하게
  const getServerSnapshot = getSnapshot;

  const snap = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return React.useMemo(() => JSON.parse(snap) as { loggedIn: boolean; name: string }, [snap]);
}

/** -----------------------------------------------
 * Nav
 * 요구사항:
 * 1) 로고는 왼쪽 "끝"에 붙인다.
 * 2) 로그인 전: 오른쪽 비움.
 *    로그인 후: "실명님" + (줄바꿈) "로그아웃" 버튼.
 * 3) 로고 클릭: 로그인 후 → /home, 로그인 전 → /.
 *    (div+onClick 대신 Link로 안전하게 탐색)
 * ----------------------------------------------- */
const Nav: React.FC = () => {
  const nav = useNavigate();
  const { loggedIn, name } = useAuthStore();

  const onLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userName');
    // 구독자들에게 변경 알림
    window.dispatchEvent(new Event('auth:update'));
    nav('/', { replace: true });
  };

  return (
    <header
      id="app-topbar"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: '#fff',
        borderBottom: '1px solid #eee',
      }}
    >
      {/* 375px 프레임 가운데 정렬 + 좌우 패딩 제거로 "왼쪽 끝" 붙이기 */}
      <div
        style={{
          width: 'min(100%, 375px)',
          margin: '0 auto',
          padding: '10px 0', // 좌우 0
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* 왼쪽: 로고 (Link로 안전한 라우팅) */}
        <Link
          to={loggedIn ? '/home' : '/'}
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          aria-label="EARLY·DOT 홈"
        >
          <SmallSizeLogo height={28} />
        </Link>

        {/* 오른쪽: 로그인 후에만 "실명님" + "로그아웃" */}
        <div style={{ minWidth: 16, textAlign: 'right', lineHeight: 1.15 }}>
          {loggedIn && (
            <>
              <div style={{ fontWeight: 700, color: '#111' }}>
                {(name || '사용자') + '님'}
              </div>
              <button
                onClick={onLogout}
                style={{
                  marginTop: 2,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#2563eb',
                  textDecoration: 'underline',
                }}
              >
                로그아웃
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Nav;
