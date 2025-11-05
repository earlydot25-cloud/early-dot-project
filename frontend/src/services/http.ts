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
  // 💡 수정: 개발 환경에서 프록시를 사용하도록 기본값을 빈 문자열('')로 설정합니다.
  // 이렇게 해야 CRA/Webpack이 package.json의 proxy 설정을 따르게 됩니다.
  return (cra || '').replace(/\/+$/, '');
}

export const API_BASE = getApiBase();


export const BACKEND_URL = 'http://django:8000';


// 로컬 스토리지 키 상수화
export const STORAGE = {
  access: 'accessToken',
  refresh: 'refreshToken',
  user: 'user',
} as const;

function authHeader(): Record<string, string> {
  const token = localStorage.getItem(STORAGE.access);
  // 토큰이 있을 때만 Authorization 헤더를 반환
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  // API_BASE가 빈 문자열이므로, URL은 '/api/...' 형태로 프록시를 타게 됩니다.
  const url = `${API_BASE}${path}`;

  // body를 RequestInit에서 분리하여 fetch 호출 시 가장 뒤에 위치하도록 합니다.
  const { headers, body, ...restOptions } = options;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json', // 기본 JSON 헤더
      ...(authHeader() || {}),            // 인증 헤더 병합
      ...(headers || {}),                 // 추가 헤더 병합
    },
    body: body, // 분리된 body를 명시적으로 전달
    ...restOptions, // method, cache 등 나머지 옵션
  });

  // JSON 파싱 (비JSON 응답 대비) - 더 안전하게 처리
  let data: any = {};
  try {
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        // JSON 파싱 실패 시 (예: HTML 에러 페이지 등)
        console.error('JSON parse error:', text.substring(0, 100));
        data = { detail: text || `서버 오류 (${res.status})` };
      }
    }
  } catch (e) {
    console.error('Response read error:', e);
    data = { detail: '응답을 읽을 수 없습니다.' };
  }


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

  // API_BASE를 사용하여 프록시를 통해 요청
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
