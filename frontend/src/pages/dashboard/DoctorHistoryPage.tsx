// frontend/src/pages/dashboard/DoctorHistoryPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import RiskLevelIcon from '../../components/RiskLevelIcon';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';

interface Patient {
  id: number;
  name: string;
  latest_note?: string;
  has_attention?: boolean; // 주의가 필요한 환자 여부
  doctor_risk_level?: string; // 의사가 선정한 위험도
  needs_review?: boolean; // 소견 미작성 여부
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
  const [sortOption, setSortOption] = useState<'소견 필요순' | '위험도순' | '이름순'>('소견 필요순');
  const [viewMode, setViewMode] = useState<'patients' | 'folders' | 'records'>('patients');
  const [isLoading, setIsLoading] = useState(true);

  // ✅ 환자 목록 불러오기
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await axios.get<Patient[]>(`${API_BASE_URL}/api/dashboard/patients/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        console.log('[DoctorHistoryPage] 환자 목록 응답:', response.data);
        setPatients(response.data);
      } catch (err: any) {
        console.error('Failed to fetch patients:', err);
        console.error('Error details:', err.response?.data || err.message);
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
        console.log('[DoctorHistoryPage] 폴더 목록 요청: patient_id=', selectedPatientId);
        const response = await axios.get<Folder[]>(`${API_BASE_URL}/api/dashboard/folders/`, {
          params: { user: selectedPatientId },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        console.log('[DoctorHistoryPage] 폴더 목록 응답:', response.data);
        setFolders(response.data);
        setViewMode('folders');
      } catch (err: any) {
        console.error('Failed to fetch folders:', err);
        console.error('Error details:', err.response?.data || err.message);
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
      console.log('[DoctorHistoryPage] 진단 기록 요청: patient_id=', selectedPatientId, 'folder=', folderName);
      const response = await axios.get<RecordItem[]>(`${API_BASE_URL}/api/dashboard/records/`, {
        params: { user: selectedPatientId, folder: folderName },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log('[DoctorHistoryPage] 진단 기록 응답:', response.data);
      setRecords(response.data);
      setViewMode('records');
    } catch (err: any) {
      console.error('Failed to fetch records:', err);
      console.error('Error details:', err.response?.data || err.message);
      setRecords([]);
    }
  };

  // ✅ 환자 정렬 (소견 필요순, 위험도순, 이름순)
  const normalizedPatients = useMemo(
    () =>
      patients.map((patient) => ({
        ...patient,
        needs_review:
          typeof patient.needs_review === 'boolean' ? patient.needs_review : true,
      })),
    [patients]
  );

  const sortedPatients = useMemo(() => {
    let sorted = [...normalizedPatients];

    if (sortOption === '소견 필요순') {
      // 소견 미작성 환자 우선, 그 다음 위험도순
      const needsReview = sorted.filter(p => p.needs_review);
      const reviewed = sorted.filter(p => !p.needs_review);
      
      // 위험도 우선순위
      const riskPriority: Record<string, number> = {
        '즉시 주의': 3,
        '경과 관찰': 2,
        '정상': 1,
        '소견 대기': 0,
      };
      
      // 소견 미작성 환자: AI 위험도 또는 기본값으로 정렬
      const sortedNeedsReview = needsReview.sort((a, b) => {
        const priorityA = riskPriority[a.doctor_risk_level || ''] || 0;
        const priorityB = riskPriority[b.doctor_risk_level || ''] || 0;
        if (priorityB !== priorityA) return priorityB - priorityA;
        return a.name.localeCompare(b.name);
      });
      
      // 소견 작성 완료 환자: 위험도순
      const sortedReviewed = reviewed.sort((a, b) => {
        const priorityA = riskPriority[a.doctor_risk_level || ''] || 0;
        const priorityB = riskPriority[b.doctor_risk_level || ''] || 0;
        if (priorityB !== priorityA) return priorityB - priorityA;
        return a.name.localeCompare(b.name);
      });
      
      sorted = [...sortedNeedsReview, ...sortedReviewed];
    } else if (sortOption === '위험도순') {
      // 의사가 선정한 위험도 기준으로 정렬 (소견 미작성은 하단)
      const riskPriority: Record<string, number> = {
        '즉시 주의': 3,
        '경과 관찰': 2,
        '정상': 1,
        '소견 대기': 0,
      };
      
      sorted.sort((a, b) => {
        // 소견 미작성 환자는 하단
        if (a.needs_review && !b.needs_review) return 1;
        if (!a.needs_review && b.needs_review) return -1;
        
        const priorityA = riskPriority[a.doctor_risk_level || ''] || 0;
        const priorityB = riskPriority[b.doctor_risk_level || ''] || 0;
        if (priorityB !== priorityA) return priorityB - priorityA;
        return a.name.localeCompare(b.name);
      });
    } else if (sortOption === '이름순') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true, sensitivity: 'base' }));
    }

    return sorted;
  }, [normalizedPatients, sortOption]);

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
          return (
            p.has_attention ||
            (p.latest_note && (p.latest_note.includes('즉시 주의') || p.latest_note.includes('주의')))
          );
        }
        if (riskFilter === '소견 필요') {
          return !!p.needs_review;
        }
        return (p.doctor_risk_level || '') === riskFilter;
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

      {/* 검색 및 필터 (환자 목록에서만 표시) */}
      {viewMode === 'patients' && (
        <div className="mb-4 space-y-2">
          {/* 검색 입력 */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="환자 이름 검색..."
              className="w-full pl-3 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>
          
          {/* 필터 및 정렬 */}
          <div className="flex gap-2">
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="flex-1 text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400"
            >
              <option value="전체 보기">전체 보기</option>
              <option value="주의 환자">주의 환자</option>
              <option value="경과 관찰">경과 관찰</option>
              <option value="소견 필요">소견 필요</option>
              <option value="소견 대기">소견 대기</option>
              <option value="정상">정상</option>
            </select>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as '소견 필요순' | '위험도순' | '이름순')}
              className="flex-1 text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400"
            >
              <option value="소견 필요순">소견 필요순</option>
              <option value="위험도순">위험도순</option>
              <option value="이름순">이름순</option>
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
                className={`flex items-center rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition bg-white ${
                  patient.needs_review
                    ? 'border-2 border-yellow-300'
                    : patient.doctor_risk_level === '경과 관찰'
                    ? 'border-2 border-orange-200'
                    : patient.doctor_risk_level === '정상'
                    ? 'border-2 border-green-200'
                    : patient.has_attention ||
                      (patient.latest_note && (patient.latest_note.includes('즉시 주의') || patient.latest_note.includes('주의')))
                    ? 'border-2 border-red-200'
                    : 'border border-gray-200'
                }`}
              >
                <div className="flex-1 text-left leading-tight">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">
                      {patient.name}
                    </h3>
                    {patient.needs_review && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                        소견 필요
                      </span>
                    )}
                    {(patient.has_attention || 
                      (patient.latest_note && (patient.latest_note.includes('즉시 주의') || patient.latest_note.includes('주의')))) && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        주의
                      </span>
                    )}
                    {patient.doctor_risk_level && !patient.needs_review && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {patient.doctor_risk_level}
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

