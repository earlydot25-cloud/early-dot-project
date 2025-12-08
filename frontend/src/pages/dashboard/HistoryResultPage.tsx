import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '../../contexts/ToastContext';
import ImageZoomModal from '../../components/ImageZoomModal';
import { formatDateTime } from '../../utils/dateUtils';

// ------------------- Interface -------------------
interface Disease {
  name_ko: string;
  name_en: string;
  classification?: string;
  description?: string;
  recommendation?: string;
}

interface Photo {
  id: number;
  folder_name: string;
  file_name: string;
  upload_storage_path: string;
  body_part: string;
  symptoms_itch: string;
  symptoms_pain: string;
  symptoms_color: string;
  symptoms_infection: string;
  symptoms_blood: string;
  onset_date: string;
  meta_age: number;
  meta_sex: string;
  capture_date: string;
}

interface FollowUp {
  doctor_risk_level: string;
  doctor_note: string;
  current_status: string;
  last_updated_at?: string;
}

interface UserInfo {
  name: string;
  sex: string;
  age: number | null;
  family_history: string;
}

interface ResultDetail {
  id: number;
  analysis_date: string;
  risk_level: string;
  class_probs?: Record<string, number>;
  grad_cam_path: string;
  vlm_analysis_text: string | null;
  disease: Disease | null;
  photo: Photo;
  followup_check: FollowUp | null;
  user: UserInfo;
  doctor_uid?: number | null;  // 의사에게 할당된 경우에만 존재
  user_id?: number;  // 환자 Users.id
}

// 배포 환경에서는 /api 프록시 경로 사용
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';
const RISK_OPTIONS = ['소견 대기', '즉시 주의', '경과 관찰', '정상'] as const;
type RiskOption = typeof RISK_OPTIONS[number];

const normalizeHost = (url: string) =>
  url.replace(/^http:\/\/(?:django|project_django)(?::\d+)?/i, API_BASE_URL);

// ✅ 경로 보정 함수 - 이미지는 /media/ 경로로 직접 접근
const resolveMediaUrl = (rawPath?: string) => {
  if (!rawPath) return '';
  let path = rawPath.replace(/\\/g, '/');

  // 이미 완전한 URL이면 그대로 사용
  if (/^https?:\/\//i.test(path)) {
    const currentOrigin = window.location.origin;
    
    // 현재 호스트와 같은 도메인이면 그대로 사용 (프록시가 처리)
    if (path.startsWith(currentOrigin)) {
      return path;
    }
    
    // localhost나 127.0.0.1인 경우 현재 호스트로 변환
    if (path.includes('127.0.0.1:8000') || path.includes('localhost:8000')) {
      const mediaPath = path.replace(/^https?:\/\/[^\/]+/i, '');
      return `${currentOrigin}${mediaPath}`;
    }
    
    // ngrok URL이 포함되어 있으면 그대로 사용
    if (path.includes('ngrok')) {
      return path;
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
      // media 경로면 /media/로 변환
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

// 증상 심각도 순서 (심한 것부터)
const SYMPTOM_SEVERITY_ORDER: Record<string, number> = {
  '심각': 3,
  '있음': 2,
  '약간~보통': 1,
  '약간': 1,
  '보통': 1,
  '없음': 0,
};

const getSymptomSeverity = (value: string): number => {
  return SYMPTOM_SEVERITY_ORDER[value] ?? 1;
};

// ------------------- Component -------------------
const HistoryResultPage: React.FC = () => {
  const { resultId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [data, setData] = useState<ResultDetail | null>(null);
  const [showGradCam, setShowGradCam] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDoctor, setIsDoctor] = useState(false);
  const [doctorNote, setDoctorNote] = useState('');
  const [doctorRiskLevel, setDoctorRiskLevel] = useState<RiskOption>('소견 대기');
  const [isSavingFollowup, setIsSavingFollowup] = useState(false);
  const [followupMessage, setFollowupMessage] = useState<string | null>(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (!resultId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await axios.get<ResultDetail>(`/api/dashboard/records/${resultId}/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setData(response.data);
        console.log('ResultDetail data:', response.data);
        console.log('Has disease:', !!response.data.disease);
        console.log('Has followup_check:', !!response.data.followup_check);
      } catch (err: any) {
        console.error('Failed to fetch result detail:', err);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [resultId]);

  useEffect(() => {
    const isDoc = typeof window !== 'undefined' && localStorage.getItem('isDoctor') === '1';
    setIsDoctor(isDoc);
  }, []);

  useEffect(() => {
    if (data?.followup_check) {
      const risk = data.followup_check.doctor_risk_level;
      if (risk && RISK_OPTIONS.includes(risk as RiskOption)) {
        setDoctorRiskLevel(risk as RiskOption);
      } else {
        setDoctorRiskLevel('소견 대기');
      }
      setDoctorNote(data.followup_check.doctor_note || '');
    } else {
      setDoctorRiskLevel('소견 대기');
      setDoctorNote('');
    }
  }, [data?.followup_check]);

  const handleSaveFollowup = async () => {
    if (!data) return;
    try {
      setIsSavingFollowup(true);
      setFollowupMessage(null);
      const token = localStorage.getItem('accessToken');
      const response = await axios.patch(
        `/api/dashboard/records/${data.id}/followup/update/`,
        {
          doctor_note: doctorNote,
          doctor_risk_level: doctorRiskLevel,
          current_status: '확인 완료',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const updatedFollowup = response.data as FollowUp;
      setData((prev: ResultDetail | null) => (prev ? { ...prev, followup_check: updatedFollowup } : null));
      if (updatedFollowup.doctor_risk_level && RISK_OPTIONS.includes(updatedFollowup.doctor_risk_level as RiskOption)) {
        setDoctorRiskLevel(updatedFollowup.doctor_risk_level as RiskOption);
      }
      setDoctorNote(updatedFollowup.doctor_note || '');
      setFollowupMessage('전문의 소견이 저장되었습니다.');
      
      // 소견 저장 후 DoctorHistoryPage에 환자 목록 새로고침 이벤트 전달
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('doctor-opinion-saved'));
      }
    } catch (err: any) {
      console.error('Failed to save follow-up:', err);
      alert(err.response?.data?.error || err.response?.data?.message || '소견 저장에 실패했습니다.');
    } finally {
      setIsSavingFollowup(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full bg-white px-4 py-5">
        <div className="text-center text-gray-500 mt-10">데이터 불러오는 중...</div>
      </div>
    );
  }

  // URL에서 userId, folderName, resultId 추출 (의사용 URL 기반 라우팅)
  const pathParts = location.pathname.split('/');
  const isDoctorPath = location.pathname.includes('/doctor/');
  
  let userId: string | null = null;
  let folderNameFromPath: string | null = null;
  
  if (isDoctorPath) {
    // /dashboard/doctor/history/:userId/:folderName/:resultId 형식
    const historyIndex = pathParts.indexOf('history');
    if (historyIndex > -1 && pathParts.length > historyIndex + 3) {
      userId = pathParts[historyIndex + 1];
      folderNameFromPath = decodeURIComponent(pathParts[historyIndex + 2]);
    } else if (historyIndex > -1 && pathParts.length > historyIndex + 2) {
      // 기존 형식 호환: /dashboard/doctor/history/:folderName/:resultId?user=:userId
      folderNameFromPath = decodeURIComponent(pathParts[historyIndex + 1]);
      const searchParams = new URLSearchParams(location.search);
      userId = searchParams.get('user');
    }
  }

  // 뒤로가기 핸들러: 이전 페이지(기록 목록)로 이동
  const handleBack = () => {
    if (isDoctorPath && userId && folderNameFromPath && folderNameFromPath !== 'history') {
      // 의사용: 기록 목록 페이지로 이동
      navigate(`/dashboard/doctor/history/${userId}/${encodeURIComponent(folderNameFromPath)}`);
    } else {
      // 기본: 브라우저 뒤로가기
      navigate(-1);
    }
  };

  if (!data) {
    return (
      <div className="w-full bg-white px-4 py-5">
        <button
          onClick={handleBack}
          className="text-sm text-gray-600 mb-3 flex items-center gap-1 hover:text-black"
        >
          ← 뒤로가기
        </button>
        <div className="text-center text-gray-500 mt-10">데이터를 불러올 수 없습니다.</div>
      </div>
    );
  }

  // ✅ 안전한 URL 생성
  const originalUrl = data.photo && data.photo.upload_storage_path 
    ? resolveMediaUrl(data.photo.upload_storage_path) 
    : '';
  const gradcamUrl = data.grad_cam_path ? resolveMediaUrl(data.grad_cam_path) : '';

  // ✅ 위험도 판단
  const hasDoctorNote = data.followup_check && 
    data.followup_check.doctor_risk_level && 
    data.followup_check.doctor_risk_level !== '소견 대기';
  
  const aiRiskLevel = data.risk_level || '분석 대기';
  const doctorRiskLevelFromData = data.followup_check?.doctor_risk_level || '';
  
  // 위험한 경우 판단: 보통 이상 (보통, 중간, 높음, 즉시 주의)
  const isRiskHigh = aiRiskLevel === '높음' || aiRiskLevel === '즉시 주의' || 
                     aiRiskLevel === '중간' || aiRiskLevel === '보통' ||
                     doctorRiskLevelFromData === '즉시 주의' || doctorRiskLevelFromData === '경과 관찰';

  const finalRiskLevel = hasDoctorNote && data.followup_check
    ? data.followup_check.doctor_risk_level
    : aiRiskLevel;
  const riskSource = hasDoctorNote ? '의사' : (data.disease ? 'AI' : '대기');

  // 위험도 색상 스타일
  const riskColor =
    finalRiskLevel === '높음' || finalRiskLevel === '즉시 주의'
      ? 'text-red-600 bg-red-100 border-red-300'
      : finalRiskLevel === '중간' || finalRiskLevel === '보통' || finalRiskLevel === '경과 관찰'
      ? 'text-orange-600 bg-orange-100 border-orange-300'
      : finalRiskLevel === '분석 대기'
      ? 'text-gray-600 bg-gray-100 border-gray-300'
      : 'text-green-600 bg-green-100 border-green-300';

  // 모델 확신도 계산 (class_probs에서 최대값)
  const modelConfidence = data.class_probs 
    ? Math.max(...Object.values(data.class_probs).map(v => Number(v))) * 100 
    : null;

  // location.state에서 전달된 정보 사용
  const userName = location.state?.userName || data.user.name;
  const folderDisplay = location.state?.folderDisplay || data.photo.folder_name;
  const diseaseName = location.state?.diseaseName || data.disease?.name_ko || data.photo.file_name;

  const hasFollowup = !!data.followup_check;
  const doctorRiskDisplay = hasFollowup && data.followup_check?.doctor_risk_level
    ? data.followup_check.doctor_risk_level
    : '소견 대기';
  const doctorNoteDisplay = hasFollowup
    ? (data.followup_check?.doctor_note || '소견이 등록되지 않았습니다.')
    : '전문의 소견이 아직 입력되지 않았습니다. (자동 기본값)';
  const doctorUpdatedDate = hasFollowup && data.followup_check?.last_updated_at
    ? formatDateTime(data.followup_check.last_updated_at)
    : null;

  const handleDownloadPDF = async () => {
    if (!pdfRef.current || !data) return;
    
    try {
      // A4 용지 크기: 210mm x 297mm
      // 96 DPI 기준: 약 794px x 1123px
      // 여백을 고려하여 실제 콘텐츠 너비는 약 190mm (약 718px)
      const pdfWidthPx = 718; // 픽셀
      
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2, // 고해상도를 위해 scale 증가
        useCORS: true,
        logging: false,
        width: pdfWidthPx,
        windowWidth: pdfWidthPx,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 10; // 좌우 여백 10mm
      const contentWidth = pageWidth - (margin * 2); // 190mm
      
      // 이미지 높이 계산 (mm 단위)
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      const availableHeight = pageHeight - (margin * 2); // 상하 여백 제외 (277mm)
      
      // 한 페이지에 모두 들어가는지 확인
      if (imgHeight <= availableHeight) {
        // 한 페이지에 모두 들어감
        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeight);
      } else {
        // 여러 페이지로 나누기 (중복 없이 정확하게)
        const totalPages = Math.ceil(imgHeight / availableHeight);
        
        for (let i = 0; i < totalPages; i++) {
          if (i > 0) {
            pdf.addPage();
          }
          
          // 현재 페이지에 표시할 이미지 부분 계산
          const sourceY = (i * availableHeight * canvas.width / contentWidth); // 픽셀 기준
          const sourceHeight = Math.min(
            availableHeight * canvas.width / contentWidth,
            canvas.height - sourceY
          );
          
          // 임시 캔버스에 이미지의 해당 부분만 복사
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = sourceHeight;
          const ctx = tempCanvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(
              canvas,
              0, sourceY, // 소스 시작 위치 (픽셀)
              canvas.width, sourceHeight, // 소스 크기
              0, 0, // 대상 시작 위치
              canvas.width, sourceHeight // 대상 크기
            );
            
            const pageImgData = tempCanvas.toDataURL('image/png', 0.95);
            const pageImgHeight = (sourceHeight * contentWidth) / canvas.width;
            pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, pageImgHeight);
          }
        }
      }

      const fileName = `${data.user.name}_${data.disease?.name_ko || '진단결과'}_${formatDateTime(new Date().toISOString()).replace(' ', '_')}.pdf`;
      pdf.save(fileName);
      showSuccess('PDF 다운로드가 완료되었습니다.');
    } catch (error) {
      console.error('PDF 생성 실패:', error);
      showError('PDF 다운로드에 실패했습니다.');
    }
  };

  return (
    <div className="w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto bg-gray-50 min-h-screen px-4 py-5 pb-24">
      {/* 헤더: 폴더명 - 파일명 */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="text-sm font-bold text-gray-700 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
        >
          ← 뒤로가기
        </button>
        {data && (
          <button
            onClick={handleDownloadPDF}
            className="text-sm font-bold text-blue-700 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 hover:border-blue-400 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF 다운로드
          </button>
        )}
      </div>
      
      {/* 실제 화면 컨텐츠 */}
      <h1 className="text-lg font-bold text-gray-900 mb-4">
        {data.photo?.folder_name || ''} - {data.photo?.file_name || ''}
      </h1>

      {/* 주의 요망 배너 (위험한 경우만) */}
      {isRiskHigh && (
        <div className="bg-red-100 border-2 border-red-400 text-red-700 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="font-bold text-base">주의 요망</p>
          </div>
          <p className="text-sm">
            {hasDoctorNote 
              ? `전문의 최종 판정: ${doctorRiskLevelFromData}`
              : `AI 위험도: ${aiRiskLevel} 이상`}
          </p>
        </div>
      )}

      {/* AI 예측 진단 이미지 분석 */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-200">
        <h3 className="text-sm font-semibold mb-3 text-gray-900">AI 예측 진단 이미지 분석</h3>

        {/* 탭 버튼 (항상 표시) */}
        <div 
          className="flex justify-around mb-3 border-b border-gray-200" 
          style={{ 
            display: 'flex', 
            width: '100%', 
            minHeight: '44px',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1
          }}
        >
          <button
            className={`text-sm font-semibold pb-2 flex-1 ${
              !showGradCam
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500'
            }`}
            onClick={() => setShowGradCam(false)}
            style={{ 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              visibility: 'visible', 
              opacity: 1,
              minHeight: '40px',
              cursor: 'pointer'
            }}
          >
            털 제거 이미지
          </button>
          <button
            className={`text-sm font-semibold pb-2 flex-1 ${
              showGradCam
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500'
            }`}
            onClick={() => setShowGradCam(true)}
            style={{ 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              visibility: 'visible', 
              opacity: 1,
              minHeight: '40px',
              cursor: 'pointer'
            }}
          >
            AI GradCAM 분석
          </button>
        </div>

        {/* 이미지 표시 */}
        <div className="w-full bg-gray-100 rounded-lg overflow-hidden text-center" style={{ minHeight: '200px' }}>
          {originalUrl || gradcamUrl ? (
            <img
              src={showGradCam && gradcamUrl ? gradcamUrl : (originalUrl || '')}
              alt={showGradCam && gradcamUrl ? 'GradCAM 분석' : '원본 이미지'}
              className="w-full h-auto max-h-96 object-contain cursor-zoom-in"
              onClick={() => {
                const imageUrl = showGradCam && gradcamUrl ? gradcamUrl : (originalUrl || '');
                if (imageUrl) setZoomImageUrl(imageUrl);
              }}
              onError={(e) => {
                // GradCAM 이미지가 없거나 에러가 발생하면 원본 이미지로 대체
                const target = e.target as HTMLImageElement;
                if (showGradCam && gradcamUrl && originalUrl) {
                  target.src = originalUrl;
                } else {
                  target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E이미지 없음%3C/text%3E%3C/svg%3E';
                }
              }}
            />
          ) : (
            <div className="w-full h-64 flex items-center justify-center text-gray-500">
              이미지를 불러올 수 없습니다
            </div>
          )}
          <p className="text-gray-500 text-xs mt-2 pb-1">
            {showGradCam && gradcamUrl ? 'AI GradCAM 분석' : '털 제거 이미지'}
          </p>
        </div>
      </div>

      {/* AI 예측 진단명 */}
      {data.disease && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
          <p className="text-xs text-blue-600 font-semibold mb-1">AI 예측 진단명</p>
          <p className="font-bold text-base text-gray-900 mb-1">
            {data.disease.name_en}
          </p>
          <p className="text-sm text-gray-900">
            ({data.disease.name_ko})
          </p>
        </div>
      )}

      {/* AI 위험도 */}
      {data.disease && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-xs text-red-600 font-semibold mb-1">AI 위험도: {aiRiskLevel}</p>
          {modelConfidence !== null && (
            <p className="text-xs text-gray-900">
              모델 확신도: {modelConfidence.toFixed(1)}%
            </p>
          )}
        </div>
      )}

      {/* 분석 대기 상태 */}
      {!data.disease && (
        <div className="bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-200">
          <p className="text-sm font-semibold text-gray-900 mb-1">진단 상태</p>
          <p className="text-xs text-gray-600">
            AI 분석이 진행 중입니다. 잠시 후 다시 확인해주세요.
          </p>
        </div>
      )}

      {/* AI 진단 결과 (상세 확률 정보) */}
      {data.disease && data.class_probs && (
        <div className="bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-200">
          <p className="text-sm font-semibold mb-3 text-gray-900">AI 진단 결과</p>
          
          {/* 각 질병별 확률 */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">질병별 예측 확률</p>
            <div className="space-y-1.5">
              {Object.entries(data.class_probs)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([disease, prob]) => (
                  <div key={disease} className="flex justify-between items-center">
                    <span className="text-xs text-gray-700">{disease}</span>
                    <span className="text-xs font-semibold text-gray-900">
                      {((prob as number) * 100).toFixed(2)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* 요약 메시지 */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-700 leading-relaxed">
              <span className="font-semibold">{Object.entries(data.class_probs)
                .sort(([, a], [, b]) => (b as number) - (a as number))[0][0]}</span>
              {' '}가 {((Object.entries(data.class_probs)
                .sort(([, a], [, b]) => (b as number) - (a as number))[0][1] as number) * 100).toFixed(1)}% 확률로 예측되며,{' '}
              <span className="font-semibold">{data.risk_level}</span>으로 위험도가 예상됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 분석 대기 상태 (Results가 없을 때) */}
      {!data.disease && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-semibold text-gray-900 mb-1">진단 상태</p>
          <p className="text-xs text-gray-600">
              AI 분석이 진행 중입니다. 잠시 후 다시 확인해주세요.
            </p>
        </div>
      )}

      {/* 전문의 최종 소견 */}
      {data.disease && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 shadow-sm mb-4">
          <p className="text-sm font-bold text-red-600 mb-2">전문의 최종 소견</p>
          
          {data.followup_check ? (
            <>
              <p className="text-xs text-gray-700 mb-2 whitespace-pre-wrap">
                {data.followup_check.doctor_note || '소견이 등록되지 않았습니다.'}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-600">
                  최종 판정: <span className="font-semibold">{data.followup_check.doctor_risk_level}</span>
                </span>
                {data.followup_check.last_updated_at && (
                  <span className="text-xs text-gray-500">
                    업데이트일: {formatDateTime(data.followup_check.last_updated_at)}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-700 mb-2 whitespace-pre-wrap">
                전문의 소견이 아직 입력되지 않았습니다.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-600">
                  최종 판정: <span className="font-semibold">-</span>
                </span>
              </div>
            </>
          )}

          {/* 의사 소견 작성 섹션 (의사일 때 항상 표시) */}
          {isDoctor && (
            <div className={`${!isDoctor ? 'mt-4' : ''} bg-white rounded-lg border border-red-200 p-3 space-y-3`}>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <p className="text-sm font-bold text-red-600">전문의 소견 작성</p>
              </div>
              
              {/* 기존 소견이 있는 경우 표시 */}
              {hasFollowup && (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1">현재 소견</p>
                  <p className="text-xs text-gray-600 mb-2 whitespace-pre-wrap">
                    {data.followup_check?.doctor_note || '소견이 등록되지 않았습니다.'}
                  </p>
                  <p className="text-xs text-gray-500">
                    최종 판정: <span className="font-semibold">{data.followup_check?.doctor_risk_level || '소견 대기'}</span>
                    {doctorUpdatedDate && ` | 업데이트일: ${doctorUpdatedDate}`}
                  </p>
                </div>
              )}
              
              {/* 환자가 소견을 신청하지 않은 경우 (환자 전용) */}
              {!hasFollowup && !isDoctor && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-2 mb-2">
                  <p className="text-xs text-blue-700">
                    �� 환자가 아직 소견을 신청하지 않았지만, 바로 소견을 작성하고 저장할 수 있습니다.
                </p>
                </div>
              )}
              
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  최종 판정 <span className="text-red-500">*</span>
                </label>
                <select
                  value={doctorRiskLevel}
                  onChange={(e) => setDoctorRiskLevel(e.target.value as RiskOption)}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-red-300 focus:border-red-500"
                >
                  {RISK_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  소견 내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={doctorNote}
                  onChange={(e) => setDoctorNote(e.target.value)}
                  rows={5}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-red-300 focus:border-red-500 resize-none"
                  placeholder="환부 상태, 권장 조치, 추가 검사 필요 여부 등을 상세히 입력하세요."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {doctorNote.length}자 / 최소 10자 이상 권장
                </p>
              </div>
              
              <button
                onClick={handleSaveFollowup}
                disabled={isSavingFollowup || !doctorNote.trim() || doctorNote.trim().length < 10}
                className="w-full py-3 bg-red-600 text-white text-sm font-bold rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {isSavingFollowup ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    저장 중...
                  </span>
                ) : (
                  '전문의 소견 저장하기'
                )}
              </button>
              
              {followupMessage && (
                <div className="bg-green-50 border border-green-200 rounded-md p-2">
                  <p className="text-xs text-green-700 text-center font-medium">{followupMessage}</p>
                </div>
              )}
              
              {(!doctorNote.trim() || doctorNote.trim().length < 10) && (
                <p className="text-xs text-red-600 text-center">
                  소견 내용을 최소 10자 이상 입력해주세요.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 환자 기본 정보와 주요 증상 및 특이사항 */}
      <div className="space-y-4">
      {/* 환자 기본 정보 */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-sm font-semibold text-gray-900">환자 기본 정보</p>
          </div>
          <div className="space-y-0">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-xs text-gray-600">이름</span>
              <span className="text-xs text-gray-900 font-medium">{data.user.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-xs text-gray-600">나이 / 성별</span>
              <span className="text-xs text-gray-900 font-medium">
                {data.user.age ? `만 ${data.user.age}세` : '정보 없음'} / {data.user.sex || '모름'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-xs text-gray-600">환부 위치</span>
              <span className="text-xs text-gray-900 font-medium">
                {data.photo.body_part || '정보 없음'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-xs text-gray-600">가족력 유무</span>
              <span className="text-xs text-gray-900 font-medium">{data.user.family_history || '없음'}</span>
            </div>
          </div>
        </div>

        {/* 주요 증상 및 특이사항 */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-semibold text-gray-900">주요 증상 및 특이사항</p>
          </div>
          
          {data.photo.onset_date && (
            <p className="text-xs text-gray-700 mb-3">
              최근 발병 시점: {data.photo.onset_date}
            </p>
          )}
          
          <div className="flex flex-wrap gap-2">
            {data.photo.symptoms_blood && (
              <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                data.photo.symptoms_blood === '예' || data.photo.symptoms_blood === '있음' || data.photo.symptoms_blood === '심함'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                출혈({data.photo.symptoms_blood === '예' || data.photo.symptoms_blood === '있음' ? '예' : data.photo.symptoms_blood})
              </span>
            )}
            {data.photo.symptoms_color && (
              <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                getSymptomSeverity(data.photo.symptoms_color) >= 2
                  ? 'bg-red-100 text-red-700'
                  : getSymptomSeverity(data.photo.symptoms_color) === 1
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                크기 변화({data.photo.symptoms_color === '심함' ? '심함' : data.photo.symptoms_color})
              </span>
            )}
            {data.photo.symptoms_pain && (
              <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                getSymptomSeverity(data.photo.symptoms_pain) >= 2
                  ? 'bg-red-100 text-red-700'
                  : getSymptomSeverity(data.photo.symptoms_pain) === 1
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                통증 ({data.photo.symptoms_pain === '심함' ? '심함' : data.photo.symptoms_pain === '보통' ? '보통' : data.photo.symptoms_pain})
              </span>
            )}
            {data.photo.symptoms_itch && (
              <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                getSymptomSeverity(data.photo.symptoms_itch) >= 2
                  ? 'bg-red-100 text-red-700'
                  : getSymptomSeverity(data.photo.symptoms_itch) === 1
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                가려움({data.photo.symptoms_itch})
              </span>
            )}
            {data.photo.symptoms_infection && (
              <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                data.photo.symptoms_infection === '예' || data.photo.symptoms_infection === '있음'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                감염({data.photo.symptoms_infection === '예' || data.photo.symptoms_infection === '있음' ? '예' : data.photo.symptoms_infection})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 처리 히스토리 */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-semibold text-gray-900">처리 히스토리</p>
        </div>
        <div className="space-y-0">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-xs text-gray-600">최초 기록일</span>
            <span className="text-xs text-gray-900 font-medium">
              {data.photo.capture_date
                ? formatDateTime(data.photo.capture_date)
                : data.analysis_date
                ? formatDateTime(data.analysis_date)
                : '정보 없음'}
            </span>
          </div>
          {data.followup_check?.last_updated_at && (
            <div className="flex justify-between py-2">
              <span className="text-xs text-gray-600">전문의 최종 확인일</span>
              <span className="text-xs text-gray-900 font-medium">
                {formatDateTime(data.followup_check.last_updated_at)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 질환 상세 정보 (Results가 있을 때만) */}
      {data.disease && data.disease.description && (
        <div className="bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-semibold text-gray-900">질환 상세 정보</p>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-2">
            {data.disease.name_ko || data.disease.name_en}
          </p>
          <p className="text-xs text-gray-700 mb-2 whitespace-pre-wrap leading-relaxed">
            {data.disease.description}
          </p>
          {data.disease.recommendation && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-900 mb-1">권장사항</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                {data.disease.recommendation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* PDF 생성용 컨테이너 - A4 크기에 최적화 (화면 밖에 위치) */}
      <div 
        ref={pdfRef} 
        className="bg-white" 
        style={{ 
          width: '718px', // A4 콘텐츠 너비 (190mm = 약 718px)
          padding: '20px',
          fontSize: '14px',
          lineHeight: '1.6',
          position: 'absolute',
          left: '-9999px',
          top: '0',
        }}
      >
        {/* PDF용 헤더 */}
        <div className="mb-3">
          <h1 className="text-xl font-bold text-gray-900 mb-1">진단 결과 보고서</h1>
          <p className="text-sm text-gray-600 mb-1">
            {userName} &gt; {folderDisplay} &gt; {diseaseName}
          </p>
          <p className="text-xs text-gray-500">
            생성일: {formatDateTime(new Date().toISOString())}
          </p>
        </div>

        {/* 경고 문구 */}
        {data.followup_check?.doctor_risk_level === '즉시 주의' && (
          <div className="bg-red-100 border border-red-400 text-red-600 rounded-md p-2.5 text-sm mb-3 font-semibold">
            <span>주의: 전문의의 소견이 '즉시 주의' 상태입니다.</span>
          </div>
        )}

        {/* 이미지 섹션 - 원본과 GradCAM 나란히 배치 */}
        <div className="bg-white p-3 rounded-lg shadow-sm mb-3 border border-gray-200">
          <h3 className="text-base font-semibold mb-2 text-gray-900">
            {data.disease ? 'AI 예측 진단 및 이미지 분석' : '업로드된 이미지'}
          </h3>

          {/* 이미지들을 가로로 나란히 배치 */}
          <div className="flex gap-3">
            {/* 원본 이미지 */}
            {originalUrl && (
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-700 mb-1.5 text-center">털 제거 이미지</h4>
                <div className="w-full bg-gray-100 rounded-lg overflow-hidden text-center">
                  <img
                    src={originalUrl}
                    alt="원본 이미지"
                    className="w-full h-auto max-h-[240px] object-contain mx-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\"%3E%3Ctext x=\"50%25\" y=\"50%25\" text-anchor=\"middle\" dy=\".3em\"%3E이미지 없음%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
              </div>
            )}

            {/* GradCAM 이미지 */}
            {data.disease && gradcamUrl && (
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-700 mb-1.5 text-center">AI GradCAM 분석</h4>
                <div className="w-full bg-gray-100 rounded-lg overflow-hidden text-center">
                  <img
                    src={gradcamUrl}
                    alt="GradCAM 분석"
                    className="w-full h-auto max-h-[240px] object-contain mx-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\"%3E%3Ctext x=\"50%25\" y=\"50%25\" text-anchor=\"middle\" dy=\".3em\"%3E이미지 없음%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI 예측 진단명과 AI 위험도를 나란히 배치 */}
        {data.disease && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* AI 예측 진단명 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-600 font-semibold mb-1">AI 예측 진단명</p>
              <p className="font-bold text-lg text-gray-900 mb-1">
                {data.disease.name_en}
              </p>
              <p className="text-base text-gray-900">
                ({data.disease.name_ko})
              </p>
            </div>

            {/* AI 위험도 */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600 font-semibold mb-1">AI 위험도: {data.risk_level || '분석 대기'}</p>
              {data.class_probs && (
                <p className="text-base text-gray-900">
                  모델 확신도: {(Math.max(...Object.values(data.class_probs).map(v => Number(v))) * 100).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        )}

        {/* 전문의 최종 소견 (doctor_uid가 있는 경우에만 표시) */}
        {data.disease && data.doctor_uid !== null && data.doctor_uid !== undefined && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 shadow-sm mb-3">
            <p className="text-base font-bold text-red-600 mb-1.5">전문의 최종 소견</p>
            <p className="text-sm text-gray-700 mb-1.5 whitespace-pre-wrap">
              {doctorNoteDisplay}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">
                최종 판정: <span className="font-semibold">{doctorRiskDisplay}</span>
              </span>
              {doctorUpdatedDate && (
                <span className="text-sm text-gray-500">
                  업데이트일: {doctorUpdatedDate}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 환자 기본 정보와 주요 증상 및 특이사항을 나란히 배치 */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* 환자 기본 정보 */}
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
            <div className="mb-2">
              <p className="text-sm font-semibold text-gray-900">환자 기본 정보</p>
            </div>
            <div className="space-y-0">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-xs text-gray-600">이름</span>
                <span className="text-xs text-gray-900 font-medium">{data.user.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-xs text-gray-600">나이 / 성별</span>
                <span className="text-xs text-gray-900 font-medium">
                  {data.user.age ? `만 ${data.user.age}세` : '정보 없음'} / {data.user.sex || '모름'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-xs text-gray-600">환부 위치</span>
                <span className="text-xs text-gray-900 font-medium">
                  {data.photo.body_part || '정보 없음'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-xs text-gray-600">가족력 유무</span>
                <span className="text-xs text-gray-900 font-medium">{data.user.family_history || '없음'}</span>
              </div>
            </div>
          </div>

          {/* 주요 증상 및 특이사항 */}
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
            <div className="mb-2">
              <p className="text-sm font-semibold text-gray-900">주요 증상 및 특이사항</p>
            </div>
            
            {data.photo.onset_date && (
              <p className="text-xs text-gray-700 mb-2">
                최근 발병 시점: {data.photo.onset_date}
              </p>
            )}
            
            <div className="flex flex-wrap gap-1.5">
            {data.photo.symptoms_blood && (
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                data.photo.symptoms_blood === '예' || data.photo.symptoms_blood === '있음' || data.photo.symptoms_blood === '심함'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                출혈({data.photo.symptoms_blood === '예' || data.photo.symptoms_blood === '있음' ? '예' : data.photo.symptoms_blood})
              </span>
            )}
            {data.photo.symptoms_color && (
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                getSymptomSeverity(data.photo.symptoms_color) >= 2
                  ? 'bg-red-100 text-red-700'
                  : getSymptomSeverity(data.photo.symptoms_color) === 1
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                크기 변화({data.photo.symptoms_color === '심함' ? '심함' : data.photo.symptoms_color})
              </span>
            )}
            {data.photo.symptoms_pain && (
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                getSymptomSeverity(data.photo.symptoms_pain) >= 2
                  ? 'bg-red-100 text-red-700'
                  : getSymptomSeverity(data.photo.symptoms_pain) === 1
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                통증 ({data.photo.symptoms_pain === '심함' ? '심함' : data.photo.symptoms_pain === '보통' ? '보통' : data.photo.symptoms_pain})
              </span>
            )}
            {data.photo.symptoms_itch && (
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                getSymptomSeverity(data.photo.symptoms_itch) >= 2
                  ? 'bg-red-100 text-red-700'
                  : getSymptomSeverity(data.photo.symptoms_itch) === 1
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                가려움({data.photo.symptoms_itch})
              </span>
            )}
            {data.photo.symptoms_infection && (
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                data.photo.symptoms_infection === '예' || data.photo.symptoms_infection === '있음'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                감염({data.photo.symptoms_infection === '예' || data.photo.symptoms_infection === '있음' ? '예' : data.photo.symptoms_infection})
              </span>
            )}
          </div>
          </div>
        </div>

        {/* 질환 상세 정보 - 질환 설명과 권장사항을 나란히 배치 */}
        {data.disease && data.disease.description && (
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
            <div className="mb-2">
              <p className="text-base font-semibold text-gray-900">질환 상세 정보</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* 질환 설명 */}
              <div>
                <p className="text-base font-semibold text-gray-900 mb-1.5">
                  {data.disease.name_ko || data.disease.name_en}
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {data.disease.description}
                </p>
              </div>
              {/* 권장사항 */}
              {data.disease.recommendation && (
                <div>
                  <p className="text-base font-semibold text-gray-900 mb-1.5">권장사항</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {data.disease.recommendation}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 이미지 확대 모달 */}
      {zoomImageUrl && (
        <ImageZoomModal
          imageUrl={zoomImageUrl}
          alt={showGradCam && gradcamUrl ? 'GradCAM 분석' : '원본 이미지'}
          onClose={() => setZoomImageUrl(null)}
        />
      )}
    </div>
  );
};

export default HistoryResultPage;
