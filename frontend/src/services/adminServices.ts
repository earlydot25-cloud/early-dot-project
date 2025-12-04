// frontend/src/services/adminServices.ts
// 관리자 도구 관련 API 서비스

import { http, API_BASE } from './http';

// 의사 신청 정보 타입
export interface DoctorApplication {
  user_id: number;
  user_email: string;
  user_name: string;
  name: string;
  specialty: string;
  hospital: string;
  status: '미승인' | '승인' | '거절';
  rejection_reason?: string;
  cert_path?: string;
  cert_file_url?: string;
  // Users 모델의 추가 필드들 (백엔드 serializer에 포함되어야 함)
  // 하위 호환성을 위한 별칭 필드들
  uid?: number; // user_id의 별칭
  email?: string; // user_email의 별칭
  // Users 모델의 추가 필드들
  sex?: string;
  age?: number;
  birth_date?: string;
  family_history?: string;
  date_joined?: string;
}

// Helper 함수: DoctorApplication에서 uid를 안전하게 가져오기
export function getDoctorUid(doctor: DoctorApplication): number {
  return doctor.uid ?? doctor.user_id;
}

// Helper 함수: DoctorApplication에서 email을 안전하게 가져오기
export function getDoctorEmail(doctor: DoctorApplication): string {
  return doctor.email ?? doctor.user_email;
}

// 의사 목록 응답 타입
interface DoctorListResponse {
  count: number;
  results: DoctorApplication[];
}

// 의사 승인 응답 타입
interface DoctorApprovalResponse {
  message: string;
  doctor: DoctorApplication;
}

// 의사 거절 응답 타입
interface DoctorRejectionResponse {
  message: string;
  doctor: DoctorApplication;
}

/**
 * 의사 목록 조회
 * GET /api/admin_tools/doctors/?status=all|pending|approved|rejected
 */
export async function getDoctorList(status: 'all' | 'pending' | 'approved' | 'rejected' = 'all'): Promise<DoctorListResponse> {
  try {
    const response = await http.get<DoctorListResponse>(`/api/admin_tools/doctors/?status=${status}`);
    return response;
  } catch (error: any) {
    console.error('Failed to fetch doctor list:', error);
    const errorMessage = error?.payload?.detail || error?.detail || error?.message || '의사 목록을 불러오는데 실패했습니다.';
    throw new Error(errorMessage);
  }
}

/**
 * 의사 승인
 * POST /api/admin_tools/doctors/approve/<int:pk>/
 */
export async function approveDoctor(uid: number): Promise<DoctorApprovalResponse> {
  try {
    const response = await http.post<DoctorApprovalResponse>(`/api/admin_tools/doctors/approve/${uid}/`);
    return response;
  } catch (error: any) {
    console.error('Failed to approve doctor:', error);
    const errorMessage = error?.payload?.detail || error?.detail || error?.message || '의사 승인에 실패했습니다.';
    throw new Error(errorMessage);
  }
}

/**
 * 의사 거절
 * POST /api/admin_tools/doctors/reject/<int:pk>/
 */
export async function rejectDoctor(uid: number, rejectionReason: string): Promise<DoctorRejectionResponse> {
  try {
    const response = await http.post<DoctorRejectionResponse>(`/api/admin_tools/doctors/reject/${uid}/`, {
      rejection_reason: rejectionReason,
    });
    return response;
  } catch (error: any) {
    console.error('Failed to reject doctor:', error);
    const errorMessage = error?.payload?.detail || error?.detail || error?.message || '의사 거절에 실패했습니다.';
    throw new Error(errorMessage);
  }
}

/**
 * 의사 증빙서류 다운로드 URL 생성
 * GET /api/admin_tools/doctors/<int:pk>/cert/
 */
export function getCertDownloadUrl(uid: number): string {
  return `${API_BASE}/api/admin_tools/doctors/${uid}/cert/`;
}

