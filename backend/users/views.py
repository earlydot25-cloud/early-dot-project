# backend/users/views.py
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .serializers import RegisterSerializer, UserSerializer, UserProfileSerializer, UserProfileUpdateSerializer

class UserSignupView(APIView):
    permission_classes = [AllowAny]
    # ← FormData(파일) / x-www-form-urlencoded / JSON 모두 받기
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        print("Validated Data:", serializer.validated_data)

        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


# --------------------------------------------------------
# 2. 프로필 뷰 (GET/PATCH/DELETE: /api/auth/profile/)
# --------------------------------------------------------
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    # 1. 내 정보 조회 (GET)
    def get(self, request):
        """내 정보 조회 (GET)"""
        # 💡 UserProfileSerializer를 사용하여 의사/환자 상세 정보 포함
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # 2. 내 정보 수정 (PATCH)
    def patch(self, request):
        """프로필 정보 수정 (PATCH)"""
        user = request.user

        # 💡 UserProfileUpdateSerializer 사용
        serializer = UserProfileUpdateSerializer(
            user,
            data=request.data,
            partial=True  # PATCH 요청에는 필수
        )

        if serializer.is_valid():
            serializer.save()

            # 업데이트 후 최신 프로필 정보로 응답
            updated_user = User.objects.get(id=user.id)
            response_serializer = UserProfileSerializer(updated_user)

            return Response(response_serializer.data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # 3. 회원 탈퇴 (DELETE)
    def delete(self, request):
        """회원 탈퇴 (DELETE)"""
        user = request.user
        user.delete()
        # 성공 시 204 No Content 반환
        return Response(status=status.HTTP_204_NO_CONTENT)
