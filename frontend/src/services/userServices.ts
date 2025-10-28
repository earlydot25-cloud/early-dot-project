// src/services/userServices.ts
import axios from 'axios';
import { UserProfile, PatientListItem } from '../types/UserTypes';

// 로컬 스토리지 키 (http.ts와 동일하게)
const ACCESS_TOKEN_KEY = 'accessToken';

// 백엔드 기본 URL 설정 (실제 환경에 맞게 변경 필요)
const API_BASE_URL = 'http://127.0.0.1:8000/api';
const API = axios.create({
  baseURL: API_BASE_URL,
});


// 🚨 Axios 요청 인터셉터 추가: 모든 요청에 토큰을 삽입
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);

    // 🚨 수정: config.headers가 존재하는지 확인하고,
    //        없다면 빈 객체로 초기화하여 안전하게 접근
    if (token) {
        if (!config.headers) {
            config.headers = {};
        }
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 현재 로그인된 사용자 정보 (환자/의사)를 가져오는 함수
 * GET /api/auth/profile/
 */
export async function fetchUserProfile(): Promise<UserProfile> {
  try {
    // 🚩 백엔드 통합 경로인 /auth/profile/ 사용 (GET 요청)
    const response = await API.get<UserProfile>('/auth/profile/');
    return response.data;
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    throw new Error("프로필 정보를 불러오는데 실패했습니다.");
  }
}


/**
 * 사용자 정보 업데이트 함수
 * PATCH /api/auth/profile/
 */
export async function updateProfile(data: any): Promise<void> {
  try {
    // 🚩 백엔드 통합 경로인 /auth/profile/ 사용 (PATCH 요청)
    await API.patch('/auth/profile/', data);
  } catch (error) {
    console.error('Update failed:', error);
    throw new Error("정보 수정에 실패했습니다.");
  }
}

/**
 * 회원 탈퇴 함수
 * DELETE /api/auth/profile/
 */
export async function deleteAccount(): Promise<void> {
  try {
    // 🚩 백엔드 통합 경로인 /auth/profile/ 사용 (DELETE 요청)
    // 이전에 404가 발생했던 /users/profile/delete/ 경로 대신 이 경로를 사용해야 합니다.
    await API.delete('/auth/profile/');
  } catch (error) {
    console.error('Deletion failed:', error);
    throw new Error("회원 탈퇴에 실패했습니다.");
  }
}

/**
 * 의사 전용: 담당 환자 삭제 함수
 * POST /api/doctors/patients/{patientId}/remove/
 */
export async function removePatient(patientId: number): Promise<void> {
  try {
    // 경로는 올바름.
    await API.post(`/doctors/patients/${patientId}/remove/`);
  } catch (error) {
    console.error('Remove patient failed:', error);
    throw new Error("환자 제거에 실패했습니다.");
  }
}
