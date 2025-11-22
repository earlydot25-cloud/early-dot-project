import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
const RISK_OPTIONS = ['소견 대기', '즉시 주의', '경과 관찰', '정상'] as const;
type RiskOption = typeof RISK_OPTIONS[number];

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

  useEffect(() => {
    if (!resultId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await axios.get<ResultDetail>(`${API_BASE_URL}/api/dashboard/records/${resultId}/`, {
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
        `${API_BASE_URL}/api/dashboard/records/${data.id}/followup/update/`,
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
      setData(prev => (prev ? { ...prev, followup_check: updatedFollowup } : prev));
      if (updatedFollowup.doctor_risk_level && RISK_OPTIONS.includes(updatedFollowup.doctor_risk_level as RiskOption)) {
        setDoctorRiskLevel(updatedFollowup.doctor_risk_level as RiskOption);
      }
      setDoctorNote(updatedFollowup.doctor_note || '');
      setFollowupMessage('전문의 소견이 저장되었습니다.');
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

  if (!data) {
    return (
      <div className="w-full bg-white px-4 py-5">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-600 mb-3 flex items-center gap-1 hover:text-black"
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

  // ✅ 위험도 색상 스타일
  const hasDoctorNote =
    data.followup_check &&
    data.followup_check.doctor_risk_level &&
    data.followup_check.doctor_risk_level !== '소견 대기';
  const finalRiskLevel = hasDoctorNote && data.followup_check
    ? data.followup_check.doctor_risk_level
    : data.risk_level || '분석 대기';
  const riskSource = hasDoctorNote ? '의사' : (data.disease ? 'AI' : '대기');

  const riskColor =
    finalRiskLevel === '높음' || finalRiskLevel === '즉시 주의'
      ? 'text-red-600 bg-red-100 border-red-300'
      : finalRiskLevel === '중간' || finalRiskLevel === '보통' || finalRiskLevel === '경과 관찰'
      ? 'text-yellow-600 bg-yellow-100 border-yellow-300'
      : finalRiskLevel === '분석 대기'
      ? 'text-gray-600 bg-gray-100 border-gray-300'
      : 'text-green-600 bg-green-100 border-green-300';

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
    ? data.followup_check.last_updated_at.split('T')[0]
    : null;

  return (
    <div className="w-full bg-white px-4 py-5">
      {/* 뒤로가기 */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
      >
        ← 뒤로가기
      </button>

      {/* 상단 경로 */}
      <p className="text-xs text-gray-500 mb-2">
        {userName} &gt; {folderDisplay} &gt; {diseaseName}
      </p>

      {/* 경고 문구 */}
      {data.followup_check?.doctor_risk_level === '즉시 주의' && (
        <div className="bg-red-100 border border-red-400 text-red-600 rounded-md p-3 text-sm mb-4 font-semibold">
          ⚠️ 주의: 전문의의 소견 **[즉시 주의]** 상태입니다.
        </div>
      )}

      {/* 이미지 섹션 */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
        <h3 className="text-sm font-semibold mb-3 text-gray-900">
          {data.disease ? 'AI 예측 진단 및 이미지 분석' : '업로드된 이미지'}
        </h3>

        {/* 탭 버튼 (GradCAM이 있을 때만 표시) */}
        {data.disease && gradcamUrl && (
          <div className="flex justify-around mb-3 border-b border-gray-200">
            <button
              className={`text-xs font-semibold pb-2 ${
                !showGradCam ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
              }`}
              onClick={() => setShowGradCam(false)}
            >
              원본 환부 이미지
            </button>
            <button
              className={`text-xs font-semibold pb-2 ${
                showGradCam ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
              }`}
              onClick={() => setShowGradCam(true)}
            >
              AI GradCAM 분석
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
              (e.target as HTMLImageElement).src =
                'data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\"%3E%3Ctext x=\"50%25\" y=\"50%25\" text-anchor=\"middle\" dy=\".3em\"%3E이미지 없음%3C/text%3E%3C/svg%3E';
            }}
          />
          <p className="text-gray-500 text-xs mt-2 pb-1">
            {showGradCam && gradcamUrl ? 'AI GradCAM 분석' : '원본 이미지'}
          </p>
        </div>
      </div>

      {/* 질환명 및 위험도 */}
      {data.disease && (
        <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
          <p className="text-xs text-blue-600 font-semibold mb-1">AI 예측 진단명</p>
          <p className="font-bold text-lg mb-2">
            {data.disease.name_en} ({data.disease.name_ko})
          </p>
          <div className="flex items-center gap-2">
            <RiskLevelIcon
              riskLevel={finalRiskLevel}
              source={riskSource as 'AI' | '의사' | '대기'}
              size={20}
            />
            <p className={`text-xs px-2 py-1 rounded border ${riskColor}`}>
              {riskSource} 위험도: {finalRiskLevel}
            </p>
          </div>
        </div>
      )}

      {/* 분석 대기 상태 (Results가 없을 때) */}
      {!data.disease && (
        <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
          <p className="text-xs text-gray-600 font-semibold mb-1">진단 상태</p>
          <div className="flex items-center gap-2">
            <RiskLevelIcon riskLevel="분석 대기" source="대기" size={20} />
            <p className="text-sm text-gray-700">
              AI 분석이 진행 중입니다. 잠시 후 다시 확인해주세요.
            </p>
          </div>
        </div>
      )}

      {/* 전문의 최종 소견 */}
      {data.disease && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 shadow-sm mb-4">
          <p className="text-sm font-bold text-red-600 mb-2">전문의 최종 소견</p>
          <p className="text-xs text-gray-700 mb-2 whitespace-pre-wrap">
            {doctorNoteDisplay}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600">
              최종 판정: <span className="font-semibold">{doctorRiskDisplay}</span>
            </span>
            {doctorUpdatedDate ? (
              <span className="text-xs text-gray-500">
                업데이트일: {doctorUpdatedDate}
              </span>
            ) : (
              <span className="text-[11px] text-gray-400">
                전문의 검토 전 (기본값)
              </span>
            )}
          </div>

          {!hasFollowup && !isDoctor && (
            <div className="mt-3">
              <p className="text-xs text-gray-700 mb-2">
                전문의 소견이 아직 신청되지 않았습니다.
              </p>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('accessToken');
                    await axios.post(
                      `${API_BASE_URL}/api/dashboard/records/${data.id}/request-followup/`,
                      {},
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                        },
                      }
                    );
                    alert('전문의 소견 신청이 완료되었습니다.');
                    window.location.reload();
                  } catch (err: any) {
                    console.error('Failed to request follow-up:', err);
                    alert(err.response?.data?.error || err.response?.data?.message || '전문의 소견 신청에 실패했습니다.');
                  }
                }}
                className="w-full py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition duration-150"
              >
                전문의 소견 신청하기
              </button>
            </div>
          )}

          {isDoctor && (
            <div className="mt-4 bg-white rounded-lg border border-red-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-red-600">전문의 소견 작성</p>
              {!hasFollowup && (
                <p className="text-[11px] text-gray-500">
                  아직 환자가 소견을 신청하지 않았습니다. 바로 아래에서 소견을 작성하고 저장할 수 있습니다.
                </p>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-700">최종 판정</label>
                <select
                  value={doctorRiskLevel}
                  onChange={(e) => setDoctorRiskLevel(e.target.value as RiskOption)}
                  className="w-full mt-1 text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-red-300"
                >
                  {RISK_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">소견 내용</label>
                <textarea
                  value={doctorNote}
                  onChange={(e) => setDoctorNote(e.target.value)}
                  rows={4}
                  className="w-full mt-1 text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-red-300"
                  placeholder="환부 상태, 권장 조치 등을 입력하세요."
                />
              </div>
              <button
                onClick={handleSaveFollowup}
                disabled={isSavingFollowup}
                className="w-full py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700 transition disabled:opacity-60"
              >
                {isSavingFollowup ? '저장 중...' : '전문의 소견 저장하기'}
              </button>
              {followupMessage && (
                <p className="text-[11px] text-green-600 text-center">{followupMessage}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* VLM 모델 분석 (Results가 있을 때만) */}
      {data.vlm_analysis_text && (
        <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
          <p className="text-sm font-semibold mb-2 text-gray-900">VLM 모델 분석 소견</p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
            {data.vlm_analysis_text}
          </p>
        </div>
      )}

      {/* 환자 기본 정보 */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
        <p className="text-sm font-semibold mb-2 text-gray-900">환자 기본 정보</p>
        <div className="space-y-1">
          <p className="text-xs text-gray-700">
            나이 / 성별: {data.user.age ? `${data.user.age}세` : '정보 없음'} / {data.user.sex || '모름'}
          </p>
          <p className="text-xs text-gray-700">환부 위치: {data.photo.body_part || '정보 없음'}</p>
          <p className="text-xs text-gray-700">가족력 유무: {data.user.family_history || '없음'}</p>
        </div>
      </div>

      {/* 주요 증상 및 특이사항 */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
        <p className="text-sm font-semibold mb-2 text-gray-900">주요 증상 및 특이사항</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-left">
          <p className="text-xs text-gray-700">
            <span className="font-bold">발병 시점:</span> {data.photo.onset_date || '정보 없음'}
          </p>
          <p className="text-xs text-gray-700">
            <span className="font-bold">가려움:</span> {data.photo.symptoms_itch || '없음'}
          </p>
          <p className="text-xs text-gray-700">
            <span className="font-bold">통증:</span> {data.photo.symptoms_pain || '없음'}
          </p>
          <p className="text-xs text-gray-700">
            <span className="font-bold">색 변화:</span> {data.photo.symptoms_color || '없음'}
          </p>
          <p className="text-xs text-gray-700">
            <span className="font-bold">감염:</span> {data.photo.symptoms_infection || '없음'}
          </p>
          <p className="text-xs text-gray-700">
            <span className="font-bold">출혈:</span> {data.photo.symptoms_blood || '없음'}
          </p>
        </div>
      </div>

      {/* 질환 상세 정보 (Results가 있을 때만) */}
      {data.disease && data.disease.description && (
        <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
          <p className="text-sm font-semibold mb-2 text-gray-900">질환 상세 정보</p>
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
    </div>
  );
};

export default HistoryResultPage;

