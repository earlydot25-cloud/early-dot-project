// frontend/src/pages/dashboard/HistoryPage.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';

interface Folder {
  folder_name: string;
  body_part: string;
  capture_date: string | null;
  upload_storage_path: string;
  max_risk_level?: string; // 최고 위험도 (심각도순 정렬용)
}

// 신체 부위 목록 (BodySelectionPage와 동일)
const BODY_PARTS = ['전체', '머리/목', '앞 몸통', '뒤 몸통', '옆구리', '팔', '다리', '손바닥/발바닥', '구강/성기'];

type SortOption = '최신순' | '심각도순' | '가나다순';

const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]); // 원본 데이터 저장
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('최신순');
  const [filterBodyPart, setFilterBodyPart] = useState<string>('전체');

  // ✅ 현재 사용자의 폴더 목록 불러오기
  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await axios.get<Folder[]>(`${API_BASE_URL}/api/dashboard/folders/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        console.log('[HistoryPage] 폴더 목록 응답:', response.data);
        setAllFolders(response.data); // 원본 데이터 저장
        applyFiltersAndSort(response.data); // 필터 및 정렬 적용
      } catch (err: any) {
        console.error('Failed to fetch folders:', err);
        console.error('Error details:', err.response?.data || err.message);
        setFolders([]);
        setAllFolders([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFolders();
  }, []);

  // 필터 및 정렬 적용 함수 (useCallback으로 메모이제이션)
  const applyFiltersAndSort = React.useCallback((foldersToProcess: Folder[]) => {
    let filtered = [...foldersToProcess];

    // 1. 부위별 필터링
    if (filterBodyPart !== '전체') {
      filtered = filtered.filter(folder => folder.body_part === filterBodyPart);
    }

    // 2. 정렬
    if (sortOption === '최신순') {
      filtered.sort((a, b) => {
        const dateA = a.capture_date ? new Date(a.capture_date).getTime() : 0;
        const dateB = b.capture_date ? new Date(b.capture_date).getTime() : 0;
        return dateB - dateA; // 최신순 (내림차순)
      });
    } else if (sortOption === '심각도순') {
      // 위험도 우선순위
      const riskPriority: Record<string, number> = {
        '즉시 주의': 5,
        '높음': 4,
        '경과 관찰': 3,
        '보통': 3,
        '중간': 2,
        '낮음': 1,
        '정상': 0,
        '분석 대기': -1,
      };
      
      filtered.sort((a, b) => {
        const priorityA = riskPriority[a.max_risk_level || '분석 대기'] || 0;
        const priorityB = riskPriority[b.max_risk_level || '분석 대기'] || 0;
        if (priorityB !== priorityA) {
          return priorityB - priorityA; // 심각도순 (내림차순)
        }
        // 심각도가 같으면 최신순으로 정렬
        const dateA = a.capture_date ? new Date(a.capture_date).getTime() : 0;
        const dateB = b.capture_date ? new Date(b.capture_date).getTime() : 0;
        return dateB - dateA;
      });
    } else if (sortOption === '가나다순') {
      // 한글 가나다 순 정렬 (오름차순)
      filtered.sort((a, b) => {
        const nameA = a.folder_name || '';
        const nameB = b.folder_name || '';
        return nameA.localeCompare(nameB, 'ko', { numeric: true, sensitivity: 'base' });
      });
    }

    setFolders(filtered);
  }, [filterBodyPart, sortOption]);

  // 필터 또는 정렬 옵션 변경 시 적용
  useEffect(() => {
    if (allFolders.length > 0) {
      applyFiltersAndSort(allFolders);
    }
  }, [allFolders, applyFiltersAndSort]);

  if (isLoading) {
    return (
      <div className="w-full bg-white px-4 py-5">
        <div className="text-center text-gray-500 mt-10">로딩 중...</div>
      </div>
    );
  }

  // 폴더 선택/해제
  const toggleFolderSelection = (folderName: string) => {
    setSelectedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedFolders.size === folders.length) {
      setSelectedFolders(new Set());
    } else {
      setSelectedFolders(new Set(folders.map(f => f.folder_name)));
    }
  };

  // 폴더 삭제
  const handleDeleteFolders = async () => {
    if (selectedFolders.size === 0) {
      alert('삭제할 폴더를 선택해주세요.');
      return;
    }

    if (!window.confirm(`선택한 ${selectedFolders.size}개의 폴더를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      let successCount = 0;
      let failCount = 0;

      for (const folderName of Array.from(selectedFolders)) {
        try {
          await axios.delete(`/api/dashboard/folders/${encodeURIComponent(folderName)}/delete/`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to delete folder ${folderName}:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        alert(`${successCount}개의 폴더가 삭제되었습니다.${failCount > 0 ? ` (${failCount}개 실패)` : ''}`);
        // 목록 새로고침
        const response = await axios.get<Folder[]>('/api/dashboard/folders/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFolders(response.data);
        setSelectedFolders(new Set());
        setIsEditMode(false);
      } else {
        alert('폴더 삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="w-full bg-white px-4 py-5">
      <h2 className="text-lg font-bold mb-1 text-left">진단 내역</h2>
      <p className="text-xs text-gray-500 mb-4 text-left">
        폴더 별로 병변 부위를 손쉽게 추적하세요!
      </p>

      {/* 수정/삭제 탭 및 정렬/필터 */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex gap-1 border-b border-gray-200">
            <button
              onClick={() => {
                setIsEditMode(false);
                setSelectedFolders(new Set());
              }}
              className={`px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                !isEditMode
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              조회
            </button>
            <button
              onClick={() => setIsEditMode(true)}
              className={`px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                isEditMode
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              수정/삭제
            </button>
          </div>
          {/* 정렬 및 필터 */}
          <div className="flex gap-1 items-center flex-1 justify-end min-w-0">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="text-xs border border-gray-300 rounded-md px-1.5 py-1 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none w-auto max-w-[75px]"
            >
              <option value="최신순">최신순</option>
              <option value="심각도순">심각도순</option>
              <option value="가나다순">가나다순</option>
            </select>
            <select
              value={filterBodyPart}
              onChange={(e) => setFilterBodyPart(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-1.5 py-1 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none w-auto max-w-[90px] truncate"
            >
              {BODY_PARTS.map((part) => (
                <option key={part} value={part === '전체' ? '전체' : part}>
                  {part}
                </option>
              ))}
            </select>
          </div>
        </div>
        {isEditMode && (
          <div className="flex gap-2 justify-end">
            <button
              onClick={toggleSelectAll}
              className="text-xs px-2 py-1 text-blue-600 hover:text-blue-700"
            >
              {selectedFolders.size === folders.length ? '전체 해제' : '전체 선택'}
            </button>
            {selectedFolders.size > 0 && (
              <button
                onClick={handleDeleteFolders}
                className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                삭제 ({selectedFolders.size})
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {folders.length > 0 ? (
          folders.map((folder, index) => (
            <div
              key={index}
              onClick={() => {
                if (!isEditMode) {
                  navigate(`/dashboard/history/${folder.folder_name}`);
                }
              }}
              className={`flex items-center bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition gap-3 ${
                isEditMode ? 'cursor-default' : 'cursor-pointer'
              } ${selectedFolders.has(folder.folder_name) ? 'ring-2 ring-blue-500' : ''}`}
            >
              {/* 체크박스 (수정 모드일 때만) */}
              {isEditMode && (
                <input
                  type="checkbox"
                  checked={selectedFolders.has(folder.folder_name)}
                  onChange={() => toggleFolderSelection(folder.folder_name)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
              )}
              <div className="flex-1 text-left leading-tight">
                {/* 폴더명 (수정 모드에서는 클릭 가능) */}
                {isEditMode && editingFolder === folder.folder_name ? (
                  <input
                    type="text"
                    value={editFolderName}
                    onChange={(e) => setEditFolderName(e.target.value)}
                    onBlur={async () => {
                      if (editFolderName && editFolderName !== folder.folder_name) {
                        try {
                          const token = localStorage.getItem('accessToken');
                          await axios.patch(
                            `/api/dashboard/folders/${encodeURIComponent(folder.folder_name)}/update/`,
                            { folder_name: editFolderName },
                            {
                              headers: {
                                Authorization: `Bearer ${token}`,
                              },
                            }
                          );
                          // 목록 새로고침
                          const response = await axios.get<Folder[]>('/api/dashboard/folders/', {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          setFolders(response.data);
                        } catch (err) {
                          console.error('Update error:', err);
                          alert('수정 중 오류가 발생했습니다.');
                        }
                      }
                      setEditingFolder(null);
                      setEditFolderName('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === 'Escape') {
                        setEditFolderName(folder.folder_name);
                        setEditingFolder(null);
                      }
                    }}
                    className="text-base font-semibold text-gray-900 mb-1 w-full border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                ) : (
                  <h3
                    className={`text-base font-semibold text-gray-900 mb-1 ${
                      isEditMode ? 'cursor-pointer hover:text-blue-600 underline' : ''
                    }`}
                    onClick={(e) => {
                      if (isEditMode) {
                        e.stopPropagation();
                        setEditingFolder(folder.folder_name);
                        setEditFolderName(folder.folder_name);
                      }
                    }}
                    title={isEditMode ? '클릭하여 폴더명 수정' : ''}
                  >
                    {folder.folder_name}
                  </h3>
                )}
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
    </div>
  );
};

export default HistoryPage;
