import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

import BeforeLoginPage from './pages/BeforeLoginPage';
import MainPage from './pages/dashboard/MainPage';
import DoctorMainPage from './pages/dashboard/DoctorMainPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from "./pages/auth/SignupPage";
import BodySelectionPage from './pages/diagnosis/CapturePage';
import HistoryPage from './pages/dashboard/HistoryPage';
import ProfilePage from './pages/dashboard/ProfilePage';
import ResultDetailPage from './pages/diagnosis/ResultDetailPage';

// 간단한 로그인 판별
const isAuthed = () => !!localStorage.getItem('accessToken');

// 보호 라우트: 미로그인 시 / 로 리다이렉트
const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  return isAuthed() ? children : <Navigate to="/" replace />;
}

// user 역할 판별 훅 (DB 0/1 매핑)
const useUserRole = () => {
    // 💡 Local Storage에서 'isDoctor' 키를 가져옵니다.
    // 로그인 시 DB의 1 (의사) 또는 0 (환자) 값이 문자열 "1" 또는 "0"으로 저장되어야 합니다.
    const isDoctorString = localStorage.getItem('isDoctor');

    // isDoctor는 "1" 문자열일 때만 true가 됩니다.
    // (Local Storage에 저장된 문자열 "1"을 DB의 1(의사)로 간주)
    const isDoctor = (typeof window !== 'undefined' && isDoctorString === '1');

    return { isDoctor };
};

// 🟢 [수정됨] HomeRedirector 컴포넌트를 Navigate 컴포넌트로 변경
// 역할에 따라 다른 경로로 리다이렉트합니다.
const HomeRedirector: React.FC = () => {
    const { isDoctor } = useUserRole();

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

                    {/* 🟢 핵심: '/home' 경로에서 역할에 따라 페이지 분기 (HomeRedirector 사용) 🟢 */}
                    {/* HomeRedirector는 컴포넌트 렌더링 대신 경로 리다이렉트를 수행합니다. */}
                    <Route path="/home" element={<RequireAuth><HomeRedirector /></RequireAuth>} />

                    {/* 2) 대시보드 메인 페이지 (실제 컴포넌트 렌더링은 여기서) */}
                    <Route path="/dashboard/main" element={<RequireAuth><MainPage /></RequireAuth>} />
                    <Route path="/dashboard/doctor/main" element={<RequireAuth><DoctorMainPage /></RequireAuth>} />

                    {/* 3) 로그인 후만 접근 가능 (다른 라우트들) */}
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
