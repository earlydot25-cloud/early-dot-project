# backend/users/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import get_user_model

# 커스텀 유저 모델 가져오기
User = get_user_model()

# 커밋용
# --------------------------------------------------------
# 1. 회원가입 뷰 (POST: /api/auth/signup/)
# --------------------------------------------------------
# 토큰이 필요 없으므로 AllowAny 설정
class UserSignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # 💡 팀원들에게 위임할 로직: 시리얼라이저를 사용하여 유저 데이터 검증 및 생성

        # 현재는 FE 연동 테스트를 위해 간단한 응답만 반환
        username = request.data.get('username')
        if not username:
            return Response({'message': '아이디를 입력해주세요.'}, status=status.HTTP_400_BAD_REQUEST)

        # 실제 구현 시: user = UserSerializer(data=request.data); user.save()
        return Response(
            {'message': f'{username}님, 회원가입 성공. 로그인해주세요.'},
            status=status.HTTP_201_CREATED
        )


# --------------------------------------------------------
# 2. 프로필 뷰 (GET/PUT: /api/auth/profile/)
# --------------------------------------------------------
# 토큰이 필요하므로 IsAuthenticated 설정
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    # 내 정보 조회 (FE의 /profile 페이지에서 사용)
    def get(self, request):
        # 💡 팀원들에게 위임할 로직: request.user 객체를 시리얼라이즈하여 반환
        user = request.user

        # 실제 구현 시: serializer = UserSerializer(user); return Response(serializer.data)
        return Response({
            'username': user.username,
            'email': user.email,
            'message': '인증된 사용자 프로필 정보입니다.'
        }, status=status.HTTP_200_OK)

    # 내 정보 수정
    def put(self, request):
        # 💡 팀원들에게 위임할 로직: 시리얼라이저를 사용하여 유저 정보 업데이트

        # 실제 구현 시: serializer = UserSerializer(request.user, data=request.data); serializer.save()
        return Response(
            {'message': '프로필 정보가 성공적으로 수정되었습니다.'},
            status=status.HTTP_200_OK
        )