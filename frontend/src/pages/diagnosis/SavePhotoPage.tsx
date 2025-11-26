import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchUserProfile } from '../../services/userServices';

// 백엔드 업로드 엔드포인트
// 환경 변수가 있으면 사용, 없으면 상대 경로 사용 (프록시 또는 같은 도메인)
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';
const API_URL = `${API_BASE_URL}/api/diagnosis/upload/`;

// 드롭다운 공통 옵션
const SEVERITY = ['없음', '약간~보통', '심각'] as const;
const ONSET = ['1주 내', '1달 내', '1년 내', '1년 이상', '선천성', '모름', '없음'] as const;
const SEX = ['남성', '여성', '모름'] as const;

type NavState = {
  file?: File;
  previewUrl?: string;
  bodyPart?: string;
};

const SavePhotoPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: NavState };

  const incomingFile = location.state?.file;
  const incomingPreviewUrl = location.state?.previewUrl;
  const incomingBodyPart = location.state?.bodyPart || '머리/목';

  const [file, setFile] = useState<File | null>(incomingFile ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(incomingPreviewUrl ?? null);
  const [bodyPart] = useState<string>(incomingBodyPart);

  useEffect(() => {
    if (incomingFile) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          sessionStorage.setItem('save_preview', String(reader.result || ''));
          sessionStorage.setItem('save_body_part', incomingBodyPart);
        } catch { /* noop */ }
      };
      reader.readAsDataURL(incomingFile);
    } else if (!incomingFile && !incomingPreviewUrl) {
      const savedPreview = sessionStorage.getItem('save_preview');
      const savedBody = sessionStorage.getItem('save_body_part');
      if (savedPreview) setPreviewUrl(savedPreview);
      if (savedBody) (savedBody !== bodyPart) && sessionStorage.setItem('save_body_part', bodyPart);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [folderName, setFolderName] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileNameTouched, setFileNameTouched] = useState<boolean>(false);
  const [itch, setItch] = useState<typeof SEVERITY[number]>('없음');
  const [pain, setPain] = useState<typeof SEVERITY[number]>('없음');
  const [color, setColor] = useState<typeof SEVERITY[number]>('없음');
  const [infection, setInfection] = useState<typeof SEVERITY[number]>('없음');
  const [blood, setBlood] = useState<typeof SEVERITY[number]>('없음');
  const [onset, setOnset] = useState<typeof ONSET[number]>('1달 내');
  const [sex, setSex] = useState<typeof SEX[number]>('모름');
  const [birth, setBirth] = useState<string>('');
  const [folderList, setFolderList] = useState<string[]>([]);
  const [folderListVisible, setFolderListVisible] = useState<boolean>(false);
  const [folderListLoading, setFolderListLoading] = useState<boolean>(false);
  const [folderListError, setFolderListError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const suggestedName = useMemo(() => {
    if (file?.name) return file.name;
    if (previewUrl) return `capture_${Date.now()}.jpg`;
    return '';
  }, [file, previewUrl]);

  // 회원가입 정보 불러오기
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const profile = await fetchUserProfile();
        console.log('Loaded user profile:', profile); // 디버깅용
        
        // 성별 설정 (백엔드에서 'M', 'F', '남', '여' 등 다양한 형식일 수 있음)
        if (profile.sex) {
          const sexStr = String(profile.sex).trim();
          console.log('Profile sex value:', sexStr); // 디버깅용
          
          const sexValue = sexStr === 'M' || sexStr === '남' || sexStr === '남성' 
            ? '남성' 
            : sexStr === 'F' || sexStr === '여' || sexStr === '여성'
            ? '여성'
            : '모름';
          
          console.log('Converted sex value:', sexValue); // 디버깅용
          setSex(sexValue as typeof SEX[number]);
        } else {
          console.log('No sex value in profile'); // 디버깅용
        }
        
        // 생년월일 설정 (birth_date 필드가 있다면)
        if (profile.birth_date) {
          const birthDate = profile.birth_date;
          console.log('Profile birth_date value:', birthDate); // 디버깅용
          
          // YYYY-MM-DD 형식으로 변환
          const dateStr = typeof birthDate === 'string' 
            ? birthDate.split('T')[0] 
            : new Date(birthDate).toISOString().split('T')[0];
          
          console.log('Converted birth_date:', dateStr); // 디버깅용
          setBirth(dateStr);
        } else {
          console.log('No birth_date value in profile'); // 디버깅용
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
        // 프로필 로드 실패해도 계속 진행
      }
    };
    
    loadUserProfile();
  }, []);

  useEffect(() => {
    setFileNameTouched(false);
    if (suggestedName) setFileName(suggestedName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, previewUrl]);

  useEffect(() => {
    if (!fileNameTouched && suggestedName) setFileName(suggestedName);
  }, [suggestedName, fileNameTouched]);

  const handleRetake = () => {
    navigate('/diagnosis/body-select', { replace: false, state: { bodyPart } });
  };

  const handleRefreshFields = () => {
    setFolderName('');
    setFileName(suggestedName);
    setFileNameTouched(false);
    setItch('없음');
    setPain('없음');
    setColor('없음');
    setInfection('없음');
    setBlood('없음');
    setOnset('1달 내');
    setSex('모름');
    setBirth('');
  };

  const handleToggleFolderList = async () => {
    if (folderListVisible) {
      setFolderListVisible(false);
      return;
    }
    setFolderListLoading(true);
    setFolderListError(null);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE_URL}/api/dashboard/folders/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('폴더 목록 API 오류:', errorText);
        throw new Error('폴더 목록을 불러오지 못했습니다.');
      }
      const data = await res.json();
      console.log('[SavePhotoPage] 폴더 목록 응답:', data);
      const names = Array.isArray(data)
        ? data
            .map((folder: any) => folder?.folder_name)
            .filter((name: string) => typeof name === 'string' && name.trim().length > 0)
        : [];
      console.log('[SavePhotoPage] 추출된 폴더명:', names);
      setFolderList(names);
    } catch (error: any) {
      console.error('Failed to load folder list:', error);
      setFolderListError(error?.message || '폴더 목록을 불러오지 못했습니다.');
    } finally {
      setFolderListLoading(false);
      setFolderListVisible(true);
    }
  };

  const handleSelectFolder = (name: string) => {
    setFolderName(name);
    setFolderListVisible(false);
  };

  const onSubmit = async () => {
    let finalFile: File | null = file;
    if (!finalFile && previewUrl) {
      const [meta, data] = previewUrl.split(',');
      const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
      // MIME 타입에서 확장자 추출
      const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' 
                  : mime.includes('png') ? 'png' 
                  : mime.includes('gif') ? 'gif' 
                  : 'jpg';
      const bin = atob(data);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      // 파일명에 확장자가 없으면 추가
      const fileExt = fileName && fileName.includes('.') 
        ? fileName.split('.').pop() 
        : ext;
      const fullFileName = fileName 
        ? (fileName.includes('.') ? fileName : `${fileName}.${fileExt}`)
        : `capture_${Date.now()}.${fileExt}`;
      finalFile = new File([u8], fullFileName, { type: mime });
    }

    if (!finalFile) {
      alert('업로드할 이미지가 없습니다. 다시 촬영하거나 갤러리에서 선택해주세요.');
      return;
    }
    if (!fileName) {
      alert('사진명을 입력해주세요.');
      return;
    }

    // 폴더명이 없으면 기본값 사용
    const finalFolderName = folderName || `default_${Date.now()}`;

    const fd = new FormData();
    
    let finalFileName = fileName.trim();
    if (!finalFileName) {
      finalFileName = suggestedName || `capture_${Date.now()}.jpg`;
    }
    if (!finalFileName.includes('.')) {
      const originalName = finalFile.name;
      const extension = originalName.includes('.') 
        ? originalName.split('.').pop() 
        : 'jpg';
      finalFileName = `${finalFileName}.${extension}`;
    }
    
    // 백엔드 모델의 실제 필드명인 'upload_storage_path' 사용
    // FormData.append의 세 번째 인자는 파일명이므로 확장자를 포함한 파일명 사용
    fd.append('upload_storage_path', finalFile, finalFileName);
    fd.append('folder_name', finalFolderName);
    fd.append('file_name', finalFileName);
    fd.append('body_part', bodyPart);
    fd.append('symptoms_itch', itch);
    fd.append('symptoms_pain', pain);
    fd.append('symptoms_color', color);
    fd.append('symptoms_infection', infection);
    fd.append('symptoms_blood', blood);
    fd.append('onset_date', onset);
    fd.append('meta_sex', sex);
    if (birth) {
      const y = Number(birth.slice(0, 4));
      const now = new Date();
      const age = now.getFullYear() - y;
      fd.append('meta_age', String(age));
    } else {
      fd.append('meta_age', String(30));
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(API_URL, { 
        method: 'POST', 
        body: fd,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMessage = '업로드 실패';
        try {
          const errJson = JSON.parse(errText);
          // details가 있으면 더 상세한 에러 메시지 표시
          if (errJson.details) {
            const detailsStr = JSON.stringify(errJson.details, null, 2);
            errMessage = `${errJson.error || '업로드 실패'}\n\n상세 내용:\n${detailsStr}`;
            console.error('업로드 실패 상세:', errJson.details);
          } else {
            errMessage = errJson.error || errJson.detail || JSON.stringify(errJson);
          }
        } catch {
          errMessage = errText || '업로드 실패';
        }
        console.error('업로드 실패 응답:', errText);
        setIsSubmitting(false);
        alert(errMessage);
        return;
      }
      const data = await res.json();
      console.log('[SavePhotoPage] 업로드 성공 응답:', data);
      console.log('[SavePhotoPage] result_id:', data.result_id);
      console.log('[SavePhotoPage] photo_id:', data.photo_id);
      console.log('[SavePhotoPage] id (사용할 ID):', data.id);
      
      // 응답에서 id를 확인하거나 photo 객체의 id 사용
      // result_id가 있으면 result_id를 우선 사용 (AI 예측이 완료된 경우)
      const resultId = data.result_id || data.id || data.photo?.id;
      console.log('[SavePhotoPage] 최종 사용할 ID:', resultId);
      
      if (resultId) {
        navigate(`/diagnosis/detail/${resultId}`, { replace: true });
      } else {
        alert('업로드는 성공했지만 결과 페이지로 이동할 수 없습니다.');
      }
    } catch (e: any) {
      console.error('업로드 중 예외:', e);
      alert(`업로드 실패: ${e.message || '네트워크 오류가 발생했습니다.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-md mx-auto">
        {/* 로딩 오버레이 */}
        {isSubmitting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-xl max-w-[300px] w-full mx-4">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-700 text-center">수초 ~ 수분 소요됩니다.</p>
              </div>
            </div>
          </div>
        )}

        {/* 제목 */}
        <div className="px-4 pt-6 pb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-left">사진 저장</h2>
        </div>

        {/* 미리보기 카드 */}
        <div className="px-4 pb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 shadow-sm">
            <div className="flex gap-4 mb-4">
              <div className="flex-1 h-48 bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
                {previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt="preview" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                    미리보기가 없습니다
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={handleRetake}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  카메라 다시 촬영
                </button>
                <button 
                  onClick={handleRefreshFields}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors whitespace-nowrap"
                >
                  기입 내역 새로고침
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 폼 카드 */}
        <div className="px-4 pb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4 shadow-sm">
            <div className="space-y-4">
              {/* 기본 정보 */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">폴더명</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="예) 김민준_25"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleToggleFolderList}
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-600 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    aria-label="폴더 목록 열기"
                  >
                    ☰
                  </button>
                </div>
                {folderListVisible && (
                  <div className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {folderListLoading ? (
                      <p className="px-4 py-3 text-sm text-gray-500">불러오는 중...</p>
                    ) : folderListError ? (
                      <p className="px-4 py-3 text-sm text-red-500">{folderListError}</p>
                    ) : folderList.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500">폴더가 존재하지 않습니다.</p>
                    ) : (
                      <ul>
                        {folderList.map((name) => (
                          <li key={name}>
                            <button
                              type="button"
                              onClick={() => handleSelectFolder(name)}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50"
                            >
                              {name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">사진명</label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => {
                    setFileNameTouched(true);
                    setFileName(e.target.value);
                  }}
                  placeholder="예) capture_123.jpg"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">확장자를 포함해 입력하거나 비워두면 자동 생성됩니다.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">신체부위</label>
                <input
                  type="text"
                  value={bodyPart}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              {/* 증상 정보 */}
              <div className="pt-2 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">증상 정보</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">가려움</label>
                    <select 
                      value={itch} 
                      onChange={(e) => setItch(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      {SEVERITY.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">통증</label>
                    <select 
                      value={pain} 
                      onChange={(e) => setPain(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      {SEVERITY.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">색변화</label>
                    <select 
                      value={color} 
                      onChange={(e) => setColor(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      {SEVERITY.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">상처로 인한 감염</label>
                    <select 
                      value={infection} 
                      onChange={(e) => setInfection(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      {SEVERITY.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">출혈</label>
                    <select 
                      value={blood} 
                      onChange={(e) => setBlood(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      {SEVERITY.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">발병시기</label>
                    <select 
                      value={onset} 
                      onChange={(e) => setOnset(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      {ONSET.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* 개인 정보 */}
              <div className="pt-2 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">개인 정보</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">성별</label>
                    <select 
                      value={sex} 
                      onChange={(e) => setSex(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      {SEX.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">생년월일</label>
                    <input
                      type="date"
                      value={birth}
                      onChange={(e) => setBirth(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="px-4 pb-4">
          <button 
            onClick={onSubmit}
            className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            제출하고 결과로 이동
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavePhotoPage;
