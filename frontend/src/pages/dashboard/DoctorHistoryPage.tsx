// frontend/src/pages/dashboard/DoctorHistoryPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import RiskLevelIcon from '../../components/RiskLevelIcon';

interface Patient {
  id: number;
  name: string;
  latest_note?: string;
  has_attention?: boolean; // 주의가 필요한 환자 여부
}

interface Folder {
  folder_name: string;
  body_part: string;
  capture_date: string | null;
  upload_storage_path: string;
  patient_id?: number;
}

interface RecordItem {
  id: number;
  risk_level: string;
  analysis_date: string;
  disease?: { name_ko?: string };
  photo: {
    folder_name: string;
    body_part: string;
    capture_date: string;
  };
  followup_check?: {
    doctor_risk_level: string;
  };
}

const DoctorHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('전체 보기');
  const [viewMode, setViewMode] = useState<'patients' | 'folders' | 'records'>('patients');
  const [isLoading, setIsLoading] = useState(true);

  // ✅ 환자 목록 불러오기
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await axios.get<Patient[]>('/api/dashboard/patients/', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setPatients(response.data);
      } catch (err: any) {
        console.error('Failed to fetch patients:', err);
        setPatients([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatients();
  }, []);

  // ✅ 폴더 목록 불러오기 (환자 선택 시)
  useEffect(() => {
    if (!selectedPatientId) {
      setFolders([]);
      return;
    }

    const fetchFolders = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await axios.get<Folder[]>('/api/dashboard/folders/', {
          params: { user: selectedPatientId },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setFolders(response.data);
        setViewMode('folders');
      } catch (err: any) {
        console.error('Failed to fetch folders:', err);
        setFolders([]);
      }
    };

    fetchFolders();
  }, [selectedPatientId]);

  // ✅ 파일(진단 기록) 목록 불러오기 (폴더 선택 시)
  const handleFolderClick = async (folderName: string) => {
    if (!selectedPatientId) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get<RecordItem[]>('/api/dashboard/records/', {
        params: { user: selectedPatientId, folder: folderName },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setRecords(response.data);
      setViewMode('records');
    } catch (err: any) {
      console.error('Failed to fetch records:', err);
      setRecords([]);
    }
  };

  // ✅ 주의가 필요한 환자 필터링 및 정렬
  const sortedPatients = useMemo(() => {
    const attentionPatients = patients.filter(p => p.has_attention || 
      (p.latest_note && (p.latest_note.includes('즉시 주의') || p.latest_note.includes('주의'))));
    const normalPatients = patients.filter(p => !attentionPatients.includes(p));

    // 주의 환자는 최상위, 각 그룹은 이름 오름차순
    const sortedAttention = [...attentionPatients].sort((a, b) => a.name.localeCompare(b.name));
    const sortedNormal = [...normalPatients].sort((a, b) => a.name.localeCompare(b.name));

    return [...sortedAttention, ...sortedNormal];
  }, [patients]);

  // ✅ 검색 및 필터 적용
  const filteredPatients = useMemo(() => {
    let filtered = sortedPatients;

    // 검색 필터
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 위험도 필터
    if (riskFilter !== '전체 보기') {
      filtered = filtered.filter(p => {
        if (riskFilter === '주의 환자') {
          return p.has_attention || 
            (p.latest_note && (p.latest_note.includes('즉시 주의') || p.latest_note.includes('주의')));
        }
        return p.latest_note?.includes(riskFilter);
      });
    }

    return filtered;
  }, [sortedPatients, searchQuery, riskFilter]);

  // ✅ 뒤로가기 핸들러
  const handleBack = () => {
    if (viewMode === 'records') {
      setViewMode('folders');
      setRecords([]);
    } else if (viewMode === 'folders') {
      setViewMode('patients');
      setSelectedPatientId(null);
      setFolders([]);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full bg-white px-4 py-5">
        <div className="text-center text-gray-500 mt-10">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white px-4 py-5">
      {/* 헤더 */}
      {viewMode !== 'patients' && (
        <button
          onClick={handleBack}
          className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
        >
          ← 뒤로가기
        </button>
      )}

      {/* 제목 */}
      {viewMode === 'patients' && (
        <>
          <h2 className="text-lg font-bold mb-1 text-left">전체 환자 목록</h2>
          <p className="text-xs text-gray-500 mb-3 text-left">
            환자를 선택하면 해당 환자의 폴더 목록을 볼 수 있습니다.
          </p>
        </>
      )}

      {viewMode === 'folders' && selectedPatientId && (
        <h2 className="text-lg font-bold mb-3 text-left">
          {patients.find(p => p.id === selectedPatientId)?.name || '환자'}의 폴더 목록
        </h2>
      )}

      {viewMode === 'records' && (
        <h2 className="text-lg font-bold mb-3 text-left">진단 기록</h2>
      )}

      {/* 검색 및 필터 (환자 목록에서만 표시, 겹쳐서 배치) */}
      {viewMode === 'patients' && (
        <div className="mb-4 relative">
          {/* 검색 입력과 드롭다운을 겹쳐서 배치 */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="환자 이름 검색..."
              className="w-full pr-24 pl-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-400"
            >
              <option value="전체 보기">전체 보기</option>
              <option value="주의 환자">주의 환자</option>
              <option value="즉시 주의">즉시 주의</option>
              <option value="경과 관찰">경과 관찰</option>
              <option value="추가검사 필요">추가검사 필요</option>
              <option value="치료 완료">치료 완료</option>
            </select>
          </div>
        </div>
      )}

      {/* 환자 목록 */}
      {viewMode === 'patients' && (
        <div className="space-y-3">
          {filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => (
              <div
                key={patient.id}
                onClick={() => setSelectedPatientId(patient.id)}
                className={`flex items-center rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition ${
                  patient.has_attention || 
                  (patient.latest_note && (patient.latest_note.includes('즉시 주의') || patient.latest_note.includes('주의')))
                    ? 'bg-red-50 border-2 border-red-200'
                    : 'bg-white'
                }`}
              >
                <div className="flex-1 text-left leading-tight">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">
                      {patient.name}
                    </h3>
                    {(patient.has_attention || 
                      (patient.latest_note && (patient.latest_note.includes('즉시 주의') || patient.latest_note.includes('주의')))) && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        주의
                      </span>
                    )}
                  </div>
                  {patient.latest_note && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {patient.latest_note}
                    </p>
                  )}
                </div>
                <div className="text-gray-400 text-sm">{'>'}</div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-400 mt-10">
              해당 조건의 환자가 없습니다.
            </p>
          )}
        </div>
      )}

      {/* 폴더 목록 */}
      {viewMode === 'folders' && (
        <div className="space-y-3">
          {folders.length > 0 ? (
            folders.map((folder, index) => (
              <div
                key={index}
                onClick={() => handleFolderClick(folder.folder_name)}
                className="flex items-center bg-white rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition"
              >
                <div className="flex-1 text-left leading-tight">
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    {folder.folder_name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    최근 수정 날짜:{' '}
                    {folder.capture_date
                      ? folder.capture_date.split('T')[0]
                      : '날짜 정보 없음'}
                  </p>
                  <p className="text-xs text-gray-500">
                    신체 부위: {folder.body_part || '정보 없음'}
                  </p>
                </div>
                <div className="text-gray-400 text-sm">{'>'}</div>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm text-center mt-10">
              폴더가 없습니다.
            </p>
          )}
        </div>
      )}

      {/* 파일(진단 기록) 목록 */}
      {viewMode === 'records' && (
        <div className="space-y-3">
          {records.length > 0 ? (
            records.map((record) => {
              const hasDoctorNote = record.followup_check && 
                record.followup_check.doctor_risk_level !== '소견 대기';
              const riskLevel = hasDoctorNote
                ? record.followup_check!.doctor_risk_level
                : record.risk_level;
              const riskSource = hasDoctorNote ? '의사' : 'AI';

              return (
                <div
                  key={record.id}
                  onClick={() =>
                    navigate(
                      `/dashboard/doctor/history/${record.photo.folder_name}/${record.id}?user=${selectedPatientId}`,
                      {
                        state: {
                          userName: patients.find(p => p.id === selectedPatientId)?.name,
                          folderDisplay: record.photo.folder_name,
                          diseaseName: record.disease?.name_ko,
                        },
                      }
                    )
                  }
                  className="flex items-center bg-white rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <RiskLevelIcon riskLevel={riskLevel} source={riskSource as 'AI' | '의사'} size={24} />
                    <div className="flex-1 text-left leading-tight">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {record.disease?.name_ko || '진단명 없음'}
                      </h3>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500">
                          {riskSource} 위험도: {riskLevel}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        신체 부위: {record.photo.body_part || '정보 없음'}
                      </p>
                      <p className="text-xs text-gray-500">
                        저장 날짜:{' '}
                        {record.photo.capture_date
                          ? record.photo.capture_date.split('T')[0]
                          : record.analysis_date
                          ? record.analysis_date.split('T')[0]
                          : '정보 없음'}
                      </p>
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm">{'>'}</div>
                </div>
              );
            })
          ) : (
            <p className="text-gray-400 text-sm text-center mt-10">
              진단 결과가 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DoctorHistoryPage;

