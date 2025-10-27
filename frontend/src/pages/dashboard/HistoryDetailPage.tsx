// frontend/src/pages/dashboard/HistoryDetailPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams, useLocation } from "react-router-dom";

interface RecordItem {
  id: number;
  risk_level: string;
  analysis_date: string;
  disease?: { name_ko?: string };
  photo: {
    folder_name: string;
  };
}

interface Patient {
  id: number;
  name: string;
}

function useQuery() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

const HistoryDetailPage: React.FC = () => {
  const { folderName } = useParams();
  const query = useQuery();
  const userId = query.get("user");
  const navigate = useNavigate();
  const location = useLocation();

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [folderFromDB, setFolderFromDB] = useState<string>("");

  // ✅ 환자명 로드
  useEffect(() => {
    axios
      .get<Patient[]>("/api/dashboard/patients/")
      .then((res) => {
        const patient = res.data.find((p) => String(p.id) === String(userId));
        if (patient) setUserName(patient.name);
      })
      .catch(() => setUserName("환자"));
  }, [userId]);

  // ✅ 폴더명 DB에서 로드
  useEffect(() => {
    axios
      .get<RecordItem[]>("/api/dashboard/records/", {
        params: { user: userId, folder: folderName },
      })
      .then((res) => {
        setRecords(res.data);
        if (res.data.length > 0) {
          setFolderFromDB(res.data[0].photo.folder_name);
        }
      })
      .catch(() => setRecords([]));
  }, [userId, folderName]);

  const finalFolderDisplay = useMemo(
    () => folderFromDB || folderName || "폴더",
    [folderFromDB, folderName]
  );

  return (
    <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-600 mb-3 flex items-center gap-1 hover:text-black"
      >
        ← 뒤로가기
      </button>

      {/* ✅ 주석 부분 수정 */}
      <p className="text-xs text-gray-500 mb-2 text-left">
        {userName ? `${userName} > ${finalFolderDisplay}` : "로딩 중..."}
      </p>

      <h2 className="text-lg font-bold mb-3 text-left">질환 목록</h2>

      <div className="space-y-3">
        {records.length > 0 ? (
          records.map((r) => (
            <div
              key={r.id}
              onClick={() =>
                navigate(
                  `/dashboard/history/${folderName}/${r.id}?user=${userId}`,
                  {
                    state: {
                      userName,
                      folderDisplay: finalFolderDisplay,
                      diseaseName: r.disease?.name_ko,
                    },
                  }
                )
              }
              className="flex items-center bg-white rounded-xl p-3 shadow-sm hover:shadow-md cursor-pointer transition"
            >
              <div className="flex-1 text-left leading-tight">
                <h3 className="text-sm font-semibold">
                  {r.disease?.name_ko || "진단명 없음"}
                </h3>
                <p className="text-xs text-gray-500">
                  위험도: {r.risk_level || "정보 없음"}
                </p>
                <p className="text-xs text-gray-500">
                  진단일:{" "}
                  {r.analysis_date
                    ? r.analysis_date.split("T")[0]
                    : "정보 없음"}
                </p>
              </div>
              <div className="text-gray-400 text-sm">{">"}</div>
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-sm mt-10 text-center">
            진단 결과가 없습니다.
          </p>
        )}
      </div>
    </div>
  );
};

export default HistoryDetailPage;
