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

          {/* 🔴 보호 라우트 (RequireAuth 적용) - 주석 처리 🔴
              로그인 기능 구현 후 필요할 때 주석을 해제하고 아래 임시 라우트를 삭제하세요. */}
          {/* <Route path="/home" element={<RequireAuth><MainPage /></RequireAuth>} />
          <Route path="/diagnosis" element={<RequireAuth><BodySelectionPage /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><HistoryPage />/RequireAuth>}< />
          <Route path="/dashboard" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          */}

          {/* 🟢 로그인 필요 없이 접근 가능하도록 임시 라우트 🟢
              현재 BottomNav 클릭 시 페이지 이동 테스트를 위해 사용됩니다. */}
          <Route path="/home" element={<MainPage />} />
          <Route path="/diagnosis" element={<BodySelectionPage />} />
          <Route path="/dashboard" element={<HistoryPage />} />
          <Route path="/dashboard" element={<ProfilePage />} />

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