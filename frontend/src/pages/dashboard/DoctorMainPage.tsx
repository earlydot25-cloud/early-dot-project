import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChevronRight, FaExclamationTriangle, FaCheckCircle, FaUserMd } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons';
import axios from 'axios';

// -----------------------------------
// 🔴 데이터 타입 정의 🔴
// -----------------------------------
interface FollowUpCheckData {
  current_status: '요청중' | '확인 완료';
  doctor_risk_level: '소견 대기' | '즉시 주의' | '경과 관찰' | '정상';
  doctor_note: string | null;
}
interface PhotoData {
  body_part: string;
  folder_name: string;
  upload_storage_path: string;
  capture_date: string;
}
interface DiseaseData {
  name_ko: string;
}
interface DiagnosisResult {
  id: number;
  photo: PhotoData;
  disease: DiseaseData;
  analysis_date: string;
  risk_level: '높음' | '보통' | '낮음' ;
  vlm_analysis_text: string | null;
  followup_check: FollowUpCheckData | null;
}
interface MainDashboardData {
  summary: {
    total_count: number;
    attention_count: number;
  };
  history: DiagnosisResult[];
}

// 💡 의사 대시보드 요약 데이터 구조에 맞게 변경
interface DoctorSummaryData {
  total_assigned_count: number; // 백엔드 필드명: total_assigned_count
  immediate_attention_count: number; // 백엔드 필드명: immediate_attention_count
}

// 💡 메인 대시보드 데이터 타입을 의사 전용으로 변경
interface DoctorDashboardData {
  summary: DoctorSummaryData;
  history: DiagnosisResult[]; // DiagnosisResult는 DoctorCardSerializer의 구조를 따라야 정확함
}


// -----------------------------------
// 🔴 아이콘 컴포넌트 래퍼 🔴
// -----------------------------------
type IconCmp = React.FC<IconBaseProps>;
const UserMdIcon: IconCmp = (props) => <FaUserMd {...props} />;
const ChevronRightIcon: IconCmp = (props) => <FaChevronRight {...props} />;
const ExclamationTriangleIcon: IconCmp = (props) => <FaExclamationTriangle {...props} />;
const CheckCircleIcon: IconCmp = (props) => <FaCheckCircle {...props} />;
// -----------------------------------


// --- [보조 컴포넌트] 진단 내역 카드 ---
interface DiagnosisCardProps {
  data: DiagnosisResult;
  isDoctorView?: boolean;
  patientName?: string;
  hasFamilyHistory?: boolean;
}

const DiagnosisCard: React.FC<DiagnosisCardProps> = ({
  data,
  isDoctorView = false,
  patientName = "환자명 (없음)",
  hasFamilyHistory = false,
}) => {
  const navigate = useNavigate();

  const handleViewResult = () => {
    navigate(`/diagnosis/detail/${data.id}`);
  };

  const hasDoctorNote = data.followup_check && data.followup_check.doctor_note && data.followup_check.doctor_risk_level !== '소견 대기';
  const isRequesting = data.followup_check && data.followup_check.current_status === '요청중' && !hasDoctorNote;

  const finalRiskLevel = hasDoctorNote
    ? data.followup_check!.doctor_risk_level
    : data.risk_level;

  const riskLabel = hasDoctorNote ? '의사' : 'AI';
  const isAttentionNeeded = finalRiskLevel === '높음' || finalRiskLevel === '즉시 주의';

  let riskDisplay;
  let riskColor = 'text-gray-700';

  if (finalRiskLevel === '높음' || finalRiskLevel === '즉시 주의') {
    riskDisplay = `${riskLabel} - ${finalRiskLevel === '즉시 주의' ? '즉시 주의' : '높음'}`;
    riskColor = 'text-red-600';
  } else if (finalRiskLevel === '경과 관찰' || finalRiskLevel === '보통') {
    riskDisplay = `${riskLabel} - 경과 관찰`;
    riskColor = 'text-yellow-600';
  } else {
    riskDisplay = `${riskLabel} - 낮음`;
    riskColor = 'text-green-600';
  }

  const buttonText = isDoctorView
    ? (isRequesting ? '소견 작성 대기' : '소견 작성/보기')
    : (isRequesting ? '요청 처리 대기' : '결과 열람');

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('ko-KR');


// -----------------------------------------------------------
// 🔴 의사 뷰 카드 렌더링
// -----------------------------------------------------------
if (isDoctorView) {
    return (
        <div className={`p-4 border rounded-lg shadow-sm w-80 flex-shrink-0 bg-white ${isAttentionNeeded ? 'border-red-400' : 'border-gray-200'}`}>
            <div className="flex justify-between items-start">

                {/* 1. 좌측 핵심 정보 블록 (이미지, 환자명/병변명) */}
                <div className="flex flex-col flex-grow">
                    <div className="flex items-start mb-3">
                        {/* 환부 이미지 Placeholder: 실제 이미지 경로 사용 */}
                         <div className="w-16 h-16 rounded mr-3 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {data.photo && data.photo.upload_storage_path ? (
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

                        {/* 환자명, 가족력, 병변명 */}
                        <div className="text-left flex-grow">
                            <p className="text-lg font-bold text-gray-900 leading-tight">
                                {patientName}
                                <span className="text-xs font-normal text-red-500 ml-1">
                                    {hasFamilyHistory ? '가족력:있음' : ''}
                                </span>
                            </p>
                            <p className="text-sm font-medium text-gray-500">{data.disease.name_ko}</p>
                        </div>
                    </div>

                    {/* 1-2. 저장 폴더/날짜 정보 */}
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

                {/* 우측: 위험도 및 버튼 */}
                <div className="ml-2 flex flex-col items-end flex-shrink-0">
                    {/* AI 위험도 */}
                    <div className="text-xs font-semibold text-right mb-1">
                        <p className="text-gray-500">- AI -</p>
                        <p className="text-red-600 font-bold">{data.risk_level}</p>
                    </div>
                    {/* 의사 소견 위험도 (있을 경우) */}
                    {hasDoctorNote && (
                        <div className="text-xs font-semibold text-right mb-3">
                            <p className="text-gray-500">- 의사 -</p>
                            <p className={riskColor}>{finalRiskLevel}</p>
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

            {/* 하단: 최종 소견 */}
            <div className="mt-4 pt-3 border-t border-gray-100">
                {/* 부가 정보 태그 (더미: 실제 데이터 필드로 교체 필요) */}
                <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-700">만 45세</span>
                    <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">상처로 인한 감염(예)</span>
                    <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">통증(심함)</span>
                    <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">가려움(보통)</span>
                </div>

                {/* 최종 소견 */}
                <div className={`bg-indigo-50 p-2 rounded`}>
                     <p className={`text-xs font-medium mb-1 text-indigo-700 flex items-center`}>
                        <UserMdIcon className="mr-1 w-3 h-3" /> 최종 소견
                    </p>
                    <p className="text-xs text-gray-700 line-clamp-2">
                        {hasDoctorNote
                            ? data.followup_check!.doctor_note || '의사 소견이 아직 작성되지 않았습니다.'
                            : data.vlm_analysis_text || 'AI 분석 결과 텍스트만 있습니다.'}
                    </p>
                </div>
            </div>
        </div>
    );
}

// -----------------------------------------------------------
// 🔴 환자 뷰 카드 렌더링 (isDoctorView가 false일 때) (기존 로직 유지)
// -----------------------------------------------------------
return (
    <div className={`p-4 border rounded-lg shadow-sm w-80 flex-shrink-0 bg-white ${isAttentionNeeded ? 'border-red-400' : 'border-gray-200'}`}>
        <div className="flex justify-between items-start">
            <div className="flex flex-col flex-grow">
                {/* ... (환자 뷰의 이미지 및 병변 정보) ... */}
            </div>

            <div className="ml-2 flex flex-col items-end">
                {/* ... (환자 뷰의 위험도 및 버튼) ... */}
            </div>
        </div>
    </div>
);
};


// --- [보조 함수] ABCDE 항목 렌더링 (제거됨) ---
/*
const renderABCDEItem = (key: string, title: string, description: string) => (
  <div key={key} className="p-3 bg-white border rounded-lg shadow-sm">
    <p className="text-md font-semibold text-gray-800 mb-1">{title}</p>
    <p className="text-sm text-gray-600">{description}</p>
  </div>
);
*/


// -----------------------------------
// --- [메인 컴포넌트] DoctorMainPage ---
// -----------------------------------

const DoctorMainPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DoctorDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔴 API 호출 로직
  useEffect(() => {
    const fetchDoctorData = async () => {
        // 💡 백엔드 DRF API URL: 현재 로그인된 의사(doctors.uid_id)에게 필요한 대시보드 데이터를 가져옴
        const API_URL = 'api/dashboard/doctor/main/';

        try {
// 1. 토큰 가져오기 (주석 해제 및 확인)
                const token = localStorage.getItem('accessToken');
                if (!token) {
                    // 💡 토큰이 없으면 에러를 설정하고 함수 종료
                    setError('인증 토큰이 없습니다. 로그인이 필요합니다.');
                    setIsLoading(false);
                    return; // 함수 즉시 종료
                }

                const response = await axios.get<DoctorDashboardData>(API_URL, {
                    headers: {
                        // 2. Authorization 헤더에 Bearer 토큰 추가 (주석 해제)
                        Authorization: `Bearer ${token}`,
                    },
                });

                setData(response.data);

        } catch (err) {
            console.error("Failed to fetch doctor dashboard data:", err);
            setError('의사 대시보드 데이터를 불러오는 데 실패했습니다. 서버 상태 및 인증을 확인하세요.');
        } finally {
            setIsLoading(false);
        }
    };

    fetchDoctorData();
  }, []);


  // 로딩 및 에러 처리 UI
  if (isLoading) {
    return <div className="p-4 text-center text-lg">의사 대시보드 데이터를 불러오는 중...</div>;
  }

  if (error || !data) {
    return <div className="p-4 text-center text-red-600 text-lg">{error || '데이터 로드 오류'}</div>;
  }

  const summary = data.summary;
  const history = data.history;

  // 소견 작성이 필요한 항목 (AI 위험도가 '높음'이거나, 소견 요청 중인 경우)
  const attentionHistory = history.filter(item =>
    item.risk_level === '높음' || item.followup_check?.current_status === '요청중'
  );

  // 진단 내역 전체보기 버튼 클릭 핸들러
  const handleViewAllHistory = () => {
    navigate('/doctor/dashboard/all');
  };

  return (
    <div className="p-1 space-y-3">

      {/* 1. 상단 요약 및 전체보기 버튼 */}
       <section>
        <div className="flex justify-between items-center mb-3 p-2 bg-gray-50 rounded-md shadow-inner">
          <div className="text-sm font-medium text-gray-700 flex items-center space-x-4">
            <span className="flex items-center">
              <CheckCircleIcon className="text-blue-500 mr-1 w-4 h-4" />
              {/* 🔴 total_count -> total_assigned_count로 변경 */}
              전체 환부 {summary.total_assigned_count}건
            </span>
            <span className="flex items-center text-red-600 font-bold">
              <ExclamationTriangleIcon className="mr-1 w-4 h-4" />
              {/* 🔴 attention_count -> immediate_attention_count로 변경 */}
              소견 요청 {summary.immediate_attention_count}건
            </span>
          </div>
          <button onClick={handleViewAllHistory} className="flex items-center text-sm text-blue-600 font-medium hover:text-blue-800">
            진단 내역 전체보기 <ChevronRightIcon className="ml-1 w-3 h-3" />
          </button>
        </div>

        {/* 2. 소견 작성 및 확인 대기 진단 내역 */}
        <h3 className="text-lg font-bold mb-3">소견 작성 및 확인 대기 진단 내역 (총 {attentionHistory.length}건)</h3>
        <div className="flex space-x-4 overflow-x-scroll pb-3 scrollbar-hide">
          {attentionHistory.length > 0 ? (
            attentionHistory.map(item => (
              <DiagnosisCard
                  key={item.id}
                  data={item}
                  isDoctorView={true}
                  patientName={`환자 No.${item.id}`}
                  hasFamilyHistory={false}
              />
            ))
          ) : (
            <p className="text-gray-500 p-4 bg-white rounded-lg shadow-sm">
              현재 소견 작성 대기 또는 확인 대기 중인 진단 내역이 없습니다.
            </p>
          )}
        </div>
      </section>

    </div>
  );
};

export default DoctorMainPage;