// frontend/src/services/authService.ts (최종 버전)
import axios from 'axios';

// 💡 API_URL을 정의합니다. (실제 연동 시 사용될 주소)
// 이 주소는 팀원들에게 전달하여 나중에 사용할 것임을 명시합니다.
const API_URL = 'http://localhost:8000/users';

// 💡 타입 정의
interface AuthResponse {
    success: boolean;
    token?: string;
    message?: string;
}

// ----------------------------------------------------
// 1. 로그인 (Login) API 호출 로직 (Mocked)
// ----------------------------------------------------
export const loginUser = async (username: string, password: string): Promise<AuthResponse> => {
    try {
        console.log(`[AUTH SERVICE] Attempting login for: ${username} (MOCKED)`);

        // 💡 실제 BE 연동 시 이 Mock 로직을 아래 주석 처리된 Axios 로직으로 교체해야 합니다.
        // Mock Data 반환
        return { success: true, token: 'mock-token-for-dev' };

        /* // 💡 실제 BE 연동 시 사용할 로직 (팀원들에게 참고용으로 제공)
        const response = await axios.post(`${API_URL}/login/`, { username, password });
        if (response.data.token) {
            localStorage.setItem('authToken', response.data.token);
            return { success: true, token: response.data.token, message: '로그인 성공' };
        } else {
            return { success: false, message: response.data.message || '토큰 없음' };
        }
        */

    } catch (error) {
        console.error('[AUTH SERVICE] Login failed', error);
        return { success: false, message: '로그인 실패 (Mocking 중)' };
    }
};

// ----------------------------------------------------
// 2. 회원가입 (Signup) API 호출 로직 (Mocked)
// ----------------------------------------------------
export const signupUser = async (data: any): Promise<AuthResponse> => {
    try {
        console.log("[AUTH SERVICE] Attempting signup (MOCKED)");

        // Mock Data 반환
        return { success: true, message: '회원가입 성공 (Mocked)' };

    } catch (error) {
        console.error('[AUTH SERVICE] Signup failed', error);
        return { success: false, message: '회원가입 실패' };
    }
};

// 💡 필수: TS1208 에러 해결을 위해 추가
export {};