// src/pages/auth/SignupPage.tsx
import React, { useMemo, useState } from "react";
import { signupUser, signupUserMultipart } from "../../services/authServices";
import { useNavigate } from "react-router-dom";

/* -----------------------------------------------------------------------------
 * 유틸 함수들
 * ---------------------------------------------------------------------------*/
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** 생년월일(YYYY-MM-DD) → 만 나이 계산 */
function calcAge(isoDate?: string) {
  if (!isoDate) return undefined;
  const t = new Date();
  const b = new Date(isoDate);
  if (isNaN(b.getTime())) return undefined;
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
}

/** 비밀번호 규칙 체크(클라이언트 사이드 가이드용) */
function usePasswordRules(password: string, email: string) {
  const emailId = email.split("@")[0] ?? "";
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9\s]/.test(password);
  const hasSpace = /\s/.test(password);
  const lengthOk = password.length >= 8 && password.length <= 64;
  const notIncludeEmailId = emailId ? !password.toLowerCase().includes(emailId.toLowerCase()) : true;
  return {
    lengthOk, hasUpper, hasLower, hasDigit, hasSpecial,
    noSpace: !hasSpace, notIncludeEmailId,
    allOk: lengthOk && hasUpper && hasLower && hasDigit && hasSpecial && !hasSpace && notIncludeEmailId,
  };
}
// ⬆️ usePasswordRules, korError 아래쯤에 추가
type FHUI = "yes" | "no" | "unknown" | "";

function uiToFHCode(ui: FHUI | undefined): "Y" | "N" | "U" {
  switch (ui) {
    case "yes": return "Y";
    case "unknown": return "U";
    // "no" 또는 미선택/빈문자 → 기본 N
    default: return "N";
  }
}

/** DRF 에러 맵 → 한국어 문구로 병합 출력 */
function korError(errors: Record<string, string> = {}) {
  // 서버에서 평탄화된 {field: "message"} 형식을 받는다고 가정
  const map: Record<string, string> = {
    "This password is too common.": "비밀번호가 너무 흔합니다.",
    "This password is too short. It must contain at least 8 characters.": "비밀번호 길이가 너무 짧습니다(최소 8자).",
    "Enter a valid email address.": "올바른 이메일 형식이 아닙니다.",
    "A user with that email already exists.": "이미 등록된 이메일입니다.",
    "This field is required.": "이 필드는 필수입니다.",
    "is not a valid choice.": "허용되지 않는 값입니다.",
  };

  const label = (field: string) =>
    field === "email" ? "이메일"
    : field === "password" ? "비밀번호"
    : field === "name" ? "이름"
    : field === "sex" ? "성별"
    : field === "age" ? "나이"
    : field === "family_history" ? "가족력"
    : field === "specialty" ? "전문의 분야"
    : field === "hospital" ? "소속 병원"
    : field === "license_file" ? "면허 증빙 파일"
    : field === "referral_uid" ? "식별 코드"
    : field;

  const lines: string[] = [];
  for (const [field, raw] of Object.entries(errors)) {
    let msg = raw || "";
    for (const [en, ko] of Object.entries(map)) msg = msg.replaceAll(en, ko);
    lines.push(`${label(field)}: ${msg}`);
  }
  return lines.length ? lines.join("\n") : "입력 값을 확인해주세요.";
}

/* -----------------------------------------------------------------------------
 * 입력 상태 타입
 * ---------------------------------------------------------------------------*/
interface FormState {
  isDoctor: boolean;
  byDoctorReferral: boolean;
  referralCode: string;
  email: string;
  password: string;
  password2: string;
  name: string;
  birth: string;
  gender: "male" | "female" | "";
  familyHistory: "yes" | "no" | "unknown" | "";
  specialty: string;
  hospital: string;
  licenseFile: File | null;
  referral_uid: string;
}

/* -----------------------------------------------------------------------------
 * 공용 UI 컴포넌트
 * ---------------------------------------------------------------------------*/
function Field({ label, help, error, children, required }:{
  label?: React.ReactNode; help?: React.ReactNode; error?: React.ReactNode;
  children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-semibold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {help && <p className="text-[12px] text-slate-500">{help}</p>}
      {error && <p className="text-[12px] font-medium text-rose-600">{error}</p>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-2xl border border-sky-300 bg-white px-4 py-4 text-[15px] text-slate-800 placeholder:text-slate-400",
        "outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-200",
        props.className
      )}
    />
  );
}

function PasswordChecklist({ rules }: { rules: ReturnType<typeof usePasswordRules> }) {
  const Row = ({ ok, text }: { ok: boolean; text: string }) => (
    <li className="flex items-center gap-2 text-[13px]">
      <span className={cx("inline-block h-2.5 w-2.5 rounded-full", ok ? "bg-emerald-500" : "bg-slate-300")} />
      <span className={ok ? "text-emerald-700" : "text-slate-600"}>{text}</span>
    </li>
  );
  return (
    <ul className="space-y-1.5">
      <Row ok={rules.lengthOk} text="길이 8~64자" />
      <Row ok={rules.hasUpper} text="대문자 최소 1자 포함 (A-Z)" />
      <Row ok={rules.hasLower} text="소문자 최소 1자 포함 (a-z)" />
      <Row ok={rules.hasDigit} text="숫자 최소 1자 포함 (0-9)" />
      <Row ok={rules.hasSpecial} text="특수문자 최소 1자 포함 (!@# 등)" />
      <Row ok={rules.noSpace} text="공백(띄어쓰기) 없음" />
      <Row ok={rules.notIncludeEmailId} text="이메일 아이디(@앞 부분) 미포함" />
    </ul>
  );
}

function CapsuleSelect({ id, checked, onChange, label }:{
  id: string; checked: boolean; onChange: () => void; label: string;
}) {
  return (
    <div>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <label
        htmlFor={id}
        className={cx(
          "flex items-center justify-between rounded-full border px-4 py-3 transition",
          checked ? "border-sky-500 bg-sky-50/50" : "border-sky-300 bg-white"
        )}
      >
        <span className="text-[15px] font-medium text-slate-800">{label}</span>
        <span className={cx("relative grid place-items-center rounded-full bg-white","h-6 w-6 border",checked ? "border-sky-500" : "border-sky-300")}>
          <span className={cx("h-3.5 w-3.5 rounded-full transition", checked ? "bg-sky-500" : "bg-transparent")} />
        </span>
      </label>
    </div>
  );
}

function Chip({ selected, onClick, className, children }:{
  selected?: boolean; onClick?: () => void; className?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-[15px] font-medium transition-all",
        selected
          ? "border-sky-500 bg-sky-50 text-sky-700 shadow-[inset_0_0_0_1px_rgba(2,132,199,0.2)]"
          : "border-sky-300 bg-white text-slate-600 hover:bg-slate-50",
        className
      )}
    >
      {children}
    </button>
  );
}

/* -----------------------------------------------------------------------------
 * 메인 컴포넌트
 * ---------------------------------------------------------------------------*/
export default function SignupPage() {
  /* 1) 입력 상태 */
  const [f, setF] = useState<FormState>({
    isDoctor: false,
    byDoctorReferral: false,
    referralCode: "",
    email: "",
    password: "",
    password2: "",
    name: "",
    birth: "",
    gender: "",
    familyHistory: "no", // 기본 '아니요'로 보이게
    specialty: "",
    hospital: "",
    licenseFile: null,
    referral_uid: "",
  });

  /* 2) UI/제출 상태 */
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  /* 3) 파생값/검증 */
  const rules = usePasswordRules(f.password, f.email);
  const age = useMemo(() => calcAge(f.birth), [f.birth]);
  const passwordMatch = f.password.length > 0 && f.password === f.password2;

  const requireReferral = !f.isDoctor && f.byDoctorReferral;
  const requireDoctorFields = f.isDoctor;
  const baseOk = !!(f.email && rules.allOk && passwordMatch && f.name && f.birth && f.gender);
  const doctorOk = !requireDoctorFields || (f.specialty && f.hospital && f.licenseFile);
  const referralOk = !requireReferral || !!f.referralCode;
  const patientFamilyOk = f.isDoctor ? true : !!f.familyHistory;
  const canSubmit = Boolean(baseOk && doctorOk && referralOk && patientFamilyOk);

  const update = <K extends keyof FormState>(key: K) => (v: FormState[K]) =>
    setF((s) => ({ ...s, [key]: v }));

  /* 4) API 헬퍼 */
  const API_BASE = (process.env.REACT_APP_API_BASE_URL?.replace(/\/+$/, "") || "http://localhost:8000");

  ///** 로그인: SimpleJWT(TokenObtainPairView) — Users.USERNAME_FIELD=email */
  //async function loginUser(payload: { email: string; password: string }) {
  //  const res = await fetch(`${API_BASE}/api/auth/login/`, {
  //    method: "POST",
  //    headers: { "Content-Type": "application/json" },
  //    body: JSON.stringify(payload),
  //  });
  //  const data = await res.json().catch(() => ({}));
  //  if (!res.ok) throw new Error(data?.detail || "로그인 실패");
  //  return data as { access: string; refresh: string };
  //}

  /* 5) 제출 핸들러 */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;

    setBusy(true);
    setErr(null);

    try {
      // (1) 파생값 계산
      const ageVal = calcAge(f.birth);
      if (ageVal == null) throw new Error("생년월일에서 나이를 계산할 수 없습니다.");

      const sexForAPI: "M" | "F" | undefined =
        f.gender === "male" ? "M" :
        f.gender === "female" ? "F" : undefined;
      if (!sexForAPI) throw new Error("성별을 선택해주세요.");

      // 가족력: 선택 안 해도 기본 'N'으로 보냄(의사 가입도 동일하게 넣어서 백엔드 누락 방지)
      const familyForAPI: "Y" | "N" | "U" = uiToFHCode(f.familyHistory);

      // (2) 회원가입 호출
      let result:
        | { ok: true; data: any }
        | { ok: false; status: number; errors: Record<string, string> };

      if (f.isDoctor) {
        // --- 의사 가입 (multipart) ---
        if (!f.specialty || !f.hospital || !f.licenseFile) {
          throw new Error("의사 가입: 전문의/병원/면허 파일이 필요합니다.");
        }

        result = await signupUserMultipart({
          email: f.email,
          password: f.password,
          name: f.name,
          sex: sexForAPI,
          age: ageVal,
          is_doctor: true,
          family_history: familyForAPI, // ← 타입에 없으면 authServices.ts 타입에 추가 필요
          specialty: f.specialty,
          hospital: f.hospital,
          license_file: f.licenseFile,
        });
      } else {
        // --- 일반(환자) 가입 (JSON) ---
        // 권고 코드가 숫자(ID)여야 할 경우 체크
        if (f.byDoctorReferral) {
          const n = Number(f.referralCode);
          if (!Number.isInteger(n) || n <= 0) {
            throw new Error("식별 코드는 숫자(ID)여야 합니다.");
          }
        }

        result = await signupUser({
          email: f.email,
          password: f.password,
          name: f.name,
          sex: sexForAPI,
          age: ageVal,
          family_history: familyForAPI,
          is_doctor: false,
          referral_uid: f.byDoctorReferral ? Number(f.referralCode) : undefined,
        });
      }

      // (3) 실패면 에러 표시하고 종료(자동 로그인 금지)
      if (!result.ok) {
        setErr(korError(result.errors));
        return;
      }

      // (4) 성공 시 자동 로그인 → 토큰 저장
      //const tokens = await loginUser({ email: f.email, password: f.password });
      //localStorage.setItem("accessToken", tokens.access);
      //localStorage.setItem("refreshToken", tokens.refresh);
      // (4) 성공 시: 혹시 남아 있는 토큰/유저 흔적 정리하고 로그인 화면으로 보냄
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("token");
      localStorage.removeItem("idToken");
      localStorage.removeItem("user");
      nav("/login", { replace: true, state: { justSignedUp: true } });
    } catch (e: any) {
      setErr(e?.message || "회원가입에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  /* 6) 렌더 */
  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-[480px] bg-white px-4 pb-10 pt-6">
      <h1 className="text-[22px] font-extrabold leading-tight text-slate-900">처음 오셨군요, 반가워요!</h1>
      <p className="mb-6 mt-1 text-[13px] text-slate-500">몇 가지 정보를 입력하면 바로 시작할 수 있어요.</p>

      {err && <p className="mb-3 whitespace-pre-line text-[13px] text-rose-600">{err}</p>}

      <form onSubmit={onSubmit} className="space-y-5">
        {/* 1) 의사 여부 */}
        <Field label="의사로 활동하기 위해 가입을 진행하시나요?" required>
          <CapsuleSelect
            id="doctor"
            checked={f.isDoctor}
            onChange={() => update("isDoctor")(!f.isDoctor)}
            label="예, 의사로 활동을 희망합니다"
          />
        </Field>

        {/* 2) 권고 가입 (의사 아닐 때만) */}
        {!f.isDoctor && (
          <Field label="의료진의 권고사항으로 가입하시나요?">
            <CapsuleSelect
              id="referral"
              checked={f.byDoctorReferral}
              onChange={() => update("byDoctorReferral")(!f.byDoctorReferral)}
              label="예, 의료진의 권고로 가입합니다"
            />
          </Field>
        )}

        {/* 3) 식별 코드 */}
        {!f.isDoctor && f.byDoctorReferral && (
          <Field label="전달받으신 식별 코드를 입력해주세요.">
            <Input
              placeholder="예: 12345"
              value={f.referralCode}
              onChange={(e) => update("referralCode")(e.target.value)}
            />
          </Field>
        )}

        {/* 공통 정보 */}
        <Field label="이메일 (ID)" required>
          <Input
            type="email"
            placeholder="Email@example.com"
            value={f.email}
            onChange={(e) => update("email")(e.target.value)}
          />
        </Field>

        <Field label="비밀번호" required>
          <Input
            type="password"
            placeholder="비밀번호"
            value={f.password}
            onChange={(e) => update("password")(e.target.value)}
          />
          <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/50 p-3">
            <PasswordChecklist rules={rules} />
          </div>
        </Field>

        <Field
          label="비밀번호 확인"
          error={f.password2 && !passwordMatch ? "비밀번호가 일치하지 않습니다." : undefined}
          required
        >
          <Input
            type="password"
            placeholder="비밀번호 재입력"
            value={f.password2}
            onChange={(e) => update("password2")(e.target.value)}
          />
        </Field>

        <Field label="이름" required>
          <Input
            placeholder="홍길동"
            value={f.name}
            onChange={(e) => update("name")(e.target.value)}
          />
        </Field>

        {/* 생년월일 */}
        <Field
          required={false}
          label={
            <div className="flex items-baseline justify-between gap-3">
              <span className="inline-flex items-center gap-1">
                <span>생년월일</span>
                <span className="text-rose-500">*</span>
              </span>
              <span className="text-[12px] text-slate-500">만 나이: {age ?? "—"}</span>
            </div>
          }
        >
          <div className="relative">
            <Input
              type="date"
              placeholder="YYYY-MM-DD"
              value={f.birth}
              onChange={(e) => update("birth")(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="pr-10"
            />
            <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9l6 6 6-6" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </Field>

        {/* 성별 */}
        <Field label="성별" required>
          <div className="flex gap-2">
            <Chip selected={f.gender === "male"} onClick={() => update("gender")("male")} className="flex-1">남성</Chip>
            <Chip selected={f.gender === "female"} onClick={() => update("gender")("female")} className="flex-1">여성</Chip>
          </div>
        </Field>

        {/* 환자 가족력 */}
        {!f.isDoctor && (
          <Field label="가족력" required>
            <div className="flex gap-2">
              <Chip selected={f.familyHistory === "yes"} onClick={() => update("familyHistory")("yes")} className="flex-1">예</Chip>
              <Chip selected={f.familyHistory === "no"} onClick={() => update("familyHistory")("no")} className="flex-1">아니요</Chip>
              <Chip selected={f.familyHistory === "unknown"} onClick={() => update("familyHistory")("unknown")} className="flex-1">모름</Chip>
            </div>
          </Field>
        )}

        {/* 의사 추가 정보 */}
        {f.isDoctor && (
          <>
            <Field label="전문의 분야" required>
              <Input placeholder="예: 피부과" value={f.specialty} onChange={(e) => update("specialty")(e.target.value)} />
            </Field>
            <Field label="소속 병원" required>
              <Input placeholder="예: 서울의료원" value={f.hospital} onChange={(e) => update("hospital")(e.target.value)} />
            </Field>
            <Field label="의사면허 확인 증빙 서류 제출" required>
              <div className="rounded-2xl border border-dashed border-sky-300 p-4">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => update("licenseFile")(e.currentTarget.files?.[0] ?? null)}
                />
                {f.licenseFile && (
                  <p className="mt-2 text-[13px] text-slate-600">
                    선택된 파일: <strong>{f.licenseFile.name}</strong>
                  </p>
                )}
              </div>
            </Field>
          </>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={!canSubmit || busy}
            className={cx(
              "w-full rounded-2xl px-6 py-4 text-lg font-semibold text-white shadow-lg transition",
              canSubmit && !busy ? "bg-gradient-to-b from-sky-400 to-sky-500 hover:brightness-105" : "bg-slate-300"
            )}
          >
            {busy ? "처리 중..." : "회원가입"}
          </button>
          <p className="mt-3 text-center text-[14px] text-slate-600">
            이미 계정이 있으신가요? <a href="#login" className="font-semibold text-sky-600 underline-offset-2 hover:underline">로그인</a>
          </p>
        </div>
      </form>
    </div>
  );
}
