"""
가짜 데이터 생성 관리 명령어
환자, 일반 사용자, 의사 데이터를 생성하고 media 파일과 SQL 덤프를 생성합니다.
"""
import os
import random
import shutil
from datetime import datetime, timedelta, date
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from PIL import Image
import io

from users.models import Users, Doctors
from diagnosis.models import Photos, Results, DiseaseInfo
from dashboard.models import FollowUpCheck, FollowUpHistory


class Command(BaseCommand):
    help = '가짜 데이터 생성: 환자, 일반 사용자, 의사 생성 및 media 파일 생성, SQL 덤프 생성'

    def add_arguments(self, parser):
        parser.add_argument(
            '--num-doctors',
            type=int,
            default=3,
            help='생성할 의사 수 (기본값: 3)',
        )
        parser.add_argument(
            '--num-patients',
            type=int,
            default=10,
            help='생성할 환자 수 (기본값: 10)',
        )
        parser.add_argument(
            '--num-normal-users',
            type=int,
            default=5,
            help='생성할 일반 사용자 수 (기본값: 5)',
        )
        parser.add_argument(
            '--photos-per-patient',
            type=int,
            default=3,
            help='환자당 생성할 사진 수 (기본값: 3)',
        )
        parser.add_argument(
            '--clear-media',
            action='store_true',
            help='기존 media 폴더 내용 삭제',
        )
        parser.add_argument(
            '--skip-dump',
            action='store_true',
            help='SQL 덤프 생성 건너뛰기',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('=== 가짜 데이터 생성 시작 ==='))
        
        # media 폴더 삭제 옵션
        if options['clear_media']:
            self.clear_media_folder()
        
        # DiseaseInfo 생성 (필수)
        diseases = self.create_disease_info()
        
        # 의사 생성
        doctors = self.create_doctors(options['num_doctors'])
        
        # 환자 생성 (의사와 연결)
        patients = self.create_patients(options['num_patients'], doctors)
        
        # 일반 사용자 생성 (의사와 연결 안 됨)
        normal_users = self.create_normal_users(options['num_normal_users'])
        
        # Photos 및 Results 생성
        all_users = patients + normal_users
        photos_list = []
        results_list = []
        for user in all_users:
            user_photos, user_results = self.create_photos(
                user, 
                options['photos_per_patient'],
                diseases
            )
            photos_list.extend(user_photos)
            results_list.extend(user_results)
        
        # FollowUpCheck 및 FollowUpHistory 생성 (일부 Results에 대해)
        followup_checks = self.create_followup_checks(results_list, doctors, patients)
        
        # SQL 덤프 생성
        if not options['skip_dump']:
            self.create_sql_dump()
        
        self.stdout.write(self.style.SUCCESS('\n=== 가짜 데이터 생성 완료 ==='))
        self.stdout.write(f'의사: {len(doctors)}명')
        self.stdout.write(f'환자: {len(patients)}명')
        self.stdout.write(f'일반 사용자: {len(normal_users)}명')
        self.stdout.write(f'사진: {len(photos_list)}개')
        self.stdout.write(f'진단 결과: {len(results_list)}개')
        self.stdout.write(f'후속 조치 요청: {len(followup_checks)}개')
    
    def clear_media_folder(self):
        """media 폴더 내용 삭제"""
        self.stdout.write('media 폴더 내용 삭제 중...')
        media_root = settings.MEDIA_ROOT
        if os.path.exists(media_root):
            # 하위 폴더만 삭제 (media 폴더 자체는 유지)
            for item in os.listdir(media_root):
                item_path = os.path.join(media_root, item)
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                    self.stdout.write(f'  삭제: {item}/')
                elif os.path.isfile(item_path):
                    os.remove(item_path)
                    self.stdout.write(f'  삭제: {item}')
            self.stdout.write(self.style.SUCCESS('  media 폴더 정리 완료'))
        else:
            os.makedirs(media_root, exist_ok=True)
            self.stdout.write(self.style.SUCCESS('  media 폴더 생성 완료'))
    
    def create_disease_info(self):
        """DiseaseInfo 데이터 생성"""
        self.stdout.write('\n질병 정보 생성 중...')
        
        diseases_data = [
            {
                'name_ko': '흑색종',
                'name_en': 'Melanoma',
                'classification': '악성',
                'description': '가장 위험한 피부암 중 하나입니다.',
                'recommendation': '즉시 병원 방문을 권장합니다.',
            },
            {
                'name_ko': '모반',
                'name_en': 'Nevus',
                'classification': '양성',
                'description': '일반적인 점으로, 큰 문제가 없습니다.',
                'recommendation': '정기적인 관찰을 권장합니다.',
            },
            {
                'name_ko': '기저세포암',
                'name_en': 'Basal Cell Carcinoma',
                'classification': '악성',
                'description': '일반적으로 천천히 성장하는 피부암입니다.',
                'recommendation': '의사 상담 후 치료를 받으세요.',
            },
            {
                'name_ko': '편평세포암',
                'name_en': 'Squamous Cell Carcinoma',
                'classification': '악성',
                'description': '표피의 편평세포에서 발생하는 암입니다.',
                'recommendation': '정기적인 검진을 권장합니다.',
            },
            {
                'name_ko': '피부섬유종',
                'name_en': 'Dermatofibroma',
                'classification': '양성',
                'description': '피부의 섬유 조직에서 발생하는 양성 종양입니다.',
                'recommendation': '정기적인 관찰을 권장합니다.',
            },
            {
                'name_ko': '양성 각화증',
                'name_en': 'Benign Keratosis',
                'classification': '양성',
                'description': '피부의 각질층이 비정상적으로 두꺼워진 양성 질환입니다.',
                'recommendation': '정기적인 관찰을 권장합니다.',
            },
            {
                'name_ko': '광선 각화증',
                'name_en': 'Actinic Keratosis',
                'classification': '전암성',
                'description': '햇빛 노출로 인한 전암성 병변으로, 피부암으로 발전할 수 있습니다.',
                'recommendation': '즉시 병원 방문을 권장합니다.',
            },
            {
                'name_ko': '혈관종',
                'name_en': 'Vascular',
                'classification': '양성',
                'description': '혈관 관련 피부 병변입니다.',
                'recommendation': '정기적인 관찰을 권장합니다.',
            },
        ]
        
        diseases = []
        for data in diseases_data:
            disease, created = DiseaseInfo.objects.get_or_create(
                name_ko=data['name_ko'],
                defaults=data
            )
            diseases.append(disease)
            if created:
                self.stdout.write(f'  생성: {disease.name_ko}')
            else:
                self.stdout.write(f'  기존: {disease.name_ko}')
        
        return diseases
    
    def generate_korean_name(self, sex):
        """한국 이름 생성 (성별에 맞게)"""
        surnames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍']
        
        # 남성 이름
        male_given_names = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '준서', '건우',
                           '현우', '지훈', '우진', '선우', '연우', '정우', '승우', '준혁', '승현', '윤우',
                           '도현', '민성', '준영', '시윤', '지우', '동현', '재원', '민수', '성민', '준호']
        
        # 여성 이름
        female_given_names = ['서연', '서윤', '지우', '서현', '민서', '하은', '아은', '수아', '지유', '채원',
                             '지원', '예은', '다은', '소율', '예나', '유나', '시은', '채은', '윤서', '지은',
                             '수빈', '가은', '나은', '예린', '하린', '지안', '연우', '유진', '민지', '서아']
        
        surname = random.choice(surnames)
        if sex == 'M':
            given_name = random.choice(male_given_names)
        else:
            given_name = random.choice(female_given_names)
        
        return f'{surname}{given_name}'
    
    def create_doctors(self, num_doctors):
        """의사 데이터 생성"""
        self.stdout.write(f'\n의사 {num_doctors}명 생성 중...')
        
        specialties = ['피부과', '성형외과', '일반외과']
        hospitals = ['서울대학교병원', '세브란스병원', '아산병원', '삼성서울병원', '가톨릭의대병원']
        statuses = ['승인', '대기', '거절']
        
        doctors = []
        with transaction.atomic():
            for i in range(num_doctors):
                email = f'doctor{i+1}@example.com'
                password = f'doctor{i+1}'
                sex = random.choice(['M', 'F'])
                name = self.generate_korean_name(sex)
                age = random.randint(35, 55)
                birth_year = date.today().year - age
                birth_month = random.randint(1, 12)
                birth_day = random.randint(1, 28)  # 28일로 제한하여 모든 월에 유효하도록
                birth_date = date(birth_year, birth_month, birth_day)
                family_history = random.choice(['Y', 'N'])
                
                # 의사 사용자 생성
                user = Users.objects.create_user(
                    email=email,
                    password=password,
                    name=name,
                    sex=sex,
                    birth_date=birth_date,
                    age=age,
                    family_history=family_history,
                    is_doctor=True,
                )
                
                # 의사 프로필 생성
                doctor = Doctors.objects.create(
                    uid=user,
                    name=name,
                    specialty=random.choice(specialties),
                    hospital=random.choice(hospitals),
                    status=random.choice(statuses),
                )
                
                # 의사 인증서 파일 생성
                self.create_doctor_cert_file(doctor)
                
                doctors.append(doctor)
                self.stdout.write(f'  생성: {email} (비밀번호: {password})')
        
        return doctors
    
    def create_patients(self, num_patients, doctors):
        """환자 데이터 생성 (의사와 연결)"""
        self.stdout.write(f'\n환자 {num_patients}명 생성 중...')
        
        patients = []
        with transaction.atomic():
            for i in range(num_patients):
                email = f'patient{i+1}@example.com'
                password = f'patient{i+1}'
                sex = random.choice(['M', 'F'])
                name = self.generate_korean_name(sex)
                age = random.randint(20, 70)
                birth_year = date.today().year - age
                birth_month = random.randint(1, 12)
                birth_day = random.randint(1, 28)  # 28일로 제한하여 모든 월에 유효하도록
                birth_date = date(birth_year, birth_month, birth_day)
                family_history = random.choice(['Y', 'N'])
                
                # 환자에게 의사 배정 (일부는 배정 없음)
                doctor = random.choice(doctors) if doctors and random.random() > 0.2 else None
                
                # 환자 사용자 생성
                user = Users.objects.create_user(
                    email=email,
                    password=password,
                    name=name,
                    sex=sex,
                    birth_date=birth_date,
                    age=age,
                    family_history=family_history,
                    is_doctor=False,
                    doctor=doctor,
                )
                
                patients.append(user)
                doctor_info = f" (담당의: {doctor.name})" if doctor else " (담당의 없음)"
                self.stdout.write(f'  생성: {email} (비밀번호: {password}){doctor_info}')
        
        return patients
    
    def create_normal_users(self, num_users):
        """일반 사용자 데이터 생성 (의사와 연결 없음)"""
        self.stdout.write(f'\n일반 사용자 {num_users}명 생성 중...')
        
        users = []
        with transaction.atomic():
            for i in range(num_users):
                email = f'user{i+1}@example.com'
                password = f'user{i+1}'
                sex = random.choice(['M', 'F'])
                name = self.generate_korean_name(sex)
                age = random.randint(20, 50)
                birth_year = date.today().year - age
                birth_month = random.randint(1, 12)
                birth_day = random.randint(1, 28)  # 28일로 제한하여 모든 월에 유효하도록
                birth_date = date(birth_year, birth_month, birth_day)
                family_history = random.choice(['Y', 'N'])
                
                # 일반 사용자 생성 (의사 연결 없음)
                user = Users.objects.create_user(
                    email=email,
                    password=password,
                    name=name,
                    sex=sex,
                    birth_date=birth_date,
                    age=age,
                    family_history=family_history,
                    is_doctor=False,
                    doctor=None,  # 명시적으로 None
                )
                
                users.append(user)
                self.stdout.write(f'  생성: {email} (비밀번호: {password})')
        
        return users
    
    def create_photos(self, user, num_photos, diseases):
        """사진 및 진단 결과 생성"""
        photos = []
        results = []
        
        body_parts = ['얼굴', '손', '다리', '등', '가슴', '팔']
        risk_levels = ['높음', '중간', '낮음', '정상']
        folder_names = ['진단1', '진단2', '진단3', '2024년1월', '2024년2월']
        
        with transaction.atomic():
            for i in range(num_photos):
                # Photos 생성
                folder_name = random.choice(folder_names)
                file_name = f'photo_{i+1}'
                body_part = random.choice(body_parts)
                capture_date = timezone.now() - timedelta(days=random.randint(1, 90))
                
                # 더미 이미지 생성
                image_file = self.create_dummy_image()
                
                # 증상 옵션 (SavePhotoPage 기준)
                # SEVERITY = ['없음', '약간~보통', '심각']
                severity_options = ['없음', '약간~보통', '심각']
                infection_options = ['없음', '예']  # 감염은 '예' 또는 '없음'
                blood_options = ['없음', '예']  # 출혈도 '예' 또는 '없음'
                onset_options = ['1주 내', '1달 내', '1년 내', '1년 이상', '선천성', '모름', '없음']
                
                # 성별을 M/F가 아닌 '남성'/'여성'/'모름' 형식으로 변환
                meta_sex_map = {'M': '남성', 'F': '여성'}
                meta_sex = meta_sex_map.get(user.sex, '모름')
                
                photo = Photos.objects.create(
                    user=user,
                    folder_name=folder_name,
                    file_name=file_name,
                    body_part=body_part,
                    capture_date=capture_date,
                    symptoms_itch=random.choice(severity_options),
                    symptoms_pain=random.choice(severity_options),
                    symptoms_color=random.choice(severity_options),
                    symptoms_infection=random.choice(infection_options),
                    symptoms_blood=random.choice(blood_options),
                    onset_date=random.choice(onset_options),
                    meta_age=user.age,
                    meta_sex=meta_sex,
                )
                
                # ImageField에 파일 저장
                photo.upload_storage_path.save(
                    f'{file_name}.jpg',
                    image_file,
                    save=True
                )
                
                # Results 생성
                disease = random.choice(diseases)
                risk_level = random.choice(risk_levels)
                
                # class_probs 생성
                class_probs = {}
                for d in diseases:
                    if d == disease:
                        class_probs[d.name_ko] = random.uniform(0.5, 0.9)
                    else:
                        class_probs[d.name_ko] = random.uniform(0.01, 0.3)
                
                # 확률 정규화
                total = sum(class_probs.values())
                class_probs = {k: v/total for k, v in class_probs.items()}
                
                # Grad-CAM 이미지 생성
                grad_cam_file = self.create_dummy_image()
                
                result = Results.objects.create(
                    photo=photo,
                    risk_level=risk_level,
                    class_probs=class_probs,
                    disease=disease,
                )
                
                # Grad-CAM 이미지 저장
                result.grad_cam_path.save(
                    f'image_{photo.id}.png',
                    grad_cam_file,
                    save=True
                )
                
                photos.append(photo)
                results.append(result)
        
        return photos, results
    
    def create_followup_checks(self, results_list, doctors, patients):
        """후속 조치 요청 및 기록 생성"""
        self.stdout.write('\n후속 조치 요청 생성 중...')
        
        followup_checks = []
        # 일부 Results에 대해 FollowUpCheck 생성 (약 30%)
        results_to_followup = random.sample(
            results_list, 
            min(len(results_list) // 3, len(results_list))
        )
        
        statuses = ['요청중', '확인 완료']
        risk_levels = ['소견 대기', '즉시 주의', '경과 관찰', '정상']
        
        with transaction.atomic():
            for result in results_to_followup:
                # 해당 Result의 사진을 가진 사용자
                user = result.photo.user
                
                # 환자인 경우에만 후속 조치 생성
                if user in patients and user.doctor:
                    # 담당 의사 할당
                    doctor = user.doctor
                    
                    # FollowUpCheck 생성
                    followup_check = FollowUpCheck.objects.create(
                        result=result,
                        user=user,
                        doctor=doctor,
                        current_status=random.choice(statuses),
                        doctor_risk_level=random.choice(risk_levels) if random.random() > 0.5 else None,
                        doctor_note=random.choice([
                            None,
                            '정기 관찰 필요',
                            '추가 검진 권장',
                            '치료 계획 수립 필요',
                        ]),
                    )
                    followup_checks.append(followup_check)
                    
                    # FollowUpHistory 생성 (상태 변경 이력)
                    # 초기 상태 기록
                    FollowUpHistory.objects.create(
                        request=followup_check,
                        status='요청중',
                        changed_by='환자',
                        note='후속 조치 요청',
                    )
                    
                    # 확인 완료된 경우 추가 이력
                    if followup_check.current_status == '확인 완료':
                        FollowUpHistory.objects.create(
                            request=followup_check,
                            status='확인 완료',
                            changed_by='의사',
                            note=followup_check.doctor_note or '의사 확인 완료',
                        )
        
        self.stdout.write(f'  생성: {len(followup_checks)}개 후속 조치 요청')
        return followup_checks
    
    def create_dummy_image(self):
        """더미 이미지 파일 생성"""
        # 200x200 RGB 이미지 생성
        img = Image.new('RGB', (200, 200), color=(
            random.randint(100, 255),
            random.randint(100, 255),
            random.randint(100, 255)
        ))
        
        # BytesIO에 저장
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        return ContentFile(img_bytes.read())
    
    def create_doctor_cert_file(self, doctor):
        """의사 인증서 파일 생성"""
        media_root = settings.MEDIA_ROOT
        cert_dir = os.path.join(media_root, 'certs', str(doctor.uid_id))
        os.makedirs(cert_dir, exist_ok=True)
        
        # 더미 인증서 이미지 생성
        img = Image.new('RGB', (300, 400), color=(255, 255, 255))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        cert_file = ContentFile(img_bytes.read())
        cert_filename = f'cert_{doctor.uid_id}.png'
        
        # Doctors 모델의 cert_path에 저장
        doctor.cert_path.save(
            cert_filename,
            cert_file,
            save=True
        )
    
    def create_sql_dump(self):
        """SQL 덤프 파일 생성 (JSON 형식)"""
        self.stdout.write('\nSQL 덤프 생성 중...')
        
        from django.core.management import call_command
        
        dump_dir = os.path.join(settings.BASE_DIR, 'sql_dumps')
        os.makedirs(dump_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        dump_file = os.path.join(dump_dir, f'fake_data_dump_{timestamp}.json')
        
        try:
            # Django의 dumpdata 명령어 실행 (JSON 형식)
            with open(dump_file, 'w', encoding='utf-8') as f:
                call_command(
                    'dumpdata',
                    'users.Users',
                    'users.Doctors',
                    'diagnosis.Photos',
                    'diagnosis.Results',
                    'diagnosis.DiseaseInfo',
                    'dashboard.FollowUpCheck',
                    'dashboard.FollowUpHistory',
                    '--natural-foreign',
                    '--natural-primary',
                    stdout=f,
                )
            
            self.stdout.write(self.style.SUCCESS(f'  JSON 덤프 생성 완료: {dump_file}'))
            self.stdout.write(self.style.WARNING('  참고: JSON 형식으로 생성되었습니다. MySQL SQL 형식이 필요하면 mysqldump를 사용하세요.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  SQL 덤프 생성 실패: {str(e)}'))

