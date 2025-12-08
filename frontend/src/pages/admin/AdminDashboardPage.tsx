// frontend/src/pages/admin/AdminDashboardPage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaDownload, FaCheck, FaTimes, FaUserMd, FaSpinner } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons';
import { getDoctorList, approveDoctor, rejectDoctor, getCertDownloadUrl, type DoctorApplication, getDoctorUid, getDoctorEmail } from '../../services/adminServices';
import { http } from '../../services/http';
import { formatDateTime } from '../../utils/dateUtils';

// 아이콘 안전 래퍼
type IconCmp = React.FC<IconBaseProps>;
const DownloadIcon: IconCmp = (props) => React.createElement(FaDownload as any, props);
const CheckIcon: IconCmp = (props) => React.createElement(FaCheck as any, props);
const TimesIcon: IconCmp = (props) => React.createElement(FaTimes as any, props);
const UserMdIcon: IconCmp = (props) => React.createElement(FaUserMd as any, props);
const SpinnerIcon: IconCmp = (props) => React.createElement(FaSpinner as any, props);

type TabType = 'all' | 'pending' | 'approved' | 'rejected';

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [doctors, setDoctors] = useState<DoctorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; doctorUid: number | null; reason: string }>({
    isOpen: false,
    doctorUid: null,
    reason: '',
  });

  // 관리자 권한 체크
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          navigate('/login');
          return;
        }
        
        const user = JSON.parse(userStr);
        // is_staff 필드 확인 (백엔드에서 제공해야 함)
        if (!user.is_staff) {
          alert('관리자 권한이 필요합니다.');
          navigate('/dashboard/main');
          return;
        }
      } catch (e) {
        console.error('권한 체크 실패:', e);
        navigate('/login');
      }
    };
    
    checkAdminAccess();
  }, [navigate]);

  // 의사 목록 로드
  useEffect(() => {
    loadDoctors();
  }, [activeTab]);

  const loadDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getDoctorList(activeTab);
      setDoctors(response.results);
    } catch (err: any) {
      console.error('의사 목록 로드 실패:', err);
      setError(err.message || '의사 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (uid: number) => {
    if (processingIds.has(uid)) return;
    
    setProcessingIds(prev => new Set(prev).add(uid));
    try {
      await approveDoctor(uid);
      await loadDoctors(); // 목록 새로고침
    } catch (err: any) {
      console.error('승인 실패:', err);
      alert(err.message || '승인 처리에 실패했습니다.');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }
  };

  const handleReject = (uid: number) => {
    setRejectModal({
      isOpen: true,
      doctorUid: uid,
      reason: '',
    });
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal.doctorUid || !rejectModal.reason.trim()) {
      alert('거절 사유를 입력해주세요.');
      return;
    }

    if (processingIds.has(rejectModal.doctorUid)) return;

    setProcessingIds(prev => new Set(prev).add(rejectModal.doctorUid!));
    try {
      await rejectDoctor(rejectModal.doctorUid, rejectModal.reason.trim());
      await loadDoctors(); // 목록 새로고침
      setRejectModal({ isOpen: false, doctorUid: null, reason: '' });
    } catch (err: any) {
      console.error('거절 실패:', err);
      alert(err.message || '거절 처리에 실패했습니다.');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(rejectModal.doctorUid!);
        return next;
      });
    }
  };

  const handleRejectCancel = () => {
    setRejectModal({ isOpen: false, doctorUid: null, reason: '' });
  };

  const handleDownloadCert = async (uid: number) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert('로그인이 필요합니다.');
        return;
      }

      const url = getCertDownloadUrl(uid);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('파일 다운로드에 실패했습니다.');
      }

      // 파일명 추출 (Content-Disposition 헤더에서)
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `doctor_cert_${uid}.pdf`;
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      // Blob으로 변환하여 다운로드
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error('증빙서류 다운로드 실패:', err);
      alert(err.message || '증빙서류 다운로드에 실패했습니다.');
    }
  };

  // formatDate 함수 수정
  const formatDate = (dateString: string) => {
    return formatDateTime(dateString);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case '승인':
        return 'bg-green-100 text-green-800';
      case '거절':
        return 'bg-rose-100 text-rose-800';
      case '미승인':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="w-full px-4 py-6 bg-white min-h-screen">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold text-slate-900 mb-2">의사 가입 관리</h1>
        <p className="text-[13px] text-slate-500">의사 가입 신청을 검토하고 승인/거절할 수 있습니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex space-x-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {[
          { key: 'all' as TabType, label: '전체', count: null },
          { key: 'pending' as TabType, label: '승인 대기', count: null },
          { key: 'approved' as TabType, label: '승인됨', count: null },
          { key: 'rejected' as TabType, label: '거절됨', count: null },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-sky-500 text-sky-600'
                : 'border-transparent text-slate-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <SpinnerIcon className="animate-spin text-sky-500 text-2xl" />
          <span className="ml-2 text-slate-600 text-[13px]">로딩 중...</span>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl mb-4 text-[13px]">
          {error}
        </div>
      )}

      {/* 의사 목록 */}
      {!loading && !error && (
        <div className="space-y-4">
          {doctors.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <UserMdIcon className="mx-auto text-4xl mb-2 text-slate-400" />
              <p className="text-[13px]">해당 상태의 의사 가입 신청이 없습니다.</p>
            </div>
          ) : (
            doctors.map(doctor => {
              const uid = getDoctorUid(doctor);
              return (
                <DoctorCard
                  key={uid}
                  doctor={doctor}
                  onApprove={() => handleApprove(uid)}
                  onReject={() => handleReject(uid)}
                  onDownloadCert={() => handleDownloadCert(uid)}
                  isProcessing={processingIds.has(uid)}
                  formatDate={formatDate}
                  getStatusBadgeColor={getStatusBadgeColor}
                />
              );
            })
          )}
        </div>
      )}

      {/* 거절 모달 */}
      {rejectModal.isOpen && (
        <RejectModal
          reason={rejectModal.reason}
          onReasonChange={(reason) => setRejectModal(prev => ({ ...prev, reason }))}
          onConfirm={handleRejectConfirm}
          onCancel={handleRejectCancel}
          isProcessing={rejectModal.doctorUid ? processingIds.has(rejectModal.doctorUid) : false}
        />
      )}
    </div>
  );
};

// 거절 모달 컴포넌트
interface RejectModalProps {
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const RejectModal: React.FC<RejectModalProps> = ({
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
  isProcessing,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-[18px] font-extrabold text-slate-900 mb-4">의사 가입 거절</h3>
        <p className="text-[13px] text-slate-600 mb-4">
          거절 사유를 입력해주세요. 이 사유는 해당 의사에게 전달됩니다.
        </p>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="예: 증빙서류가 불명확합니다. / 전문의 자격이 확인되지 않습니다."
          className="w-full h-32 px-4 py-3 border border-slate-300 rounded-2xl text-[13px] resize-none focus:outline-none focus:ring-4 focus:ring-sky-200 focus:border-sky-400"
          disabled={isProcessing}
        />
        <div className="flex space-x-2 mt-4">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-2xl text-[13px] font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing || !reason.trim()}
            className="flex-1 px-4 py-3 bg-rose-500 text-white rounded-2xl text-[13px] font-semibold hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isProcessing ? '처리 중...' : '거절하기'}
          </button>
        </div>
      </div>
    </div>
  );
};

// 의사 카드 컴포넌트
interface DoctorCardProps {
  doctor: DoctorApplication;
  onApprove: () => void;
  onReject: () => void;
  onDownloadCert: () => void;
  isProcessing: boolean;
  formatDate: (date: string) => string;
  getStatusBadgeColor: (status: string) => string;
}

const DoctorCard: React.FC<DoctorCardProps> = ({
  doctor,
  onApprove,
  onReject,
  onDownloadCert,
  isProcessing,
  formatDate,
  getStatusBadgeColor,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-4">
      {/* 카드 헤더 */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
            <UserMdIcon className="text-sky-600 text-lg" />
          </div>
          <div>
            <h3 className="text-[15px] font-extrabold text-slate-900">{doctor.name}</h3>
            <p className="text-[12px] text-slate-500">{getDoctorEmail(doctor)}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${getStatusBadgeColor(doctor.status)}`}>
          {doctor.status}
        </span>
      </div>

      {/* 기본 정보 */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-[13px]">
        {doctor.sex && (
          <div>
            <span className="text-slate-500">성별:</span>
            <span className="ml-2 text-slate-900 font-medium">{doctor.sex === 'M' ? '남성' : doctor.sex === 'F' ? '여성' : doctor.sex}</span>
          </div>
        )}
        {doctor.age !== undefined && (
          <div>
            <span className="text-slate-500">나이:</span>
            <span className="ml-2 text-slate-900 font-medium">{doctor.age}세</span>
          </div>
        )}
        {doctor.birth_date && (
          <div>
            <span className="text-slate-500">생년월일:</span>
            <span className="ml-2 text-slate-900 font-medium text-[12px]">{formatDate(doctor.birth_date)}</span>
          </div>
        )}
        {doctor.family_history && (
          <div>
            <span className="text-slate-500">가족력:</span>
            <span className="ml-2 text-slate-900 font-medium">
              {doctor.family_history === 'Y' ? '있음' : doctor.family_history === 'N' ? '없음' : '모름'}
            </span>
          </div>
        )}
      </div>

      {/* 의사 정보 */}
      <div className="border-t border-slate-100 pt-4 mb-4">
        <h4 className="text-[13px] font-extrabold text-slate-700 mb-2">의사 정보</h4>
        <div className="grid grid-cols-1 gap-2 text-[13px]">
          <div>
            <span className="text-slate-500">전문의 분야:</span>
            <span className="ml-2 text-slate-900 font-medium">{doctor.specialty || '미입력'}</span>
          </div>
          <div>
            <span className="text-slate-500">소속 병원:</span>
            <span className="ml-2 text-slate-900 font-medium">{doctor.hospital || '미입력'}</span>
          </div>
          {doctor.date_joined && (
            <div>
              <span className="text-slate-500">가입 신청일:</span>
              <span className="ml-2 text-slate-900 font-medium text-[12px]">{formatDate(doctor.date_joined)}</span>
            </div>
          )}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-col space-y-2 pt-4 border-t border-slate-100">
        {doctor.cert_path && (
          <button
            onClick={onDownloadCert}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-2xl hover:bg-slate-200 transition-colors text-[13px] font-semibold"
          >
            <DownloadIcon />
            <span>증빙서류 다운로드</span>
          </button>
        )}
        {doctor.status === '미승인' && (
          <div className="flex space-x-2">
            <button
              onClick={onApprove}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition-colors text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isProcessing ? (
                <>
                  <SpinnerIcon className="animate-spin" />
                  <span>처리 중...</span>
                </>
              ) : (
                <>
                  <CheckIcon />
                  <span>승인</span>
                </>
              )}
            </button>
            <button
              onClick={onReject}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-rose-500 text-white rounded-2xl hover:bg-rose-600 transition-colors text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isProcessing ? (
                <>
                  <SpinnerIcon className="animate-spin" />
                  <span>처리 중...</span>
                </>
              ) : (
                <>
                  <TimesIcon />
                  <span>거절</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardPage;
