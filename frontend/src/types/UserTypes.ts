// src/types/UserTypes.ts

// 1. 담당 의사 정보 타입 (AssignedDoctorInfo)
// 환자 프로필 조회 시 할당된 의사 정보 요약 (UserProfileSerializer.get_assigned_doctor)
export interface AssignedDoctorInfo {
  id: number; // Doctor User ID
  name: string;
  specialty: string;
  hospital: string;
}

// 2. 의사 정보 타입 (DoctorProfile)
// 의사 본인 프로필 조회 시 Doctors 모델 정보 (DoctorProfileSerializer)
export interface DoctorProfile {
  user_id: number; // Users.id와 연결
  specialty: string;
  hospital: string;
  status: '승인 중' | '승인' | '거절'; // Doctors.status 필드
}

// 3. 환자 목록 타입 (PatientListItem)
// 의사 프로필 조회 시 담당 환자 목록 요약 (PatientListItemSerializer)
// 🚨 이전 오류: 'export export' -> 'export'로 수정
export interface PatientListItem {
  id: number; // User.id
  name: string;
  email: string;
  birth_date: string;
  age: number;
  sex: '남성' | '여성' | string; // UserSerializer에서 M/F 대신 남성/여성 사용 가정
  last_diagnosis_date: string | null;
}

// 4. 공통 사용자 정보 (User) - Users 모델 기반
export interface User {
  id: number;
  email: string;
  name: string;
  sex: '남성' | '여성' | string; // 백엔드 직렬화 시 M/F일 수 있으므로 string 허용
  age: number;
  family_history: string;
  is_doctor: boolean;
  date_joined: string;
  birth_date: string; // 오류 해결을 위해 추가됨
}

// 5. 사용자 프로필 정보 (UserProfile) - GET 응답
// 모든 중첩 타입을 명시적으로 정의된 인터페이스로 대체
export interface UserProfile extends User {
  doctor_profile?: DoctorProfile | null; // is_doctor=true일 때 존재
  patients?: PatientListItem[]; // is_doctor=true일 때 존재
  // null을 명시적으로 허용하여 ProfilePage.tsx의 useState(null)과 호환성을 확보
  assigned_doctor?: AssignedDoctorInfo | null; // is_doctor=false일 때 존재 (nullable)
}

// 6. 프로필 업데이트 페이로드 (UserProfileUpdatePayload)
// ProfilePage.tsx의 handleSubmit에서 사용될 타입
export interface UserProfileUpdatePayload {
  name?: string;
  sex?: string;
  age?: number;
  family_history?: string;

  // 의사 전용 필드 (Doctors 모델 업데이트용)
  specialty?: string;
  hospital?: string;

  // 환자 전용 필드 (담당 의사 연결/해제용)
  assigned_doctor_name?: string;
}
