import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// Pages
import BeforeLoginPage from './pages/BeforeLoginPage';
import MainPage from './pages/dashboard/MainPage';
import LoginPage from './pages/auth/LoginPage';
import BodySelectionPage from './pages/diagnosis/BodySelectionPage'; // ✅ 올바른 import
import CapturePage from './pages/diagnosis/CapturePage';             // ✅ 촬영 페이지 별도 import
import HistoryPage from './pages/dashboard/HistoryPage';
import ProfilePage from './pages/dashboard/ProfilePage';
import ResultDetailPage from './pages/diagnosis/ResultDetailPage';

// 간단한 로그인 판별(토큰 키는 실제 프로젝트에 맞춰 추가/수정 가능)
const isAuthed = () =>
  Boolean(
    typeof window !== 'undefined' &&
      (localStorage.getItem('accessToken') ||
        localStorage.getItem('refreshToken') ||
        localStorage.getItem('token') ||
        localStorage.getItem('idToken'))
  );

// 보호 라우트: 미로그인 시 BeforeLoginPage로
type RequireAuthProps = { children: React.ReactElement };
const RequireAuth: React.FC<RequireAuthProps> = ({ children }) =>
  isAuthed() ? children : <Navigate to="/" replace />;

const App: React.FC = () => {
  return (
    <BrowserRouter> {/* ⚠ index.tsx에서 이미 감싸고 있다면 이 줄/닫는 줄 제거 */}
      <Layout>
        <Routes>
          {/* 로그인 이전 랜딩 (하나만 남김) */}
          <Route path="/" element={<BeforeLoginPage />} />

          {/* 인증 관련 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<LoginPage />} />

          {/* 임시로 보호 해제한 라우트들 */}
          <Route path="/home" element={<MainPage />} />

          {/* 🔑 진단 플로우 분리 */}
          <Route path="/diagnosis" element={<Navigate to="/diagnosis/body-select" replace />} />
          <Route path="/diagnosis/body-select" element={<BodySelectionPage />} />
          <Route path="/diagnosis/capture" element={<CapturePage />} />

          {/* 대시보드 */}
          <Route path="/dashboard/history" element={<HistoryPage />} />
          <Route path="/dashboard/profile" element={<ProfilePage />} />

          {/* 결과 상세 */}
          <Route path="/diagnosis/detail/:id" element={<ResultDetailPage />} />

          {/* 그 외 → 랜딩으로 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
export {};
