import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// -----------------------------------
// 🔴 1. 실제 파일 Import 복원 (컴파일 오류 예상) 🔴
// 이 import 구문은 실제 프로젝트 구조에 맞아야 합니다. (더미 컴포넌트 정의 영역이 삭제됨)
import Layout from './components/Layout';
import BeforeLoginPage from './pages/BeforeLoginPage';
import MainPage from './pages/dashboard/DoctorMainPage'; //잠깐 의사로 변경
import DoctorMainPage from './pages/dashboard/DoctorMainPage';
import LoginPage from './pages/auth/LoginPage';
import BodySelectionPage from './pages/diagnosis/CapturePage';
import HistoryPage from './pages/dashboard/HistoryPage';
import ProfilePage from './pages/dashboard/ProfilePage';
import ResultDetailPage from './pages/diagnosis/ResultDetailPage';


// -----------------------------------
// 🔴 2. 역할 판별 훅 (is_doctor 시뮬레이션) 🔴
const useUserRole = () => {
    // 'userRole'이 'doctor'면 is_doctor가 'Y'라고 간주합니다.
    // window 객체가 정의되어 있을 때만 localStorage에 접근합니다.
    const isDoctor =
        (typeof window !== 'undefined' && localStorage.getItem('userRole') === 'doctor');
    return { isDoctor };
};

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

                    {/* 2. 인증 관련 페이지 (인증 없이 접근 가능) */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<LoginPage />} />

                    {/* 🟢 핵심: /home 경로에서 역할에 따라 페이지 분기 🟢 */}
                    <Route path="/home" element={<HomeRedirector />} />

                    {/* 3. 기타 서비스 경로 (인증 없이 접근 가능) */}
                    <Route path="/diagnosis" element={<BodySelectionPage />} />
                    <Route path="/dashboard/history" element={<HistoryPage />} />
                    <Route path="/dashboard/profile" element={<ProfilePage />} />
                    <Route path="/diagnosis/detail/:id" element={<ResultDetailPage />} />

                    {/* 4. 404 처리 */}
                    <Route path="*" element={<div className="p-10 text-center bg-red-50 rounded-xl shadow-lg">404 Not Found</div>} />

                </Routes>
            </Layout>
        </BrowserRouter>
    );
};

export default App;
