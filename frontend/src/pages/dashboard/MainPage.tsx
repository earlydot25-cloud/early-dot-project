// src/pages/dashboard/MainPage.tsx
// ----------------------------------------------------------------------------------
// ✅ 요구사항 요약 반영
// - 로그인한 계정(환자/의사)에 "속한" 진단만 보이게 필터링
// - 첫 가입 등 "내 진단 0건"이면 상단 요약/전체보기/헤더 전부 숨김
// - 대신 CTA 문구만 노출: "조회 가능한 진단내역이 존재하지 않습니다! 지금 바로 새로운 진단을 시작해보세요!"
// - 타입스크립트, 빌드 에러/경고 정리
// - axios 예외 처리에서 버전/타입 차이로 인한 isAxiosError 의존 제거
// ----------------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// 아이콘 (react-icons는 TS에서 컴포넌트 제네릭 충돌이 가끔 나서 안전 래퍼 사용)
import { FaCamera, FaChevronRight, FaChevronLeft, FaExclamationTriangle, FaCheckCircle, FaUserMd } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons';
import axios from 'axios';
import EmptyState from '../../components/EmptyState';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { formatDateTime } from '../../utils/dateUtils';

// 배포 환경에서는 /api 프록시 경로 사용
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

// ✅ 이미지 URL 처리 함수
const normalizeHost = (url: string) =>
  url.replace(/^http:\/\/(?:django|project_django)(?::\d+)?/i, API_BASE_URL);

// ✅ 경로 보정 함수 - 이미지는 /media/ 경로로 직접 접근
const resolveMediaUrl = (rawPath?: string) => {
  if (!rawPath) return '';
  let path = rawPath.replace(/\\/g, '/');

  // 이미 완전한 URL이면 그대로 사용
  if (/^https?:\/\//i.test(path)) {
    const currentOrigin = window.location.origin;
    if (path.startsWith(currentOrigin)) {
      return path;
    }
    if (path.includes('127.0.0.1:8000') || path.includes('localhost:8000')) {
      const mediaPath = path.replace(/^https?:\/\/[^\/]+/i, '');
      return `${currentOrigin}${mediaPath}`;
    }
    return normalizeHost(path);
  }

  // /media/ 경로는 /api 없이 직접 접근
  if (path.startsWith('/media/')) {
    return path;
  }

  // media/로 시작하는 경우
  if (path.startsWith('media/')) {
    return `/${path}`;
  }

  // /media/가 포함된 경우
  if (path.includes('/media/')) {
    const parts = path.split('/media/');
    if (parts.length > 1) {
      return `/media/${parts[parts.length - 1]}`;
    }
  }

  // /로 시작하는 경우 (절대 경로)
  if (path.startsWith('/')) {
    // /api로 시작하면 제거하고 처리
    if (path.startsWith('/api/')) {
      const withoutApi = path.replace(/^\/api\//, '');
      if (withoutApi.startsWith('media/')) {
        return `/${withoutApi}`;
      }
      return `${API_BASE_URL}${path}`;
    }
    // /media/로 시작하면 그대로 사용
    if (path.startsWith('/media/')) {
      return path;
    }
    // 다른 절대 경로는 API_BASE_URL 사용
    return `${API_BASE_URL}${path}`;
  }

  // 상대 경로인 경우 /media/ 추가
  return `/media/${path}`;
};

// -----------------------------------
// 🔴 데이터 타입 정의 (백엔드 DRF 시리얼라이저 구조 반영) 🔴
// -----------------------------------
interface FollowUpCheckData {
  current_status: '요청중' | '확인 완료';
  // 의사 위험도는 보통 '소견 대기' | '즉시 주의' | '경과 관찰' | '정상'만 내려옴
  doctor_risk_level: '소견 대기' | '즉시 주의' | '경과 관찰' | '정상';
  doctor_note: string | null;
}

interface PhotoData {
  body_part: string;
  folder_name: string;
  upload_storage_path: string; // 이미지 절대/상대 경로
  capture_date: string;        // ISO 문자열
}

interface DiseaseData {
  name_ko: string;
}

interface DiagnosisResult {
  id: number;
  photo: PhotoData;
  disease: DiseaseData;
  analysis_date: string;
  risk_level: '높음' | '보통' | '낮음';
  vlm_analysis_text: string | null;
  followup_check: FollowUpCheckData | null;

  // 🔻 소유 식별자(반드시 백엔드 필드명과 일치하도록 선언)
  user_id?: number;     // 환자 Users.id
  doctor_uid?: number;  // 의사 Doctors.uid
}

interface MainDashboardData {
  summary: {
    total_count: number;
    attention_count: number;
  };
  history: DiagnosisResult[];
}
// -----------------------------------


// -----------------------------------
// 🔴 아이콘 안전 래퍼 (TS2786 방지) 🔴
// -----------------------------------
type IconCmp = React.FC<IconBaseProps>;
const UserMdIcon: IconCmp = (props) => React.createElement(FaUserMd as any, props);
const CameraIcon: IconCmp = (props) => React.createElement(FaCamera as any, props);
const ChevronRightIcon: IconCmp = (props) => React.createElement(FaChevronRight as any, props);
const ChevronLeftIcon: IconCmp = (props) => React.createElement(FaChevronLeft as any, props);
const ExclamationTriangleIcon: IconCmp = (props) => React.createElement(FaExclamationTriangle as any, props);
const CheckCircleIcon: IconCmp = (props) => React.createElement(FaCheckCircle as any, props);
// -----------------------------------
// [카드 컴포넌트] DiagnosisCard
// -----------------------------------
interface DiagnosisCardProps {
  data: DiagnosisResult;
  isDoctorView?: boolean; // 의사 모드 여부
}

const DiagnosisCard: React.FC<DiagnosisCardProps> = ({ data, isDoctorView = false }) => {
  const navigate = useNavigate();

  const handleViewResult = () => {
    // 상세 페이지로 이동 (라우팅은 프로젝트 라우트에 맞춰 조정)
    navigate(`/diagnosis/detail/${data.id}`);
  };

  // 의사 소견이 있고 '소견 대기'가 아니면 의사 위험도 우선
  const hasDoctorNote =
    !!data.followup_check?.doctor_note &&
    data.followup_check?.doctor_risk_level !== '소견 대기';

  // doctor_uid가 있는 환자의 경우, followup_check가 있으면 의사 위험도 표시 (소견 대기 포함)
  const hasFollowupCheck = !!data.followup_check;
  // current_status가 '요청중'이거나 doctor_risk_level이 '소견 대기'이면 소견 대기 상태
  const isWaitingForOpinion = (data.doctor_uid !== null && data.doctor_uid !== undefined) && hasFollowupCheck && 
    (data.followup_check?.current_status === '요청중' || data.followup_check?.doctor_risk_level === '소견 대기');
  
  // doctor_uid가 있고 followup_check가 있으면 의사 위험도 표시 (소견 대기 포함)
  const shouldShowDoctorRisk = (data.doctor_uid !== null && data.doctor_uid !== undefined) && hasFollowupCheck;

  const finalRiskLevel =
    hasDoctorNote ? data.followup_check!.doctor_risk_level : data.risk_level;

  const isAttentionNeeded = finalRiskLevel === '높음' || finalRiskLevel === '즉시 주의';

  const buttonText = isDoctorView
    ? hasDoctorNote
      ? '소견 작성/보기'
      : '소견 작성 대기'
    : hasDoctorNote
    ? '결과 열람'
    : '요청 처리 대기';

  // 요청 중 상태 확인
  const isRequestPending = data.followup_check?.current_status === '요청중';

  // 환자용 표시: AI/의사 상태 배지
  const doctorStatus = data.followup_check?.doctor_risk_level;
  const hasDoctorStatus = !!doctorStatus && doctorStatus !== '소견 대기';
  const doctorDisplay = hasDoctorStatus ? doctorStatus : '요청중';
  const doctorPillColor =
    doctorStatus === '즉시 주의'
      ? 'bg-red-100 text-red-700'
      : doctorStatus === '경과 관찰'
      ? 'bg-orange-100 text-orange-700'
      : doctorStatus === '정상'
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-600';
  const aiLevel = data.risk_level || '분석 대기';
  const aiColorMap: Record<string, string> = {
    '즉시 주의': 'bg-red-100 text-red-700',
    높음: 'bg-red-100 text-red-700',
    보통: 'bg-orange-100 text-orange-700',
    중간: 'bg-orange-100 text-orange-700',
    '경과 관찰': 'bg-orange-100 text-orange-700',
    정상: 'bg-green-100 text-green-700',
    낮음: 'bg-green-100 text-green-700',
  };
  const aiPillColor = aiColorMap[aiLevel] || 'bg-gray-100 text-gray-700';

  return (
    <div className={`p-4 border rounded-lg shadow-sm bg-white mb-4 border-gray-200`}>
      <div className="flex gap-4 items-start">
        {/* 왼쪽: 환부 이미지 */}
        <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
          {data.photo && data.photo.upload_storage_path ? (
            <img
              src={resolveMediaUrl(data.photo.upload_storage_path)}
              alt={`${data.disease.name_ko} 이미지`}
              className="w-full h-full object-cover"
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-xs text-gray-500 bg-gray-100">환부 이미지</div>';
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 bg-gray-100">
              환부 이미지
            </div>
          )}
        </div>

        {/* 중간: 병변 정보 */}
        <div className="flex-1 min-w-0">
          <div className="mb-2">
            <p className="text-xs font-medium text-gray-500 mb-1">AI 예측 병변</p>
            <p className="text-base font-semibold text-gray-800 mb-2">{data.disease.name_ko}</p>
            {data.photo.body_part && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">위치: {data.photo.body_part}</p>
              </div>
            )}

          </div>
        </div>

        {/* 오른쪽: 위험도 및 버튼 */}
        <div className="flex flex-col items-center flex-shrink-0 gap-2">
          {/* 상단: AI / 의사 리스크 pill 정렬 (가운데) */}
          <div className="flex flex-col items-center gap-1 w-full min-w-[120px]">
            <span className={`inline-flex justify-center items-center px-3 py-1 rounded-full text-xs font-semibold w-full ${aiPillColor}`}>
              AI: {data.risk_level || '분석 대기'}
            </span>
            <span className={`inline-flex justify-center items-center px-3 py-1 rounded-full text-xs font-semibold w-full ${doctorPillColor}`}>
              의사: {doctorDisplay}
            </span>
          </div>

          {/* 요청 중 배지 (버튼 크기와 동일 폭) */}
          {isRequestPending && (
            <span className="inline-flex justify-center items-center px-3 py-2 rounded-lg text-sm font-semibold bg-gray-200 text-gray-700 w-full min-w-[120px]">
              요청 중
            </span>
          )}

          {/* 결과 열람 버튼 (가운데) */}
          {buttonText !== '요청 처리 대기' && (
            <button
              onClick={handleViewResult}
              className="py-2 px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition duration-150 shadow-sm w-full min-w-[120px]"
            >
              {buttonText}
            </button>
          )}
        </div>
      </div>

      {/* 날짜 정보 (선 위) */}
      <div className="mt-3 mb-3">
        <div className="text-xs text-gray-600 space-y-1 pl-8">
          <p>저장 폴더: {data.photo.folder_name}</p>
          <p>최초 생성 일자: {formatDateTime(data.photo.capture_date)}</p>
          <p>마지막 수정 일자: {formatDateTime(data.analysis_date)}</p>
        </div>
      </div>

      {/* 하단: 소견/분석 텍스트 */}
      {isDoctorView ? (
        <div className="mt-3 pt-3 border-t border-gray-100 bg-indigo-50 p-2 rounded">
          <p className="text-xs font-medium mb-1 text-indigo-700 flex items-center">
            <UserMdIcon className="mr-1" size={12} /> 최종 소견
          </p>
          <p className="text-xs text-gray-700 line-clamp-2">
            {hasDoctorNote
              ? data.followup_check!.doctor_note || '의사 소견이 아직 작성되지 않았습니다.'
              : data.vlm_analysis_text || 'AI 분석 결과 텍스트만 있습니다.'}
          </p>
        </div>
      ) : (
        (hasDoctorNote || isRequestPending) && (
          <div className="mt-3 pt-3 border-t border-gray-100 bg-indigo-50 p-2 rounded">
            <p className="text-xs font-medium mb-1 text-indigo-700 flex items-center">
              <UserMdIcon className="mr-1" size={12} /> 의사 소견
            </p>
            <p className="text-xs text-gray-700 line-clamp-2">
              {isRequestPending 
                ? '의사 소견 요청 중입니다.'
                : (data.followup_check!.doctor_note || '의사 소견이 아직 작성되지 않았습니다.')}
            </p>
          </div>
        )
      )}
    </div>
  );
};

// -----------------------------------
// 보조 컴포넌트: ABCDE 설명 아이템 (개선 버전)
// -----------------------------------
const ABCDEItem: React.FC<{
  letter: string;
  title: string;
  description: string;
}> = ({ letter, title, description }) => {
  return (
    <div 
      className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
      style={{ 
        touchAction: 'pan-y', // ✅ 스크롤 허용, Pull-to-Refresh 방지
        userSelect: 'none', // ✅ 텍스트 선택 방지
        WebkitUserSelect: 'none', // ✅ iOS Safari 텍스트 선택 방지
      }}
      tabIndex={-1} // ✅ 포커스 불가능하게 설정
      onMouseDown={(e) => e.preventDefault()} // ✅ 마우스 다운 이벤트 방지
      onTouchStart={(e) => e.preventDefault()} // ✅ 터치 시작 이벤트 방지
    >
      <div className="flex items-start gap-3">
        {/* 왼쪽: 알파벳 배지 */}
        <div className="flex-shrink-0 w-10 h-10 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center">
          <span className="text-lg font-bold text-blue-700">{letter}</span>
        </div>
        
        {/* 오른쪽: 제목과 설명 */}
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-semibold text-gray-800 mb-1.5 leading-tight">
            {title}
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------
// 메인 컴포넌트
// -----------------------------------
const MainPage: React.FC = () => {
  const navigate = useNavigate();

  // API 데이터/상태
  const [data, setData] = useState<MainDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recent' | 'pending'>('recent');
  const [currentPage, setCurrentPage] = useState(0);

  // ✨ 메인 데이터 로드 함수
  const fetchMainData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 개발 프록시가 세팅되어 있으면 상대 경로로 호출 가능
      const API_URL = '/api/dashboard/main/';
      const token = localStorage.getItem('accessToken');
      console.log('Token being sent in MainPage:', token);

      const res = await axios.get<MainDashboardData>(API_URL, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });

      setData(
        (res.data as MainDashboardData) ?? {
          summary: { total_count: 0, attention_count: 0 },
          history: [],
        }
      );
      setError(null);
    } catch (err: any) {
      // axios 버전/타입에 상관없이 안전하게 상태코드만 뽑기
      const status = (err as any)?.response?.status as number | undefined;

      if (status === 401) {
        // 인증 안 됨 → 로그인으로
        navigate('/login');
        return;
      }
      if (status === 404 || status === 204) {
        // 데이터 없음 → 정상 플로우(빈 상태)
        setData({ summary: { total_count: 0, attention_count: 0 }, history: [] });
        setError(null);
        return;
      }

      setError('데이터를 불러오는 데 실패했습니다. 서버 상태를 확인하세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // ✨ 메인 데이터 로드
  useEffect(() => {
    fetchMainData();
  }, [navigate]);

  // ✨ Pull-to-Refresh
  usePullToRefresh({
    onRefresh: fetchMainData,
    disabled: isLoading,
  });

  // 탭 변경 시 페이지 초기화
  useEffect(() => {
    setCurrentPage(0);
  }, [activeTab]);

  // 로딩/에러 처리
  if (isLoading && !data) {
    return <div className="p-4 text-center text-lg">데이터를 불러오는 중...</div>;
  }
  if (error && !data) {
    return (
      <div className="p-4">
        <EmptyState
          icon={
            <svg className="w-16 h-16 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          title="데이터를 불러올 수 없습니다"
          description={error}
          actionLabel="다시 시도"
          onAction={fetchMainData}
        />
      </div>
    );
  }
  if (!data) {
    // 이 케이스는 드뭄(네트워크 예외 등)
    return (
      <div className="p-4">
        <EmptyState
          title="표시할 데이터가 없습니다"
          description="데이터를 불러오는 중 문제가 발생했습니다."
          actionLabel="다시 시도"
          onAction={fetchMainData}
        />
      </div>
    );
  }

  // -----------------------------------
  // 백엔드에서 이미 필터링된 데이터 사용
  // -----------------------------------
  // 백엔드에서 이미 해당 사용자의 진단 내역만 필터링해서 보내주므로
  // 프론트엔드에서 추가 필터링 불필요
  const history = data.history ?? [];

  // 로그인한 사용자 정보 (의사 여부 확인용)
  const userStr = localStorage.getItem('user');
  let isDoctor = false;

  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      isDoctor = user.is_doctor === true || localStorage.getItem('isDoctor') === '1';
    } catch (e) {
      console.error('Failed to parse user data from localStorage:', e);
    }
  }

  // 최종 위험도 타입(의사/AI 통합 관점)
  type FinalRisk = '즉시 주의' | '높음' | '경과 관찰' | '보통' | '낮음' | '정상';

  // 최종 위험도(의사 소견 우선)
  const getFinalRisk = (item: DiagnosisResult): FinalRisk => {
    const dr = item.followup_check?.doctor_risk_level;
    if (dr && dr !== '소견 대기') {
      return dr as FinalRisk; // TS 좁힘 한계로 안전 캐스팅
    }
    return item.risk_level as FinalRisk;
  };

  // 요약 수치 (백엔드에서 받은 데이터 기준)
  const visibleTotal = history.length;
  const visibleAttention = history.filter((i) => {
    const r = getFinalRisk(i);
    return r === '즉시 주의' || r === '높음';
  }).length;

  // 환자 여부 확인 (doctor_uid가 있으면 환자, 없으면 일반 유저)
  const isPatient = history.some((i) => i.doctor_uid !== null && i.doctor_uid !== undefined);

  // 탭별 필터링 (환자만 "요청 중" 탭 표시)
  const pendingCount = isPatient ? history.filter((i) => 
    i.followup_check?.current_status === '요청중'
  ).length : 0;

  const sortedHistory = history.sort((a, b) => {
    const dateA = new Date(a.analysis_date || a.photo.capture_date).getTime();
    const dateB = new Date(b.analysis_date || b.photo.capture_date).getTime();
    return dateB - dateA;
  });

  const recentHistory = sortedHistory;
  const pendingHistory = isPatient ? sortedHistory.filter((i) => 
    i.followup_check?.current_status === '요청중'
  ) : [];

  // 환자가 아니면 항상 "최근" 탭만 표시
  const displayedHistory = (isPatient && activeTab === 'pending') ? pendingHistory : recentHistory;

  // 페이지네이션 적용 여부 (항상 페이지네이션 사용)
  const shouldUsePagination = displayedHistory.length > 0;
  
  // currentPage가 범위를 벗어나지 않도록 보정
  const safeCurrentPage = Math.min(currentPage, Math.max(0, displayedHistory.length - 1));
  const currentItem = shouldUsePagination && displayedHistory.length > 0 
    ? displayedHistory[safeCurrentPage] 
    : null;
  
  const handlePrevPage = () => {
    if (safeCurrentPage > 0) {
      setCurrentPage(safeCurrentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (safeCurrentPage < displayedHistory.length - 1) {
      setCurrentPage(safeCurrentPage + 1);
    }
  };

  // 버튼 핸들러
  const handleDiagnosisClick = () => navigate('/diagnosis');
  const handleViewAllHistory = () => navigate('/dashboard/history');

  return (
    <div className="p-1 space-y-3 bg-gradient-to-b from-gray-50 to-white min-h-screen">
      {/* 1. AI 진단 사용 안내 */}
      <section className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
        <h2 className="text-lg font-bold text-gray-800 mb-2">AI 진단 보조 사용 안내</h2>
        <p className="text-sm text-gray-700 mb-4">
          'EARLY-DOT' AI는 <strong>"AI 예측 병변 및 임상 데이터"</strong>를 기반으로 훈련되었으며,
          병변의 형태, 크기, 색상 등의 정보를 종합적으로 분석하여 위험도를 예측합니다.
        </p>
        <button
          onClick={handleDiagnosisClick}
          className="w-full py-2 bg-blue-600 text-white font-semibold rounded-md flex items-center justify-center hover:bg-blue-700 transition duration-150"
        >
          <CameraIcon className="mr-2" /> 환부 촬영 안내 버튼
        </button>
      </section>

      {/* 2. AI 진단 내역 */}
      <section className="bg-white rounded-lg py-3 px-4 shadow-sm border border-gray-100">
        {/* 헤더 (항상 표시) */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">진단 내역</h2>
            {visibleTotal > 0 && (
              <span className="text-sm text-gray-500">
                총 {visibleTotal}건
                {visibleAttention > 0 && (
                  <span className="text-red-600 font-semibold"> ({visibleAttention}건 주의)</span>
                )}
              </span>
            )}
          </div>
          {visibleTotal > 0 && (
            <button
              onClick={handleViewAllHistory}
              className="flex items-center text-sm text-blue-600 font-medium hover:text-blue-800 hover:underline"
            >
              진단 내역 전체보기 <ChevronRightIcon className="ml-1" size={12} />
            </button>
          )}
        </div>

        {visibleTotal > 0 ? (
          <>

            {/* 탭 버튼 (환자만 "요청 중" 탭 표시) */}
            {isPatient && (
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setActiveTab('recent')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'recent'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  최근
                </button>
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors relative ${
                    activeTab === 'pending'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  요청 중
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* 페이지네이션으로 카드 표시 */}
            {shouldUsePagination && currentItem ? (
              <div className="relative">
                {/* 진단 카드 */}
                <DiagnosisCard key={currentItem.id} data={currentItem} isDoctorView={isDoctor} />
                
                {/* 오버레이 네비게이션 버튼 (카드 위) */}
                {displayedHistory.length > 1 && (
                  <>
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-1">
                      {/* 왼쪽 이전 버튼 */}
                      <button
                        onClick={handlePrevPage}
                        disabled={safeCurrentPage === 0}
                        className={`pointer-events-auto p-1.5 rounded-full bg-white/80 hover:bg-white shadow-md transition-all ${
                          safeCurrentPage === 0
                            ? 'opacity-30 cursor-not-allowed'
                            : 'opacity-100 hover:scale-110'
                        }`}
                      >
                        <ChevronLeftIcon size={18} className="text-gray-700" />
                      </button>
                      
                      {/* 오른쪽 다음 버튼 */}
                      <button
                        onClick={handleNextPage}
                        disabled={safeCurrentPage === displayedHistory.length - 1}
                        className={`pointer-events-auto p-1.5 rounded-full bg-white/80 hover:bg-white shadow-md transition-all ${
                          safeCurrentPage === displayedHistory.length - 1
                            ? 'opacity-30 cursor-not-allowed'
                            : 'opacity-100 hover:scale-110'
                        }`}
                      >
                        <ChevronRightIcon size={18} className="text-gray-700" />
                      </button>
                    </div>
                    
                    {/* 페이지 인디케이터 (카드 아래 중앙) */}
                    <div className="flex items-center justify-center gap-2 mt-4">
                      {displayedHistory.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentPage(index)}
                          className={`transition-all ${
                            index === safeCurrentPage
                              ? 'w-2.5 h-2.5 bg-blue-600'
                              : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                          } rounded-full`}
                          aria-label={`페이지 ${index + 1}로 이동`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <EmptyState
                title={activeTab === 'pending' ? '요청 중인 진단 내역이 없습니다' : '진단 내역이 없습니다'}
                description={activeTab === 'pending' ? '현재 처리 대기 중인 진단 요청이 없습니다.' : '아직 저장된 진단 내역이 없습니다.'}
              />
            )}
          </>
        ) : (
          /* 진단 내역이 없을 때 안내 메시지 */
          <EmptyState
            title={!isDoctor ? '아직 진단 내역이 없습니다' : '조회 가능한 진단내역이 존재하지 않습니다'}
            description={!isDoctor ? '위 버튼을 누르고 사진을 찍어서 확인해보세요!' : '환자들의 진단 내역이 없습니다.'}
            actionLabel={!isDoctor ? '진단 시작하기' : undefined}
            onAction={!isDoctor ? () => navigate('/diagnosis') : undefined}
          />
        )}
      </section>

      {/* 3. ABCDE 기법 설명 */}
      <section 
        className="pt-4 border-t border-gray-200 bg-gradient-to-b from-blue-50/30 to-white rounded-lg p-4"
        style={{ 
          touchAction: 'pan-y', // ✅ 전체 섹션에 스크롤 허용
          userSelect: 'none', // ✅ 텍스트 선택 방지
          WebkitUserSelect: 'none', // ✅ iOS Safari 텍스트 선택 방지
        }}
        tabIndex={-1} // ✅ 포커스 불가능하게 설정
      >
        <div className="mb-4">
          <div className="flex flex-col gap-4 mb-3">
            {/* 텍스트 영역 - 위쪽 */}
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                거울 앞 5분,<br /> 내 피부를 직접 확인해보세요!
              </h3>
              <p className="text-sm text-gray-600">
                ABCDE 기법이란?<br />피부를 스스로 점검하는 5가지 기준입니다.
              </p>
            </div>
            {/* 이미지 영역 - 아래쪽 */}
            <div className="w-full max-w-xs mx-auto rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
              <img 
                src="/check_mirror.jpg" 
                alt="거울 앞에서 피부 확인하는 이미지"
                className="w-full h-48 object-cover"
              />
            </div>
          </div>
        </div>

        {/* 1열 레이아웃 */}
        <div className="space-y-3">
          <ABCDEItem
            letter="A"
            title="A. 비대칭 (Asymmetry)"
            description="환부 모양을 반으로 접었을 때 대칭인지 확인합니다. 비대칭일수록 악성일 가능성이 높습니다."
          />
          <ABCDEItem
            letter="B"
            title="B. 경계 (Border)"
            description="경계선이 울퉁불퉁하거나 불규칙한지 확인합니다. 불규칙할수록 위험합니다."
          />
          <ABCDEItem
            letter="C"
            title="C. 색상 (Color)"
            description="한 병변 내에 2가지 이상의 색상이 섞여 있는지 확인합니다. 색상 변화가 클수록 위험합니다."
          />
          <ABCDEItem
            letter="D"
            title="D. 크기 (Diameter)"
            description="해당 환부 부위가 6mm가 넘는지 직접 확인하세요. 6mm 이상일 경우 변화 속도를 기록하며 주의 깊은 관찰이 필요합니다."
          />
          <ABCDEItem
            letter="E"
            title="E. 변화 (Evolving)"
            description="해당 환부 부위가 최근 경계가 넓어지거나, 가려움/통증/출혈이 있는지 스스로 관찰하여 변화를 기록하세요."
          />
        </div>
      </section>

    </div>
  );
};

export default MainPage;
