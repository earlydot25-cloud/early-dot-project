// frontend/src/pages/dashboard/HistoryResultPage.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate, useLocation } from "react-router-dom";

// ------------------- Interface -------------------
interface Disease {
  name_ko: string;
  name_en: string;
  classification: string;
  description: string;
  recommendation: string;
}

interface Photo {
  folder_name: string;
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
  last_updated_at: string;
}

interface UserInfo {
  name: string;
  sex: string;
  age: number;
  family_history: string;
}

interface ResultDetail {
  id: number;
  analysis_date: string;
  risk_level: string;
  class_probs: Record<string, number>;
  grad_cam_path: string;
  vlm_analysis_text: string;
  disease: Disease;
  photo: Photo;
  followup_check: FollowUp | null;
  user: UserInfo;
}

// ✅ 경로 보정 함수
const resolveMediaUrl = (rawPath?: string) => {
  if (!rawPath) return "";
  const base = (process.env.REACT_APP_BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "");
  let path = rawPath.replace(/\\/g, "/"); // 역슬래시 제거

  // 이미 절대 URL이면 그대로
  if (/^https?:\/\//i.test(path)) return path;

  // 이미 /media/ 로 시작하면 중복 없이 base만 붙임
  if (path.startsWith("/media/")) return `${base}${path}`;
  if (path.startsWith("media/")) return `${base}/${path}`;

  // 혹시라도 /media/가 중간에 포함돼 있으면 제거 후 추가
  if (path.includes("/media/")) {
    path = path.replace(/^\/?media\//, "");
  }

  // 나머지는 /media/ 접두사 붙여서 반환
  return `${base}/media/${path}`;
};

// ------------------- Component -------------------
const HistoryResultPage: React.FC = () => {
  const { resultId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [data, setData] = useState<ResultDetail | null>(null);
  const [showGradCam, setShowGradCam] = useState(false);

  useEffect(() => {
    axios
      .get<ResultDetail>(`/api/dashboard/records/${resultId}/`)
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, [resultId]);

  if (!data) {
    return (
      <div className="text-center mt-10 text-gray-500">
        데이터 불러오는 중...
      </div>
    );
  }

  // ✅ 안전한 URL 생성
  const originalUrl = resolveMediaUrl(data.photo.upload_storage_path);
  const gradcamUrl = resolveMediaUrl(data.grad_cam_path);

  // ✅ 위험도 색상 스타일
  const riskColor =
    data.risk_level === "높음"
      ? "text-red-600 bg-red-100 border-red-300"
      : data.risk_level === "중간"
      ? "text-yellow-600 bg-yellow-100 border-yellow-300"
      : "text-green-600 bg-green-100 border-green-300";

  return (
    <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5">
      {/* 뒤로가기 */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-600 mb-3 flex items-center gap-1 hover:text-black"
      >
        ← 뒤로가기
      </button>

      {/* 상단 경로 */}
      <p className="text-xs text-gray-500 mb-2">
        {data.user.name} &gt; {data.photo.folder_name} &gt; {data.disease.name_ko}
      </p>

      {/* 경고 문구 */}
      {data.followup_check?.doctor_risk_level === "즉시 주의" && (
        <div className="bg-red-100 border border-red-400 text-red-600 rounded-md p-3 text-sm mb-4 font-semibold">
          ⚠️ 주의: 전문의의 소견 **[즉시 주의]** 상태입니다.
        </div>
      )}

      {/* AI 예측 결과 및 이미지 */}
      <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
        <h3 className="text-sm font-semibold mb-2">
          AI 예측 진단 및 이미지 분석
        </h3>

        {/* 탭 버튼 */}
        <div className="flex justify-around mb-2">
          <button
            className={`text-xs font-semibold ${
              !showGradCam
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500"
            }`}
            onClick={() => setShowGradCam(false)}
          >
            원본 환부 이미지
          </button>
          <button
            className={`text-xs font-semibold ${
              showGradCam
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500"
            }`}
            onClick={() => setShowGradCam(true)}
          >
            AI GradCAM 분석
          </button>
        </div>

        {/* 이미지 표시 */}
        <div className="w-full bg-gray-100 rounded-md overflow-hidden text-center">
          <img
            src={showGradCam ? gradcamUrl : originalUrl}
            alt={showGradCam ? "GradCAM" : "Original"}
            className="w-full h-auto"
          />
          <p className="text-gray-500 text-sm mt-1">
            {showGradCam ? "AI GradCAM 분석" : "original"}
          </p>
        </div>
      </div>

      {/* 질환명 및 위험도 */}
      <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
        <p className="text-xs text-blue-600 font-semibold mb-1">
          AI 예측 진단명
        </p>
        <p className="font-bold text-lg">
          {data.disease.name_en} ({data.disease.name_ko})
        </p>
        <p className={`text-xs mt-2 ${riskColor}`}>
          AI 위험도: {data.risk_level}
        </p>
      </div>

      {/* 전문의 최종 소견 */}
      <div className="bg-red-50 border border-red-300 rounded-xl p-3 shadow-sm mb-4">
        <p className="text-sm font-bold text-red-600 mb-1">전문의 최종 소견</p>
        <p className="text-xs mb-1">
          {data.followup_check?.doctor_note || "소견이 등록되지 않았습니다."}
        </p>
        <p className="text-xs text-gray-500">
          최종 판정: {data.followup_check?.doctor_risk_level || "소견 대기"} / 업데이트일:{" "}
          {data.followup_check?.last_updated_at?.split("T")[0] ||
            data.analysis_date.split("T")[0]}
        </p>
      </div>

      {/* VLM 모델 분석 */}
      <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
        <p className="text-sm font-semibold mb-2">VLM 모델 분석 소견</p>
        <p className="text-xs text-gray-700 whitespace-pre-wrap">
          {data.vlm_analysis_text || "AI 모델의 세부 분석 결과가 없습니다."}
        </p>
      </div>

      {/* 환자 기본 정보 */}
      <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
        <p className="text-sm font-semibold mb-2">환자 기본 정보</p>
        <p className="text-xs">
          나이 / 성별: {data.user.age}세 / {data.user.sex}
        </p>
        <p className="text-xs">환부 위치: {data.photo.body_part}</p>
        <p className="text-xs">가족력 유무: {data.user.family_history}</p>
      </div>

      {/* 주요 증상 및 특이사항 */}
      <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
        <p className="text-sm font-semibold mb-2">주요 증상 및 특이사항</p>
        <p className="text-xs text-gray-700">
          발병 시점: {data.photo.onset_date || "정보 없음"}
        </p>
        <p className="text-xs text-gray-700">
          통증: {data.photo.symptoms_pain} / 색 변화: {data.photo.symptoms_color}
        </p>
      </div>
    </div>
  );
};

export default HistoryResultPage;
