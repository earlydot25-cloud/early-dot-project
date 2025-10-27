// src/types/UserTypes.ts

// 공통 사용자 정보 (Users 모델 기반)
export interface User {
  id: number;
  email: string;
  name: string;
  sex: '남성' | '여성';
  age: number;
  family_history: string;
  is_doctor: boolean;
  date_joined: string;
  // 수정 가능한 공통 필드 (Models에 없지만 UI에 필요한 필드)
  phone: string;
  address: string;
}

// 의사 정보 (Doctors 모델 기반)
export interface DoctorProfile {
  uid: number; // Users.id와 연결
  name: string;
  specialty: string;
  hospital: string;
  status: '승인 중' | '승인' | '거절'; // Doctors.status 필드
}

// 환자 목록 (의사용)
export interface PatientListItem {
  id: number; // User.id
  name: string;
  email: string;
}

// 사용자 프로필 정보 (백엔드 응답 형태를 가정)
export interface UserProfile extends User {
  doctor_profile?: DoctorProfile; // is_doctor=true일 때 존재
  patients?: PatientListItem[]; // is_doctor=true일 때 존재 (담당 환자 리스트)
  assigned_doctor?: { // is_doctor=false (환자)일 경우 담당 의사 정보
    id: number; // Doctor.uid
    name: string;
    specialty: string;
    hospital: string;
  } | null;
}