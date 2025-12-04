"""
데이터베이스 데이터 삭제 관리 명령어
모든 테이블의 데이터를 삭제하되 테이블 구조는 유지합니다.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.apps import apps

from users.models import Users, Doctors
from diagnosis.models import Photos, Results, DiseaseInfo
from dashboard.models import FollowUpCheck, FollowUpHistory


class Command(BaseCommand):
    help = '모든 데이터베이스 데이터 삭제 (테이블 구조는 유지)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='확인 없이 바로 삭제',
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(self.style.WARNING('⚠️  모든 데이터가 삭제됩니다!'))
            self.stdout.write(self.style.WARNING('계속하려면 --confirm 플래그를 추가하세요.'))
            return

        self.stdout.write(self.style.WARNING('데이터베이스 데이터 삭제 시작...'))

        with transaction.atomic():
            # 역순으로 삭제 (외래 키 제약 때문에)
            
            # 1. FollowUpHistory 삭제
            count = FollowUpHistory.objects.all().count()
            FollowUpHistory.objects.all().delete()
            self.stdout.write(f'  FollowUpHistory: {count}개 삭제')
            
            # 2. FollowUpCheck 삭제
            count = FollowUpCheck.objects.all().count()
            FollowUpCheck.objects.all().delete()
            self.stdout.write(f'  FollowUpCheck: {count}개 삭제')
            
            # 3. Results 삭제
            count = Results.objects.all().count()
            Results.objects.all().delete()
            self.stdout.write(f'  Results: {count}개 삭제')
            
            # 4. Photos 삭제
            count = Photos.objects.all().count()
            Photos.objects.all().delete()
            self.stdout.write(f'  Photos: {count}개 삭제')
            
            # 5. Doctors 삭제 (Users와 OneToOne이므로 Users도 함께 삭제됨)
            count = Doctors.objects.all().count()
            Doctors.objects.all().delete()
            self.stdout.write(f'  Doctors: {count}개 삭제')
            
            # 6. Users 삭제 (Doctors와 연결 안 된 것들)
            count = Users.objects.all().count()
            Users.objects.all().delete()
            self.stdout.write(f'  Users: {count}개 삭제')
            
            # 7. DiseaseInfo는 유지 (기본 질병 정보이므로)
            # 필요하면 주석 해제
            # count = DiseaseInfo.objects.all().count()
            # DiseaseInfo.objects.all().delete()
            # self.stdout.write(f'  DiseaseInfo: {count}개 삭제')

        self.stdout.write(self.style.SUCCESS('✅ 데이터베이스 데이터 삭제 완료!'))


