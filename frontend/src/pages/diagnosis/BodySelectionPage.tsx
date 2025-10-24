// import React from 'react';
// const BodySelectionPage: React.FC = () => {
//     return <h1>[Diagnosis] 1단계: 부위 선택 페이지</h1>;
//     };
// export default BodySelectionPage;
//
// export {};
// frontend/src/pages/diagnosis/BodySelectionPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Part = '머리/목' | '앞 몸통' | '뒤 몸통' | '팔' | '다리' | '손바닥/발바닥' | '구강/성기';

const ALL_PARTS: Part[] = ['머리/목','앞 몸통','뒤 몸통','팔','다리','손바닥/발바닥','구강/성기'];

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
    // 선택값을 촬영 페이지로 전달
    nav('/diagnosis/capture', { state: { bodyPart } });
  };

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ margin: '8px 0 16px' }}>[Diagnosis] 1단계: 부위 선택</h2>
      <p style={{ color: '#444', marginBottom: 12 }}>이미지 위를 클릭하거나 목록에서 선택하세요.</p>

      {/* (간단 버전) 버튼 목록 — 실제로는 인체 이미지 맵으로 대체 가능 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {ALL_PARTS.map((p) => (
          <button
            key={p}
            onClick={() => handlePick(p)}
            style={{
              padding: '12px 10px',
              borderRadius: 10,
              border: selected === p ? '2px solid #4CAF50' : '1px solid #ddd',
              background: selected === p ? '#E8F5E9' : '#fff',
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* 선택 요약 */}
      <div style={{ marginTop: 16, color: '#333' }}>
        선택된 부위: <b>{selected ?? '미선택'}</b>
      </div>

      {/* 하단 네비게이션 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button
          onClick={() => window.history.back()}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
        >
          이전
        </button>
        <button
          onClick={goNext}
          disabled={!selected}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: selected ? '#4CAF50' : '#9e9e9e',
            color: 'white',
            cursor: selected ? 'pointer' : 'not-allowed',
          }}
        >
          다음(촬영 시작)
        </button>
      </div>

      {/* 머리/목 모달 */}
      {showHeadModal && (
        <div style={modalBackdrop}>
          <div style={modalBox}>
            <h3 style={{ marginTop: 0 }}>선택한 부위가 머리/목이 맞나요?</h3>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0 16px' }}>
              <input
                type="checkbox"
                checked={oralChecked}
                onChange={(e) => setOralChecked(e.target.checked)}
              />
              입 안(구강)이면 체크하세요 → ‘구강/성기’로 저장
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowHeadModal(false)} style={modalBtnSecondary}>취소</button>
              <button onClick={confirmHead} style={modalBtnPrimary}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 성기 모달 */}
      {showGenitalModal && (
        <div style={modalBackdrop}>
          <div style={modalBox}>
            <h3 style={{ marginTop: 0 }}>선택한 부위가 성기 부위가 맞나요?</h3>
            <p style={{ color: '#444' }}>맞다면 ‘구강/성기’로 저장됩니다. 아니면 위쪽 복부를 눌러주세요.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowGenitalModal(false)} style={modalBtnSecondary}>취소</button>
              <button onClick={confirmGenital} style={modalBtnPrimary}>구강/성기로 저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const modalBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
};
const modalBox: React.CSSProperties = {
  width: 'min(92vw, 420px)', background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.25)'
};
const modalBtnPrimary: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: 'none', background: '#4CAF50', color: '#fff', cursor: 'pointer'
};
const modalBtnSecondary: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer'
};

export default BodySelectionPage;
