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
      saveUser(user);
      // ✅ 추가: 실명 보장 저장(혹시 saveUser가 안 해줄 경우 대비)
      const displayName = user?.name || user?.email || '';
      localStorage.setItem('userName', displayName);

      // 🎯 [핵심 추가]: HomeRedirector가 사용할 isDoctor 역할 정보 저장
      // user.is_doctor가 0 또는 1의 숫자 값이라고 가정하고 문자열로 변환하여 저장
      if (user && typeof user.is_doctor !== 'undefined') {
        // user.is_doctor (숫자 0 또는 1)을 문자열 "0" 또는 "1"로 저장
        localStorage.setItem('isDoctor', String(user.is_doctor));
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
