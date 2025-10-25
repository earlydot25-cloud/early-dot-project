# backend/dashboard/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from diagnosis.models import Results
from users.models import Users,  Doctors
from .serializers import ResultMainSerializer, DoctorCardSerializer
from django.db.models import Q # 복잡한 쿼리를 위해 필요

# --------------------------------------------------------
# 1. 기록 목록 뷰 (GET: /api/data/records/)
# --------------------------------------------------------
# FE의 '진단 내역' 페이지에서 사용
class RecordListView(APIView):
    pass


# --------------------------------------------------------
# 2. 기록 상세 뷰 (GET: /api/data/records/<int:pk>/)
# --------------------------------------------------------
class RecordDetailView(APIView):
   pass


# --------------------------------------------------------
# 메인- 환자 요약 뷰 (GET: /api/dashboard/main/)
# --------------------------------------------------------
# FE의 메인 화면 (대시보드)에서 사용
# UserDashboardMainView에 인증 요구사항을 임시로 제거합니다.
class UserDashboardMainView(APIView):
    # 🔴 permission_classes = [IsAuthenticated] 주석 처리 또는 제거
    # 🔴 임시 조치: 로그인 구현 전까지 모든 접근을 허용합니다.
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 💡 request.user를 사용합니다.
        user = request.user

        # 1. 최근 진단 내역 (Top 5)
        # photo__user=user 쿼리셋을 사용하여 특정 유저의 데이터만 가져옵니다.
        recent_history = Results.objects.filter(photo__user=user).order_by('-analysis_date')[:5]

        # 🔴 ResultMainSerializer 사용 시 photo, disease, followup_check 데이터가 없으면 오류 발생 가능성 있음
        #    -> 이 부분은 서버 실행 후 500 에러가 발생하면 디버깅해야 합니다.
        try:
            history_data = ResultMainSerializer(recent_history, many=True).data
        except Exception as e:
            print(f"Serializer Error: {e}")
            return Response(
                {'error': f'시리얼라이즈 과정 오류 발생: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # 2. 요약 정보 (주의 건수 계산)
        attention_query = Q(risk_level='높음') | Q(followup_check__doctor_risk_level='즉시 주의')

        attention_count = Results.objects.filter(photo__user=user).filter(attention_query).count()
        total_count = Results.objects.filter(photo__user=user).count()

        summary_data = {
            'total_count': total_count,
            'attention_count': attention_count,
        }

        # 3. 최종 응답
        return Response({
            'summary': summary_data,
            'history': history_data
        })

# --------------------------------------------------------
# 4. 의사 대시보드 메인 뷰 (GET: /api/dashboard/doctor/main/)
# --------------------------------------------------------
# FE의 의사 메인 화면 (대시보드)에서 사용
class DoctorDashboardMainView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 1. 💡 request.user는 이미 인증된 Users 객체입니다.
        user = request.user

        # 1. 의사 여부 확인
        if not user.is_doctor:
            return Response({'error': '접근 권한이 없습니다. 의사 계정으로 로그인해야 합니다.'}, status=status.HTTP_403_FORBIDDEN)

        # 2. 🚨 로그인한 Users와 연결된 Doctors 레코드의 ID 가져오기
        try:
            # related_name='doctor_profile'을 통해 Doctors 인스턴스를 가져옵니다.
            doctor_record = user.doctor_profile

            # Doctors 테이블의 PK (uid)가 Users의 ID를 참조하므로, user.id가 곧 doctor_id 입니다.
            # 하지만 쿼리 필터링 시에는 doctor_record.uid.id 또는 doctor_record.pk를 사용하거나,
            # 아니면 Doctors의 PK인 user.id를 사용해도 됩니다.
            doctor_id = doctor_record.uid.id  # Users의 ID와 동일

        except Doctors.DoesNotExist:
            print(f"ERROR: {user.email} 사용자는 is_doctor=True 이지만 Doctors 테이블에 레코드가 없습니다.")
            return Response(
                {'error': 'Doctors 테이블에 의사 정보가 누락되었습니다.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # 3. 쿼리 로직 수정: doctor_id 사용 (이 부분은 유지)
        doctor_assigned_results = Results.objects.filter(
            followup_check__doctor_id=doctor_id  # 💡 doctor_id는 Doctors 테이블의 PK (user.id)
        ).order_by('-analysis_date')[:5]

        # 🔴 DoctorCardSerializer를 사용하여 환자 정보 및 증상을 포함하여 직렬화합니다.
        try:
            history_data = DoctorCardSerializer(doctor_assigned_results, many=True).data
        except Exception as e:
            print(f"Serializer Error: {e}")
            return Response(
                {'error': f'시리얼라이즈 과정 오류 발생: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # 2. 요약 정보 (즉시 주의 건수 계산)
        #    - 의사 소견(doctor_risk_level)이 '즉시 주의'인 경우만 계산
        immediate_attention_count = Results.objects.filter(
            followup_check__doctor_id=doctor_id,
            followup_check__doctor_risk_level='즉시 주의'
        ).count()
        total_assigned_count = doctor_assigned_results.count()

        summary_data = {
            'total_assigned_count': total_assigned_count,
            'immediate_attention_count': immediate_attention_count,
        }

        # 3. 최종 응답 (DoctorDashboardSerializer 구조 사용)
        return Response({
            'summary': summary_data,
            'history': history_data
        })