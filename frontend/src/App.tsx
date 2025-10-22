import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// Pages
import BeforeLoginPage from './pages/BeforeLoginPage';
import MainPage from './pages/dashboard/MainPage';
import LoginPage from './pages/auth/LoginPage';
import BodySelectionPage from './pages/diagnosis/CapturePage'; // 나중에 바꿔야함 BodySelectionPage로
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

          {/* 로그인 이전 랜딩 및 인증 관련 유지 */}
          <Route path="/" element={<BeforeLoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<LoginPage />} />

          {/* 🟢 핵심 수정: 임시 라우트 🟢 */}
          <Route path="/home" element={<MainPage />} />

          {/* 진단 시작 경로는 유지 */}
          <Route path="/diagnosis" element={<BodySelectionPage />} />

          {/* 대시보드 경로는 기능별로 분리 */}
          <Route path="/dashboard/history" element={<HistoryPage />} />
          <Route path="/dashboard/profile" element={<ProfilePage />} />

          {/* 진단 상세 결과 페이지 경로는 ID를 받아야 함 (이전에 MainPage에서 설정한 경로와 일치) */}
          <Route path="/diagnosis/detail/:id" element={<ResultDetailPage />} />

        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
export {};