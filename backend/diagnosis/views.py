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

from django.conf import settings
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
# IsAuthenticated: 로그인한 사용자만 접근 가능하게 함

from .models import Photos
from .serializers import PhotoUploadSerializer, PhotoDetailSerializer


# (만약 기존에 views.py에 다른 코드가 있었다면 그 아래에 추가하세요)


class PhotoUploadView(APIView):
    """
    React에서 보낸 사진(File)과 데이터(FormData)를 받아
    Photos 모델에 저장하는 API 뷰
    """
    # MultiPartParser: 'image' 같은 파일 데이터를 처리
    # FormParser: 'body_part' 같은 폼 데이터를 처리
    parser_classes = (MultiPartParser, FormParser)

    # 🌟 중요: 이 API는 로그인한 사용자만 호출할 수 있도록 설정
    # (만약 테스트 중이라 로그인이 필요 없다면 이 줄을 주석 처리)
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # 🌟 중요: 'user' 필드를 request에서 자동으로 가져와 주입
        # 시리얼라이저는 'user'를 제외한 나머지 데이터를 받음

        # request.data는 프론트에서 보낸 FormData 객체를 담고 있습니다.
        # many=False (기본값) : 단일 객체를 생성합니다.
        serializer = PhotoUploadSerializer(data=request.data)

        if not serializer.is_valid():
            # 유효성 검사 실패 시 (예: 필수 필드가 누락된 경우)
            # 프론트엔드에 어떤 필드가 잘못되었는지 오류 메시지를 반환합니다.
            import json
            if settings.DEBUG:
                print(f"[DEBUG] Validation errors: {json.dumps(serializer.errors, indent=2, ensure_ascii=False)}")
                print(f"[DEBUG] Received data keys: {list(request.data.keys())}")
                print(f"[DEBUG] Received data: {dict(request.data)}")
            return Response(
                {"error": "Validation failed", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # serializer.save()를 호출하기 전에 'user'를 추가합니다.
        # request.user는 IsAuthenticated 권한을 통해 인증된 사용자 객체입니다.
        try:
            photo_instance = serializer.save(user=request.user)
            # 저장 성공 후 ID를 포함한 응답 반환 (프론트엔드에서 결과 페이지로 이동하기 위해 필요)
            return Response(
                {
                    "id": photo_instance.id,
                    "message": "Photo uploaded successfully",
                    **serializer.data
                },
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            # (디버깅용) user 할당에 실패하거나 다른 DB 오류가 발생한 경우
            import traceback
            error_trace = traceback.format_exc()
            return Response(
                {
                    "error": f"Failed to save data: {str(e)}",
                    "traceback": error_trace if settings.DEBUG else None
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

