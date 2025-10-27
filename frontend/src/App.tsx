import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";

// 페이지 import
import BeforeLoginPage from "./pages/BeforeLoginPage";
import MainPage from "./pages/dashboard/MainPage";
import LoginPage from "./pages/auth/LoginPage";
import CapturePage from "./pages/diagnosis/CapturePage";
import ProfilePage from "./pages/dashboard/ProfilePage";

// ✅ 새로 추가되는 계층형 페이지
import PatientsPage from "./pages/dashboard/PatientsDirectoryPage"; // 전체 환자 목록
import HistoryPage from "./pages/dashboard/HistoryPage"; // 폴더 목록
import HistoryDetailPage from "./pages/dashboard/HistoryDetailPage"; // 질환 목록
import HistoryResultPage from "./pages/dashboard/HistoryResultPage"; // 질환 상세 정보

// 로그인 여부 간단 판별
const isAuthed = () =>
  Boolean(
    typeof window !== "undefined" &&
      (localStorage.getItem("accessToken") ||
        localStorage.getItem("refreshToken") ||
        localStorage.getItem("token") ||
        localStorage.getItem("idToken"))
  );

// 보호 라우트
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

          {/* 로그인 / 회원가입 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<LoginPage />} />

          {/* 홈 */}
          <Route path="/home" element={<MainPage />} />

          {/* 진단 */}
          <Route path="/diagnosis" element={<CapturePage />} />
          <Route path="/diagnosis/detail/:id" element={<CapturePage />} />

          {/* 🩺 진단내역 전체 구조 */}
          {/* 기본 진단내역 경로 → 전체 환자 목록으로 리다이렉트 */}
          <Route path="/dashboard" element={<Navigate to="/dashboard/patients" replace />} />

          {/* ① 모든 환자 목록 */}
          <Route path="/dashboard/patients" element={<PatientsPage />} />

          {/* ② 폴더 목록 */}
          <Route path="/dashboard/history" element={<HistoryPage />} />

          {/* ③ 폴더 내 질환 목록 */}
          <Route path="/dashboard/history/:folderName" element={<HistoryDetailPage />} />

          {/* ④ 질환 상세 정보 */}
          <Route
            path="/dashboard/history/:folderName/:resultId"
            element={<HistoryResultPage />}
          />

          {/* 프로필 */}
          <Route path="/dashboard/profile" element={<ProfilePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
export {};
