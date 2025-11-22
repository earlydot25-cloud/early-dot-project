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
import { FaCamera, FaChevronRight, FaExclamationTriangle, FaCheckCircle, FaUserMd } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons';
import axios from 'axios';

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

  const finalRiskLevel =
    hasDoctorNote ? data.followup_check!.doctor_risk_level : data.risk_level;

  const riskLabel = hasDoctorNote ? '의사' : 'AI';
  const isAttentionNeeded = finalRiskLevel === '높음' || finalRiskLevel === '즉시 주의';

  let riskDisplay: string;
  let riskColor = 'text-gray-700';

  if (finalRiskLevel === '높음' || finalRiskLevel === '즉시 주의') {
    riskDisplay = `${riskLabel} - ${finalRiskLevel === '즉시 주의' ? '즉시 주의' : '높음'}`;
    riskColor = 'text-red-600';
  } else if (finalRiskLevel === '경과 관찰' || finalRiskLevel === '보통') {
    riskDisplay = `${riskLabel} - 경과 관찰`;
    riskColor = 'text-yellow-600';
  } else {
    riskDisplay = `${riskLabel} - 정상`;
    riskColor = 'text-green-600';
  }

  const buttonText = isDoctorView
    ? hasDoctorNote
      ? '소견 작성/보기'
      : '소견 작성 대기'
    : hasDoctorNote
    ? '결과 열람'
    : '요청 처리 대기';

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR');

  return (
    <div className={`p-4 border rounded-lg shadow-sm w-80 flex-shrink-0 bg-white ${isAttentionNeeded ? 'border-red-400' : 'border-gray-200'}`}>
      <div className="flex justify-between items-start">
        {/* 좌측: 이미지 + 병변명 */}
        <div className="flex flex-col flex-grow">
          <div className="flex items-start mb-3">
            <div className="w-16 h-16 rounded mr-3 flex items-center justify-center overflow-hidden flex-shrink-0">
              {data.photo?.upload_storage_path ? (
                <img
                  src={data.photo.upload_storage_path}
                  alt={`${data.disease.name_ko} 이미지`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
                  이미지 없음
                </div>
              )}
            </div>

            <div className="text-left flex-grow">
              <p className="text-xs font-medium text-gray-500">AI 예측 병변</p>
              <p className="text-lg font-bold text-gray-900 leading-tight">{data.disease.name_ko}</p>
            </div>
          </div>

          {/* 폴더/위치/날짜 */}
          <div className="text-sm text-gray-700 space-y-1 mt-3 border-t pt-3 border-gray-100">
            <p className="text-left">
              <span className="font-bold text-gray-900">저장 폴더:</span> {data.photo.folder_name}
            </p>
            <p className="text-left">
              <span className="font-bold text-gray-900">위치:</span> {data.photo.body_part}
            </p>
            <p className="text-left">
              <span className="font-bold text-gray-900">최초 생성:</span> {formatDate(data.photo.capture_date)}
            </p>
            <p className="text-left">
              <span className="font-bold text-gray-900">마지막 수정:</span> {formatDate(data.analysis_date)}
            </p>
          </div>
        </div>

        {/* 우측: 위험도/버튼 */}
        <div className="ml-2 flex flex-col items-end">
          {/* 환자 뷰에서는 결과 열람 전 위험도 노출 최소화(의사 소견이 있으면 노출) */}
          {(!isDoctorView || hasDoctorNote) && (
            <div className="text-xs font-semibold text-right mb-2">
              {riskDisplay.split(' - ').map((line, idx) => (
                <p key={idx} className={idx === 1 ? riskColor : 'text-gray-500'}>
                  {line}
                </p>
              ))}
            </div>
          )}

          <button
            onClick={handleViewResult}
            className="py-2 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition duration-150"
          >
            {buttonText}
          </button>
        </div>
      </div>

      {/* 하단: 소견/분석 텍스트 */}
      {isDoctorView ? (
        <div className="mt-4 pt-3 border-t border-gray-100 bg-indigo-50 p-2 rounded">
          <p className="text-xs font-medium mb-1 text-indigo-700 flex items-center">
            <UserMdIcon className="mr-1" /> 최종 소견
          </p>
          <p className="text-xs text-gray-700 line-clamp-2">
            {hasDoctorNote
              ? data.followup_check!.doctor_note || '의사 소견이 아직 작성되지 않았습니다.'
              : data.vlm_analysis_text || 'AI 분석 결과 텍스트만 있습니다.'}
          </p>
        </div>
      ) : (
        hasDoctorNote && (
          <div className="mt-4 pt-3 border-t border-gray-100 bg-indigo-50 p-2 rounded">
            <p className="text-xs font-medium mb-1 text-indigo-700 flex items-center">
              <UserMdIcon className="mr-1" /> 의사 소견
            </p>
            <p className="text-xs text-gray-700 line-clamp-2">
              {data.followup_check!.doctor_note || '의사 소견이 아직 작성되지 않았습니다.'}
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
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow hover:border-blue-300">
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

  // ✨ 메인 데이터 로드
  useEffect(() => {
    async function fetchMainData() {
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
    }

    fetchMainData();
  }, [navigate]);

  // 로딩/에러 처리
  if (isLoading) {
    return <div className="p-4 text-center text-lg">데이터를 불러오는 중...</div>;
  }
  if (error) {
    return <div className="p-4 text-center text-red-600 text-lg">{error}</div>;
  }
  if (!data) {
    // 이 케이스는 드뭄(네트워크 예외 등)
    return <div className="p-4 text-center text-gray-600">표시할 데이터가 없습니다.</div>;
  }

  // -----------------------------------
  // 🔎 "내 것만" 필터링 + 요약 계산 (=> 이 숫자만 UI에 사용)
  // -----------------------------------
  const history = data.history ?? [];

  // 로그인한 사용자 정보 (localStorage에 로그인 시 저장되어 있어야 함)
  const userStr = localStorage.getItem('user');
  let currentUserId: number = 0;
  let currentDoctorUid: number | null = null;
  let isDoctor = false;

  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      currentUserId = user.id || 0;
      currentDoctorUid = user.doctor_uid || null;
      isDoctor = user.is_doctor === true || localStorage.getItem('isDoctor') === '1';
    } catch (e) {
      console.error('Failed to parse user data from localStorage:', e);
    }
  }

  // 내 소유만 남기기
  const filteredHistory: DiagnosisResult[] = history.filter((item) => {
    if (!isDoctor) {
      // 환자: 내 Users.id와 일치하는 기록만
      return item.user_id === currentUserId;
    }
    // 의사: 내 Doctors.uid와 연결된 기록만
    return item.doctor_uid === currentDoctorUid;
  });

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

  // 요약 수치(반드시 filtered 기준)
  const visibleTotal = filteredHistory.length;
  const visibleAttention = filteredHistory.filter((i) => {
    const r = getFinalRisk(i);
    return r === '즉시 주의' || r === '높음';
  }).length;

  // 버튼 핸들러
  const handleDiagnosisClick = () => navigate('/diagnosis');
  const handleViewAllHistory = () => navigate('/dashboard');

  return (
    <div className="p-1 space-y-3">
      {/* 1. AI 진단 사용 안내 */}
      <section className="p-4 bg-blue-50 border-l-4 border-blue-600 rounded-lg shadow-sm">
        <h2 className="text-lg font-bold text-blue-800 mb-2">AI 진단 사용 안내</h2>
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

      {/* 2. AI 진단 내역 (상단 요약/헤더는 "내 것"이 0건이면 숨김) */}
      <section>
        {visibleTotal > 0 && (
          <div className="flex justify-between items-center mb-3 p-2 bg-gray-50 rounded-md shadow-inner">
            <div className="text-sm font-medium text-gray-700 flex items-center space-x-4">
              <span className="flex items-center">
                <CheckCircleIcon className="text-green-500 mr-1" /> 전체 {visibleTotal}건
              </span>
              <span className="flex items-center text-red-600 font-bold">
                <ExclamationTriangleIcon className="mr-1" /> 주의 {visibleAttention}건
              </span>
            </div>
            <button
              onClick={handleViewAllHistory}
              className="flex items-center text-sm text-blue-600 font-medium hover:text-blue-800"
            >
              진단 내역 전체보기 <ChevronRightIcon className="ml-1 text-xs" />
            </button>
          </div>
        )}

        {visibleTotal > 0 && (
          <h3 className="text-lg font-bold mb-3">AI 진단 내역 (최근 {visibleTotal}건)</h3>
        )}

        <div className="flex space-x-4 overflow-x-scroll pb-3 scrollbar-hide">
          {visibleTotal > 0 ? (
            // 최근 진단 내역 최대 3개만 표시 (최신순 정렬)
            filteredHistory
              .sort((a, b) => {
                // analysis_date 기준으로 최신순 정렬
                const dateA = new Date(a.analysis_date || a.photo.capture_date).getTime();
                const dateB = new Date(b.analysis_date || b.photo.capture_date).getTime();
                return dateB - dateA;
              })
              .slice(0, 3)
              .map((item) => (
                <DiagnosisCard key={item.id} data={item} isDoctorView={isDoctor} />
              ))
          ) : (
            // 🔻 요구한 문구: 0건일 때만 노출
            <p className="text-gray-700 font-medium">
              조회 가능한 진단내역이 존재하지 않습니다! {visibleTotal}지금 바로 새로운 진단을 시작해보세요!
            </p>
          )}
        </div>
      </section>

      {/* 3. ABCDE 기법 설명 */}
      <section className="pt-4 border-t border-gray-200">
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
