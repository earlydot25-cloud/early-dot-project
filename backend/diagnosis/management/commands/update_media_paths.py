#backend/diagnosis/management/commands/update_media_paths.py

## 데이터 경로 추가 /media/가 빠져있는 것 추가하는 코드
# cd backend
#  python manage.py update_media_paths

from django.core.management.base import BaseCommand
from django.db.models import F, Value
from django.db.models.functions import Concat
from django.apps import apps
from django.db import transaction

# 💡 모델 경로가 diagnosis 앱과 doctors 앱에 있다고 가정합니다.
Photos = apps.get_model('diagnosis', 'Photos')
Results = apps.get_model('diagnosis', 'Results')
Doctors = apps.get_model('users', 'Doctors') # 💡 doctors 앱 경로 확인 필요

class Command(BaseCommand):
    help = '데이터베이스의 모든 미디어 경로 필드(storage_path, cert_path, grad_cam_path) 앞에 /media/ 접두사를 일괄 추가합니다.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("🚨 미디어 경로 일괄 업데이트를 시작합니다..."))

        try:
            with transaction.atomic():
                # ----------------------------------------------------------------------
                # 1. Photos 테이블 업데이트: storage_path
                # ----------------------------------------------------------------------
                self.stdout.write("1. Photos 테이블 storage_path 업데이트 중...")
                updated_photos = Photos.objects.all().update(
                    storage_path=Concat(Value('/media/'), F('storage_path'))
                )
                self.stdout.write(self.style.SUCCESS(f"-> Photos: {updated_photos}개 항목 업데이트 완료."))

                # ----------------------------------------------------------------------
                # 2. Doctors 테이블 업데이트: cert_path
                # ----------------------------------------------------------------------
                self.stdout.write("2. Doctors 테이블 cert_path 업데이트 중...")
                updated_doctors = Doctors.objects.all().update(
                    cert_path=Concat(Value('/media/'), F('cert_path'))
                )
                self.stdout.write(self.style.SUCCESS(f"-> Doctors: {updated_doctors}개 항목 업데이트 완료."))

                # ----------------------------------------------------------------------
                # 3. Results 테이블 업데이트: grad_cam_path
                # ----------------------------------------------------------------------
                self.stdout.write("3. Results 테이블 grad_cam_path 업데이트 중...")
                updated_results = Results.objects.all().update(
                    grad_cam_path=Concat(Value('/media/'), F('grad_cam_path'))
                )
                self.stdout.write(self.style.SUCCESS(f"-> Results: {updated_results}개 항목 업데이트 완료."))

            self.stdout.write(self.style.SUCCESS('\n✅ 모든 미디어 경로 업데이트가 성공적으로 완료되었습니다.'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n❌ 데이터 업데이트 중 오류 발생: {e}"))
            self.stdout.write(self.style.ERROR("트랜잭션이 롤백되었습니다."))