// src/pages/auth/LoginPage.tsx
import React, { useState } from 'react';
import { login, saveTokens, me, saveUser } from '../../services/authServices';
import { useNavigate, Link } from 'react-router-dom';

function kor(msg: string) {
  // 서버 메시지를 간단히 한글화
  const map: Record<string, string> = {
    'No active account found with the given credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'Given token not valid for any token type': '세션이 만료되었습니다. 다시 로그인 해주세요.',
  };
  for (const [en, ko] of Object.entries(map)) {
    if (msg.includes(en)) return ko;
  }
  return msg || '로그인에 실패했습니다.';
}

const LoginPage: React.FC = () => {
  const nav = useNavigate();

  // 입력 상태
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI 상태
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      // 1) 로그인 → 토큰 저장
      const tokens = await login({ email, password });
      saveTokens(tokens);

      // 2) 프로필 가져오기 → 로컬 저장
      const user = await me();

      // 🚨 디버깅 코드 추가: user 객체의 내용을 콘솔에 출력합니다.
      console.log('User data from me():', user);


      // 🚨 [수정 1: 이전 키 제거] 남아있을 수 있는 'userRole' 키를 삭제하여 라우팅 혼란 방지
      localStorage.removeItem('userRole');
      saveUser(user);
      // ✅ 추가: 실명 보장 저장(혹시 saveUser가 안 해줄 경우 대비)
      const displayName = user?.name || user?.email || '';
      localStorage.setItem('userName', displayName);

      // �� [핵심 수정]: is_doctor 값을 안전하게 처리하여 "1"/"0"으로 저장
      let isDoctorStringValue = '0'; // 기본값 환자
      if (user && 'is_doctor' in user) {
          // boolean 타입인 경우
          if (typeof user.is_doctor === 'boolean') {
              isDoctorStringValue = user.is_doctor ? '1' : '0';
          }
          // 숫자 타입인 경우 (1 또는 0)
          else if (typeof user.is_doctor === 'number') {
              isDoctorStringValue = user.is_doctor ? '1' : '0';
          }
          // 문자열 타입인 경우 ("true", "1" 등)
          else if (typeof user.is_doctor === 'string') {
              const lowerValue = user.is_doctor.toLowerCase().trim();
              isDoctorStringValue = (lowerValue === 'true' || lowerValue === '1') ? '1' : '0';
          }
          // 그 외의 경우 truthy/falsy로 판단
          else {
              isDoctorStringValue = user.is_doctor ? '1' : '0';
          }
      }
      localStorage.setItem('isDoctor', isDoctorStringValue);
      
      // 🎯 슈퍼유저/관리자 정보 저장
      if (user && (user.is_staff || user.is_superuser)) {
          console.log('✅ 슈퍼유저/관리자 감지:', { is_staff: user.is_staff, is_superuser: user.is_superuser });
          localStorage.setItem('isStaff', '1');
      } else {
          console.log('👤 일반 사용자:', { is_staff: user?.is_staff, is_superuser: user?.is_superuser });
          localStorage.setItem('isStaff', '0');
      }

      // 🎯 의사 승인/거절 상태 확인 및 팝업 표시
      if (user?.is_doctor && user?.doctor_profile) {
          const doctorStatus = user.doctor_profile.status;
          const lastShownStatus = localStorage.getItem('lastDoctorStatusShown');
          const userId = user.id;
          const statusKey = `doctorStatus_${userId}_${doctorStatus}`;
          
          // 이전에 같은 상태의 팝업을 본 적이 없거나, 상태가 변경된 경우에만 팝업 표시
          if (lastShownStatus !== statusKey && (doctorStatus === '승인' || doctorStatus === '거절')) {
              if (doctorStatus === '승인') {
                  alert('가입이 승인되었습니다. 이제 의사 활동을 이어가실 수 있습니다.');
              } else if (doctorStatus === '거절') {
                  const rejectionReason = user.doctor_profile.rejection_reason || '거절 사유가 없습니다.';
                  alert(`가입이 거절되었습니다.\n\n거절 사유: ${rejectionReason}\n\n내 정보 페이지에서 자세한 내용을 확인하실 수 있습니다.`);
              }
              
              // 팝업을 봤다는 것을 localStorage에 저장
              localStorage.setItem('lastDoctorStatusShown', statusKey);
          }
      }

      // ✅ Nav가 즉시 갱신되도록 커스텀 이벤트를 쏜다
      window.dispatchEvent(new Event('auth:update'));
      // 3) 이동
      nav('/home', { replace: true });
    } catch (e: any) {
      setErr(kor(e?.message || '로그인 실패'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-[480px] bg-white px-4 pb-10 pt-8">
      <h1 className="text-[22px] font-extrabold leading-tight text-slate-900">다시 만나 반가워요</h1>
      <p className="mb-6 mt-1 text-[13px] text-slate-500">이메일과 비밀번호를 입력해 로그인하세요.</p>

      {err && (
        <p className="mb-3 whitespace-pre-line text-[13px] font-medium text-rose-600">
          {err}
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">이메일</label>
          <input
            type="email"
            placeholder="Email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-sky-300 bg-white px-4 py-4 text-[15px] outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-200"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">비밀번호</label>
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-sky-300 bg-white px-4 py-4 text-[15px] outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-200"
          />
        </div>

        <button
          type="submit"
          disabled={busy || !email || !password}
          className={`w-full rounded-2xl px-6 py-4 text-lg font-semibold text-white shadow-lg transition ${busy || !email || !password ? 'bg-slate-300' : 'bg-gradient-to-b from-sky-400 to-sky-500 hover:brightness-105'}`}
        >
          {busy ? '로그인 중…' : '로그인'}
        </button>

        <p className="mt-3 text-center text-[14px] text-slate-600">
          아직 계정이 없으신가요?{' '}
          <Link to="/signup" className="font-semibold text-sky-600 underline-offset-2 hover:underline">
            회원가입
          </Link>
        </p>
      </form>
    </div>
  );
};

export default LoginPage;
