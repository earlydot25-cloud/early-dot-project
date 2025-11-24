// frontend/src/pages/dashboard/DoctorHistoryPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaMars, FaVenus } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons';

// 메인 페이지와 동일한 아이콘 컴포넌트
type IconCmp = React.FC<IconBaseProps>;
const MarsIcon: IconCmp = (props: IconBaseProps) => <FaMars {...props} />;
const VenusIcon: IconCmp = (props: IconBaseProps) => <FaVenus {...props} />;

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';

// 경로 보정 함수
const resolveMediaUrl = (rawPath?: string) => {
  if (!rawPath) return '';
  let path = rawPath.replace(/\\/g, '/');

  // 이미 절대 URL이면 그대로 사용
  if (/^https?:\/\//i.test(path)) {
    if (API_BASE_URL && !path.includes(API_BASE_URL)) {
      return path;
    }
    return path;
  }
  
  // 상대 경로 처리
  if (path.startsWith('/')) {
    return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  }
  if (path.startsWith('media/')) {
    return API_BASE_URL ? `${API_BASE_URL}/${path}` : `/${path}`;
  }

  if (path.includes('/media/')) {
    const parts = path.split('/media/');
    if (parts.length > 1) {
      return API_BASE_URL ? `${API_BASE_URL}/media/${parts[parts.length - 1]}` : `/media/${parts[parts.length - 1]}`;
    }
  }

  return API_BASE_URL ? `${API_BASE_URL}/media/${path}` : `/media/${path}`;
};

// 이미지 로드 실패 시 대체 컴포넌트
const PhotoThumbnail: React.FC<{ 
  src: string; 
  alt: string;
}> = ({ src, alt }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div className="w-full h-full rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
        <div className="text-gray-400 text-xs text-center">
          <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>이미지 없음</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center relative">
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
};

interface Patient {
  id: number;
  name: string;
  sex?: string; // 성별
  age?: number; // 연령
  ai_risk_level?: string; // AI 위험도
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
    upload_storage_path?: string;
    file_name?: string;
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
  const [sortOption, setSortOption] = useState<'소견 필요순' | '위험도순' | '이름순'>('소견 필요순');
  const [viewMode, setViewMode] = useState<'patients' | 'folders' | 'records'>('patients');
  const [activeTab, setActiveTab] = useState<'all' | 'immediate' | 'observation' | 'normal'>('all');
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

  // ✅ 탭에 따른 필터링
  const tabFilteredPatients = useMemo(() => {
    if (activeTab === 'immediate') {
      // 즉시 주의 환자
      return sortedPatients.filter(p => 
        p.doctor_risk_level === '즉시 주의' ||
        p.has_attention ||
        (p.latest_note && p.latest_note.includes('즉시 주의'))
      );
    } else if (activeTab === 'observation') {
      // 경과 관찰 환자
      return sortedPatients.filter(p => p.doctor_risk_level === '경과 관찰');
    } else if (activeTab === 'normal') {
      // 정상 환자
      return sortedPatients.filter(p => p.doctor_risk_level === '정상');
    }
    // 전체 보기
    return sortedPatients;
  }, [sortedPatients, activeTab]);

  // ✅ 검색 및 필터 적용
  const filteredPatients = useMemo(() => {
    let filtered = tabFilteredPatients;

    // 검색 필터
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 탭으로 이미 필터링되므로 추가 필터 불필요

    return filtered;
  }, [tabFilteredPatients, searchQuery, activeTab]);

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
    <div className="w-full bg-gradient-to-b from-gray-50 to-white px-4 py-5 min-h-screen">
      {/* 헤더 */}
      {viewMode !== 'patients' && (
        <button
          onClick={handleBack}
          className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
        >
          ← 뒤로가기
        </button>
      )}

      {/* 제목 */}
      {viewMode === 'patients' && (
        <>
          <h2 className="text-xl font-bold mb-2 text-gray-900">전체 환자 목록</h2>
          <p className="text-sm text-gray-600 mb-4">
            환자를 선택하면 해당 환자의 폴더 목록을 볼 수 있습니다.
          </p>
        </>
      )}

      {viewMode === 'folders' && selectedPatientId && (
        <h2 className="text-xl font-bold mb-4 text-gray-900">
          {patients.find(p => p.id === selectedPatientId)?.name || '환자'}의 폴더 목록
        </h2>
      )}

      {viewMode === 'records' && (
        <h2 className="text-xl font-bold mb-4 text-gray-900">진단 기록</h2>
      )}

      {/* 검색 및 필터 (환자 목록에서만 표시) */}
      {viewMode === 'patients' && (
        <div className="mb-4 space-y-3">
          {/* 탭 네비게이션 */}
          <div className="flex gap-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-2 px-2 text-sm font-medium ${
                activeTab === 'all'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setActiveTab('immediate')}
              className={`pb-2 px-2 text-sm font-medium ${
                activeTab === 'immediate'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              즉시 주의
            </button>
            <button
              onClick={() => setActiveTab('observation')}
              className={`pb-2 px-2 text-sm font-medium ${
                activeTab === 'observation'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              경과 관찰
            </button>
            <button
              onClick={() => setActiveTab('normal')}
              className={`pb-2 px-2 text-sm font-medium ${
                activeTab === 'normal'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              정상
            </button>
          </div>

          {/* 검색 입력 및 정렬 */}
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="환자 이름 검색..."
                className="w-full pl-4 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="flex-shrink-0">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as '소견 필요순' | '위험도순' | '이름순')}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="소견 필요순">소견 필요순</option>
                <option value="위험도순">위험도순</option>
                <option value="이름순">이름순</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 환자 목록 */}
      {viewMode === 'patients' && (
        <div className="space-y-3">
          {filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => {
              // 위험도에 따른 태그 색상 결정
              const getRiskTagColor = (riskLevel?: string) => {
                if (!riskLevel) return 'bg-gray-200 text-gray-700';
                if (riskLevel === '즉시 주의' || riskLevel === '높음' || riskLevel === '매우 높음') return 'bg-red-100 text-red-700';
                if (riskLevel === '경과 관찰' || riskLevel === '보통') return 'bg-yellow-100 text-yellow-700';
                if (riskLevel === '정상' || riskLevel === '낮음') return 'bg-gray-200 text-gray-700'; // 낮음은 회색
                return 'bg-blue-100 text-blue-700';
              };

              // 성별 아이콘 (메인 페이지와 동일한 로직)
              const patientSex = patient.sex?.toLowerCase();
              const isFemale = patientSex && (
                patientSex === '여성' || 
                patientSex === 'f' || 
                patientSex === 'female' ||
                patientSex === '여' ||
                patientSex === '여자'
              );
              const genderIcon = isFemale 
                ? <VenusIcon className="text-pink-500" size={14} />
                : <MarsIcon className="text-blue-500" size={14} />;

              // AI 위험도 색상
              const getAiRiskColor = (riskLevel?: string) => {
                if (!riskLevel) return 'text-gray-600';
                if (riskLevel === '높음') return 'text-red-600';
                if (riskLevel === '보통') return 'text-yellow-600';
                return 'text-green-600';
              };

              return (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatientId(patient.id)}
                  className="flex items-center bg-white border rounded-lg shadow-sm p-4 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all border-gray-200"
                >
                  <div className="flex-1 text-left">
                    {/* 이름과 태그를 같은 줄에 배치 */}
                    <div className="flex items-start gap-2 mb-2">
                      {/* 성별 아이콘과 이름 그룹 */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {genderIcon}
                        <h3 className="text-lg font-bold text-gray-900">
                          {patient.name}
                        </h3>
                      </div>
                      {/* 태그들 (flex-wrap으로 다음 줄 가능) */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 연령 - 항상 표시 (없으면 "정보 없음") */}
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                          {patient.age ? `만 ${patient.age}세` : '연령 정보 없음'}
                        </span>
                        {/* AI 위험도 - 항상 표시 (없으면 "미분석") */}
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${patient.ai_risk_level ? getRiskTagColor(patient.ai_risk_level) : 'bg-gray-200 text-gray-700'}`}>
                          AI: {patient.ai_risk_level || '미분석'}
                        </span>
                        {/* 소견 대기 태그 */}
                        {patient.needs_review && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                            소견 대기
                          </span>
                        )}
                        {/* 주의 태그 (의사 위험도가 없을 때만 표시) */}
                        {!patient.doctor_risk_level && (patient.has_attention || 
                          (patient.latest_note && (patient.latest_note.includes('즉시 주의') || patient.latest_note.includes('주의')))) && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                            주의
                          </span>
                        )}
                        {/* 의사 위험도 (소견 작성 완료 시) */}
                        {patient.doctor_risk_level && !patient.needs_review && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getRiskTagColor(patient.doctor_risk_level)}`}>
                            의사: {patient.doctor_risk_level}
                          </span>
                        )}
                      </div>
                    </div>
                    {patient.latest_note && (
                      <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-100 line-clamp-2">
                        {patient.latest_note}
                      </p>
                    )}
                  </div>
                  <div className="text-gray-400 ml-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 bg-white rounded-lg shadow-sm border border-gray-200 text-center text-gray-500">
              해당 조건의 환자가 없습니다.
            </div>
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
                className="flex items-center bg-white border rounded-lg shadow-sm p-4 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all border-gray-200"
              >
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {folder.folder_name}
                  </h3>
                  <div className="text-sm text-gray-600 space-y-1 mt-2 pt-2 border-t border-gray-100">
                    <p>
                      <span className="font-semibold text-gray-900">위치:</span> {folder.body_part || '정보 없음'}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-900">최근 수정:</span>{' '}
                      {folder.capture_date
                        ? folder.capture_date.split('T')[0]
                        : '날짜 정보 없음'}
                    </p>
                  </div>
                </div>
                <div className="text-gray-400 ml-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 bg-white rounded-lg shadow-sm border border-gray-200 text-center text-gray-500">
              폴더가 없습니다.
            </div>
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

              // 위험도에 따른 색상
              const getRiskColor = (level: string) => {
                if (level === '높음' || level === '즉시 주의') return 'text-red-600';
                if (level === '보통' || level === '경과 관찰') return 'text-yellow-600';
                if (level === '낮음' || level === '정상') return 'text-green-600';
                return 'text-gray-600';
              };

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
                  className="flex items-center bg-white border rounded-lg shadow-sm p-4 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all border-gray-200"
                >
                  {/* 왼쪽: 사진 썸네일 */}
                  <div className="flex-shrink-0 w-20 h-20">
                    <PhotoThumbnail
                      src={resolveMediaUrl(record.photo.upload_storage_path)}
                      alt={record.photo.file_name || record.disease?.name_ko || '사진'}
                    />
                  </div>

                  {/* 가운데: 텍스트 정보 */}
                  <div className="flex-1 text-left ml-3">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
                      {record.disease?.name_ko || '진단명 없음'}
                    </h3>
                    <p className="text-xs text-gray-500 mb-1">
                      {riskSource} 위험도: <span className={getRiskColor(riskLevel)}>{riskLevel}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      저장 날짜:{' '}
                      {record.photo.capture_date
                        ? record.photo.capture_date.split('T')[0]
                        : record.analysis_date
                        ? record.analysis_date.split('T')[0]
                        : '정보 없음'}
                    </p>
                    {record.photo.body_part && (
                      <p className="text-xs text-gray-500">
                        신체 부위: {record.photo.body_part}
                      </p>
                    )}
                  </div>

                  {/* 오른쪽: 화살표 */}
                  <div className="text-gray-400 ml-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 bg-white rounded-lg shadow-sm border border-gray-200 text-center text-gray-500">
              진단 결과가 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DoctorHistoryPage;

