import axios from 'axios';
import { UserProfile, PatientListItem } from '../types/UserTypes';
import { BACKEND_URL, STORAGE } from './http';

// API 인스턴스 생성: Docker 내부 통신 주소 사용
const API = axios.create({
  baseURL: `${BACKEND_URL}/api`, // ✅ 수정: BACKEND_URL 사용
});


// Axios 요청 인터셉터: 모든 요청에 토큰을 삽입
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE.access);

    if (token) {
        if (!config.headers) {
            config.headers = {};
        }
        // Bearer 토큰 형식으로 설정
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
    await API.post(`/doctors/patients/${patientId}/remove/`);
  } catch (error) {
    console.error('Remove patient failed:', error);
    throw new Error("환자 제거에 실패했습니다.");
  }
}
