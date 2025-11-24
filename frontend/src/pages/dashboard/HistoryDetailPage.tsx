// frontend/src/pages/dashboard/HistoryDetailPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

// API BASE URL (환경 변수 또는 기본값)
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

// 경로 보정 함수
const resolveMediaUrl = (rawPath?: string) => {
  if (!rawPath) return '';
  let path = rawPath.replace(/\\/g, '/');

  // 이미 절대 URL이면 그대로 사용
  if (/^https?:\/\//i.test(path)) {
    // ngrok URL이나 다른 호스트를 API_BASE_URL로 정규화 (필요시)
    if (API_BASE_URL && !path.includes(API_BASE_URL)) {
      // 절대 URL이지만 다른 호스트인 경우는 그대로 사용
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

interface RecordItem {
  id: number;
  risk_level: string;
  analysis_date: string;
  disease?: { name_ko?: string } | null;
  photo: {
    id: number;
    folder_name: string;
    file_name?: string;
    body_part: string;
    capture_date: string;
    upload_storage_path?: string;
  };
  followup_check?: {
    doctor_risk_level: string;
    doctor_note?: string;
  } | null;
  vlm_analysis_text?: string | null;
}

interface Patient {
  id: number;
  name: string;
}

function useQuery() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

// 이미지 로드 실패 시 대체 컴포넌트
const PhotoThumbnail: React.FC<{ 
  src: string; 
  alt: string;
  riskLevel: string;
  riskSource: 'AI' | '의사' | '대기';
}> = ({ src, alt, riskLevel, riskSource }) => {
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

const HistoryDetailPage: React.FC = () => {
  const { folderName } = useParams();
  const query = useQuery();
  const userId = query.get('user');
  const navigate = useNavigate();
  const location = useLocation();

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [folderFromDB, setFolderFromDB] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<Set<number>>(new Set());
  const [editingFileName, setEditingFileName] = useState<number | null>(null);
  const [editFileName, setEditFileName] = useState<string>('');

  // ✅ 환자명 로드 (의사용일 때만)
  useEffect(() => {
    if (!userId) {
      // 일반인용: 현재 사용자 이름 가져오기 (localStorage에서)
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setUserName(user.name || user.email || '사용자');
        } catch {
          setUserName('사용자');
        }
      }
      return;
    }

    // 의사용: 환자 이름 가져오기
    const fetchUserName = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await axios.get<Patient[]>('/api/dashboard/patients/', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const patient = response.data.find((p) => String(p.id) === String(userId));
        if (patient) setUserName(patient.name);
      } catch (err) {
        console.error('Failed to fetch patient name:', err);
        setUserName('환자');
      }
    };

    fetchUserName();
  }, [userId]);

  // ✅ 폴더명 DB에서 로드
  useEffect(() => {
    if (!folderName) {
      setIsLoading(false);
      return;
    }

    const fetchRecords = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        // userId가 있으면 해당 사용자, 없으면 현재 사용자 (일반인용)
        const params: any = { folder: folderName };
        if (userId) {
          params.user = userId;
        }
        
        const response = await axios.get<RecordItem[]>('/api/dashboard/records/', {
          params,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setRecords(response.data);
        if (response.data.length > 0) {
          setFolderFromDB(response.data[0].photo.folder_name);
        }
      } catch (err) {
        console.error('Failed to fetch records:', err);
        setRecords([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecords();
  }, [userId, folderName]);

  const finalFolderDisplay = useMemo(
    () => folderFromDB || folderName || '폴더',
    [folderFromDB, folderName]
  );

  // 뒤로가기 핸들러: 폴더 목록으로 이동
  const handleBack = () => {
    if (userId) {
      // 의사용: 환자 목록으로 이동
      navigate(`/dashboard/doctor/history?user=${userId}`);
    } else {
      // 일반 사용자용: 폴더 목록으로 이동
      navigate('/dashboard/history');
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
      <button
        onClick={handleBack}
        className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
      >
        ← 뒤로가기
      </button>

      {/* 경로 표시 */}
      <p className="text-xs text-gray-500 mb-2 text-left">
        {userName ? `${userName} > ${finalFolderDisplay}` : '로딩 중...'}
      </p>

      <h2 className="text-lg font-bold mb-3 text-left">질환 목록</h2>

      {/* 수정/삭제 탭 */}
      <div className="flex items-center justify-end mb-4">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => {
              setIsEditMode(false);
              setSelectedRecords(new Set());
            }}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
              !isEditMode
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            조회
          </button>
          <button
            onClick={() => setIsEditMode(true)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
              isEditMode
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            수정/삭제
          </button>
        </div>
        {isEditMode && (
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => {
                if (selectedRecords.size === records.length) {
                  setSelectedRecords(new Set());
                } else {
                  setSelectedRecords(new Set(records.map(r => r.id)));
                }
              }}
              className="text-xs px-2 py-1 text-blue-600 hover:text-blue-700"
            >
              {selectedRecords.size === records.length ? '전체 해제' : '전체 선택'}
            </button>
            {selectedRecords.size > 0 && (
              <button
                onClick={async () => {
                  if (!window.confirm(`선택한 ${selectedRecords.size}개의 파일을 삭제하시겠습니까?`)) {
                    return;
                  }

                  try {
                    const token = localStorage.getItem('accessToken');
                    const response = await axios.request<{ deleted_count: number; errors?: string[] }>({
                      method: 'DELETE',
                      url: '/api/dashboard/records/bulk/delete/',
                      headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                      },
                      data: {
                        ids: Array.from(selectedRecords),
                      } as any,
                    });

                    if (response.data.deleted_count > 0) {
                      alert(`${response.data.deleted_count}개의 파일이 삭제되었습니다.`);
                      // 목록 새로고침
                      const params: any = { folder: folderName };
                      if (userId) params.user = userId;
                      const res = await axios.get<RecordItem[]>('/api/dashboard/records/', {
                        params,
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      setRecords(res.data);
                      setSelectedRecords(new Set());
                      setIsEditMode(false);
                    }
                  } catch (err) {
                    console.error('Delete error:', err);
                    alert('삭제 중 오류가 발생했습니다.');
                  }
                }}
                className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                삭제 ({selectedRecords.size})
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {records.length > 0 ? (
          records.map((r) => {
            const hasDoctorNote = r.followup_check && 
              r.followup_check.doctor_risk_level && 
              r.followup_check.doctor_risk_level !== '소견 대기';
            const riskLevel = hasDoctorNote && r.followup_check
              ? r.followup_check.doctor_risk_level
              : r.risk_level || '분석 대기';
            const riskSource = hasDoctorNote ? '의사' : (r.disease ? 'AI' : '대기');

            return (
              <div
                key={r.id}
                onClick={() => {
                  if (!isEditMode) {
                    // 일반인용인지 의사용인지 확인
                    const isDoctorPath = window.location.pathname.includes('/doctor/');
                    const basePath = isDoctorPath ? '/dashboard/doctor/history' : '/dashboard/history';
                    navigate(
                      `${basePath}/${folderName}/${r.id}${userId ? `?user=${userId}` : ''}`,
                      {
                        state: {
                          userName,
                          folderDisplay: finalFolderDisplay,
                          diseaseName: r.disease?.name_ko || r.photo.file_name,
                        },
                      }
                    );
                  }
                }}
                className={`flex items-center bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition gap-3 ${
                  isEditMode ? 'cursor-default' : 'cursor-pointer'
                } ${selectedRecords.has(r.id) ? 'ring-2 ring-blue-500' : ''}`}
              >
                {/* 체크박스 (수정 모드일 때만) */}
                {isEditMode && (
                  <input
                    type="checkbox"
                    checked={selectedRecords.has(r.id)}
                    onChange={() => {
                      setSelectedRecords(prev => {
                        const next = new Set(prev);
                        if (next.has(r.id)) {
                          next.delete(r.id);
                        } else {
                          next.add(r.id);
                        }
                        return next;
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                )}
                {/* 왼쪽: 사진 썸네일 */}
                <div className="flex-shrink-0 w-20 h-20">
                  <PhotoThumbnail
                    src={resolveMediaUrl(r.photo.upload_storage_path)}
                    alt={r.photo.file_name || r.disease?.name_ko || '사진'}
                    riskLevel={riskLevel}
                    riskSource={riskSource as 'AI' | '의사' | '대기'}
                  />
                </div>

                {/* 가운데: 텍스트 정보 */}
                <div className="flex-1 text-left leading-tight min-w-0 ml-3">
                  {/* 파일명 (수정 모드에서는 클릭 가능) */}
                  {isEditMode && editingFileName === r.id ? (
                    <input
                      type="text"
                      value={editFileName}
                      onChange={(e) => setEditFileName(e.target.value)}
                      onBlur={async () => {
                        if (editFileName && editFileName !== r.photo.file_name) {
                          try {
                            const token = localStorage.getItem('accessToken');
                            await axios.patch(`/api/dashboard/records/${r.id}/update/`, {
                              file_name: editFileName,
                            }, {
                              headers: {
                                Authorization: `Bearer ${token}`,
                              },
                            });
                            // 목록 새로고침
                            const params: any = { folder: folderName };
                            if (userId) params.user = userId;
                            const res = await axios.get<RecordItem[]>('/api/dashboard/records/', {
                              params,
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            setRecords(res.data);
                          } catch (err) {
                            console.error('Update error:', err);
                            alert('수정 중 오류가 발생했습니다.');
                          }
                        }
                        setEditingFileName(null);
                        setEditFileName('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        } else if (e.key === 'Escape') {
                          setEditFileName(r.photo.file_name || '');
                          setEditingFileName(null);
                        }
                      }}
                      className="text-sm font-semibold text-gray-900 mb-1 w-full border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  ) : (
                    <h3 
                      className={`text-sm font-semibold text-gray-900 mb-1 truncate ${
                        isEditMode ? 'cursor-pointer hover:text-blue-600 underline' : ''
                      }`}
                      onClick={(e) => {
                        if (isEditMode) {
                          e.stopPropagation();
                          setEditingFileName(r.id);
                          setEditFileName(r.photo.file_name || '');
                        }
                      }}
                      title={isEditMode ? '클릭하여 파일명 수정' : ''}
                    >
                      {r.disease?.name_ko || r.photo.file_name || '분석 대기 중'}
                    </h3>
                  )}
                  <p className="text-xs text-gray-500 mb-1">
                    {riskSource} 위험도: {riskLevel || '정보 없음'}
                  </p>
                  <p className="text-xs text-gray-500">
                    저장 날짜:{' '}
                    {r.photo.capture_date
                      ? r.photo.capture_date.split('T')[0]
                      : r.analysis_date
                      ? r.analysis_date.split('T')[0]
                      : '정보 없음'}
                  </p>
                  {/* 신체 부위 (읽기 전용) */}
                  {r.photo.body_part && (
                    <p className="text-xs text-gray-500">
                      신체 부위: {r.photo.body_part}
                    </p>
                  )}
                </div>

                {/* 오른쪽: 화살표 */}
                <div className="flex-shrink-0 text-gray-400 text-sm">{'>'}</div>
              </div>
            );
          })
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
