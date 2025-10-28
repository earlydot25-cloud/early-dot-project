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
 */
export async function fetchUserProfile(): Promise<UserProfile> {
  try {
    // 🚨 수정: 기존 '/api/profile/' 에서 '/users/profile/' 로 변경
    // API.get('/users/profile/')는 http://127.0.0.1:8000/api/users/profile/ 로 요청됩니다.
    const response = await API.get<UserProfile>('/auth/profile/');
    return response.data;
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    throw new Error("프로필 정보를 불러오는데 실패했습니다.");
  }
}


/**
 * 사용자 정보 업데이트 함수
 */
export async function updateProfile(data: any): Promise<void> {
  try {
    // 경로는 올바름. '/users/profile/update/' 엔드포인트가 API_BASE_URL에 연결됨
    await API.patch('/auth/profile/', data);
  } catch (error) {
    console.error('Update failed:', error);
    throw new Error("정보 수정에 실패했습니다.");
  }
}

/**
 * 회원 탈퇴 함수
 */
export async function deleteAccount(): Promise<void> {
  try {
    // 경로는 올바름.
    await API.delete('/auth/profile/');
  } catch (error) {
    console.error('Deletion failed:', error);
    throw new Error("회원 탈퇴에 실패했습니다.");
  }
}

/**
 * 의사 전용: 담당 환자 삭제 함수
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