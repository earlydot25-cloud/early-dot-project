import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCamera, FaChevronRight, FaExclamationTriangle, FaCheckCircle, FaUserMd } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons';
// 💡 axios 임포트 (프로젝트에 axios가 설치되어 있어야 합니다)
import axios from 'axios';

// -----------------------------------
// 🔴 데이터 타입 정의 (백엔드 DRF 시리얼라이저 구조 반영) 🔴
// -----------------------------------
interface FollowUpCheckData {
  current_status: '요청중' | '확인 완료';
  doctor_risk_level: '소견 대기' | '즉시 주의' | '경과 관찰' | '정상';
  doctor_note: string | null;
}
interface PhotoData {
  body_part: string;
  folder_name: string;
  storage_path: string;
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
  risk_level: '높음' | '보통' | '낮음' | '정상';
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
// -----------------------------------


// -----------------------------------
// 🔴 TS2786 에러 해결을 위한 타입 안전 래퍼 추가 🔴
// -----------------------------------
type IconCmp = React.FC<IconBaseProps>;
const UserMdIcon: IconCmp = (props) => React.createElement(FaUserMd as any, props);
const CameraIcon: IconCmp = (props) => React.createElement(FaCamera as any, props);
const ChevronRightIcon: IconCmp = (props) => React.createElement(FaChevronRight as any, props);
const ExclamationTriangleIcon: IconCmp = (props) => React.createElement(FaExclamationTriangle as any, props);
const CheckCircleIcon: IconCmp = (props) => React.createElement(FaCheckCircle as any, props);
// -----------------------------------


// --- [컴포넌트] 진단 내역 카드 ---
interface DiagnosisCardProps {
  data: DiagnosisResult; // 🔴 실제 데이터 타입 사용
}

const DiagnosisCard: React.FC<DiagnosisCardProps> = ({ data }) => {
  // 🔴 API 응답 데이터로 로직 수정
  const hasDoctorNote = data.followup_check && data.followup_check.doctor_note && data.followup_check.doctor_risk_level !== '소견 대기';
  const isRequesting = data.followup_check && data.followup_check.current_status === '요청중' && !hasDoctorNote;

  // 최종 위험도 결정 (의사 소견이 있으면 의사 소견 위험도 사용)
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
    riskDisplay = `${riskLabel} - 정상`;
    riskColor = 'text-green-600';
  }

  // 날짜 포맷팅 (YYYY-MM-DDT... 형식 가정)
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('ko-KR');

  // UI 이미지와 유사하게 구조화
  return (
    <div className={`p-4 border rounded-lg shadow-sm w-80 flex-shrink-0 bg-white ${isAttentionNeeded ? 'border-red-400' : 'border-gray-200'}`}>
      <div className="flex justify-between items-start">
        {/* 좌측: 환부 이미지 및 기본 정보 */}
        <div className="flex">
          {/* 환부 이미지 Placeholder */}
          <div className="w-16 h-16 bg-yellow-300 rounded mr-3 flex items-center justify-center text-xs font-bold text-gray-800">
            {/* 🔴 data.photo.storage_path를 사용하여 이미지 렌더링 예정 */}
            Lesion Image
          </div>

          <div className="text-sm">
            {/* AI 예측 병변 */}
            <p className="text-xs font-medium text-gray-500">AI 예측 병변</p>
            <p className="text-lg font-bold text-gray-900 leading-tight">{data.disease.name_ko}</p>

            {/* 저장 폴더명 등 */}
            <div className="text-xs text-gray-700 space-y-0.5 mt-2">
                <p>저장 폴더: {data.photo.folder_name}</p>
                <p>위치: {data.photo.body_part}</p>
                <p>최초 생성: {formatDate(data.photo.capture_date)}</p>
                <p>마지막 수정: {formatDate(data.analysis_date)}</p>
            </div>
          </div>
        </div>

        {/* 우측: 위험도 및 버튼 */}
        <div className="ml-2 flex flex-col items-end">
          <div className="text-xs font-semibold text-right mb-2">
            {riskDisplay.split(' - ').map((line, index) => (
              <p key={index} className={index === 1 ? riskColor : 'text-gray-500'}>
                {line}
              </p>
            ))}
          </div>

          <button className="py-2 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition duration-150">
            {isRequesting ? '요청 처리 대기' : '결과 열람'}
          </button>
        </div>
      </div>

      {/* 하단: 의사 소견 영역 / AI 분석 결과 (요청 사항 반영) */}
      <div className={`mt-4 pt-3 border-t border-gray-100 ${hasDoctorNote ? 'bg-indigo-50 p-2 rounded' : ''}`}>
        <p className={`text-xs font-medium mb-1 ${hasDoctorNote ? 'text-indigo-700 flex items-center' : 'text-gray-700'}`}>
            {hasDoctorNote ? <UserMdIcon className="mr-1" /> : 'AI 분석 결과'}
        </p>
        <p className="text-xs text-gray-700 line-clamp-2">
            {hasDoctorNote
                ? data.followup_check!.doctor_note || '의사 소견이 아직 작성되지 않았습니다.'
                : data.vlm_analysis_text || 'AI 분석 결과 텍스트가 없습니다.'}
        </p>
      </div>

      {/* 의사 소견 대기 상태 (별도로 표시할 필요 없음. 위에서 '요청 처리 대기' 버튼으로 대체됨) */}
    </div>
  );
};


// --- [보조 함수] ABCDE 항목 렌더링 ---
const renderABCDEItem = (key: string, title: string, description: string) => (
  <div key={key} className="p-3 bg-white border rounded-lg shadow-sm">
    <p className="text-md font-semibold text-gray-800 mb-1">{title}</p>
    <p className="text-sm text-gray-600">{description}</p>
  </div>
);


// --- [메인 컴포넌트] MainPage ---

const MainPage: React.FC = () => {
  const navigate = useNavigate();
  // 🔴 API 응답을 저장할 상태 정의
  const [data, setData] = useState<MainDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔴 API 호출 로직 (useEffect)
  useEffect(() => {
    const fetchMainData = async () => {
      // 💡 백엔드 URL을 정확히 맞춰주세요. (예: process.env.REACT_APP_API_BASE_URL + '/dashboard/main/')
      const API_URL = '/api/dashboard/main/';

      try {
        const response = await axios.get<MainDashboardData>(API_URL, {
            // 💡 인증 토큰 전송 설정 (예시: localStorage에서 토큰 가져오기)
            headers: {
                Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
        });

        setData(response.data);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError('데이터를 불러오는 데 실패했습니다. 서버 상태를 확인하세요.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMainData();
  }, []); // 컴포넌트 마운트 시 한 번만 실행


  // 로딩 및 에러 처리 UI
  if (isLoading) {
    return <div className="p-4 text-center text-lg">데이터를 불러오는 중...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-600 text-lg">{error}</div>;
  }

  // 데이터가 성공적으로 로드되면 렌더링
  const summary = data!.summary;
  const history = data!.history;


  // AI 진단 촬영 안내 버튼 클릭 핸들러
  const handleDiagnosisClick = () => {
    navigate('/diagnosis');
  };

  // 진단 내역 전체보기 버튼 클릭 핸들러
  const handleViewAllHistory = () => {
    navigate('/dashboard');
  };

  return (
    <div className="p-4 space-y-6">

      {/* 1. AI 진단 사용 안내 */}
      <section className="p-4 bg-blue-50 border-l-4 border-blue-600 rounded-lg shadow-sm">
        <h2 className="text-lg font-bold text-blue-800 mb-2">AI 진단 사용 안내</h2>
        <p className="text-sm text-gray-700 mb-4">
          'EARLY-DOT' AI는 **"AI 예측 병변 및 임상 데이터"**를 기반으로 훈련되었으며, 병변의 형태, 크기, 색상 등의 정보를 종합적으로 분석하여 위험도를 예측합니다.
        </p>
        <button
          onClick={handleDiagnosisClick}
          className="w-full py-2 bg-blue-600 text-white font-semibold rounded-md flex items-center justify-center hover:bg-blue-700 transition duration-150"
        >
          <CameraIcon className="mr-2" /> 환부 촬영 안내 버튼
        </button>
      </section>

      {/* 2. AI 진단 내역 상단 고정 및 요약 */}
      <section>
        {/* 상단 요약 (개수, 주의 개수, 전체보기) */}
        <div className="flex justify-between items-center mb-3 p-2 bg-gray-50 rounded-md shadow-inner">
          <div className="text-sm font-medium text-gray-700 flex items-center space-x-4">
            <span className="flex items-center">
              <CheckCircleIcon className="text-green-500 mr-1" /> 전체 {summary.total_count}건
            </span>
            <span className="flex items-center text-red-600 font-bold">
              <ExclamationTriangleIcon className="mr-1" /> 주의 {summary.attention_count}건
            </span>
          </div>
          <button onClick={handleViewAllHistory} className="flex items-center text-sm text-blue-600 font-medium hover:text-blue-800">
            진단 내역 전체보기 <ChevronRightIcon className="ml-1 text-xs" />
          </button>
        </div>

        {/* 진단 내역 카드 (옆으로 스크롤) */}
        <h3 className="text-lg font-bold mb-3">AI 진단 내역 (최근 {history.length}건)</h3>
        <div className="flex space-x-4 overflow-x-scroll pb-3 scrollbar-hide">
          {history.map(item => (
            <DiagnosisCard
                key={item.id}
                data={item}
            />
          ))}
          {history.length === 0 && (
            <p className="text-gray-500">아직 진단 내역이 없습니다. 새로운 진단을 시작하세요.</p>
          )}
        </div>
      </section>

      {/* 3. ABCDE 기법 설명 */}
      <section className="pt-4 border-t border-gray-200">
        <h3 className="text-lg font-bold mb-3">거울 앞 5분, 내 피부 직접 확인해보세요</h3>
        <p className="text-sm text-gray-700 mb-4">
          ABCDE 기법이란? 내 피부를 스스로 점검할 수 있는 5가지 기준입니다.
        </p>

        {/* ABCDE 설명 항목 */}
        <div className="space-y-3">
          {renderABCDEItem('A', 'A. 비대칭 (Asymmetry)', '환부 모양을 반으로 접었을 때 대칭인지 확인합니다. 비대칭일수록 악성일 가능성이 높습니다.')}
          {renderABCDEItem('B', 'B. 경계 (Border)', '경계선이 울퉁불퉁하거나 불규칙한지 확인합니다. 불규칙할수록 위험합니다.')}
          {renderABCDEItem('C', 'C. 색상 (Color)', '한 병변 내에 2가지 이상의 색상이 섞여 있는지 확인합니다. 색상 변화가 클수록 위험합니다.')}

          {/* D, E 기법 (사용자 관찰 유도) */}
          {renderABCDEItem(
            'D',
            'D. 크기 (Diameter)',
            '해당 환부 부위가 6mm 가 넘는지 직접 확인하세요. 6mm 이상일 경우 변화 속도를 기록하며 주의 깊은 관찰이 필요합니다.'
          )}
          {renderABCDEItem(
            'E',
            'E. 변화 (Evolving)',
            '해당 환부 부위가 최근 경계가 넓어지거나, 가려움, 통증, 출혈을 동반하는지 환자 스스로 관찰하여 변화를 기록하세요.'
          )}
        </div>
      </section>

    </div>
  );
};

export default MainPage;