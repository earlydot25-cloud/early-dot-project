# backend/admin_tools/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.http import FileResponse, Http404
from django.conf import settings
import os

from users.models import Doctors
from .serializers import DoctorApplicationSerializer


# 참고: 실제로는 DRF의 IsAdminUser나 커스텀 권한(IsManager)을 사용해야 합니다.
# 여기서는 일단 IsAuthenticated로 경로만 확보합니다.


# --------------------------------------------------------
# 1. 의사 목록 조회 뷰 (GET: /api/admin_tools/doctors/)
# - query parameter: status (all/pending/approved/rejected)
# --------------------------------------------------------
class DoctorListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 관리자 권한 체크 (is_staff)
        if not request.user.is_staff:
            return Response(
                {'detail': '관리자 권한이 필요합니다.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # status 필터 파라미터
        status_filter = request.query_params.get('status', 'all')
        
        # Doctors 객체 조회
        doctors = Doctors.objects.select_related('uid').all()
        
        # status 필터 적용
        if status_filter == 'pending':
            doctors = doctors.filter(status='미승인')
        elif status_filter == 'approved':
            doctors = doctors.filter(status='승인')
        elif status_filter == 'rejected':
            doctors = doctors.filter(status='거절')
        # 'all'이면 필터링 없이 전체 조회
        
        # 시리얼라이저로 변환
        serializer = DoctorApplicationSerializer(doctors, many=True, context={'request': request})
        
        return Response({
            'count': len(serializer.data),
            'results': serializer.data
        }, status=status.HTTP_200_OK)


# --------------------------------------------------------
# 2. 의사 승인 뷰 (POST: /api/admin_tools/doctors/approve/<int:pk>/)
# --------------------------------------------------------
class DoctorApprovalView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        # 관리자 권한 체크
        if not request.user.is_staff:
            return Response(
                {'detail': '관리자 권한이 필요합니다.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            doctor = Doctors.objects.get(uid_id=pk)
        except Doctors.DoesNotExist:
            return Response(
                {'detail': '의사를 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # status 업데이트
        doctor.status = '승인'
        doctor.save()
        
        serializer = DoctorApplicationSerializer(doctor, context={'request': request})
        return Response({
            'message': '의사 가입이 승인되었습니다.',
            'doctor': serializer.data
        }, status=status.HTTP_200_OK)


# --------------------------------------------------------
# 3. 의사 거절 뷰 (POST: /api/admin_tools/doctors/reject/<int:pk>/)
# --------------------------------------------------------
class DoctorRejectionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        # 관리자 권한 체크
        if not request.user.is_staff:
            return Response(
                {'detail': '관리자 권한이 필요합니다.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            doctor = Doctors.objects.get(uid_id=pk)
        except Doctors.DoesNotExist:
            return Response(
                {'detail': '의사를 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 거절 사유 받기
        rejection_reason = request.data.get('rejection_reason', '').strip()
        if not rejection_reason:
            return Response(
                {'detail': '거절 사유를 입력해주세요.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # status 및 거절 사유 업데이트
        doctor.status = '거절'
        doctor.rejection_reason = rejection_reason
        doctor.save()
        
        serializer = DoctorApplicationSerializer(doctor, context={'request': request})
        return Response({
            'message': '의사 가입이 거절되었습니다.',
            'doctor': serializer.data
        }, status=status.HTTP_200_OK)


# --------------------------------------------------------
# 4. 의사 증빙서류 다운로드 뷰 (GET: /api/admin_tools/doctors/<int:pk>/cert/)
# --------------------------------------------------------
class DoctorCertDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        # 관리자 권한 체크
        if not request.user.is_staff:
            return Response(
                {'detail': '관리자 권한이 필요합니다.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            doctor = Doctors.objects.get(uid_id=pk)
        except Doctors.DoesNotExist:
            return Response(
                {'detail': '의사를 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if not doctor.cert_path:
            return Response(
                {'detail': '증빙서류 파일이 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 파일 경로 구성
        file_path = os.path.join(settings.MEDIA_ROOT, doctor.cert_path.name)
        
        if not os.path.exists(file_path):
            return Response(
                {'detail': '파일을 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 파일 응답 반환
        try:
            file = open(file_path, 'rb')
            response = FileResponse(
                file,
                content_type='application/octet-stream'
            )
            # 원본 파일명 추출
            filename = os.path.basename(doctor.cert_path.name)
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            return Response(
                {'detail': f'파일 다운로드 중 오류가 발생했습니다: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )