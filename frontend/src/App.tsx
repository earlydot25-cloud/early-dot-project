import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// Pages
import BeforeLoginPage from './pages/BeforeLoginPage';
import MainPage from './pages/dashboard/MainPage';
import LoginPage from './pages/auth/LoginPage';
import BodySelectionPage from './pages/diagnosis/BodySelectionPage';
import HistoryPage from './pages/dashboard/HistoryPage';
import ProfilePage from './pages/dashboard/ProfilePage';

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
// 보호 라우트: 미로그인 시 BeforeLoginPage로
type RequireAuthProps = { children: React.ReactElement };

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  return isAuthed() ? children : <Navigate to="/" replace />;
};


const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* 로그인 이전 랜딩 */}
          <Route path="/" element={<BeforeLoginPage />} />

          {/* 로그인 필요한 화면들 */}
          <Route path="/home" element={<RequireAuth><MainPage /></RequireAuth>} />
          <Route path="/diagnosis" element={<RequireAuth><BodySelectionPage /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><HistoryPage /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />

          {/* 인증 관련 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<LoginPage />} /> {/* 추후 SignupPage로 교체 */}
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
export {};
