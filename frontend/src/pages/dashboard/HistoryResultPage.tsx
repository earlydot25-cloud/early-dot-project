// frontend/src/pages/dashboard/HistoryResultPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

interface RecordDetail {
  id: number;
  analysis_date: string;
  risk_level: string;
  vlm_analysis_text: string;
  disease: { name_ko: string };
  photo: {
    user_name: string;
    folder_name: string;
    upload_storage_path: string;
    body_part: string;
  };
}

const HistoryResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { folderName, resultId } = useParams();
  const [data, setData] = useState<RecordDetail | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      const res = await axios.get<RecordDetail>(
        `/api/dashboard/records/${resultId}/`
      );
      setData(res.data);
    };
    fetchDetail();
  }, [resultId]);

  if (!data) return <p>불러오는 중...</p>;

  const { photo, disease } = data;

  return (
    <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="text-lg text-gray-700 hover:text-black mb-3"
      >
        ←
      </button>

      <h2 className="text-lg font-semibold mb-2">
        {photo.user_name} &gt; {photo.folder_name} &gt; {disease.name_ko}
      </h2>

      <img
        src={`http://127.0.0.1:8000${photo.upload_storage_path}`}
        alt="record"
        className="w-full rounded-xl border border-gray-200 mb-4"
      />

      <p className="text-sm text-gray-700 mb-2">
        <b>진단일:</b> {data.analysis_date.split("T")[0]}
      </p>
      <p className="text-sm text-gray-700 mb-2">
        <b>위험도:</b>{" "}
        <span
          className={
            data.risk_level === "높음"
              ? "text-red-500 font-semibold"
              : data.risk_level === "중간"
              ? "text-yellow-500 font-semibold"
              : "text-green-500 font-semibold"
          }
        >
          {data.risk_level}
        </span>
      </p>
      <p className="text-sm text-gray-700">
        <b>AI 분석 내용:</b> {data.vlm_analysis_text || "내용 없음"}
      </p>
    </div>
  );
};

export default HistoryResultPage;
