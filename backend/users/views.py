# backend/users/views.py
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from .serializers import RegisterSerializer, UserSerializer, UserProfileSerializer, UserProfileUpdateSerializer
from users.models import Doctors

class UserSignupView(APIView):
    permission_classes = [AllowAny]
    # ← FormData(파일) / x-www-form-urlencoded / JSON 모두 받기
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def post(self, request):
        try:
            # 요청 데이터 로깅
            print("=== SIGNUP REQUEST ===")
            print("Request data keys:", list(request.data.keys()))
            print("is_doctor:", request.data.get('is_doctor'))
            print("has license_file:", 'license_file' in request.data)
            
            serializer = RegisterSerializer(data=request.data)
            if not serializer.is_valid():
                print("Validation errors:", serializer.errors)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            print("Validated Data:", serializer.validated_data)

            user = serializer.save()
            print("User created successfully:", user.id)
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback
            error_msg = str(e)
            error_trace = traceback.format_exc()
            print("=" * 50)
            print(f"ERROR in UserSignupView.post: {error_msg}")
            print(error_trace)
            print("=" * 50)
            return Response(
                {"detail": f"회원가입 중 오류가 발생했습니다: {error_msg}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


User = get_user_model() # 사용자 모델을 가져오는 더 안전한 방법
# --------------------------------------------------------
# 2. 프로필 뷰 (GET/PATCH: /api/users/profile/, /api/users/profile/update/)
# --------------------------------------------------------
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    # 내 정보 조회 (FE의 /profile 페이지에서 사용) - GET
    def get(self, request):
        """프로필 정보 조회 (GET)"""
        # UserProfileSerializer를 사용하여 의사/환자 상세 정보 포함
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # 내 정보 수정 (PUT 대신 PATCH 사용 권장) - PATCH
    def patch(self, request):
        """프로필 정보 수정 (PATCH)"""
        user = request.user

        # UserProfileUpdateSerializer 사용
        # (시리얼라이저 Import 필요)
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

    # 회원 탈퇴 - DELETE
    def delete(self, request):
        """회원 탈퇴"""
        user = request.user
        user.delete()
        # 성공 시 204 No Content 반환
        return Response(status=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------
# 3. 의사 전용: 담당 환자 제거 뷰 (POST: /api/doctors/patients/{patientId}/remove/)
# --------------------------------------------------------
class RemovePatientView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, patient_id):
        """의사가 담당 환자를 목록에서 제거"""
        # 의사만 접근 가능
        if not request.user.is_doctor:
            return Response(
                {'error': 'Permission denied. Doctor access only.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # 의사 정보 가져오기
            doctor_record = request.user.doctor_profile
            if not doctor_record:
                return Response(
                    {'error': 'Doctor profile not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # 환자 정보 가져오기
            try:
                patient = User.objects.get(id=patient_id, is_doctor=False)
            except User.DoesNotExist:
                return Response(
                    {'error': 'Patient not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # 환자가 해당 의사에게 할당되어 있는지 확인
            if patient.doctor != doctor_record:
                return Response(
                    {'error': 'Patient is not assigned to this doctor'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 환자의 doctor 필드를 None으로 설정하여 제거
            patient.doctor = None
            patient.save()
            
            return Response(
                {'message': 'Patient removed successfully'},
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            import traceback
            print(f"Error in RemovePatientView: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {'error': f'Failed to remove patient: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
