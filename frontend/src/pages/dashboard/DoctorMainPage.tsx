// src/pages/dashboard/DoctorMainPage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChevronRight, FaChevronLeft, FaExclamationTriangle, FaCheckCircle, FaUserMd, FaMars, FaVenus } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';

// ✅ 이미지 URL 처리 함수
const normalizeHost = (url: string) =>
  url.replace(/^http:\/\/(?:django|project_django)(?::\d+)?/i, API_BASE_URL);

const resolveMediaUrl = (rawPath?: string) => {
  if (!rawPath) return '';
  let path = rawPath.replace(/\\/g, '/');

  if (/^https?:\/\//i.test(path)) return normalizeHost(path);
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  if (path.startsWith('media/')) return `${API_BASE_URL}/${path}`;

  if (path.includes('/media/')) {
    const parts = path.split('/media/');
    if (parts.length > 1) {
      return `${API_BASE_URL}/media/${parts[parts.length - 1]}`;
    }
  }

  return `${API_BASE_URL}/media/${path}`;
};

// -----------------------------------
// 🔴 데이터 타입 정의 🔴
// -----------------------------------
interface PatientData {
  name: string;
  calculated_age: number | null;
  family_history: string | null;
}

interface FollowUpCheckData {
  current_status: '요청중' | '확인 완료';
  doctor_risk_level: '소견 대기' | '즉시 주의' | '경과 관찰' | '정상';
  doctor_note: string | null;
  last_updated_at?: string;
}

interface PhotoData {
  body_part: string;
  folder_name: string;
  upload_storage_path: string;
  capture_date: string;
  onset_date: string | null;
  symptoms_itch: string | null;
  symptoms_pain: string | null;
  symptoms_infection: string | null;
  meta_sex?: string | null;
}

interface DiseaseData {
  name_ko: string;
  name_en?: string;
}

interface DiagnosisResult {
  id: number;
  patient: PatientData;
  photo: PhotoData;
  disease: DiseaseData;
  analysis_date: string;
  risk_level: '높음' | '보통' | '낮음';
  vlm_analysis_text: string | null;
  followup_check: FollowUpCheckData | null;
}

interface DoctorSummaryData {
  total_assigned_count: number;
  immediate_attention_count: number;
}

interface DoctorDashboardData {
  summary: DoctorSummaryData;
  history: DiagnosisResult[];
}

// -----------------------------------
// 🔴 아이콘 컴포넌트 래퍼 🔴
// -----------------------------------
type IconCmp = React.FC<IconBaseProps>;
const UserMdIcon: IconCmp = (props) => <FaUserMd {...props} />;
const ChevronRightIcon: IconCmp = (props) => <FaChevronRight {...props} />;
const ChevronLeftIcon: IconCmp = (props) => <FaChevronLeft {...props} />;
const ExclamationTriangleIcon: IconCmp = (props) => <FaExclamationTriangle {...props} />;
const CheckCircleIcon: IconCmp = (props) => <FaCheckCircle {...props} />;
const MarsIcon: IconCmp = (props: IconBaseProps) => <FaMars {...props} />;
const VenusIcon: IconCmp = (props: IconBaseProps) => <FaVenus {...props} />;

// -----------------------------------
// 🔴 환자 카드 컴포넌트 🔴
// -----------------------------------
interface PatientCardProps {
  data: DiagnosisResult;
}

const PatientCard: React.FC<PatientCardProps> = ({ data }) => {
  const navigate = useNavigate();

  const handleViewOpinion = () => {
    navigate(`/diagnosis/detail/${data.id}`);
  };

  const hasDoctorNote = data.followup_check && 
    data.followup_check.doctor_note && 
    data.followup_check.doctor_risk_level !== '소견 대기';

  const finalRiskLevel = hasDoctorNote
    ? data.followup_check!.doctor_risk_level
    : data.risk_level;

  const isAttentionNeeded = finalRiskLevel === '즉시 주의' || finalRiskLevel === '높음';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  // 증상 태그 생성 (신체부위는 제외)
  const symptomTags = [];
  if (data.photo.symptoms_infection === '예' || data.photo.symptoms_infection === '있음') {
    symptomTags.push({ text: `상처로 인한 감염(예)`, color: 'bg-red-100 text-red-700' });
  }
  if (data.photo.symptoms_pain) {
    const painLevel = data.photo.symptoms_pain === '심함' ? '심함' : data.photo.symptoms_pain;
    symptomTags.push({ text: `통증(${painLevel})`, color: 'bg-red-100 text-red-700' });
  }
  if (data.photo.symptoms_itch) {
    const itchLevel = data.photo.symptoms_itch === '보통' ? '보통' : data.photo.symptoms_itch;
    symptomTags.push({ text: `가려움(${itchLevel})`, color: 'bg-yellow-100 text-yellow-700' });
  }
  
  // 가족력 태그 (Y/N, yes/no, 있음/없음, 예/아니오 등 다양한 형식 처리)
  const hasFamilyHistory = data.patient.family_history && (
    data.patient.family_history === '있음' || 
    data.patient.family_history === '예' ||
    data.patient.family_history.toUpperCase() === 'Y' ||
    data.patient.family_history.toLowerCase() === 'yes' ||
    data.patient.family_history === '1' ||
    data.patient.family_history === 'true'
  );
  const familyHistoryText = hasFamilyHistory ? '있음' : '없음';
  const familyHistoryColor = hasFamilyHistory 
    ? 'bg-red-100 text-red-700' 
    : 'bg-gray-200 text-gray-700';
  
  // 발병시기 태그
  const onsetTag = data.photo.onset_date ? { text: `발병 시기(${data.photo.onset_date})`, color: 'bg-gray-200 text-gray-700' } : null;

  // 성별 아이콘 (photo.meta_sex 또는 기본값 사용)
  const isFemale = data.photo.meta_sex && (
    data.photo.meta_sex.toLowerCase() === '여성' || 
    data.photo.meta_sex.toUpperCase() === 'F' || 
    data.photo.meta_sex.toLowerCase() === 'female' ||
    data.photo.meta_sex.toLowerCase() === '여'
  );
  const genderIcon = isFemale 
    ? <VenusIcon className="text-pink-500" size={14} />
    : <MarsIcon className="text-blue-500" size={14} />;

  return (
    <div className={`p-4 border rounded-lg shadow-sm bg-white mb-4 ${isAttentionNeeded ? 'border-red-400 shadow-red-100' : 'border-gray-200'}`}>
      <div className="flex gap-4">
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

        {/* 중간: 환자 정보 */}
        <div className="flex-1 min-w-0">
          <div className="mb-2">
            <div className="flex items-center gap-1 mb-1">
              {genderIcon}
              <span className="text-lg font-bold text-gray-900">{data.patient.name}</span>
            </div>
          </div>
          
          <p className="text-base font-semibold text-gray-800 mb-2">{data.disease.name_ko}</p>
          {data.photo.body_part && (
            <p className="text-sm text-gray-600">위치: {data.photo.body_part}</p>
          )}
        </div>

        {/* 오른쪽: 위험도 및 버튼 */}
        <div className="flex flex-col items-end flex-shrink-0">
          <div className="text-center mb-3">
            <div className="text-xs mb-1">
              <span className="text-gray-500">- AI -</span>
              <p className={`font-semibold ${data.risk_level === '높음' ? 'text-red-600' : data.risk_level === '보통' ? 'text-yellow-600' : 'text-green-600'}`}>
                {data.risk_level}
              </p>
            </div>
            {hasDoctorNote && (
              <div className="text-xs mt-2">
                <span className="text-gray-500">- 의사 -</span>
                <p className={`font-semibold ${finalRiskLevel === '즉시 주의' ? 'text-red-600' : 'text-yellow-600'}`}>
                  {finalRiskLevel}
                </p>
              </div>
            )}
          </div>
          
          <button
            onClick={handleViewOpinion}
            className="py-1.5 px-3 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition duration-150"
          >
            소견 열람
          </button>
        </div>
      </div>

      {/* 날짜 정보 (선 위) */}
      <div className="mt-3 mb-3">
        <div className="text-xs text-gray-600 space-y-1 pl-8">
          <p>최초 생성 일자: {formatDate(data.photo.capture_date)}</p>
          <p>마지막 수정 일자: {formatDate(data.analysis_date)}</p>
        </div>
      </div>

      {/* 하단: 나이, 가족력, 발병시기, 증상 태그 (선 아래) */}
      <div className="pt-3 border-t border-gray-200">
        <div className="flex flex-wrap gap-2">
          {/* 나이 태그 */}
          {data.patient.calculated_age && (
            <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-700">
              만 {data.patient.calculated_age}세
            </span>
          )}
          
          {/* 가족력 태그 */}
          <span className={`px-2 py-1 text-xs rounded-full ${familyHistoryColor}`}>
            가족력({familyHistoryText})
          </span>
          
          {/* 발병 시기 태그 */}
          {onsetTag && (
            <span className={`px-2 py-1 text-xs rounded-full ${onsetTag.color}`}>
              {onsetTag.text}
            </span>
          )}
          
          {/* 증상 태그 */}
          {symptomTags.map((tag, idx) => (
            <span key={idx} className={`px-2 py-1 text-xs rounded-full ${tag.color}`}>
              {tag.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// -----------------------------------
// --- [메인 컴포넌트] DoctorMainPage ---
// -----------------------------------

const DoctorMainPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DoctorDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'attention' | 'needOpinion'>('attention');
  const [currentPage, setCurrentPage] = useState(0);

  // 🔴 API 호출 로직
  useEffect(() => {
    const fetchDoctorData = async () => {
      const API_URL = '/api/dashboard/doctor/main/';

      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          setError('인증 토큰이 없습니다. 로그인이 필요합니다.');
          setIsLoading(false);
          return;
        }

        const response = await axios.get<DoctorDashboardData>(API_URL, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setData(response.data);
      } catch (err: any) {
        console.error("Failed to fetch doctor dashboard data:", err);

        if (err.response) {
          console.error("Axios error response status:", err.response.status);
          console.error("Axios error response data:", err.response.data);
        }

        const errorStatus = err.response?.status;

        if (errorStatus === 403) {
          navigate('/dashboard/main');
          return;
        }

        if (errorStatus === 401) {
          setError('세션이 만료되었거나 인증에 실패했습니다. 다시 로그인해주세요.');
          navigate('/login');
          return;
        }

        setError('의사 대시보드 데이터를 불러오는 데 실패했습니다. 서버 상태 및 인증을 확인하세요.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDoctorData();
  }, [navigate]);

  // 탭 변경 시 페이지 초기화 (early return 이전에 호출되어야 함)
  useEffect(() => {
    setCurrentPage(0);
  }, [activeTab]);

  // 로딩 및 에러 처리 UI
  if (isLoading) {
    return <div className="p-4 text-center text-lg">의사 대시보드 데이터를 불러오는 중...</div>;
  }

  if (error || !data) {
    return <div className="p-4 text-center text-red-600 text-lg">{error || '데이터 로드 오류'}</div>;
  }

  const summary = data.summary;
  const history = data.history;

  // 주의가 필요한 환자 (즉시 주의 또는 높음 위험도)
  const attentionPatients = history.filter((item: DiagnosisResult) => {
    const finalRisk = item.followup_check?.doctor_risk_level === '즉시 주의' || 
                     item.risk_level === '높음';
    return finalRisk;
  });

  // 소견 작성이 필요한 환자 (소견이 없거나 소견 대기 상태)
  const needOpinionPatients = history.filter((item: DiagnosisResult) => {
    const hasOpinion = item.followup_check && 
                      item.followup_check.doctor_note && 
                      item.followup_check.doctor_risk_level !== '소견 대기';
    return !hasOpinion;
  });

  // 소견 작성 완료 건수 계산
  const completedOpinions = history.filter((item: DiagnosisResult) => {
    return item.followup_check && 
           item.followup_check.doctor_note && 
           item.followup_check.doctor_risk_level !== '소견 대기';
  }).length;

  const handleViewAllPatients = () => {
    navigate('/dashboard/doctor/history');
  };

  const displayedPatients = activeTab === 'attention' ? attentionPatients : needOpinionPatients;

  // 페이지네이션 적용 여부 (3개 이상일 때만)
  const shouldUsePagination = displayedPatients.length >= 3;
  
  // currentPage가 범위를 벗어나지 않도록 보정
  const safeCurrentPage = Math.min(currentPage, Math.max(0, displayedPatients.length - 1));
  const currentPatient = shouldUsePagination && displayedPatients.length > 0 
    ? displayedPatients[safeCurrentPage] 
    : null;
  
  const handlePrevPage = () => {
    if (safeCurrentPage > 0) {
      setCurrentPage(safeCurrentPage - 1);
    }
  };
  
  const handleNextPage = () => {
    if (safeCurrentPage < displayedPatients.length - 1) {
      setCurrentPage(safeCurrentPage + 1);
    }
  };

  return (
    <div className="p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white min-h-screen">
      {/* 1. 상단 요약 카드 */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-white py-3 px-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-3xl font-bold text-blue-600 mb-1 text-center">{summary.total_assigned_count}</div>
          <div className="text-xs text-gray-600 text-center">전체 환자</div>
        </div>
        <div className="bg-white py-3 px-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-3xl font-bold text-green-600 mb-1 text-center">{completedOpinions}</div>
          <div className="text-xs text-gray-600 text-center">소견 작성 완료</div>
        </div>
      </section>

      {/* 2. 탭 네비게이션 */}
      <section>
        <div className="flex gap-4 border-b border-gray-200 mb-3">
          <button
            onClick={() => setActiveTab('attention')}
            className={`pb-2 px-2 text-sm font-medium ${
              activeTab === 'attention'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            주의가 필요한 내 환자
          </button>
          <button
            onClick={() => setActiveTab('needOpinion')}
            className={`pb-2 px-2 text-xs font-medium ${
              activeTab === 'needOpinion'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-red-600 hover:text-red-700'
            }`}
          >
            소견작성 필요 {needOpinionPatients.length > 0 && `+${needOpinionPatients.length}건`}
          </button>
        </div>
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleViewAllPatients}
            className="text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center"
          >
            내 환자 전체보기 <ChevronRightIcon className="ml-1" size={12} />
          </button>
        </div>

        {/* 3. 환자 카드 리스트 */}
        <div className="space-y-0">
          {displayedPatients.length > 0 ? (
            <>
              {shouldUsePagination ? (
                // 페이지네이션 모드 (3개 이상일 때)
                <div className="relative">
                  {currentPatient && (
                    <>
                      {/* 환자 카드 */}
                      <PatientCard key={currentPatient.id} data={currentPatient} />
                      
                      {/* 오버레이 네비게이션 버튼 */}
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
                          disabled={safeCurrentPage === displayedPatients.length - 1}
                          className={`pointer-events-auto p-1.5 rounded-full bg-white/80 hover:bg-white shadow-md transition-all ${
                            safeCurrentPage === displayedPatients.length - 1
                              ? 'opacity-30 cursor-not-allowed'
                              : 'opacity-100 hover:scale-110'
                          }`}
                        >
                          <ChevronRightIcon size={18} className="text-gray-700" />
                        </button>
                      </div>
                      
                      {/* 페이지 인디케이터 (카드 아래 중앙) */}
                      <div className="flex items-center justify-center gap-2 mt-4">
                        {displayedPatients.map((_, index) => (
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
                // 일반 모드 (3개 미만일 때)
                displayedPatients.map((item: DiagnosisResult) => (
                  <PatientCard key={item.id} data={item} />
                ))
              )}
            </>
          ) : (
            <div className="p-8 bg-white rounded-lg shadow-sm border border-gray-200 text-center text-gray-500">
              {activeTab === 'attention'
                ? '주의가 필요한 환자가 없습니다.'
                : '소견 작성이 필요한 환자가 없습니다.'}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default DoctorMainPage;
