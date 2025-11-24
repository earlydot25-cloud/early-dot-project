import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMars, FaVenus } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons';
import {
    UserProfile,
    PatientListItem,
    AssignedDoctorInfo,
    DoctorProfile as DoctorProfileType
} from '../../types/UserTypes';
import { fetchUserProfile, updateProfile, deleteAccount, removePatient } from '../../services/userServices';
import { clearAuth } from '../../services/authServices';

// 성별 아이콘 컴포넌트
type IconCmp = React.FC<IconBaseProps>;
const MarsIcon: IconCmp = (props: IconBaseProps) => <FaMars {...props} />;
const VenusIcon: IconCmp = (props: IconBaseProps) => <FaVenus {...props} />;

interface MyPageProps {}

const MyPage: React.FC<MyPageProps> = () => {

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  // formData 타입을 명확히 지정하거나 (UserProfile과 필드 확장) 'any' 대신 Record<string, any> 사용
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // profile이 로드된 후에만 isDoctor를 계산하여 오류 방지
  const isDoctor = useMemo(() => profile?.is_doctor || false, [profile]);

  // assignedDoctorExists를 명확한 Boolean으로 설정
  const assignedDoctorExists = useMemo(() => {
      // 💡 타입이 AssignedDoctorInfo | null | undefined 이므로 안전하게 접근
      return !!(profile?.assigned_doctor);
  }, [profile]);

  // 의사이거나 (isDoctor) 담당의사가 지정된 환자 (assignedDoctorExists)는 수정 가능
  // birth_date, age, family_history는 모두 수정 가능하도록 합니다.
  const isUserEditable = isDoctor || assignedDoctorExists || true; // 기본 정보는 항상 수정 가능하도록 임시 설정


  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data: UserProfile = await fetchUserProfile();
        // 💡 setProfile(data)는 이제 UserProfile | null 타입과 호환됩니다.
        setProfile(data);

        // 🚩 birth_date와 age를 명확히 분리하여 폼 데이터에 초기화
        setFormData({
            ...data,
            birth_date: data.birth_date || '',
            age: data.age || '',

            // 💡 타입 안정성을 위해 ?. 체이닝 적용
            assigned_doctor_name: data.assigned_doctor?.name || '',
            doctor_profile: data.doctor_profile || {},
            assigned_doctor: data.assigned_doctor || {},
        });
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        // 💡 alert 사용 대신 커스텀 UI 메시지 사용 권장
        // alert(error instanceof Error ? error.message : "프로필 로드 중 알 수 없는 오류 발생");
        console.error("프로필 로드 중 알 수 없는 오류 발생:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // 의사 전용 필드 처리 (doctor_profile 객체 내부)
    if (isDoctor && (name === 'specialty' || name === 'hospital')) {
      setFormData((prev: Record<string, any>) => ({
        ...prev,
        doctor_profile: {
          ...prev.doctor_profile,
          [name]: value,
        },
      }));
    // 환자 전용 필드 (담당의사 이름) 처리
    } else if (!isDoctor && name === 'assigned_doctor_name') {
        setFormData((prev: Record<string, any>) => ({
            ...prev,
            [name]: value, // assigned_doctor_name 필드를 최상위에 저장
        }));
    // 공통 필드 (name, sex, age, family_history, birth_date) 처리
    } else {
      setFormData((prev: Record<string, any>) => ({ ...prev, [name]: value }));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 💡 UserProfileUpdatePayload 타입을 사용하거나 명확히 정의된 객체 사용
      const updatePayload: Record<string, any> = {
        name: formData.name,
        sex: formData.sex,
        age: formData.age ? Number(formData.age) : undefined, // 나이는 숫자로 변환
        birth_date: formData.birth_date || undefined,
        // birth_date는 백엔드 시리얼라이저에 없으므로 (UserProfileUpdateSerializer),
        // age와 name으로 대체되어 계산되는 경우 제외하고는 제거하는 것이 좋습니다.
        // 백엔드 시리얼라이저(UserProfileUpdateSerializer) 필드에 맞게 birth_date 제거
        // birth_date: formData.birth_date,
        family_history: formData.family_history,

        // 추가 필드 (백엔드에 있다면)
        phone: formData.phone,
        address: formData.address,
      };

      if (isDoctor) {
        // 의사 프로필 필드
        updatePayload.specialty = formData.doctor_profile.specialty;
        updatePayload.hospital = formData.doctor_profile.hospital;
      } else if (!isDoctor) {
        // 환자 담당의사 이름 필드 (isUserEditable 조건 제거)
        updatePayload.assigned_doctor_name = formData.assigned_doctor_name || '';
      }

      await updateProfile(updatePayload); // updateProfile 함수를 호출

      // 성공 후 프로필 다시 로드
      const updatedProfile: UserProfile = await fetchUserProfile();
      // 💡 setProfile(updatedProfile)은 이제 UserProfile | null 타입과 호환됩니다.
      setProfile(updatedProfile);

      // 폼 데이터 재초기화
      setFormData({
          ...updatedProfile,
          // 업데이트된 birth_date 및 age 값으로 재초기화
          birth_date: updatedProfile.birth_date || '', // 업데이트된 생년월일
          age: updatedProfile.age || '',              // 업데이트된 나이
          assigned_doctor_name: updatedProfile.assigned_doctor?.name || '',
          doctor_profile: updatedProfile.doctor_profile || {},
          assigned_doctor: updatedProfile.assigned_doctor || {},
      });

      // 수정 모드 종료
      setIsEditing(false);
      // alert('정보가 성공적으로 수정되었습니다.');
      console.log('정보가 성공적으로 수정되었습니다.');
    } catch (error) {
      // alert(error instanceof Error ? error.message : '정보 수정에 실패했습니다.');
      console.error('Update failed:', error);
    }
  };

const handleAccountDelete = async () => {
    try {
      await deleteAccount(); // 회원 탈퇴 API 호출

      clearAuth(); // 로컬 스토리지에서 토큰 및 사용자 정보 삭제

      // alert('회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.');
      console.log('회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.');

      // 메인 페이지(로그인 전 페이지)로 리다이렉션
      navigate('/');

    } catch (error) {
      // alert(error instanceof Error ? error.message : '회원 탈퇴에 실패했습니다.');
      console.error('Deletion failed:', error);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleRemovePatient = async (patientId: number) => {
    // 💡 window.confirm 대신 커스텀 모달/UI 사용
    if (!window.confirm('선택한 환자를 담당 목록에서 삭제하시겠습니까?')) return;
    try {
      await removePatient(patientId); // removePatient 함수를 호출
      setProfile((prev: UserProfile | null) => prev ? ({
        ...prev,
        // 💡 타입은 UserProfile에서 가져왔으므로 안전하게 사용
        patients: prev.patients?.filter((p: PatientListItem) => p.id !== patientId)
      }) : null);
      // alert('환자가 목록에서 제거되었습니다.');
      console.log('환자가 목록에서 제거되었습니다.');
    } catch (error) {
      // alert(error instanceof Error ? error.message : '환자 제거에 실패했습니다.');
      console.error('Remove patient failed:', error);
    }
  };

  const handleGoToDiagnosis = () => {
    // alert("진단 기록 페이지로 이동해야 합니다.");
    console.log("진단 기록 페이지로 이동해야 합니다.");
    // 여기에 실제 라우팅 로직 (예: navigate('/diagnosis-history'))을 구현해야 합니다.
  };


  if (isLoading) {
    return <div className="text-center p-8">프로필 로딩 중...</div>;
  }

  if (!profile) {
    return <div className="text-center p-8 text-red-600">사용자 정보를 찾을 수 없습니다.</div>;
  }

  const doctorProfile = profile.doctor_profile;
  const assignedDoctor = profile.assigned_doctor;
  const isDoctorApproved = doctorProfile && doctorProfile.status === '승인';

  // 폼 필드 헬퍼 컴포넌트
  const FormField: React.FC<{ label: string; name: string; value: string | number; isEditable: boolean; type?: string }> =
    ({ label, name, value, isEditable, type = 'text' }) => (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-xs text-gray-600">{label}</span>
      {isEditable && isEditing ? (
        <input
          type={type}
          name={name}
          value={value}
          onChange={handleInputChange}
          className="flex-1 ml-2 text-xs text-gray-900 font-medium p-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
        />
      ) : (
        <span className="text-xs text-gray-900 font-medium text-right">{String(value)}</span>
      )}
    </div>
  );

  const PatientSpecificFields: React.FC = () => {
    if (!assignedDoctorExists) {
        return (
             <div className="mt-3 pt-3 border-t border-gray-200">
                 <div className="flex items-center gap-2 mb-3">
                   <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                   </svg>
                   <h3 className="text-sm font-semibold text-gray-900">담당의사 정보</h3>
                 </div>
                 <p className="text-xs text-gray-500 text-left mb-2">현재 담당의사가 지정되지 않았습니다.</p>
                 <FormField
                    label="담당의사 실명"
                    name="assigned_doctor_name"
                    value={formData.assigned_doctor_name || ''}
                    isEditable={isEditing}
                />
            </div>
        );
    }

    const doctor = assignedDoctor!;

    return (
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-900">담당의사 정보</h3>
        </div>

        <FormField
            label="담당의사 실명"
            name="assigned_doctor_name"
            value={formData.assigned_doctor_name || ''}
            isEditable={isEditing}
        />
        <FormField
            label="전문의 분야"
            name="assigned_doctor_specialty"
            // 💡 assignedDoctor는 AssignedDoctorInfo 타입 (UserTypes.ts에서 정의)
            value={doctor.specialty || '미등록'}
            isEditable={false}
        />
        <FormField
            label="소속 병원"
            name="assigned_doctor_hospital"
            value={doctor.hospital || '미등록'}
            isEditable={false}
        />
      </div>
    );
  };


  const DoctorSpecificFields: React.FC = () => (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-900">전문의 정보</h3>
      </div>

      <div className="flex justify-between py-2 border-b border-gray-100">
        <span className="text-xs text-gray-600">의사 승인 여부</span>
        <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
                doctorProfile?.status === '승인' ? 'bg-green-100 text-green-700' :
                doctorProfile?.status === '승인 중' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
            }`}
        >
            {doctorProfile?.status || '미등록'}
        </span>
      </div>

      <FormField
        label="전문의 분야"
        name="specialty"
        value={formData.doctor_profile?.specialty || ''}
        isEditable={isEditing}
      />
      <FormField
        label="소속 병원"
        name="hospital"
        value={formData.doctor_profile?.hospital || ''}
        isEditable={isEditing}
      />
    </div>
  );

  const DoctorPatientList: React.FC = () => {
    const patients = profile.patients || [];
    const totalPatients = patients.length;
    const needsReviewCount = patients.filter((p: PatientListItem) => p.needs_review).length;

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-bold text-gray-900">담당 환자 리스트</h3>
          </div>
        </div>
        {isDoctorApproved ? (
          <>
            {/* 요약 정보 */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">전체 환자</span>
                <span className="font-bold text-gray-900">{totalPatients}명</span>
              </div>
              {needsReviewCount > 0 && (
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-600">소견 필요</span>
                  <span className="font-bold text-blue-600">{needsReviewCount}명</span>
                </div>
              )}
            </div>

            {/* 간단한 환자 목록 (최대 5명만 표시) */}
            {patients.length > 0 ? (
              <div className="space-y-2 mb-4">
                {patients.slice(0, 5).map((patient: PatientListItem) => {
                  // 성별 아이콘 (전체 환자 목록과 동일한 로직)
                  const patientSex = patient.sex?.toLowerCase();
                  const isFemale = patientSex && (
                    patientSex === '여성' || 
                    patientSex === 'f' || 
                    patientSex === 'female' ||
                    patientSex === '여' ||
                    patientSex === '여자'
                  );
                  const genderIcon = isFemale 
                    ? <VenusIcon className="text-pink-500" size={14} />
                    : <MarsIcon className="text-blue-500" size={14} />;

                  return (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-2">
                        {genderIcon}
                        <span className="text-sm font-medium text-gray-900">{patient.name}</span>
                        {patient.needs_review ? (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            소견 필요
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                            소견 완료
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`${patient.name}님을 담당 환자 목록에서 제거하시겠습니까?`)) {
                            handleRemovePatient(patient.id);
                          }
                        }}
                        className="px-2 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 transition duration-150 flex-shrink-0 ml-2"
                      >
                        삭제
                      </button>
                    </div>
                  );
                })}
                {patients.length > 5 && (
                  <p className="text-xs text-gray-500 text-center mt-2">
                    외 {patients.length - 5}명의 환자가 더 있습니다
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">현재 담당하고 있는 환자가 없습니다.</p>
            )}

            {/* 전체 목록 보기 버튼 */}
            <button
              onClick={() => navigate('/dashboard/doctor/history')}
              className="w-full py-2.5 px-4 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition duration-150 flex items-center justify-center gap-2"
            >
              <span>전체 목록 보기</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        ) : (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600 text-left">
              승인된 의사만 환자 리스트를 관리할 수 있습니다.
            </p>
          </div>
        )}
      </div>
    );
  };


  return (
    <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5 pb-24">
      {/* 헤더 */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 mb-2">마이 페이지</h1>
      </div>

      <div className="space-y-4">
        {/* 회원 정보 수정 폼 */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h2 className="text-lg font-bold text-gray-900">회원 정보 {isEditing ? '수정' : '확인'}</h2>
          </div>

          <form onSubmit={handleUpdate}>
            {/* 공통 정보 필드 */}
            <FormField label="이메일 (ID)" name="email" value={profile.email} isEditable={false} />
            <FormField label="이름" name="name" value={formData.name || ''} isEditable={isEditing} />
            {/* 생년월일 필드 추가 (수정 가능, Date 타입으로 표시) */}
            <FormField label="생년월일" name="birth_date" value={formData.birth_date || ''} isEditable={isEditing} type="date" />
            {/* 나이 필드를 별도로 표시 (수정 가능) */}
            <FormField label="나이" name="age" value={formData.age || ''} isEditable={isEditing} type="number" />

            <FormField label="성별" name="sex" value={formData.sex || ''} isEditable={isEditing} />
            <FormField label="가족력" name="family_history" value={formData.family_history || ''} isEditable={isEditing} />

            {/* 역할별 추가 정보 */}
            {isDoctor ? <DoctorSpecificFields /> : <PatientSpecificFields />}

            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end space-x-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => { // 수정 취소 버튼 연동
                        setIsEditing(false);
                        // 취소 시 원래 profile 데이터로 복구
                        setFormData({
                            ...profile,
                            birth_date: profile.birth_date || '', // 생년월일 복구
                            age: profile.age || '',              // 나이 복구
                            assigned_doctor_name: profile?.assigned_doctor?.name || '',
                            doctor_profile: profile?.doctor_profile || {},
                            assigned_doctor: profile?.assigned_doctor || {},
                        });
                    }}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-md hover:bg-gray-100 transition duration-150"
                  >
                    수정 취소
                  </button>
                  <button
                    type="submit" // 수정 완료 버튼 (form submit)
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition duration-150"
                  >
                    수정 완료
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowDeleteModal(true);
                    }}
                    className="px-3 py-1.5 border border-red-500 text-red-500 text-xs rounded-md hover:bg-red-50 transition duration-150"
                  >
                    회원 탈퇴
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition duration-150"
                  >
                    정보 수정
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        <div className="space-y-8">
            {isDoctor && <DoctorPatientList />}

            {/* 환자 전용 섹션 */}
            {!isDoctor && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                    <h3 className="text-lg font-bold mb-2 text-gray-900 text-left">나의 진단 기록</h3>
                    <p className="text-sm text-gray-700 text-left mb-3">최근 진단 결과를 확인하고 후속 조치를 요청할 수 있습니다.</p>
                    <button 
                      onClick={() => navigate('/dashboard/history')}
                      className="w-full py-2 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition duration-150"
                    >
                      기록 보러가기
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* 회원 탈퇴 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-2xl w-96">
            <h3 className="text-xl font-bold mb-4">회원 탈퇴</h3>
            <p className="mb-6">정말로 탈퇴하시겠습니까? 모든 정보가 삭제되며 복구할 수 없습니다.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={handleAccountDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-semibold"
              >
                탈퇴 확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPage;
