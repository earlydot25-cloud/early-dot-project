import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

import BeforeLoginPage from './pages/BeforeLoginPage';
import MainPage from './pages/dashboard/MainPage';
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
};

const App: React.FC = () => {
  useEffect(() => {
    const access = localStorage.getItem('accessToken');
    const user = localStorage.getItem('user');

    // user 정보가 없거나 accessToken이 비정상적이면 정리
    if (!access || !user || user === 'null') {
      localStorage.clear();
    }
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
