# backend/admin_tools/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated


# 💡 참고: 실제로는 DRF의 IsAdminUser나 커스텀 권한(IsManager)을 사용해야 합니다.
# 여기서는 일단 IsAuthenticated로 경로만 확보합니다.


# --------------------------------------------------------
# 1. 승인 대기 의사 목록 뷰 (GET: /api/mng/doctors/pending/)
# --------------------------------------------------------
class PendingDoctorListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 💡 현재는 로직 없이 pass (승인 대기 중인 의사 목록 조회)
        pass

        # 임시 응답: 200 OK
        return Response(
            {'message': '승인 대기 의사 목록 API 경로 확인됨 (로직 구현 필요)', 'pending_count': 0},
            status=status.HTTP_200_OK
        )


# --------------------------------------------------------
# 2. 의사 승인 뷰 (POST: /api/mng/doctors/approve/<int:pk>/)
# --------------------------------------------------------
class DoctorApprovalView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        # 💡 현재는 로직 없이 pass (특정 의사를 승인 처리)
        pass

        # 임시 응답: 200 OK
        return Response(
            {'message': f'{pk}번 의사 승인 처리 API 경로 확인됨 (로직 구현 필요)'},
            status=status.HTTP_200_OK
        )


# --------------------------------------------------------
# 3. 전체 사용자 관리 뷰 (GET: /api/mng/users/)
# --------------------------------------------------------
class UserManagementView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 💡 현재는 로직 없이 pass (전체 사용자 목록 및 관리)
        pass

        # 임시 응답: 200 OK
        return Response(
            {'message': '사용자 관리 API 경로 확인됨 (로직 구현 필요)', 'total_users': 0},
            status=status.HTTP_200_OK
        )