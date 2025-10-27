// frontend/src/pages/dashboard/HistoryPage.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

interface Folder {
  folder_name: string;
  body_part: string;
  capture_date: string | null;
  upload_storage_path: string;
}

interface Patient {
  id: number;
  name: string;
}

function useQuery() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

const HistoryPage: React.FC = () => {
  const query = useQuery();
  const userId = query.get("user");
  const navigate = useNavigate();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [userName, setUserName] = useState<string>("");

  // ✅ 환자 이름 불러오기
  useEffect(() => {
    axios
      .get<Patient[]>("/api/dashboard/patients/")
      .then((res) => {
        const patient = res.data.find((p) => String(p.id) === String(userId));
        if (patient) setUserName(patient.name);
      })
      .catch(() => setUserName("환자"));
  }, [userId]);

  // ✅ 폴더 목록 불러오기 (DB의 folder_name 사용)
  useEffect(() => {
    axios
      .get<Folder[]>("/api/dashboard/folders/", { params: { user: userId } })
      .then((res) => {
        setFolders(res.data);
      })
      .catch(() => setFolders([]));
  }, [userId]);

  return (
    <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5">
      <button
        onClick={() => navigate("/dashboard/patients")}
        className="text-sm text-gray-600 mb-3 flex items-center gap-1 hover:text-black"
      >
        ← 뒤로가기
      </button>

      <h2 className="text-lg font-bold mb-1 text-left">{userName}</h2>
      <p className="text-xs text-gray-500 mb-4 text-left">
        폴더 별로 병변 부위를 손쉽게 추적하세요!
      </p>

      <div className="space-y-3">
        {folders.length > 0 ? (
          folders.map((folder, index) => (
            <div
              key={index}
              onClick={() =>
                navigate(`/dashboard/history/${folder.folder_name}?user=${userId}`)
              }
              className="flex items-center bg-white rounded-xl p-3 shadow-sm hover:shadow-md cursor-pointer transition"
            >
              {/* ✅ DB에서 가져온 실제 폴더명 출력 */}
              <div className="flex-1 text-left leading-tight">
                <h3 className="text-sm font-semibold">{folder.folder_name}</h3>

                <p className="text-xs text-gray-500">
                  최근 수정 날짜:{" "}
                  {folder.capture_date
                    ? folder.capture_date.split("T")[0]
                    : "날짜 정보 없음"}
                </p>
                <p className="text-xs text-gray-500">
                  신체 부위: {folder.body_part || "정보 없음"}
                </p>
              </div>
              <div className="text-gray-400 text-sm">{">"}</div>
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-sm text-center mt-10">
            폴더가 없습니다.
          </p>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
