import React, { useEffect, useState  } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

import BeforeLoginPage from './pages/BeforeLoginPage';
import MainPage from './pages/dashboard/MainPage';
import DoctorMainPage from './pages/dashboard/DoctorMainPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import BodySelectionPage from './pages/diagnosis/CapturePage';
import HistoryPage from './pages/dashboard/HistoryPage';
import ProfilePage from './pages/dashboard/ProfilePage';
import ResultDetailPage from './pages/diagnosis/ResultDetailPage';

// 로그인 여부 판별 함수 개선
const isAuthed = (): boolean => {
  const access = localStorage.getItem('accessToken');
  const user = localStorage.getItem('user');

  // accessToken과 user 둘 다 존재해야 로그인 상태로 인정
  if (!access || !user || user === 'null' || user === '{}') return false;
  return true;
};

// 보호 라우트: 로그인 안 되어 있으면 "/"로 리다이렉트
const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  return isAuthed() ? children : <Navigate to="/" replace />;
}

// user 역할 판별 훅 (DB 0/1 매핑)
const useUserRole = (): { isDoctor: boolean, isLoaded: boolean } => {
    // 💡 Local Storage 변경에 반응하도록 상태를 관리
    const [isDoctor, setIsDoctor] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false); // 로드 상태 추가

    useEffect(() => {
        const determineRole = () => {
            const isDoctorString = localStorage.getItem('isDoctor'); // 'userRole' -> 'isDoctor' 키를 사용하도록 가정

            // isDoctor는 "1" 문자열일 때만 true가 됩니다.
            const newIsDoctor = (typeof window !== 'undefined' && isDoctorString === '1');

            // 로그인 상태이고, isDoctorString 값이 존재하면 로드 완료로 간주합니다.
            if (isAuthed() && isDoctorString !== null) {
                 setIsDoctor(newIsDoctor);
                 setIsLoaded(true); // 로드 완료
            } else if (!isAuthed()) {
                 // 로그아웃 상태라면 즉시 로드 완료 (isDoctor: false)
                 setIsDoctor(false);
                 setIsLoaded(true);
            } else {
                 // 로그인했지만 isDoctor 값이 아직 없으면 (초기 로드 경쟁 조건) 로드되지 않은 상태를 유지
                 setIsLoaded(false);
            }
        };

        determineRole();

        // 로그인/로그아웃 시 발생하는 커스ㅍ텀 이벤트에 반응하여 역할 갱신
        const handleAuthUpdate = () => {
            determineRole();
        };

        // 🚨 이벤트 리스너 추가: LoginPage에서 dispatch한 이벤트에 반응하여 역할 상태를 갱신합니다.
        window.addEventListener('auth:update', handleAuthUpdate);

        return () => {
            window.removeEventListener('auth:update', handleAuthUpdate);
        };
    }, []); // 훅이 마운트될 때 한 번만 실행

    // 🚨 수정: isLoaded 상태를 반환 객체에 명시적으로 추가하여 TS2339 오류를 해결합니다.
    return { isDoctor, isLoaded };
};

// 🟢 [수정됨] HomeRedirector 컴포넌트를 Navigate 컴포넌트로 변경
// 역할에 따라 다른 경로로 리다이렉트합니다.
const HomeRedirector: React.FC = () => {
    // 🚨 수정: isLoaded를 사용하여 역할 정보 로드를 기다립니다.
    const { isDoctor, isLoaded } = useUserRole();

    if (!isLoaded) {
        // Local Storage에서 isDoctor 값이 로드될 때까지 아무것도 렌더링하지 않거나 (null),
        // 간단한 로딩 스피너를 보여줄 수 있습니다. (여기서는 null을 사용)
        return null;
    }

    // isDoctor 이면 '/dashboard/doctor/main'으로 리다이렉트
    if (isDoctor) {
        return <Navigate to="/dashboard/doctor/main" replace />;
    }
    // isDoctor가 아니면 '/dashboard/main' (환자 대시보드)으로 리다이렉트
    return <Navigate to="/dashboard/main" replace />;
};

// -----------------------------------
// App 컴포넌트 (라우팅)
const App: React.FC = () => {
  useEffect(() => {
    const access = localStorage.getItem('accessToken');
    const user = localStorage.getItem('user');

    // user 정보가 없거나 accessToken이 비정상적이면 정리
    if (!access || !user || user === 'null') {
      localStorage.clear();
    }
console.log("-----------------------------------------------------------------");
        console.log("⚠️ 현재 모든 페이지는 인증 없이 접근 가능합니다.");
        // 🚨 수정: 콘솔 메시지를 현재 사용 중인 'isDoctor' 키와 값('1'/'0')에 맞춰 수정
        console.log("✅ '/home' 경로 테스트 안내:");
        console.log("    - 의사 모드: localStorage.setItem('isDoctor', '1'); (콘솔 입력 후 새로고침)");
        console.log("    - 환자 모드: localStorage.setItem('isDoctor', '0'); 또는 localStorage.removeItem('isDoctor'); (콘솔 입력 후 새로고침)");
        console.log("-----------------------------------------------------------------");
  }, []);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* 0) 로그인 전 랜딩 */}
          <Route path="/" element={<BeforeLoginPage />} />

          {/* 1) 인증 관련 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* 2) 로그인 후만 접근 가능 */}
          <Route path="/home" element={<RequireAuth><HomeRedirector /></RequireAuth>} />
          <Route path="/dashboard/main" element={<RequireAuth><MainPage /></RequireAuth>} />
          <Route path="/dashboard/doctor/main" element={<RequireAuth><DoctorMainPage /></RequireAuth>} />
          <Route path="/diagnosis" element={<RequireAuth><BodySelectionPage /></RequireAuth>} />
          <Route path="/dashboard/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
          <Route path="/dashboard/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/diagnosis/detail/:id" element={<RequireAuth><ResultDetailPage /></RequireAuth>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
