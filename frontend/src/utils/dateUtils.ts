/**
 * 날짜 포맷팅 유틸리티 함수
 * 24시간 형식으로 날짜와 시간(분까지)을 반환
 */

/**
 * ISO 날짜 문자열을 "YYYY-MM-DD HH:mm" 형식으로 변환
 * @param dateString ISO 날짜 문자열 (예: "2025-12-08T14:30:00Z")
 * @returns "2025-12-08 14:30" 형식의 문자열
 */
export const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '날짜 정보 없음';
  
  try {
    const date = new Date(dateString);
    
    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      return '날짜 정보 없음';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch (error) {
    console.error('날짜 포맷팅 오류:', error);
    return '날짜 정보 없음';
  }
};

/**
 * 날짜만 표시 (시간 제외) - 생년월일 등에 사용
 * @param dateString ISO 날짜 문자열
 * @returns "YYYY-MM-DD" 형식의 문자열
 */
export const formatDateOnly = (dateString: string | null | undefined): string => {
  if (!dateString) return '날짜 정보 없음';
  
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return '날짜 정보 없음';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('날짜 포맷팅 오류:', error);
    return '날짜 정보 없음';
  }
};
