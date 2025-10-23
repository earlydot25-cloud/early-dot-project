# # backend/diagnosis/views.py
#
# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# from rest_framework.permissions import IsAuthenticated, AllowAny
#
#
# # --------------------------------------------------------
# # 1. 이미지 업로드 뷰 (POST: /api/diag/upload/)
# # --------------------------------------------------------
# class ImageUploadView(APIView):
#     # 진단 시작은 로그인이 필요함
#     permission_classes = [IsAuthenticated]
#
#     def post(self, request):
#         # 💡 현재는 로직 없이 pass 후, FE가 요청을 보냈을 때 최소 응답 반환
#         pass  # 실제 구현은 팀원에게 위임 (NCP 저장 및 DB 기록)
#
#         # 임시 응답: 202 Accepted (FE가 성공을 기대하며, 다음 단계인 predict로 넘어갈 수 있게 ID 반환)
#         return Response(
#             {'message': '이미지 업로드 API 경로 확인됨 (로직 구현 필요)', 'image_id': 'MOCK-IMG-001'},
#             status=status.HTTP_202_ACCEPTED
#         )
#
#
# # --------------------------------------------------------
# # 2. 모델 예측 뷰 (POST: /api/diag/predict/)
# # --------------------------------------------------------
# class ModelPredictionView(APIView):
#     # 모델 예측 요청도 로그인이 필요함
#     permission_classes = [IsAuthenticated]
#
#     def post(self, request):
#         # 💡 현재는 로직 없이 pass 후, FE가 요청을 보냈을 때 최소 응답 반환
#         pass  # 실제 구현은 팀원에게 위임 (FastAPI 호출 및 결과 저장)
#
#         # 임시 응답: 200 OK (FE가 진단 결과를 기대함)
#         return Response(
#             {'message': '모델 예측 API 경로 확인됨 (로직 구현 필요)', 'result': 'MOCK-POSITIVE', 'confidence': 0.95},
#             status=status.HTTP_200_OK
#         )

# backend/diagnosis/views.py

# backend/diagnosis/views.py

from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import get_user_model  # ✅ 추가 (더미 유저용)

from .models import Photos
from .serializers import PhotoUploadSerializer, PhotoDetailSerializer


class PhotoUploadView(APIView):
    """
    React에서 보낸 사진(File)과 데이터(FormData)를 받아
    Photos 모델에 저장하는 API 뷰
    """
    parser_classes = (MultiPartParser, FormParser)

    # ⚙️ 현재 테스트 중이므로 로그인 불필요
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = PhotoUploadSerializer(data=request.data)

        if serializer.is_valid():
            try:
                # ✅ AllowAny 모드에서는 로그인 안 했으므로 임시 유저 지정
                User = get_user_model()
                if request.user.is_authenticated:
                    current_user = request.user
                else:
                    # id=1 유저를 기본으로 (DB에 patient1@ex.com 존재하므로)
                    current_user = User.objects.get(id=1)

                # ✅ user를 명시적으로 주입
                photo = serializer.save(user=current_user)

                # 저장 완료 후 상세 데이터 반환
                detail_data = PhotoDetailSerializer(photo).data
                return Response(detail_data, status=status.HTTP_201_CREATED)

            except Exception as e:
                return Response(
                    {"error": f"Failed to save data: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
