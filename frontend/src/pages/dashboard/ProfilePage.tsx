import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, PatientListItem } from '../../types/UserTypes';
// 백엔드 통신 함수 임포트 확인 (userServices.ts에 정의되어 있어야 함)
import { fetchUserProfile, updateProfile, deleteAccount, removePatient } from '../../services/userServices';
import { useNavigate } from 'react-router-dom';
import { clearAuth } from '../../services/authServices';

interface MyPageProps {}

const MyPage: React.FC<MyPageProps> = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();
  // formData에 profile 전체 구조와 추가 필드 초기화
  const [formData, setFormData] = useState<any>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // profile이 로드된 후에만 isDoctor를 계산하여 오류 방지
  const isDoctor = useMemo(() => profile?.is_doctor || false, [profile]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await fetchUserProfile();
        setProfile(data);
        // 데이터를 로드할 때 phone, address, doctor_profile, assigned_doctor를 확실히 초기화
        setFormData({
            ...data,
            doctor_profile: data.doctor_profile || {},
            assigned_doctor: data.assigned_doctor || {},
            phone: data.phone || '',
            address: data.address || '',
        });
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        alert(error instanceof Error ? error.message : "프로필 로드 중 알 수 없는 오류 발생");
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // 의사 전용 필드 처리
    if (isDoctor && (name === 'specialty' || name === 'hospital')) {
      setFormData((prev: any) => ({
        ...prev,
        doctor_profile: {
          ...prev.doctor_profile,
          [name]: value,
        },
      }));
    // 환자 전용 필드 처리
    } else if (!isDoctor && name === 'assigned_doctor_name') {
        setFormData((prev: any) => ({
            ...prev,
            assigned_doctor: {
                ...prev.assigned_doctor,
                name: value,
            },
        }));
    // 공통 필드 (phone, address 등) 처리
    } else {
      setFormData((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatePayload: any = {
        // 💡 [핵심 수정]: 공통으로 수정 가능한 필드들을 페이로드에 포함
        name: formData.name,
        sex: formData.sex,
        age: formData.age,
        family_history: formData.family_history,
      };

      if (isDoctor) {
        // 의사 프로필 필드
        updatePayload.specialty = formData.doctor_profile.specialty;
        updatePayload.hospital = formData.doctor_profile.hospital;
      } else if (!isDoctor && formData.assigned_doctor.name) {
        // 환자 담당의사 이름 필드
        updatePayload.assigned_doctor_name = formData.assigned_doctor.name;
      }

      await updateProfile(updatePayload); // 💡 updateProfile 함수를 호출

      // 성공 후 프로필 다시 로드
      const updatedProfile = await fetchUserProfile();
      setProfile(updatedProfile);
      setFormData({
          ...updatedProfile,
          doctor_profile: updatedProfile.doctor_profile || {},
          assigned_doctor: updatedProfile.assigned_doctor || {},
          phone: updatedProfile.phone || '', // phone, address도 업데이트된 값으로 초기화
          address: updatedProfile.address || '',
      });
      setIsEditing(false); // 수정 모드 종료
      alert('정보가 성공적으로 수정되었습니다.');
    } catch (error) {
      alert(error instanceof Error ? error.message : '정보 수정에 실패했습니다.');
      console.error('Update failed:', error);
    }
  };

const handleAccountDelete = async () => {
    try {
      await deleteAccount(); // 회원 탈퇴 API 호출

      // 💡 3. 토큰 제거 및 리다이렉션 로직 추가
      clearAuth(); // 로컬 스토리지에서 토큰 및 사용자 정보 삭제

      alert('회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.');

      // 메인 페이지(로그인 전 페이지)로 리다이렉션
      navigate('/');

    } catch (error) {
      alert(error instanceof Error ? error.message : '회원 탈퇴에 실패했습니다.');
      console.error('Deletion failed:', error);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleRemovePatient = async (patientId: number) => {
    if (!window.confirm('선택한 환자를 담당 목록에서 삭제하시겠습니까?')) return;
    try {
      await removePatient(patientId); // 💡 removePatient 함수를 호출
      setProfile((prev: UserProfile | null) => prev ? ({
        ...prev,
        patients: prev.patients?.filter((p: PatientListItem) => p.id !== patientId)
      }) : null);
      alert('환자가 목록에서 제거되었습니다.');
    } catch (error) {
      alert(error instanceof Error ? error.message : '환자 제거에 실패했습니다.');
      console.error('Remove patient failed:', error);
    }
  };

  const handleGoToDiagnosis = () => {
    alert("진단 기록 페이지로 이동해야 합니다.");
    // 🚨 여기에 실제 라우팅 로직 (예: router.push('/diagnosis-history'))을 구현해야 합니다.
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
    <div className="flex items-center py-3 border-b border-gray-100 space-x-4">
      <label className="text-gray-500 font-medium min-w-[80px] flex-shrink-0 text-left">{label}</label>
      {isEditable && isEditing ? (
        <input
          type={type}
          name={name}
          value={value}
          onChange={handleInputChange}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 flex-grow text-left"
        />
      ) : (
        <p className="w-full text-gray-800 p-2 text-left">{value}</p>
      )}
    </div>
  );

const PatientSpecificFields: React.FC = () => {
    // 💡 1. assignedDoctor 변수가 존재하는지 확인
    // (profile.assigned_doctor 객체가 아예 null/undefined인 경우)
    const assignedDoctorExists = assignedDoctor && (
        assignedDoctor.name || assignedDoctor.specialty || assignedDoctor.hospital
    );

    // 💡 2. 담당의사가 지정되지 않았으면 null을 반환하여 섹션 전체를 숨김
    if (!assignedDoctorExists) {
        return null;
    }

    // 💡 3. 담당의사가 지정된 경우에만 섹션 렌더링
    return (
      <div className="mt-6 border-t pt-6">
        <h3 className="text-xl font-bold text-gray-700 mb-4 text-left">담당의사 정보</h3>

        {/* 담당의사 이름 필드는 백엔드에서 null로 올 수 있으므로, name으로 다시 체크 */}
        {assignedDoctor.name ? (
          <>
              {/* assigned_doctor_name 필드는 수정 모드에서만 수정 가능 (handleInputChange/handleUpdate 연동됨) */}
              <FormField
                  label="담당의사 실명"
                  name="assigned_doctor_name"
                  value={formData.assigned_doctor.name || ''}
                  isEditable={true}
              />
              <FormField
                  label="전문의 분야"
                  name="assigned_doctor_specialty"
                  value={assignedDoctor.specialty || '미등록'}
                  isEditable={false}
              />
              <FormField
                  label="소속 병원"
                  name="assigned_doctor_hospital"
                  value={assignedDoctor.hospital || '미등록'}
                  isEditable={false}
              />
          </>
        ) : (
          // 담당의사 객체는 있지만 name 필드가 빈 경우에만 이 메시지를 표시
          <p className="text-red-500 text-left">담당 의사 이름이 등록되지 않았습니다.</p>
        )}
      </div>
    );
  };


  const DoctorSpecificFields: React.FC = () => (
    <div className="mt-6 border-t pt-6">
      <h3 className="text-xl font-bold text-gray-700 mb-4 text-left">전문의 정보</h3>

      {/* 의사 승인 여부 확인 */}
      <div className="flex items-center py-3 border-b border-gray-100 space-x-4">
          <p className="text-gray-500 font-medium min-w-[80px] flex-shrink-0 text-left">의사 승인 여부</p>
          <span
              className={`font-bold p-2 rounded text-left ${
                  doctorProfile?.status === '승인' ? 'bg-green-100 text-green-700' :
                  doctorProfile?.status === '승인 중' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
              }`}
          >
              {doctorProfile?.status || '미등록'}
          </span>
      </div>

      {/* 전문의 분야 (수정 가능) */}
      <FormField
        label="전문의 분야"
        name="specialty"
        value={formData.doctor_profile?.specialty || ''}
        isEditable={true}
      />
      {/* 소속 병원 (수정 가능) */}
      <FormField
        label="소속 병원"
        name="hospital"
        value={formData.doctor_profile?.hospital || ''}
        isEditable={true}
      />
    </div>
  );

  const DoctorPatientList: React.FC = () => (
    <div className="p-6 bg-white rounded-lg shadow-md border-t-4 border-blue-500 mt-8">
      <h3 className="text-2xl font-bold mb-4 text-blue-700 text-left">담당 환자 리스트</h3>
      {isDoctorApproved ? (
        <ul className="space-y-3 text-left">
          {profile.patients && profile.patients.length > 0 ? (
            profile.patients.map((patient: PatientListItem) => (
              <li key={patient.id} className="flex justify-between items-center p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition duration-150">
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-gray-800">{patient.name}</span>
                  <span className="text-sm text-gray-500">ID: {patient.id} | Email: {patient.email}</span>
                </div>
                <button
                  onClick={() => handleRemovePatient(patient.id)} // 💡 환자 삭제 연동
                  className="px-3 py-1 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition duration-150"
                >
                  삭제
                </button>
              </li>
            ))
          ) : (
            <p className="text-gray-500">현재 담당하고 있는 환자가 없습니다.</p>
          )}
        </ul>
      ) : (
        <p className="text-red-500 text-left">⚠️ **승인된 의사만** 환자 리스트를 관리할 수 있습니다.</p>
      )}
    </div>
  );


  return (
    <div className="mx-auto p-4 sm:p-8 bg-gray-50 max-w-xl min-w-[320px]">
      <h1 className="text-3xl font-bold text-gray-800 mb-8 border-b pb-4 text-left">마이 페이지</h1>

      <div className="space-y-8">

        {/* 회원 정보 수정 폼 */}
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-gray-700 mb-6 text-left">회원 정보 {isEditing ? '수정' : '확인'}</h2>

          <form onSubmit={handleUpdate}> {/* 💡 수정 완료 버튼은 handleUpdate로 연동됨 */}
            {/* 공통 정보 필드 (수정 불가능) */}
            <FormField label="이메일 (ID)" name="email" value={profile.email} isEditable={false} />
            <FormField label="이름" name="name" value={profile.name} isEditable={false} />
            <FormField label="생년월일" name="age" value={profile.age} isEditable={false} />
            <FormField label="성별" name="sex" value={profile.sex} isEditable={false} />

            {/* 역할별 추가 정보 */}
            {isDoctor ? <DoctorSpecificFields /> : <PatientSpecificFields />}

            <div className="mt-8 pt-6 border-t flex justify-end space-x-4">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => { // 💡 수정 취소 버튼 연동
                        setIsEditing(false);
                        // 취소 시 원래 profile 데이터로 복구
                        setFormData({
                            ...profile,
                            doctor_profile: profile?.doctor_profile || {},
                            assigned_doctor: profile?.assigned_doctor || {},
                            phone: profile?.phone || '',
                            address: profile?.address || '',
                        });
                    }}
                    className="px-5 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition duration-150"                  >
                    수정 취소
                  </button>
                  <button
                    type="submit" // 💡 수정 완료 버튼 (form submit)
                    className="px-5 py-1.5 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 transition duration-150"                  >
                    수정 완료
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)} // 💡 회원 탈퇴 버튼 연동 (모달 열기)
                    className="px-6 py-1.5 border border-red-500 text-red-500 font-semibold text-sm rounded-lg hover:bg-red-100 transition duration-150"                  >
                    회원 탈퇴
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)} // 💡 정보 수정 버튼 연동 (수정 모드 활성화)
                    className="px-6 py-1.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition duration-150"                  >
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
                <div className="p-6 bg-white rounded-lg shadow-md border-t-4 border-purple-500">
                    <h3 className="text-2xl font-bold mb-4 text-purple-700 text-left">나의 진단 기록</h3>
                    <p className="text-gray-600 text-left">최근 진단 결과를 확인하고 후속 조치를 요청할 수 있습니다.</p>
                    <button
                      onClick={handleGoToDiagnosis} // 💡 기록 보러가기 버튼 연동
                      className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600">
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
                onClick={() => setShowDeleteModal(false)} // 💡 모달 취소 버튼 연동
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={handleAccountDelete} // 💡 탈퇴 확인 버튼 연동
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