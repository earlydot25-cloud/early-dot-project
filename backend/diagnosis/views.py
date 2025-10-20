# backend/diagnosis/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny


# --------------------------------------------------------
# 1. 이미지 업로드 뷰 (POST: /api/diag/upload/)
# --------------------------------------------------------
class ImageUploadView(APIView):
    # 진단 시작은 로그인이 필요함
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # 💡 현재는 로직 없이 pass 후, FE가 요청을 보냈을 때 최소 응답 반환
        pass  # 실제 구현은 팀원에게 위임 (NCP 저장 및 DB 기록)

        # 임시 응답: 202 Accepted (FE가 성공을 기대하며, 다음 단계인 predict로 넘어갈 수 있게 ID 반환)
        return Response(
            {'message': '이미지 업로드 API 경로 확인됨 (로직 구현 필요)', 'image_id': 'MOCK-IMG-001'},
            status=status.HTTP_202_ACCEPTED
        )


# --------------------------------------------------------
# 2. 모델 예측 뷰 (POST: /api/diag/predict/)
# --------------------------------------------------------
class ModelPredictionView(APIView):
    # 모델 예측 요청도 로그인이 필요함
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # 💡 현재는 로직 없이 pass 후, FE가 요청을 보냈을 때 최소 응답 반환
        pass  # 실제 구현은 팀원에게 위임 (FastAPI 호출 및 결과 저장)

        # 임시 응답: 200 OK (FE가 진단 결과를 기대함)
        return Response(
            {'message': '모델 예측 API 경로 확인됨 (로직 구현 필요)', 'result': 'MOCK-POSITIVE', 'confidence': 0.95},
            status=status.HTTP_200_OK
        )