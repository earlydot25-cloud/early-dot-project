import React, { useEffect, useState, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './contexts/ToastContext';
import { refreshTokenIfNeeded } from './services/http';

import BeforeLoginPage from './pages/BeforeLoginPage';
import MainPage from './pages/dashboard/MainPage';
import DoctorMainPage from './pages/dashboard/DoctorMainPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import BodySelectionPage from './pages/diagnosis/BodySelectionPage';
import CapturePage from './pages/diagnosis/CapturePage';
import SavePhotoPage from './pages/diagnosis/SavePhotoPage';
import HistoryPage from './pages/dashboard/HistoryPage';
import DoctorHistoryPage from './pages/dashboard/DoctorHistoryPage';
import HistoryDetailPage from './pages/dashboard/HistoryDetailPage';
import HistoryResultPage from './pages/dashboard/HistoryResultPage';
import ProfilePage from './pages/dashboard/ProfilePage';
import ResultDetailPage from './pages/diagnosis/ResultDetailPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';

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
}

// user 역할 판별 훅 (DB 0/1 매핑)
const useUserRole = (): { isDoctor: boolean, isLoaded: boolean } => {
    // 💡 Local Storage 변경에 반응하도록 상태를 관리
    const [isDoctor, setIsDoctor] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false); // 로드 상태 추가

    useEffect(() => {
        const determineRole = () => {
            const isDoctorString = localStorage.getItem('isDoctor'); // 'userRole' -> 'isDoctor' 키를 사용하도록 가정
            const isStaffString = localStorage.getItem('isStaff'); // 슈퍼유저/관리자 체크용

            // isDoctor는 "1" 문자열일 때만 true가 됩니다.
            const newIsDoctor = (typeof window !== 'undefined' && isDoctorString === '1');

            // 로그인 상태이고, isDoctor 또는 isStaff 값이 존재하면 로드 완료로 간주합니다.
            if (isAuthed() && (isDoctorString !== null || isStaffString !== null)) {
                 setIsDoctor(newIsDoctor);
                 setIsLoaded(true); // 로드 완료
            } else if (!isAuthed()) {
                 // 로그아웃 상태라면 즉시 로드 완료 (isDoctor: false)
                 setIsDoctor(false);
                 setIsLoaded(true);
            } else {
                 // 로그인했지만 isDoctor/isStaff 값이 아직 없으면 (초기 로드 경쟁 조건) 로드되지 않은 상태를 유지
                 setIsLoaded(false);
            }
        };

        determineRole();

        // 로그인/로그아웃 시 발생하는 커스ㅍ텀 이벤트에 반응하여 역할 갱신
        const handleAuthUpdate = () => {
            determineRole();
        };

        // 🚨 이벤트 리스너 추가: LoginPage에서 dispatch한 이벤트에 반응하여 역할 상태를 갱신합니다.
        window.addEventListener('auth:update', handleAuthUpdate);

        return () => {
            window.removeEventListener('auth:update', handleAuthUpdate);
        };
    }, []); // 훅이 마운트될 때 한 번만 실행

    // 🚨 수정: isLoaded 상태를 반환 객체에 명시적으로 추가하여 TS2339 오류를 해결합니다.
    return { isDoctor, isLoaded };
};

// 🟢 [수정됨] HomeRedirector 컴포넌트를 Navigate 컴포넌트로 변경
// 역할에 따라 다른 경로로 리다이렉트합니다.
const HomeRedirector: React.FC = () => {
    const { isDoctor, isLoaded } = useUserRole();
    
    // 로드 완료될 때까지 대기
    if (!isLoaded) {
        return null;
    }

    // 🎯 1순위: 슈퍼유저/관리자는 admin 페이지로 리다이렉트
    const isStaff = localStorage.getItem('isStaff') === '1';
    console.log('🔍 HomeRedirector 체크:', { isStaff, isDoctor, isLoaded });
    if (isStaff) {
        console.log('✅ 관리자 페이지로 리다이렉트');
        return <Navigate to="/admin/main" replace />;
    }

    // 🎯 2순위: 의사는 의사 대시보드로 리다이렉트
    if (isDoctor) {
        return <Navigate to="/dashboard/doctor/main" replace />;
    }

    // 🎯 3순위: 일반 사용자는 환자 대시보드로 리다이렉트
    return <Navigate to="/dashboard/main" replace />;
};

// -----------------------------------
// 페이지 이동 시 최상단으로 스크롤하는 컴포넌트
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  // 모든 스크롤 가능한 요소를 찾아서 초기화하는 함수
  const scrollToTop = () => {
    // 1. window와 document 스크롤 초기화
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.documentElement.scrollLeft = 0;
    document.body.scrollTop = 0;
    document.body.scrollLeft = 0;
    
    // 2. 모든 가능한 스크롤 컨테이너 초기화
    const scrollContainers = [
      '.main-content',
      'main',
      '.app-container',
      '#root',
    ];
    
    scrollContainers.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl) {
            htmlEl.scrollTop = 0;
            htmlEl.scrollLeft = 0;
          }
        });
      } catch (e) {
        // selector 오류 무시
      }
    });
    
    // 3. overflow 속성이 scroll이나 auto인 모든 요소 찾아서 초기화
    const allElements = document.querySelectorAll('*');
    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl && htmlEl.scrollTop !== undefined) {
        const style = window.getComputedStyle(htmlEl);
        const overflowY = style.overflowY;
        const overflowX = style.overflowX;
        if ((overflowY === 'scroll' || overflowY === 'auto') && htmlEl.scrollTop > 0) {
          htmlEl.scrollTop = 0;
        }
        if ((overflowX === 'scroll' || overflowX === 'auto') && htmlEl.scrollLeft > 0) {
          htmlEl.scrollLeft = 0;
        }
      }
    });
  };

  // useLayoutEffect로 DOM 업데이트 전에 스크롤 초기화
  useLayoutEffect(() => {
    scrollToTop();
  }, [pathname]);

  // useEffect로 DOM 렌더링 완료 후에도 스크롤 초기화
  useEffect(() => {
    // 즉시 실행
    scrollToTop();
    
    // requestAnimationFrame을 사용하여 DOM 렌더링 완료 후 실행
    requestAnimationFrame(() => {
      scrollToTop();
      requestAnimationFrame(() => {
        scrollToTop();
      });
    });
    
    // 약간의 딜레이 후 다시 실행 (DOM 렌더링 완료 보장)
    const timeoutId = setTimeout(scrollToTop, 0);
    const timeoutId2 = setTimeout(scrollToTop, 10);
    const timeoutId3 = setTimeout(scrollToTop, 50);
    const timeoutId4 = setTimeout(scrollToTop, 100);
    const timeoutId5 = setTimeout(scrollToTop, 200);
    const timeoutId6 = setTimeout(scrollToTop, 300);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      clearTimeout(timeoutId4);
      clearTimeout(timeoutId5);
      clearTimeout(timeoutId6);
    };
  }, [pathname]);

  return null;
};

// -----------------------------------
// App 컴포넌트 (라우팅)
const App: React.FC = () => {
  useEffect(() => {
    const access = localStorage.getItem('accessToken');
    const user = localStorage.getItem('user');

    // user 정보가 없거나 accessToken이 비정상적이면 정리
    if (!access || !user || user === 'null') {
      localStorage.clear();
    }
console.log("-----------------------------------------------------------------");
        console.log("⚠️ 현재 모든 페이지는 인증 없이 접근 가능합니다.");
        // 🚨 수정: 콘솔 메시지를 현재 사용 중인 'isDoctor' 키와 값('1'/'0')에 맞춰 수정
        console.log("✅ '/home' 경로 테스트 안내:");
        console.log("    - 의사 모드: localStorage.setItem('isDoctor', '1'); (콘솔 입력 후 새로고침)");
        console.log("    - 환자 모드: localStorage.setItem('isDoctor', '0'); 또는 localStorage.removeItem('isDoctor'); (콘솔 입력 후 새로고침)");
        console.log("-----------------------------------------------------------------");
  }, []);

  // 페이지 포커스 시 토큰 갱신 체크
  useEffect(() => {
    const handleFocus = async () => {
      await refreshTokenIfNeeded();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return (
    <ToastProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Layout>
          <Routes>
          {/* 0) 로그인 전 랜딩 */}
          <Route path="/" element={<BeforeLoginPage />} />

          {/* 1) 인증 관련 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* 2) 로그인 후만 접근 가능 */}
          <Route path="/home" element={<RequireAuth><HomeRedirector /></RequireAuth>} />
          <Route path="/dashboard/main" element={<RequireAuth><MainPage /></RequireAuth>} />
          <Route path="/dashboard/doctor/main" element={<RequireAuth><DoctorMainPage /></RequireAuth>} />
          
          {/* 진단 플로우 */}
          <Route path="/diagnosis" element={<RequireAuth><BodySelectionPage /></RequireAuth>} />
          <Route path="/diagnosis/body-select" element={<RequireAuth><BodySelectionPage /></RequireAuth>} />
          <Route path="/diagnosis/capture" element={<RequireAuth><CapturePage /></RequireAuth>} />
          <Route path="/diagnosis/save" element={<RequireAuth><SavePhotoPage /></RequireAuth>} />
          
          {/* 진단 내역 - 일반인용 */}
          <Route path="/dashboard/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
          <Route path="/dashboard/history/:folderName" element={<RequireAuth><HistoryDetailPage /></RequireAuth>} />
          <Route path="/dashboard/history/:folderName/:resultId" element={<RequireAuth><HistoryResultPage /></RequireAuth>} />
          
          {/* 진단 내역 - 의사용 (URL 기반 라우팅) */}
          <Route path="/dashboard/doctor/history" element={<RequireAuth><DoctorHistoryPage /></RequireAuth>} />
          <Route path="/dashboard/doctor/history/:userId" element={<RequireAuth><DoctorHistoryPage /></RequireAuth>} />
          <Route path="/dashboard/doctor/history/:userId/:folderName" element={<RequireAuth><DoctorHistoryPage /></RequireAuth>} />
          <Route path="/dashboard/doctor/history/:userId/:folderName/:resultId" element={<RequireAuth><HistoryResultPage /></RequireAuth>} />
          
          <Route path="/dashboard/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/diagnosis/detail/:id" element={<RequireAuth><ResultDetailPage /></RequireAuth>} />
          
          {/* 관리자 페이지 */}
          <Route path="/admin/main" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
          <Route path="/admin/dashboard" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ToastProvider>
  );
};

export default App;
