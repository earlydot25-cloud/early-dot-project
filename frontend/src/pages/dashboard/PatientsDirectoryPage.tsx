// frontend/src/pages/dashboard/PatientsDirectoryPage.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface Patient {
  id: number;
  name: string;
  latest_note?: string;
}

const PatientsDirectoryPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filter, setFilter] = useState<string>("전체 보기"); // 기본값
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const res = await axios.get<Patient[]>("/api/dashboard/patients/", {
          params: filter === "전체 보기" ? {} : { filter }, // ✅ 자동 인코딩
        });
        setPatients(res.data);
      } catch (e) {
        console.error("Failed to fetch patients:", e);
        setPatients([]);
      }
    };
    fetchPatients();
  }, [filter]);

  return (
    <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5">
      <h2 className="text-lg font-bold mb-1 text-left">전체 환자 목록</h2>
      <p className="text-xs text-gray-500 mb-4 text-left">
        환자를 선택하면 해당 환자의 폴더 목록을 볼 수 있습니다.
      </p>

      {/* 드롭다운 */}
      <div className="flex justify-end mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-400"
        >
          <option value="전체 보기">전체 보기</option>

          {/* 화면 표시 라벨(백엔드에서 유연 매칭) */}
          <option value="경과 관찰 소견 등록">경과 관찰 소견 등록</option>
          <option value="후속 조치 요청">후속 조치 요청</option>
          <option value="즉시 주의 소견 등록">즉시 주의 소견 등록</option>
          <option value="추가검사 필요">추가검사 필요</option>
          <option value="치료 완료">치료 완료</option>
          <option value="기타 소견">기타 소견</option>
        </select>
      </div>

      {/* 리스트 */}
      <div className="space-y-3">
        {patients.length > 0 ? (
          patients.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/dashboard/history?user=${p.id}`)}
              className="flex items-center bg-white rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition"
            >
              <div className="flex-1 text-left leading-tight">
                <h3 className="text-base font-semibold text-gray-900">{p.name}</h3>
                {p.latest_note && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{p.latest_note}</p>
                )}
              </div>
              <div className="text-gray-400 text-sm">{">"}</div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-400 mt-10">해당 조건의 환자가 없습니다.</p>
        )}
      </div>
    </div>
  );
};

export default PatientsDirectoryPage;
