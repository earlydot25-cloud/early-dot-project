# backend/dashboard/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated


# --------------------------------------------------------
# 1. 기록 목록 뷰 (GET: /api/data/records/)
# --------------------------------------------------------
# FE의 '진단 내역' 페이지에서 사용
class RecordListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 💡 현재는 로직 없이 pass (사용자 진단 기록 목록 조회)
        pass

        # 임시 응답: 200 OK
        return Response(
            {'message': '기록 목록 API 경로 확인됨 (로직 구현 필요)', 'data': []},
            status=status.HTTP_200_OK
        )


# --------------------------------------------------------
# 2. 기록 상세 뷰 (GET: /api/data/records/<int:pk>/)
# --------------------------------------------------------
class RecordDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        # 💡 현재는 로직 없이 pass (특정 진단 기록 상세 조회)
        pass

        # 임시 응답: 200 OK
        return Response(
            {'message': f'{pk}번 기록 상세 API 경로 확인됨 (로직 구현 필요)', 'record_id': pk},
            status=status.HTTP_200_OK
        )


# --------------------------------------------------------
# 3. 대시보드 요약 뷰 (GET: /api/data/summary/)
# --------------------------------------------------------
# FE의 메인 화면 (대시보드)에서 사용
class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 💡 현재는 로직 없이 pass (최근 기록, 통계 등 요약 데이터 제공)
        pass

        # 임시 응답: 200 OK
        return Response(
            {'message': '대시보드 요약 API 경로 확인됨 (로직 구현 필요)', 'recent_count': 5},
            status=status.HTTP_200_OK
        )