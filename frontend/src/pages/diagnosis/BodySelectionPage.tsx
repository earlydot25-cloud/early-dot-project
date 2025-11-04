import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Part = '머리/목' | '앞 몸통' | '뒤 몸통' | '옆구리' | '팔' | '다리' | '손바닥/발바닥' | '구강/성기';

const ALL_PARTS: Part[] = ['머리/목','앞 몸통','뒤 몸통','옆구리','팔','다리','손바닥/발바닥','구강/성기'];

const BodySelectionPage: React.FC = () => {
  const nav = useNavigate();
  const [selected, setSelected] = useState<Part | null>(null);
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [showGenitalModal, setShowGenitalModal] = useState(false);
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

  const goNext = () => {
    const bodyPart = selected ?? '머리/목';
    nav('/diagnosis/capture', { state: { bodyPart } });
  };

  return (
    <div className="py-4">
      {/* 제목 섹션 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">[Diagnosis] 1단계: 부위 선택</h2>
        <p className="text-gray-600 text-sm">검사할 신체 부위를 목록에서 선택하세요.</p>
      </div>

      {/* 부위 선택 버튼 그리드 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {ALL_PARTS.map((p) => (
          <button
            key={p}
            onClick={() => handlePick(p)}
            className={`
              px-4 py-4 rounded-lg text-center font-medium transition-all
              ${selected === p 
                ? 'bg-blue-50 border-2 border-blue-500 text-blue-700' 
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            {p}
          </button>
        ))}
      </div>

      {/* 선택 요약 카드 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="text-sm text-gray-600">
          선택된 부위: <span className="font-bold text-gray-900">{selected ?? '미선택'}</span>
        </div>
      </div>

      {/* 하단 네비게이션 버튼 */}
      <div className="flex justify-between gap-3 mt-8">
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
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-400 text-white cursor-not-allowed'
            }
          `}
        >
          다음(촬영 시작)
        </button>
      </div>

      {/* 머리/목 모달 */}
      {showHeadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-45 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">선택한 부위가 머리/목이 맞나요?</h3>
            <label className="flex items-center gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={oralChecked}
                onChange={(e) => setOralChecked(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">입 안(구강)이면 체크하세요 → '구강/성기'로 저장</span>
            </label>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowHeadModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium"
              >
                취소
              </button>
              <button
                onClick={confirmHead}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
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
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">선택한 부위가 성기 부위가 맞나요?</h3>
            <p className="text-sm text-gray-600 mb-6">맞다면 '구강/성기'로 저장됩니다. 아니면 위쪽 복부를 눌러주세요.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowGenitalModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium"
              >
                취소
              </button>
              <button
                onClick={confirmGenital}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
              >
                구강/성기로 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BodySelectionPage;
