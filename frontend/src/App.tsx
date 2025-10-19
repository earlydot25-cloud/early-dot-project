import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

// Pages Import
import MainPage from './pages/MainPage';
import LoginPage from './pages/auth/LoginPage';
import BodySelectionPage from './pages/diagnosis/BodySelectionPage';
import HistoryPage from './pages/dashboard/HistoryPage';
import ProfilePage from './pages/auth/ProfilePage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      {/* 💡 Layout 컴포넌트가 전체를 감싸고, Nav 및 BottomNav 렌더링을 책임집니다. */}
      <Layout>
        {/* 💡 콘텐츠 영역의 <div style={{ padding: '20px' }}>는 Layout.tsx의 main 태그로 이동했습니다! */}

        <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/diagnosis" element={<BodySelectionPage />} />
            <Route path="/dashboard" element={<HistoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            {/* 여기에 필요한 다른 페이지 라우트도 추가하세요 */}
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
export {};