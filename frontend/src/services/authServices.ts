// src/services/authServices.ts
// -----------------------------------------------------------------------------
// 인증 관련 서비스 모듈
// - login: 이메일/비밀번호로 토큰 발급
// - refresh: 갱신
// - me: 현재 사용자 프로필 가져오기
// - saveTokens / clearAuth: 로컬 스토리지 관리
// -----------------------------------------------------------------------------
import { API_BASE, STORAGE, http } from './http';

// DRF 에러 평탄화
export function parseDjangoErrors(data: any): Record<string, string> {
  if (!data || typeof data !== 'object') return {};
  const out: Record<string, string> = {};
  for (const k of Object.keys(data)) {
    const v = (data as any)[k];
    if (Array.isArray(v)) out[k] = v.join(' ');
    else if (typeof v === 'string') out[k] = v;
    else out[k] = JSON.stringify(v);
  }
  return out;
}

// 공용 fetch
async function jsonFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  // body가 FormData가 아닐 때만 JSON 헤더 세팅
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // JWT 자동 부착(있을 때만)
  const access = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (access && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${access}`);
  }

  const res = await fetch(url, { ...init, headers, credentials: 'omit' });
  const text = await res.text();
  
  // JSON 파싱 안전하게 처리
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      // JSON 파싱 실패 시 (예: HTML 에러 페이지, "Proxy erro..." 등)
      console.error('JSON parse error:', text.substring(0, 100));
      data = { detail: text || `서버 오류 (${res.status})` };
    }
  }

  if (!res.ok) {
    const err: any = new Error(data?.detail || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

/* ------------------------------------------------------------------------- */
/* 1) 회원가입 (JSON) — 일반 사용자/권고 가입 환자용                         */
/* ------------------------------------------------------------------------- */

// types 보강: multipart에도 family_history 허용
export type SignupJsonPayload = {
  email: string;
  password: string;
  name: string;
  sex?: 'M' | 'F';
  birth_date: string;
  age?: number;
  family_history?: 'Y' | 'N' | 'U'; // ← JSON에 명시
  is_doctor?: boolean;
  referral_uid?: number;
};


export async function signupUser(payload: SignupJsonPayload) {
    const body: SignupJsonPayload = {
    ...payload,
    family_history: payload.family_history ?? 'N',
  };
  try {
    const data = await jsonFetch<any>(`${API_BASE}/api/auth/signup/`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // 응답에 토큰이 같이 올 수 있음(백엔드 정책)
    if (data?.tokens?.access) localStorage.setItem('accessToken', data.tokens.access);
    if (data?.tokens?.refresh) localStorage.setItem('refreshToken', data.tokens.refresh);

    return { ok: true as const, data };
  } catch (e: any) {
    if (e?.data) {
      return { ok: false as const, status: e.status ?? 400, errors: parseDjangoErrors(e.data) };
    }
    return { ok: false as const, status: 0, errors: { _error: e?.message || 'Network error' } };
  }
}

/* ------------------------------------------------------------------------- */
/* 2) 회원가입 (FormData) — 의사(파일 업로드 포함)용                          */
/* ------------------------------------------------------------------------- */

export type SignupMultipartPayload = {
  email: string;
  password: string;
  name: string;
  sex?: 'M' | 'F';
  birth_date: string;
  age?: number;
  is_doctor?: boolean;
  family_history?: "Y" | "N" | "U";   // ✅ 이 줄 있어야 함
  specialty?: string;
  hospital?: string;
  license_file?: File | null;
  referral_uid?: number;
};


export async function signupUserMultipart(payload: SignupMultipartPayload) {
  const fd = new FormData();
  const sexLabel = payload.sex === 'M' ? '남성' : payload.sex === 'F' ? '여성' : '';
  const fhLabelMap: Record<'Y'|'N'|'U', '있음'|'없음'|'모름'> = { Y: '있음', N: '없음', U: '모름' };

  // 필수/공통
  fd.append('email', payload.email);
  fd.append('password', payload.password);
  fd.append('name', payload.name);
  fd.append("birth_date", payload.birth_date);

  // 선택 필드(값이 있을 때만 append)
  if (payload.sex) fd.append('sex', payload.sex);
  if (typeof payload.age === 'number') fd.append('age', String(payload.age));
  if (typeof payload.is_doctor === 'boolean') fd.append('is_doctor', String(payload.is_doctor));
  // 💡 핵심: 값이 없으면 'N'으로 보냄
  fd.append('family_history', payload.family_history ?? 'N');
  if (payload.specialty) fd.append('specialty', payload.specialty);
  if (payload.hospital) fd.append('hospital', payload.hospital);
  if (payload.license_file) fd.append('license_file', payload.license_file);
  if (typeof payload.referral_uid === 'number') {
    fd.append('referral_uid', String(payload.referral_uid));
  }

  try {
    const data = await jsonFetch<any>(`${API_BASE}/api/auth/signup/`, {
      method: 'POST',
      body: fd, // FormData일 땐 Content-Type 세팅 금지
    });

    if (data?.tokens?.access) localStorage.setItem('accessToken', data.tokens.access);
    if (data?.tokens?.refresh) localStorage.setItem('refreshToken', data.tokens.refresh);

    return { ok: true as const, data };
  } catch (e: any) {
    if (e?.data) {
      return { ok: false as const, status: e.status ?? 400, errors: parseDjangoErrors(e.data) };
    }
    return { ok: false as const, status: 0, errors: { _error: e?.message || 'Network error' } };
  }
}

export type Tokens = { access: string; refresh: string };
export type User = {
  id: number;
  email: string;
  name: string;
  is_doctor: boolean;
  doctor_uid: number | null;
  is_staff?: boolean;
  is_superuser?: boolean;
};

export async function login(params: { email: string; password: string }): Promise<Tokens> {
  // SimpleJWT: /api/auth/login/ 에 { email, password } 전송 (커스텀 유저 email 로그인)
  const data = await fetch(`${API_BASE}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(async (res) => {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.detail || '이메일 또는 비밀번호를 확인하세요.';
      const e = new Error(msg) as any;
      e.payload = json;
      e.status = res.status;
      throw e;
    }
    return json as Tokens;
  });

  return data;
}

export async function refresh(refreshToken: string): Promise<Pick<Tokens, 'access'>> {
  return http.post<Pick<Tokens, 'access'>>('/api/auth/refresh/', { refresh: refreshToken });
}

export async function me(): Promise<any> {
  // /api/auth/profile/ 는 IsAuthenticated 보호 (백엔드에서 설정)
  // UserProfileSerializer를 사용하므로 UserProfile 타입 데이터 반환
  return http.get<any>('/api/auth/profile/');
}

export function saveTokens(tokens: Tokens) {
  localStorage.setItem(STORAGE.access, tokens.access);
  localStorage.setItem(STORAGE.refresh, tokens.refresh);
}

export function saveUser(user: User) {
  localStorage.setItem(STORAGE.user, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE.access);
  localStorage.removeItem(STORAGE.refresh);
  localStorage.removeItem(STORAGE.user);
  localStorage.removeItem('userName');
  localStorage.removeItem('isDoctor');
  localStorage.removeItem('isStaff');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:update'));
  }
}