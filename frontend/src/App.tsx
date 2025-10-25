import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import SavePhotoPage from './pages/diagnosis/SavePhotoPage';

// Pages
import BeforeLoginPage from './pages/BeforeLoginPage';
import MainPage from './pages/dashboard/MainPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import BodySelectionPage from './pages/diagnosis/BodySelectionPage'; // ✅ 올바른 import
import CapturePage from './pages/diagnosis/CapturePage';             // ✅ 촬영 페이지 별도 import
import HistoryPage from './pages/dashboard/HistoryPage';
import ProfilePage from './pages/dashboard/ProfilePage';
import ResultDetailPage from './pages/diagnosis/ResultDetailPage';

// 간단한 로그인 판별
const isAuthed = () => !!localStorage.getItem('accessToken');

// 보호 라우트: 미로그인 시 / 로 리다이렉트
const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  return isAuthed() ? children : <Navigate to="/" replace />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* 로그인 이전 랜딩 */}
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
          <Route path="/diagnosis/capture" element={<RequireAuth><CapturePage /></RequireAuth>}/>
          <Route path="/diagnosis/save" element={<RequireAuth><SavePhotoPage /></RequireAuth>}/>
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
export {};