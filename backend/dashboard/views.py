# backend/dashboard/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
#from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from diagnosis.models import Results
from users.models import Users
from .serializers import ResultMainSerializer
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
# 3. 대시보드 요약 뷰 (GET: /api/data/summary/)
# --------------------------------------------------------
# FE의 메인 화면 (대시보드)에서 사용
# UserDashboardMainView에 인증 요구사항을 임시로 제거합니다.
class UserDashboardMainView(APIView):
    # 🔴 permission_classes = [IsAuthenticated] 주석 처리 또는 제거
    # 🔴 임시 조치: 로그인 구현 전까지 모든 접근을 허용합니다.
    permission_classes = [AllowAny]

    def get(self, request):
        # 🔴 임시: 로그인 구현 전까지 덤프 데이터에 있는 특정 유저(ID=1)의 데이터를 강제 로드
        try:
            # 💡 덤프 파일에 반드시 존재하는 User 객체를 가정합니다.
            user = Users.objects.get(id=1)
        except Users.DoesNotExist:
            return Response(
                {'error': '임시 테스트 유저(ID=1)를 찾을 수 없습니다. 덤프 파일을 확인하세요.'},
                status=status.HTTP_404_NOT_FOUND
            )

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