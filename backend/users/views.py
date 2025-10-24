# backend/users/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from .serializers import RegisterSerializer, UserSerializer

class UserSignupView(APIView):
    permission_classes = [AllowAny]
    # ← FormData(파일) / x-www-form-urlencoded / JSON 모두 받기
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)



# --------------------------------------------------------
# 2. 프로필 뷰 (GET/PUT: /api/auth/profile/)
# --------------------------------------------------------
# 토큰이 필요하므로 IsAuthenticated 설정
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    # 내 정보 조회 (FE의 /profile 페이지에서 사용)
    def get(self, request):
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)

    def put(self, request):
        # 추후 업데이트 로직 작성
        return Response({'message': '프로필 정보가 성공적으로 수정되었습니다.'}, status=status.HTTP_200_OK)
