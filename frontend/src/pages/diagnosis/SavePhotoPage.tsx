import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoPreview from '../../components/PhotoPreview';
import { useCaptureStore } from '../../hooks/useCaptureStore';
import { uploadCase } from '../../services/uploadService';
import axios from 'axios';

// =======================
// 타입 정의
// =======================
type SymptomOption = '없음' | '약간' | '보통' | '심함';

interface SaveFormValues {
  folderName: string;
  fileName: string;
  bodyPart: string;
  itch: SymptomOption;
  pain: SymptomOption;
  colorChange: SymptomOption;
  infection: SymptomOption;
  bleeding: SymptomOption;
  onset: string;
  gender: '남' | '여' | '기타';
  birth: string;
}

// =======================
// 상수 정의
// =======================
const SYMPTOM_OPTIONS: SymptomOption[] = ['없음', '약간', '보통', '심함'];
const ONSET_OPTIONS = ['1주 이내', '1달 이내', '3달 이내', '6달 이내', '6달 이상'];

// =======================
// 메인 컴포넌트
// =======================
export default function SavePhotoPage() {
  const navigate = useNavigate();
  const { bodyPart, capturedImage } = useCaptureStore();
  const [submitting, setSubmitting] = useState(false);
  const fileBlobRef = useRef<Blob | null>(null);

  // 가입 시 기본값 (실제 서비스에서는 사용자 프로필에서 불러옴)
//   const defaultGender: '남' | '여' | '기타' = '남';
//   const defaultBirth = '1995-01-01';
  const [userInfo, setUserInfo] = useState<{ gender: '남' | '여' | '기타'; birth: string } | null>(null);

useEffect(() => {
  axios
    .get<{ sex: string; birth: string }>('/api/auth/profile/', { withCredentials: true })
    .then((res) => {
      const data = res.data;
      setUserInfo({ gender: data.sex === 'M' ? '남' : data.sex === 'F' ? '여' : '기타', birth: data.birth });
      setForm((prev) => ({
        ...prev,
        gender: data.sex === 'M' ? '남' : data.sex === 'F' ? '여' : '기타',
        birth: data.birth,
      }));
    })
    .catch((err) => {
      console.error('유저 정보 불러오기 실패:', err);
    });
}, []);


  // 폼 상태
  const [form, setForm] = useState<SaveFormValues>({
    folderName: makeDefaultFolderName(),
    fileName: makeDefaultFileName(),
    bodyPart: bodyPart ?? '',
    itch: '없음',
    pain: '없음',
    colorChange: '없음',
    infection: '없음',
    bleeding: '없음',
    onset: '1달 이내',
    gender: '남', // 임시(API 로 덮어씌워짐)
    birth: '', // 임시(위와 동일)
  });

  // =======================
  // 이미지 → Blob 변환
  // =======================
  useEffect(() => {
    if (!capturedImage) return;
    (async () => {
      const blob = await (await fetch(capturedImage)).blob();
      fileBlobRef.current = blob;
    })();
  }, [capturedImage]);

  // =======================
  // 필수 데이터 없을 경우
  // =======================
  if (!bodyPart || !capturedImage) {
    return (
      <div className="p-6">
        <p className="text-red-600 font-medium">필수 데이터가 없습니다. 촬영 단계로 이동합니다.</p>
        <button
          className="mt-4 px-4 py-2 rounded bg-black text-white"
          onClick={() => navigate('/diagnosis/capture')}
        >
          촬영으로 이동
        </button>
      </div>
    );
  }

  // =======================
  // 핸들러
  // =======================
  const onResetFields = () => {
  setForm((prev) => ({
    ...prev,
    folderName: makeDefaultFolderName(),
    fileName: makeDefaultFileName(),
    itch: '없음',
    pain: '없음',
    colorChange: '없음',
    infection: '없음',
    bleeding: '없음',
    onset: '1달 이내',
    gender: userInfo?.gender || '기타',
    birth: userInfo?.birth || '',
  }));
};


  const onChange = (key: keyof SaveFormValues, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async () => {
  if (!fileBlobRef.current) {
    alert('이미지 변환 중입니다. 잠시 후 다시 시도해 주세요.');
    return;
  }
  if (!form.folderName || !form.fileName) {
    alert('폴더명과 사진명을 입력해 주세요.');
    return;
  }

  // 1. 나이 계산 (단순 연 나이)
  const birthYear = Number(form.birth.split('-')[0]);
  const nowYear = new Date().getFullYear();
  const ageGuess = nowYear - birthYear;

  // 2. 백엔드에서 요구하는 key로 다시 매핑
  const backendPayload = {
    body_part: form.bodyPart,
    symptoms_itch: form.itch,
    symptoms_pain: form.pain,
    symptoms_color: form.colorChange,
    symptoms_infection: form.infection,
    symptoms_blood: form.bleeding,
    onset_date: form.onset,
    meta_age: ageGuess.toString(),
    meta_sex: form.gender,
    folder_name: form.folderName,
    file_name: form.fileName,
  };

  setSubmitting(true);
  try {
    const { caseId } = await uploadCase(backendPayload, fileBlobRef.current);
    navigate(`/diagnosis/detail/${caseId}`);
  } catch (error) {
    console.error(error);
    alert('업로드 중 오류가 발생했습니다.');
  } finally {
    setSubmitting(false);
  }
};


  // =======================
  // 렌더링
  // =======================
  return (
    <div className="p-5 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold">저장 페이지 – 혁준</h1>

      {/* 환부 사진 + 카메라 촬영 버튼 */}
      <div className="space-y-3">
        <PhotoPreview src={capturedImage} />
        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded border"
            onClick={() => navigate('/diagnosis/capture')}
          >
            카메라 촬영
          </button>
          <button className="px-4 py-2 rounded border" onClick={onResetFields}>
            기입 내역 새로고침
          </button>
        </div>
      </div>

      {/* 폴더명 / 사진명 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField
          label="폴더명"
          value={form.folderName}
          placeholder="예: 2025-10-24_torso"
          onChange={(v) => onChange('folderName', v)}
        />
        <InputField
          label="사진명"
          value={form.fileName}
          placeholder="예: torso_001"
          onChange={(v) => onChange('fileName', v)}
        />
      </div>

      {/* 신체부위 (수정 불가) */}
      <div>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">신체부위 (수정 불가)</span>
          <input
            className="border rounded px-3 py-2 bg-gray-100"
            value={form.bodyPart}
            disabled
          />
        </label>
      </div>

      {/* 증상 드롭다운 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {([
          ['itch', '가려움'],
          ['pain', '통증'],
          ['colorChange', '색변화'],
          ['infection', '상처로 인한 감염'],
          ['bleeding', '출혈'],
        ] as const).map(([key, label]) => (
          <SelectField
            key={key}
            label={label}
            options={SYMPTOM_OPTIONS}
            value={form[key]}
            onChange={(v) => onChange(key, v)}
          />
        ))}

        <SelectField
          label="발병시기"
          options={ONSET_OPTIONS}
          value={form.onset}
          onChange={(v) => onChange('onset', v)}
        />

        <SelectField
          label="성별"
          options={['남', '여', '기타']}
          value={form.gender}
          onChange={(v) => onChange('gender', v)}
        />

        <InputField
          label="생년월일"
          type="date"
          value={form.birth}
          onChange={(v) => onChange('birth', v)}
        />
      </div>

      {/* 제출 버튼 */}
      <div className="pt-2">
        <button
          className="px-5 py-3 rounded bg-black text-white disabled:opacity-60"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? '제출 중…' : '제출'}
        </button>
      </div>
    </div>
  );
}

// =======================
// 서브 컴포넌트
// =======================
function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-600">{label}</span>
      <input
        type={type}
        className="border rounded px-3 py-2"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-600">{label}</span>
      <select
        className="border rounded px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

// =======================
// 유틸 함수
// =======================
function makeDefaultFolderName() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function makeDefaultFileName() {
  return `photo_${Date.now()}`;
}
