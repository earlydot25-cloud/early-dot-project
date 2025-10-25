// src/services/http.ts
// ----------------------------------------------------------------------------------
// 공용 HTTP 유틸 (fetch 기반)
// - 모든 JSON 요청을 한 곳에서 처리
// - 401(만료) 시 refresh 자동 시도 → 성공하면 원 요청 재실행
// - Vite(.env): import.meta.env.VITE_API_BASE 사용, CRA면 process.env.REACT_APP_API_BASE_URL 사용
// ----------------------------------------------------------------------------------

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function getApiBase() {
  // CRA 기준, process.env 사용
  const cra = process.env.REACT_APP_API_BASE_URL;
  return (cra || 'http://localhost:8000').replace(/\/+$/, '');
}

export const API_BASE = getApiBase();

// 로컬 스토리지 키 상수화
export const STORAGE = {
  access: 'accessToken',
  refresh: 'refreshToken',
  user: 'user',
} as const;

function authHeader(): Record<string, string> {
  const token = localStorage.getItem(STORAGE.access);
  // ✅ undefined 대신 빈 객체 리턴하도록 string 키/값으로 확정
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json', // 기본 JSON 헤더
      ...(authHeader() || {}),            // ✅ undefined일 때 안전하게 빈 객체 대체
      ...(options.headers || {}),         // 추가 옵션 병합
    },
  ...options,
});

  // JSON 파싱 (비JSON 응답 대비)
  const data = await res.json().catch(() => ({} as any)); // ✅ 타입 명시 (TS가 data.detail 접근할 때 경고 안 뜸)


  // 401 처리: 첫 시도라면 refresh 한 번 시도
  if (res.status === 401 && retry) {
    const ok = await tryRefresh();
    if (ok) {
      // 새 access로 원 요청 재시도 (retry=false로 무한루프 방지)
      return request<T>(path, options, false);
    } else {
      // refresh 실패 → 강제 로그아웃
      localStorage.removeItem(STORAGE.access);
      localStorage.removeItem(STORAGE.refresh);
      localStorage.removeItem(STORAGE.user);
      throw new Error(data?.detail || '인증이 만료되었습니다. 다시 로그인 해주세요.');
    }
  }

  if (!res.ok) {
    // 서버가 에러 메시지를 {detail: "..."} 혹은 {field: ["..."]} 등으로 줄 수 있음
    // 상위에서 사용자 친화 메시지로 변환
    const msg = data?.detail || '요청에 실패했습니다.';
    const err = new Error(msg) as any;
    err.payload = data;
    err.status = res.status;
    throw err;
  }

  return data as T;
}

// refresh 토큰으로 access 재발급
export async function tryRefresh(): Promise<boolean> {
  const refresh = localStorage.getItem(STORAGE.refresh);
  if (!refresh) return false;
  const res = await fetch(`${API_BASE}/api/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access) return false;
  localStorage.setItem(STORAGE.access, data.access);
  return true;
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: any) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: any) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
