// frontend/src/pages/dashboard/PatientsPage.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface Patient {
  id: number;
  name: string;
  folder_name?: string;
}

const PatientsPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get<Patient[]>("/api/dashboard/patients/") // ✅ 응답 타입 지정
      .then((res) => setPatients(res.data as Patient[])) // ✅ 타입 단언
      .catch(() => setPatients([]));
  }, []);

  return (
    <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5">
      <h2 className="text-lg font-bold mb-1 text-left">전체 환자 목록</h2>
      <p className="text-xs text-gray-500 mb-4 text-left">
        환자를 선택하면 해당 환자의 폴더 목록을 볼 수 있습니다.
      </p>

      <div className="space-y-3">
        {patients.length > 0 ? (
          patients.map((patient) => (
            <div
              key={patient.id}
              onClick={() =>
                navigate(`/dashboard/history?user=${patient.id}`)
              }
              className="flex items-center bg-white rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition"
            >
              {/* 이름만 표시 */}
              <div className="flex-1 text-left leading-tight">
                <h3 className="text-base font-semibold text-gray-900">
                  {patient.name}
                </h3>
              </div>

              <div className="text-gray-400 text-sm">{">"}</div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-400 mt-10">
            환자 데이터가 없습니다.
          </p>
        )}
      </div>
    </div>
  );
};

export default PatientsPage;
