import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiZap, FiSquare, FiScissors } from 'react-icons/fi';

type Part = '머리/목' | '앞 몸통' | '뒤 몸통' | '옆구리' | '팔' | '다리' | '손바닥/발바닥' | '구강/성기';

const ALL_PARTS: Part[] = ['머리/목','앞 몸통','뒤 몸통','옆구리','팔','다리','손바닥/발바닥','구강/성기'];

// 모바일 디바이스 감지
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const BodySelectionPage: React.FC = () => {
  const nav = useNavigate();
  const [selected, setSelected] = useState<Part | null>(null);
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [showGenitalModal, setShowGenitalModal] = useState(false);
  const [showCameraGuide, setShowCameraGuide] = useState(false);
  const [oralChecked, setOralChecked] = useState(false);

  const handlePick = (p: Part) => {
    if (p === '머리/목') {
      setOralChecked(false);
      setShowHeadModal(true);
      return;
    }
    if (p === '구강/성기') {
      setShowGenitalModal(true);
      return;
    }
    setSelected(p);
  };

  const confirmHead = () => {
    const finalPart: Part = oralChecked ? '구강/성기' : '머리/목';
    setSelected(finalPart);
    setShowHeadModal(false);
  };

  const confirmGenital = () => {
    setSelected('구강/성기');
    setShowGenitalModal(false);
  };

  // 모바일에서 네이티브 카메라 열기
  const openNativeCamera = (bodyPart: Part) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // 후면 카메라 사용
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // 바로 저장 페이지로 이동
        nav('/diagnosis/save', {
          state: {
            file,
            previewUrl: URL.createObjectURL(file),
            bodyPart,
          },
        });
      }
    };
    
    input.click();
  };

  const goNext = () => {
    // 촬영 안내 모달 표시
    setShowCameraGuide(true);
  };

  const proceedToCamera = () => {
    const bodyPart = selected ?? '머리/목';
    setShowCameraGuide(false);
    
    // 모바일이면 네이티브 카메라 열기
    if (isMobile) {
      openNativeCamera(bodyPart);
      return;
    }
    
    // 데스크톱이면 캡처 페이지로 이동
    nav('/diagnosis/capture', { state: { bodyPart } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* 제목 섹션 */}
      <div className="px-4 pt-6 pb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-1">신체 부위 선택</h2>
        <p className="text-sm text-gray-600">검사할 신체 부위를 선택하세요.</p>
      </div>

      {/* 부위 선택 버튼 그리드 */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {ALL_PARTS.map((p) => (
            <button
              key={p}
              onClick={() => handlePick(p)}
              className={`
                px-4 py-5 rounded-xl text-center font-medium transition-all border-2
                ${selected === p 
                  ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-md' 
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm'
                }
              `}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 선택된 부위 표시 */}
      {selected && (
        <div className="px-4 pb-4">
          <div className="text-sm text-gray-500 text-center">
            선택된 부위: <span className="font-semibold text-gray-900">{selected}</span>
          </div>
        </div>
      )}

      {/* 하단 네비게이션 버튼 */}
      <div className="px-4 pb-4">
        <div className="flex justify-between gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            이전
          </button>
          <button
            onClick={goNext}
            disabled={!selected}
            className={`
              flex-1 px-4 py-3 rounded-lg font-medium transition-colors
              ${selected 
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            다음
          </button>
        </div>
      </div>

      {/* 머리/목 모달 */}
      {showHeadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-45 flex items-center justify-center z-50 p-4">
          <div className="bg-white border rounded-lg shadow-sm p-5 w-full max-w-xs">
            <h3 className="text-lg font-bold text-gray-900 mb-4">선택한 부위가 머리/목이 맞나요?</h3>
            <label className="flex items-center gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={oralChecked}
                onChange={(e) => setOralChecked(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">입 안(구강)이면 체크하세요 → '구강/성기'로 저장</span>
            </label>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowHeadModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-medium shadow-sm"
              >
                취소
              </button>
              <button
                onClick={confirmHead}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 구강/성기 모달 */}
      {showGenitalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-45 flex items-center justify-center z-50 p-4">
          <div className="bg-white border rounded-lg shadow-sm p-5 w-full max-w-xs">
            <h3 className="text-lg font-bold text-gray-900 mb-2">선택한 부위가 성기 부위가 맞나요?</h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">맞다면 '구강/성기'로 저장됩니다. <br />아니면 위쪽 복부를 눌러주세요.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowGenitalModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-medium shadow-sm"
              >
                취소
              </button>
              <button
                onClick={confirmGenital}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm"
              >
                구강/성기로 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 촬영 안내 모달 */}
      {showCameraGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-45 flex items-center justify-center z-50 p-3">
          <div className="bg-white border rounded-lg shadow-sm p-5 w-full max-w-xs">
            <h3 className="text-lg font-bold text-gray-900 mb-4">촬영 안내</h3>
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <FiZap className="text-blue-600" size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 mb-1">라이트(플래시) 켜기</p>
                  <p className="text-sm text-gray-600">촬영 전에 라이트 기능을 켜주세요.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <FiSquare className="text-blue-600" size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 mb-1">환부 중앙 배치</p>
                  <p className="text-sm text-gray-600">환부를 화면 정 중앙에 위치시켜 주세요.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <FiScissors className="text-blue-600" size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 mb-1">털이 많은 부위</p>
                  <p className="text-sm text-gray-600">털이 많으면 환부가 잘 보이게 찍어주세요.</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCameraGuide(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-medium shadow-sm"
              >
                취소
              </button>
              <button
                onClick={proceedToCamera}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BodySelectionPage;
