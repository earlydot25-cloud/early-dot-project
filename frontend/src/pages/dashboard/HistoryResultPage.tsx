// frontend/src/pages/dashboard/HistoryResultPage.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams, useLocation } from "react-router-dom";

interface RecordDetail {
  id: number;
  analysis_date: string;
  risk_level: string;
  vlm_analysis_text: string;
  disease: { name_ko: string };
  photo: { folder_name: string };
}

const HistoryResultPage: React.FC = () => {
  const { folderName, resultId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const userId = query.get("user");

  const { userName, folderDisplay, diseaseName } = (location.state || {}) as {
    userName?: string;
    folderDisplay?: string;
    diseaseName?: string;
  };

  const [data, setData] = useState<RecordDetail | null>(null);

  useEffect(() => {
    axios
      .get<RecordDetail>(`/api/dashboard/records/${resultId}/`)
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, [resultId]);

  const finalUser = userName || "환자";
  const finalFolder = folderDisplay || data?.photo?.folder_name || folderName;
  const finalDisease = data?.disease?.name_ko || diseaseName || "질환명";

  return (
    <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-600 mb-3 flex items-center gap-1 hover:text-black"
      >
        ← 뒤로가기
      </button>

      {/* ✅ DB에서 불러온 폴더명 반영 */}
      <p className="text-xs text-gray-500 mb-2 text-left">
        {`${finalUser} > ${finalFolder} > ${finalDisease}`}
      </p>

      <h2 className="text-lg font-bold mb-2 text-left">
        {finalDisease} ({data?.risk_level || "정보 없음"})
      </h2>

      <p className="text-xs text-gray-500 mb-4 text-left">
        진단일: {data?.analysis_date?.split("T")[0] || "정보 없음"}
      </p>

      <p className="text-sm text-gray-700 mb-5 text-left">
        {data?.vlm_analysis_text || "AI 분석 결과가 없습니다."}
      </p>

      <h3 className="text-sm font-semibold text-left mb-1">설명</h3>
      <h3 className="text-sm font-semibold text-left">권장 조치</h3>
    </div>
  );
};

export default HistoryResultPage;
