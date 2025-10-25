import React from 'react'; #useEffect  필요시 재 설정
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

import BeforeLoginPage from './pages/BeforeLoginPage';
import MainPage from './pages/dashboard/MainPage'; //잠깐 의사로 변경
import DoctorMainPage from './pages/dashboard/DoctorMainPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from "./pages/auth/SignupPage";
import BodySelectionPage from './pages/diagnosis/CapturePage';
import HistoryPage from './pages/dashboard/HistoryPage';
import ProfilePage from './pages/dashboard/ProfilePage';
import ResultDetailPage from './pages/diagnosis/ResultDetailPage';

// 간단한 로그인 판별
const isAuthed = () => !!localStorage.getItem('accessToken');

// -----------------------------------
// 🔴 2. 역할 판별 훅 (is_doctor 시뮬레이션) 🔴 # 이거 불리안으로 수정 필요
const useUserRole = () => {
    // 'userRole'이 'doctor'면 is_doctor가 'Y'라고 간주합니다.
    // window 객체가 정의되어 있을 때만 localStorage에 접근합니다.
    const isDoctor =
        (typeof window !== 'undefined' && localStorage.getItem('userRole') === 'doctor');
    return { isDoctor };
};

// 보호 라우트: 미로그인 시 / 로 리다이렉트
const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  return isAuthed() ? children : <Navigate to="/" replace />;
// -----------------------------------
// 🔴 3. HomeRedirector 컴포넌트 (조건부 렌더링) 🔴
// users.is_doctor가 Y이면 DoctorMainPage로 라우팅
const HomeRedirector: React.FC = () => {
    const { isDoctor } = useUserRole();

    // isDoctor (users.is_doctor === 'Y') 이면 DoctorMainPage
    if (isDoctor) {
        return <DoctorMainPage />;
    }
    // isDoctor가 아니면 (일반 사용자) MainPage
    return <MainPage />;
};

// -----------------------------------
// 🔴 4. App 컴포넌트 (라우팅) 🔴
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* 0) 로그인 전 랜딩 */}
          <Route path="/" element={<BeforeLoginPage />} />
    // 개발자 테스트 안내
    useEffect(() => {
        console.log("-----------------------------------------------------------------");
        console.log("⚠️ 현재 모든 페이지는 인증 없이 접근 가능합니다.");
        console.log("✅ '/home' 경로 테스트 안내:");
        console.log("    - 의사 모드: localStorage.setItem('userRole', 'doctor'); (콘솔 입력 후 새로고침)");
        console.log("    - 환자 모드: localStorage.setItem('userRole', 'patient'); 또는 localStorage.removeItem('userRole'); (콘솔 입력 후 새로고침)");
        console.log("-----------------------------------------------------------------");
    }, []);

    return (
        <BrowserRouter>
            <Layout>
                <Routes>
                    {/* 1. 로그인 이전 랜딩 페이지 (루트 경로) */}
                    <Route path="/" element={<BeforeLoginPage />} />

          {/* 1) 인증 관련 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* 🟢 핵심: /home 경로에서 역할에 따라 페이지 분기 🟢 */}
          <Route path="/home" element={<RequireAuth><HomeRedirector /></RequireAuth>} />

          {/* 2) 로그인 후만 접근 가능 */}
          <Route path="/home" element={<RequireAuth><MainPage /></RequireAuth>} />
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
