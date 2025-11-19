// frontend/src/pages/diagnosis/ResultDetailPage.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import RiskLevelIcon from '../../components/RiskLevelIcon';

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
  request_date?: string;
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
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';

const normalizeHost = (url: string) =>
  url.replace(/^http:\/\/(?:django|project_django)(?::\d+)?/i, API_BASE_URL);

// ✅ 경로 보정 함수
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

// 증상 심각도 순서 (심한 것부터)
const SYMPTOM_SEVERITY_ORDER: Record<string, number> = {
  '심각': 3,
  '약간~보통': 2,
  '있음': 2,
  '약간': 1,
  '없음': 0,
};

const getSymptomSeverity = (value: string): number => {
  return SYMPTOM_SEVERITY_ORDER[value] ?? 1;
};

// ------------------- Component -------------------
const ResultDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<ResultDetail | null>(null);
  const [showGradCam, setShowGradCam] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await axios.get<ResultDetail>(`/api/dashboard/records/${id}/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        console.log('[ResultDetailPage] 받은 데이터:', response.data);
        console.log('[ResultDetailPage] disease:', response.data.disease);
        console.log('[ResultDetailPage] class_probs:', response.data.class_probs);
        console.log('[ResultDetailPage] risk_level:', response.data.risk_level);
        setData(response.data);
      } catch (err: any) {
        console.error('Failed to fetch result detail:', err);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5">
        <div className="text-center text-gray-500 mt-10">데이터 불러오는 중...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5">
        <button
          onClick={() => navigate(-1)}
          className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
        >
          ← 뒤로가기
        </button>
        <div className="text-center text-gray-500 mt-10">데이터를 불러올 수 없습니다.</div>
      </div>
    );
  }

  // ✅ 안전한 URL 생성
  const originalUrl = resolveMediaUrl(data.photo.upload_storage_path);
  const gradcamUrl = data.grad_cam_path ? resolveMediaUrl(data.grad_cam_path) : '';

  // ✅ 위험도 판단
  const hasDoctorNote = data.followup_check && 
    data.followup_check.doctor_risk_level && 
    data.followup_check.doctor_risk_level !== '소견 대기';
  
  const aiRiskLevel = data.risk_level || '분석 대기';
  const doctorRiskLevel = data.followup_check?.doctor_risk_level || '';
  
  // 위험한 경우 판단: 보통 이상 (보통, 중간, 높음, 즉시 주의)
  const isRiskHigh = aiRiskLevel === '높음' || aiRiskLevel === '즉시 주의' || 
                     aiRiskLevel === '중간' || aiRiskLevel === '보통' ||
                     doctorRiskLevel === '즉시 주의' || doctorRiskLevel === '경과 관찰';

  const finalRiskLevel = hasDoctorNote && data.followup_check
    ? data.followup_check.doctor_risk_level
    : aiRiskLevel;
  const riskSource = hasDoctorNote ? '의사' : (data.disease ? 'AI' : '대기');

  // 모델 확신도 계산 (class_probs에서 최대값)
  const modelConfidence = data.class_probs 
    ? Math.max(...Object.values(data.class_probs)) * 100 
    : null;

  // 증상 정렬 (심한 순서대로)
  const symptoms = [
    { label: '가려움', value: data.photo.symptoms_itch, key: 'itch' },
    { label: '통증', value: data.photo.symptoms_pain, key: 'pain' },
    { label: '색 변화', value: data.photo.symptoms_color, key: 'color' },
    { label: '감염', value: data.photo.symptoms_infection, key: 'infection' },
    { label: '출혈', value: data.photo.symptoms_blood, key: 'blood' },
  ].filter(s => s.value && s.value !== '없음')
    .sort((a, b) => getSymptomSeverity(b.value) - getSymptomSeverity(a.value));

  return (
    <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5 pb-24">
      {/* 헤더: 폴더명 - 파일명 */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/dashboard/main')}
          className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
        >
          ← 뒤로가기
        </button>
        <h1 className="text-lg font-bold text-gray-900">
          {data.photo.folder_name} - {data.photo.file_name}
        </h1>
      </div>

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
              ? `전문의 최종 판정: ${doctorRiskLevel}`
              : `AI 위험도: ${aiRiskLevel} 이상`}
          </p>
        </div>
      )}

      {/* AI 예측 진단 이미지 분석 */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
        <h3 className="text-base font-bold mb-3 text-gray-900">AI 예측 진단 이미지 분석</h3>

        {/* 탭 버튼 (GradCAM이 있을 때만 표시) */}
        {/* {data.disease && gradcamUrl && (  */} 
        {data.disease && (  
          <div className="flex justify-around mb-3 border-b border-gray-200">
            <button
              className={`text-sm font-semibold pb-2 flex-1 ${
                !showGradCam
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500'
              }`}
              onClick={() => setShowGradCam(false)}
            >
              병변 사진
            </button>
            <button
              className={`text-sm font-semibold pb-2 flex-1 ${
                showGradCam
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500'
              }`}
              onClick={() => setShowGradCam(true)}
            >
              그라드 캠
            </button>
          </div>
        )}

        {/* 이미지 표시 */}
        <div className="w-full bg-gray-100 rounded-lg overflow-hidden text-center">
          <img
            src={showGradCam && gradcamUrl ? gradcamUrl : originalUrl}
            alt={showGradCam ? 'GradCAM' : 'Original'}
            className="w-full h-auto max-h-96 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E이미지 없음%3C/text%3E%3C/svg%3E';
            }}
          />
          <p className="text-gray-500 text-xs mt-2 pb-1">
            {showGradCam && gradcamUrl ? 'AI GradCAM 분석' : '병변 사진'}
          </p>
        </div>
      </div>

      {/* AI 예측 진단명 */}
      {data.disease && (
        <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
          <p className="text-xs text-blue-600 font-semibold mb-1">AI 예측 진단명</p>
          <p className="font-bold text-lg mb-2">
            {data.disease.name_en} ({data.disease.name_ko})
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <RiskLevelIcon riskLevel={finalRiskLevel} source={riskSource as 'AI' | '의사' | '대기'} size={20} />
            <p className="text-sm font-semibold text-gray-700">
              AI 위험도: {aiRiskLevel}
            </p>
            {modelConfidence !== null && (
              <p className="text-xs text-gray-500">
                모델 확신도: {modelConfidence.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      )}

      {/* 분석 대기 상태 */}
      {!data.disease && (
        <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
          <p className="text-sm text-gray-600 font-semibold mb-2">진단 상태</p>
          <div className="flex items-center gap-2">
            <RiskLevelIcon riskLevel="분석 대기" source="대기" size={24} />
            <p className="text-sm text-gray-700">
              AI 분석이 진행 중입니다. 잠시 후 다시 확인해주세요.
            </p>
          </div>
        </div>
      )}

      {/* AI 진단 결과 */}
      {data.disease && data.class_probs && (
        <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
          <p className="text-sm font-semibold mb-3 text-gray-900">AI 진단 결과</p>
          
          {/* 예측된 질병 및 위험도 */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <RiskLevelIcon riskLevel={data.risk_level} source="AI" size={20} />
              <p className="text-sm font-semibold text-gray-900">
                예측 질병: {data.disease.name_ko}
              </p>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              위험도: <span className="font-semibold">{data.risk_level}</span>
            </p>
          </div>

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

      {/* 전문의 최종 소견 */}
      {data.followup_check && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 shadow-sm mb-4">
          <p className="text-sm font-bold text-red-600 mb-2">
            {data.user.name} 전문의 최종 소견
          </p>
          <div className="mb-2">
            <p className="text-xs text-gray-600 mb-1">최종판정</p>
            <div className="flex items-center gap-2">
              <RiskLevelIcon 
                riskLevel={data.followup_check.doctor_risk_level} 
                source="의사" 
                size={20} 
              />
              <p className="text-sm font-semibold text-gray-900">
                {data.followup_check.doctor_risk_level}
              </p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-red-200">
            <p className="text-xs text-gray-600 mb-1">소견 내용</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {data.followup_check.doctor_note || '소견이 등록되지 않았습니다.'}
            </p>
          </div>
        </div>
      )}

      {/* VLM 모델 분석 소견 */}
      {data.vlm_analysis_text && (
        <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
          <p className="text-sm font-semibold mb-2 text-gray-900">VLM 모델 분석 소견</p>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded mb-2">
            <p className="text-xs font-semibold text-blue-800 mb-2">ABCDE 기법 분석</p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
              {data.vlm_analysis_text}
            </p>
          </div>
        </div>
      )}

      {/* 환자 기본 정보 */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
        <p className="text-sm font-semibold mb-3 text-gray-900">환자 기본 정보</p>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-xs text-gray-600">이름</span>
            <span className="text-xs text-gray-900 font-medium">{data.user.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-600">나이/성별</span>
            <span className="text-xs text-gray-900 font-medium">
              {data.user.age ? `${data.user.age}세` : '정보 없음'} / {data.user.sex || '모름'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-600">환부 위치</span>
            <span className="text-xs text-gray-900 font-medium">{data.photo.body_part || '정보 없음'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-600">가족력 유무</span>
            <span className="text-xs text-gray-900 font-medium">{data.user.family_history || '없음'}</span>
          </div>
        </div>
      </div>

      {/* 주요 증상 및 특이사항 */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
        <p className="text-sm font-semibold mb-3 text-gray-900">주요 증상 및 특이사항</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-left">
          <p className="text-xs text-gray-700">
            <span className="font-bold">발병 시점:</span> {data.photo.onset_date || '정보 없음'}
          </p>
          {data.photo.symptoms_itch && (
            <p className={`text-xs ${
              getSymptomSeverity(data.photo.symptoms_itch) >= 2 ? 'text-red-600' : 
              getSymptomSeverity(data.photo.symptoms_itch) === 1 ? 'text-yellow-600' : 
              'text-gray-700'
            }`}>
              <span className="font-bold">가려움:</span> {data.photo.symptoms_itch}
            </p>
          )}
          {data.photo.symptoms_pain && (
            <p className={`text-xs ${
              getSymptomSeverity(data.photo.symptoms_pain) >= 2 ? 'text-red-600' : 
              getSymptomSeverity(data.photo.symptoms_pain) === 1 ? 'text-yellow-600' : 
              'text-gray-700'
            }`}>
              <span className="font-bold">통증:</span> {data.photo.symptoms_pain}
            </p>
          )}
          {data.photo.symptoms_color && (
            <p className={`text-xs ${
              getSymptomSeverity(data.photo.symptoms_color) >= 2 ? 'text-red-600' : 
              getSymptomSeverity(data.photo.symptoms_color) === 1 ? 'text-yellow-600' : 
              'text-gray-700'
            }`}>
              <span className="font-bold">색 변화:</span> {data.photo.symptoms_color}
            </p>
          )}
          {data.photo.symptoms_infection && (
            <p className={`text-xs ${
              getSymptomSeverity(data.photo.symptoms_infection) >= 2 ? 'text-red-600' : 
              getSymptomSeverity(data.photo.symptoms_infection) === 1 ? 'text-yellow-600' : 
              'text-gray-700'
            }`}>
              <span className="font-bold">감염:</span> {data.photo.symptoms_infection}
            </p>
          )}
          {data.photo.symptoms_blood && (
            <p className={`text-xs ${
              getSymptomSeverity(data.photo.symptoms_blood) >= 2 ? 'text-red-600' : 
              getSymptomSeverity(data.photo.symptoms_blood) === 1 ? 'text-yellow-600' : 
              'text-gray-700'
            }`}>
              <span className="font-bold">출혈:</span> {data.photo.symptoms_blood}
            </p>
          )}
        </div>
      </div>

      {/* 처리 내역 */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
        <p className="text-sm font-semibold mb-3 text-gray-900">처리 내역</p>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-xs text-gray-600">최초 기록일</span>
            <span className="text-xs text-gray-900 font-medium">
              {data.photo.capture_date
                ? new Date(data.photo.capture_date).toLocaleDateString('ko-KR')
                : data.analysis_date
                ? new Date(data.analysis_date).toLocaleDateString('ko-KR')
                : '정보 없음'}
            </span>
          </div>
          {data.followup_check?.last_updated_at && (
            <div className="flex justify-between">
              <span className="text-xs text-gray-600">전문의 최종 확인일</span>
              <span className="text-xs text-gray-900 font-medium">
                {new Date(data.followup_check.last_updated_at).toLocaleDateString('ko-KR')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultDetailPage;
