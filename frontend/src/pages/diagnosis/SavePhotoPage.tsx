import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchUserProfile } from '../../services/userServices';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useToast } from '../../contexts/ToastContext';
import ProgressIndicator, { ProgressStep } from '../../components/ProgressIndicator';

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
  const { showSuccess, showError, showInfo } = useToast();

  const incomingFile = location.state?.file;
  const incomingPreviewUrl = location.state?.previewUrl;
  const incomingBodyPart = location.state?.bodyPart || '머리/목';

  const [file, setFile] = useState<File | null>(incomingFile ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(incomingPreviewUrl ?? null);
  const [bodyPart] = useState<string>(incomingBodyPart);
  
  // 크롭 관련 상태
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // 이미지 로드 시 초기 크롭 영역 설정 (더 작은 영역으로 시작)
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const { naturalWidth, naturalHeight } = img;
    const { width, height } = img;
    
    // 이미지 비율 저장
    const aspectRatio = naturalWidth / naturalHeight;
    setImageAspectRatio(aspectRatio);
    
    // 이미지의 작은 쪽을 기준으로 60% 크기로 시작
    const minDimension = Math.min(naturalWidth, naturalHeight);
    const maxDimension = Math.max(naturalWidth, naturalHeight);
    const cropSizePercent = (minDimension * 0.6 / maxDimension) * 100;
    
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: Math.min(cropSizePercent, 60), // 최대 60%
        },
        1, // 정사각형 비율
        width,
        height
      ),
      width,
      height
    );
    setCrop(crop);
  };

  // 크롭된 이미지를 File로 변환
  const getCroppedImg = async (
    image: HTMLImageElement,
    pixelCrop: PixelCrop,
    fileName: string
  ): Promise<File> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context가 없습니다.');
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      pixelCrop.width * scaleX,
      pixelCrop.height * scaleY,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas가 비어있습니다.'));
          return;
        }
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        resolve(file);
      }, 'image/jpeg', 0.95);
    });
  };

  // 사진 잘라내기 적용 핸들러
  const handleApplyCrop = async () => {
    if (!completedCrop || !imgRef.current || !previewUrl) {
      alert('잘라낼 이미지가 없습니다.');
      return;
    }

    try {
      const image = imgRef.current;
      const croppedFile = await getCroppedImg(
        image,
        completedCrop,
        file?.name || `cropped_${Date.now()}.jpg`
      );
      
      // 잘라낸 이미지 미리보기 생성
      const reader = new FileReader();
      reader.onload = () => {
        setCroppedPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(croppedFile);
      
      setCroppedFile(croppedFile);
      showSuccess('사진이 잘라졌습니다.');
    } catch (error) {
      console.error('사진 잘라내기 실패:', error);
      showError('사진 잘라내기에 실패했습니다.');
    }
  };

  // 사진 잘라내기 취소 핸들러
  const handleCancelCrop = () => {
    setCrop(undefined);
    setCompletedCrop(undefined);
    setCroppedFile(null);
    setCroppedPreviewUrl(null);
  };

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
      const res = await fetch('/api/dashboard/folders/', {
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
    // 시간 측정 시작
    const startTime = Date.now();
    const startTimeStr = new Date().toLocaleString('ko-KR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
    console.log(`[SavePhotoPage] 제출 버튼 클릭 시간: ${startTimeStr}`);
    
    // 크롭된 파일이 있으면 우선 사용
    let finalFile: File | null = croppedFile || file;
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
      showError('업로드할 이미지가 없습니다. 다시 촬영하거나 갤러리에서 선택해주세요.');
      return;
    }
    if (!fileName) {
      showError('사진명을 입력해주세요.');
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
        showError(errMessage);
        return;
      }
      const data = await res.json();
      const uploadEndTime = Date.now();
      const uploadDuration = ((uploadEndTime - startTime) / 1000).toFixed(2);
      
      console.log('[SavePhotoPage] 업로드 성공 응답:', data);
      console.log('[SavePhotoPage] result_id:', data.result_id);
      console.log('[SavePhotoPage] photo_id:', data.photo_id);
      console.log('[SavePhotoPage] id (사용할 ID):', data.id);
      console.log(`[SavePhotoPage] 업로드 완료 시간: ${new Date().toLocaleString('ko-KR', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
      })}`);
      console.log(`[SavePhotoPage] 업로드 소요 시간: ${uploadDuration}초`);
      
      // 응답에서 id를 확인하거나 photo 객체의 id 사용
      // result_id가 있으면 result_id를 우선 사용 (AI 예측이 완료된 경우)
      const resultId = data.result_id || data.id || data.photo?.id;
      console.log('[SavePhotoPage] 최종 사용할 ID:', resultId);
      
      if (resultId) {
        const navigationStartTime = Date.now();
        navigate(`/diagnosis/detail/${resultId}`, { replace: true });
        
        // 결과 페이지 로드 완료는 ResultDetailPage에서 측정
        // 여기서는 네비게이션 시작 시간만 기록
        console.log(`[SavePhotoPage] 결과 페이지 이동 시작 시간: ${new Date().toLocaleString('ko-KR', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          hour12: false 
        })}`);
        console.log(`[SavePhotoPage] 제출 버튼 클릭부터 결과 페이지 이동까지 총 소요 시간: ${((navigationStartTime - startTime) / 1000).toFixed(2)}초`);
        showSuccess('진단 요청이 완료되었습니다. 결과를 확인하세요.');
      } else {
        showError('업로드는 성공했지만 결과 페이지로 이동할 수 없습니다.');
      }
    } catch (e: any) {
      console.error('업로드 중 예외:', e);
      showError(`업로드 실패: ${e.message || '네트워크 오류가 발생했습니다.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-md mx-auto">
        {/* 로딩 오버레이 - 진행 상태 표시 */}
        {isSubmitting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 shadow-xl max-w-md w-full mx-4">
              <ProgressIndicator
                steps={[
                  { label: '이미지 업로드', status: 'completed' },
                  { label: '털 제거 처리', status: 'active' },
                  { label: 'AI 분석', status: 'pending' },
                  { label: '결과 생성', status: 'pending' },
                ]}
                currentStep={1}
              />
            </div>
          </div>
        )}
        
        {/* 펄스 애니메이션 스타일 */}
        <style>{`
          @keyframes pulse-ring {
            0% {
              transform: scale(0.8);
              opacity: 0.6;
            }
            50% {
              transform: scale(1.2);
              opacity: 0.2;
            }
            100% {
              transform: scale(1.4);
              opacity: 0;
            }
          }
          
          @keyframes pulse-heart {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.1);
            }
          }
        `}</style>

        {/* 제목 */}
        <div className="px-4 pt-6 pb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-left">사진 저장</h2>
        </div>

        {/* 미리보기 카드 */}
        <div className="px-4 pb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 shadow-sm">
            {/* 사진 잘라내기 안내 텍스트 */}
            {previewUrl && !croppedPreviewUrl && (
              <div className="mb-3 text-center">
                <p className="text-sm text-gray-600 font-medium">환부 영역을 정사각형으로 선택해주세요</p>
                <p className="text-xs text-gray-500 mt-1">드래그하여 잘라낼 영역을 조정할 수 있습니다</p>
              </div>
            )}
            
            {/* 이미지 크롭 영역 - 이미지 비율에 맞춰 동적 조정 */}
            <div className="mb-4">
              {previewUrl ? (
                <div className="relative w-full rounded-lg overflow-hidden border-2 border-gray-300 shadow-lg">
                  {croppedPreviewUrl ? (
                    // 잘라낸 이미지 표시
                    <div className="relative w-full bg-gray-50">
                      <div className="flex items-center justify-center">
                        <img 
                          src={croppedPreviewUrl} 
                          alt="잘라낸 사진 미리보기" 
                          className="max-w-full max-h-[500px] object-contain rounded-lg shadow-md" 
                        />
                      </div>
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                        잘라내기 완료
                      </div>
                    </div>
                  ) : (
                    // 사진 잘라내기 도구 표시 - 이미지 크기에 맞춰 동적 조정 (패딩 없음)
                    <div className="relative w-full flex items-center justify-center" style={{ 
                      maxHeight: '500px'
                    }}>
                      <div className="flex items-center justify-center">
                        <ReactCrop
                          crop={crop}
                          onChange={(_, percentCrop) => setCrop(percentCrop)}
                          onComplete={(c) => setCompletedCrop(c)}
                          aspect={1}
                          minWidth={30}
                          minHeight={30}
                          style={{ 
                            maxWidth: '100%', 
                            maxHeight: '500px',
                            display: 'inline-block'
                          }}
                        >
                          <img
                            ref={imgRef}
                            src={previewUrl}
                            alt="preview"
                            style={{ 
                              maxWidth: '100%',
                              maxHeight: '500px',
                              display: 'block',
                              width: 'auto',
                              height: 'auto',
                              margin: '0 auto'
                            }}
                            onLoad={onImageLoad}
                          />
                        </ReactCrop>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full bg-gray-900 rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center" style={{ minHeight: '200px' }}>
                  <div className="text-gray-400 text-sm">미리보기가 없습니다</div>
                </div>
              )}
            </div>
            
            {/* 사진 잘라내기 제어 버튼 */}
            {previewUrl && !croppedPreviewUrl && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={handleApplyCrop}
                  disabled={!completedCrop}
                  className="flex-1 px-4 py-3 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md disabled:shadow-none"
                >
                  사진 잘라내기
                </button>
                <button
                  onClick={handleCancelCrop}
                  className="px-4 py-3 rounded-lg border-2 border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </div>
            )}
            
            {/* 잘라낸 후 다시 잘라내기 버튼 */}
            {croppedPreviewUrl && (
              <div className="mb-4">
                <button
                  onClick={handleCancelCrop}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-blue-500 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  사진 다시 잘라내기
                </button>
              </div>
            )}
            
            {/* 하단 버튼들 */}
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
              <button 
                onClick={handleRetake}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                카메라 다시 촬영
              </button>
              <button 
                onClick={handleRefreshFields}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                기입 내역 새로고침
              </button>
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
                      style={{ fontSize: '16px' }}
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
                      style={{ fontSize: '16px' }}
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
                      style={{ fontSize: '16px' }}
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
                      style={{ fontSize: '16px' }}
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
                      style={{ fontSize: '16px' }}
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
                      style={{ fontSize: '16px' }}
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
                      style={{ fontSize: '16px' }}
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-900"
                      style={{
                        WebkitAppearance: 'none',
                        MozAppearance: 'textfield',
                        appearance: 'none',
                        minHeight: '44px', // 모바일 터치 친화적 크기
                        fontSize: '16px', // 모바일에서 확대 방지
                        color: birth ? '#111827' : '#9CA3AF', // 값이 있으면 진한 색, 없으면 회색
                      }}
                      placeholder="YYYY-MM-DD"
                    />
                    {/* 모바일에서 값이 보이지 않을 경우를 위한 대체 표시 */}
                    {birth && (
                      <p className="text-xs text-gray-600 mt-1.5 font-medium">
                        선택된 날짜: {birth.split('-').join('. ')}
                      </p>
                    )}
                    {!birth && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        생년월일을 선택해주세요
                      </p>
                    )}
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
            style={{ fontSize: '18px' }}
          >
            제출하고 결과로 이동
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavePhotoPage;
