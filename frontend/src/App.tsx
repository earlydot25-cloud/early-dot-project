// frontend/src/App.tsx (최종 확인)
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

// Pages
import MainPage from './pages/MainPage';
import LoginPage from './pages/auth/LoginPage';
import CapturePage from './pages/diagnosis/CapturePage'; // 이름 변경되었는지 확인
import HistoryPage from './pages/dashboard/HistoryPage'; // 이름 변경되었는지 확인

const App: React.FC = () => {
  return (
    <BrowserRouter>
      {/* Layout 컴포넌트가 전체를 감싸고, Nav를 내부에 포함 */}
      <Layout>
        <div style={{ padding: '20px' }}> {/* 콘텐츠 영역 */}
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/diagnosis" element={<CapturePage />} />
            <Route path="/dashboard" element={<HistoryPage />} />
            {/* 여기에 필요한 다른 페이지 라우트도 추가하세요 */}
          </Routes>
        </div>
      </Layout>
    </BrowserRouter>
  );
};

export default App;