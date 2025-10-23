// frontend/src/pages/dashboard/HistoryPage.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface RecordItem {
  id: number;
  analysis_date: string;
  risk_level: string;
  disease: {
    name_ko: string;
  };
  photo: {
    body_part: string;
    folder_name: string;
    capture_date: string;
    upload_storage_path: string;
  };
}

const HistoryPage: React.FC = () => {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await axios.get<RecordItem[]>("/api/dashboard/records/");
        setRecords(res.data);
      } catch (err) {
        console.error(err);
        setError("진단 기록을 불러오는 중 오류가 발생했습니다.");
      }
    };
    fetchRecords();
  }, []);

  const folders = Object.values(
    records.reduce((acc, record) => {
      const folderName = record.photo.folder_name;
      if (!acc[folderName]) acc[folderName] = [];
      acc[folderName].push(record);
      return acc;
    }, {} as Record<string, RecordItem[]>)
  );

  if (error)
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        {error}
      </div>
    );

  return (
    <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-4">
      <h2 className="text-lg font-bold mb-2 text-left">폴더 목록</h2>
      <p className="text-xs text-gray-500 mb-4 text-left">
        폴더 별로 병변 부위를 손쉽게 추적하세요!
      </p>

      <div className="space-y-3">
        {folders.map((recordsInFolder, index) => {
          const first = recordsInFolder[0];
          return (
            <div
              key={index}
              onClick={() =>
                navigate(`/dashboard/history/${first.photo.folder_name}`)
              }
              className="flex items-center bg-white rounded-xl shadow-sm p-2 w-full cursor-pointer hover:bg-gray-100 transition"
            >
              <img
                src={`http://127.0.0.1:8000${first.photo.upload_storage_path}`}
                alt="preview"
                className="w-12 h-12 rounded-md object-cover mr-3 border border-gray-200"
              />
              <div className="flex-1 text-left leading-tight">
                <h3 className="text-sm font-semibold">
                  {first.photo.folder_name}
                </h3>
                <p className="text-xs text-gray-500">
                  최근 수정 날짜: {first.analysis_date.split("T")[0]}
                </p>
                <p className="text-xs text-gray-500">
                  질병명: {first.disease?.name_ko || "정보 없음"}
                </p>
                <p className="text-xs text-gray-500">
                  신체 부위: {first.photo.body_part}
                </p>
              </div>
              <div className="text-gray-400 text-sm">{">"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HistoryPage;
