// frontend/src/services/authService.ts
import axios from 'axios';

// 💡 타입 정의
interface AuthResponse {
    success: boolean;
    token?: string;
    message?: string;
}

// ----------------------------------------------------
// 1. 로그인 (Login) API 호출 로직
// ----------------------------------------------------
export const loginUser = async (username: string, password: string): Promise<AuthResponse> => {
    try {
        // 백틱(`)과 달러사인($)을 정확히 사용해야 합니다.
        console.log(`[AUTH SERVICE] Attempting login for: ${username}`);

        // Mock Data 반환
        return { success: true, token: 'mock-token-for-dev' };

    } catch (error) {
        console.error('[AUTH SERVICE] Login failed', error);
        return { success: false, message: '로그인 실패' };
    }
};

// ----------------------------------------------------
// 2. 회원가입 (Signup) API 호출 로직
// ----------------------------------------------------
export const signupUser = async (data: any): Promise<AuthResponse> => {
    try {
        console.log("[AUTH SERVICE] Attempting signup (Mocked)");

        // Mock Data 반환
        return { success: true, message: '회원가입 성공 (Mocked)' };

    } catch (error) {
        console.error('[AUTH SERVICE] Signup failed', error);
        return { success: false, message: '회원가입 실패' };
    }
};