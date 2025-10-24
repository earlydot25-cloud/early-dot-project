import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface Patient {
  id: number;
  name: string;
  folders: string[];
}

const PatientsPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const res = await axios.get<Patient[]>("/api/dashboard/patients/");
        setPatients(res.data);
      } catch (err) {
        console.error(err);
        setError("환자 목록을 불러오는 중 오류가 발생했습니다.");
      }
    };
    fetchPatients();
  }, []);

  if (error)
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        {error}
      </div>
    );

  return (
    <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-6">
      <h2 className="text-lg font-bold mb-3">전체 환자 목록</h2>
      <p className="text-xs text-gray-500 mb-4">
        환자를 선택하면 해당 환자의 폴더 목록을 볼 수 있습니다.
      </p>

      <div className="space-y-3">
        {patients.map((patient) => (
          <div
            key={patient.id}
            className="bg-white rounded-xl shadow-sm p-3 border border-gray-100 hover:bg-gray-50 transition"
          >
            {/* ✅ 이름 클릭 시 폴더목록으로 이동 */}
            <h3
              onClick={() => {
                localStorage.setItem("selectedUserName", patient.name);
                navigate(`/dashboard/history?user=${patient.id}`);
              }}
              className="text-sm font-semibold mb-2 cursor-pointer hover:text-blue-600 transition"
            >
              {patient.name}
            </h3>

            {/* ✅ 폴더 버튼 클릭 시에도 동일하게 이동 */}
            <div className="flex flex-wrap gap-2">
              {patient.folders.map((folder) => (
                <button
                  key={folder}
                  onClick={() => {
                    localStorage.setItem("selectedUserName", patient.name);
                    navigate(`/dashboard/history?user=${patient.id}`);
                  }}
                  className="px-2 py-1 text-xs rounded-lg bg-blue-50 hover:bg-blue-100 transition"
                >
                  {folder}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PatientsPage;
