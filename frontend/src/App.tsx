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

// user 역할 판별 훅 (is_doctor 시뮬레이션)
const useUserRole = () => {
    // 💡 'userRole' 키 대신, 백엔드 is_doctor에 더 가까운 'isDoctor' 키를 사용하도록 권장
    //    값이 'doctor' 문자열인지 확인
    const role = localStorage.getItem('userRole');

    // isDoctor는 'doctor' 문자열일 때만 true가 됩니다.
    // 만약 로그인 시 is_doctor=True를 localStorage에 'isDoctor' : 'true'로 저장했다면 아래 로직으로 변경
    // const isDoctor = (typeof window !== 'undefined' && localStorage.getItem('isDoctor') === 'true');

    // 현재 코드에 맞춰 유지
    const isDoctor = (typeof window !== 'undefined' && role === 'doctor');
    return { isDoctor };
};

// HomeRedirector 컴포넌트 (조건부 렌더링)
// users.is_doctor가 Y이면 DoctorMainPage로 라우팅
const HomeRedirector: React.FC = () => {
    const { isDoctor } = useUserRole();

    // isDoctor (users.is_doctor === 'Y' 시뮬레이션) 이면 DoctorMainPage
    if (isDoctor) {
        return <DoctorMainPage />;
    }
    // isDoctor가 아니면 (일반 사용자) MainPage
    return <MainPage />;
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

                    {/* 🟢 핵심: /home 경로에서 역할에 따라 페이지 분기 (HomeRedirector 사용) 🟢 */}
                    {/* 이 하나의 라우트가 로그인 상태와 역할에 따른 분기를 모두 처리합니다. */}
                    <Route path="/home" element={<RequireAuth><HomeRedirector /></RequireAuth>} />

                    {/* 2) 로그인 후만 접근 가능 (다른 라우트들) */}
                    {/* 이 라우트들은 모두 RequireAuth로 감싸져 있습니다. */}
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