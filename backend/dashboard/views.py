# backend/dashboard/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from diagnosis.models import Results, Photos
from users.models import Users, Doctors
from .serializers import ResultMainSerializer, DoctorCardSerializer
from django.db.models import Q, Max  # 복잡한 쿼리를 위해 필요
from django.utils import timezone

# --------------------------------------------------------
# 1. 폴더 목록 뷰 (GET: /api/dashboard/folders/)
# --------------------------------------------------------
# FE의 '진단 내역' 페이지에서 사용
class FoldersListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 쿼리 파라미터에서 user ID 확인 (의사용일 경우)
        user_id = request.query_params.get('user')
        
        # user_id가 제공되면 해당 사용자, 없으면 현재 로그인한 사용자
        if user_id:
            try:
                target_user = Users.objects.get(id=user_id)
            except Users.DoesNotExist:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            target_user = request.user
        
        # 해당 사용자의 Photos에서 folder_name으로 그룹핑
        # 각 폴더별로 최신 capture_date를 가진 사진 정보 반환
        folders_data = Photos.objects.filter(user=target_user).values('folder_name').annotate(
            latest_date=Max('capture_date')
        ).order_by('-latest_date')
        
        # 각 폴더의 상세 정보 조회
        result = []
        for folder in folders_data:
            # 해당 폴더의 가장 최근 사진 정보 가져오기
            latest_photo = Photos.objects.filter(
                user=target_user,
                folder_name=folder['folder_name']
            ).order_by('-capture_date').first()
            
            if latest_photo:
                # 이미지 URL 생성 (절대 경로)
                image_url = ''
                if latest_photo.upload_storage_path:
                    url = latest_photo.upload_storage_path.url
                    if url.startswith('http'):
                        image_url = url
                    else:
                        image_url = f"http://127.0.0.1:8000{url}"
                
                # 해당 폴더의 최고 위험도 계산
                # 폴더 내 모든 Photos의 Results를 확인하여 최고 위험도 찾기
                folder_photos = Photos.objects.filter(
                    user=target_user,
                    folder_name=folder['folder_name']
                )
                folder_results = Results.objects.filter(photo__in=folder_photos).select_related('followup_check')
                
                max_risk_level = '낮음'  # 기본값
                risk_levels_priority = {
                    '즉시 주의': 5,
                    '높음': 4,
                    '경과 관찰': 3,
                    '보통': 3,
                    '중간': 2,
                    '낮음': 1,
                    '정상': 0,
                    '분석 대기': -1,
                }
                
                max_priority = -2
                for result in folder_results:
                    # 의사 소견 우선, 없으면 AI 위험도
                    risk = result.followup_check.doctor_risk_level if (
                        result.followup_check and 
                        result.followup_check.doctor_risk_level and 
                        result.followup_check.doctor_risk_level != '소견 대기'
                    ) else result.risk_level
                    
                    priority = risk_levels_priority.get(risk, 0)
                    if priority > max_priority:
                        max_priority = priority
                        max_risk_level = risk
                
                result.append({
                    'folder_name': folder['folder_name'],
                    'body_part': latest_photo.body_part,
                    'capture_date': folder['latest_date'].isoformat() if folder['latest_date'] else None,
                    'upload_storage_path': image_url,
                    'max_risk_level': max_risk_level,  # 추가: 최고 위험도
                })
        
        return Response(result, status=status.HTTP_200_OK)


# --------------------------------------------------------
# 2. 기록 목록 뷰 (GET: /api/dashboard/records/)
# --------------------------------------------------------
# FE의 '질환 목록' 페이지에서 사용
# Results가 있으면 Results 반환, 없으면 Photos 반환
class RecordListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 쿼리 파라미터
        user_id = request.query_params.get('user')
        folder_name = request.query_params.get('folder')
        
        # user_id가 제공되면 해당 사용자, 없으면 현재 로그인한 사용자
        if user_id:
            try:
                target_user = Users.objects.get(id=user_id)
            except Users.DoesNotExist:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            target_user = request.user
        
        # Photos 필터링
        photos_query = Photos.objects.filter(user=target_user)
        if folder_name:
            photos_query = photos_query.filter(folder_name=folder_name)
        
        # 해당 Photos와 연결된 Results 가져오기
        results = Results.objects.filter(photo__in=photos_query).select_related('photo', 'disease', 'followup_check').order_by('-analysis_date')
        
        # Results가 있는 Photos ID 목록
        photos_with_results = [r.photo_id for r in results]
        
        # Results가 없는 Photos 가져오기
        photos_without_results = photos_query.exclude(id__in=photos_with_results).order_by('-capture_date')
        
        # 시리얼라이저로 변환
        records_data = []
        
        try:
            # Results가 있는 경우
            if results.exists():
                serializer = ResultMainSerializer(results, many=True, context={'request': request})
                records_data.extend(serializer.data)
            
            # Results가 없는 Photos도 포함 (분석 대기 상태)
            from django.conf import settings
            for photo in photos_without_results:
                # 이미지 URL 생성 (절대 경로)
                image_url = ''
                if photo.upload_storage_path:
                    if photo.upload_storage_path.url.startswith('http'):
                        image_url = photo.upload_storage_path.url
                    else:
                        # 상대 경로를 절대 경로로 변환
                        image_url = f"http://127.0.0.1:8000{photo.upload_storage_path.url}"
                
                records_data.append({
                    'id': photo.id,
                    'photo': {
                        'id': photo.id,
                        'folder_name': photo.folder_name,
                        'file_name': photo.file_name,
                        'body_part': photo.body_part,
                        'capture_date': photo.capture_date.isoformat() if photo.capture_date else None,
                        'upload_storage_path': image_url,
                    },
                    'disease': None,
                    'analysis_date': photo.capture_date.isoformat() if photo.capture_date else None,
                    'risk_level': '분석 대기',
                    'vlm_analysis_text': None,
                    'followup_check': None,
                })
            
            # 최종 정렬 (날짜 기준 내림차순)
            records_data.sort(key=lambda x: x.get('analysis_date') or '', reverse=True)
            
        except Exception as e:
            return Response(
                {'error': f'Serialization error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response(records_data, status=status.HTTP_200_OK)


# --------------------------------------------------------
# 3. 기록 상세 뷰 (GET: /api/dashboard/records/<int:pk>/)
# --------------------------------------------------------
# pk는 Results.id 또는 Photos.id 모두 가능
class RecordDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from .serializers import ResultDetailSerializer, PhotoDetailSerializer
        
        # 1. Results로 먼저 시도
        try:
            result = Results.objects.select_related('photo', 'photo__user', 'disease', 'followup_check').get(pk=pk)
            # 권한 확인: 본인의 결과거나 의사가 담당한 결과여야 함
            if result.photo.user != request.user and not request.user.is_doctor:
                return Response(
                    {'error': 'Permission denied'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            serializer = ResultDetailSerializer(result, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Results.DoesNotExist:
            # 2. Results가 없으면 Photos로 시도
            try:
                photo = Photos.objects.select_related('user').get(pk=pk)
                # 권한 확인
                if photo.user != request.user and not request.user.is_doctor:
                    return Response(
                        {'error': 'Permission denied'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # Photos만 있을 때의 응답 구조 (Results 형태와 호환)
                from django.conf import settings
                image_url = ''
                if photo.upload_storage_path:
                    url = photo.upload_storage_path.url
                    if url.startswith('http'):
                        image_url = url
                    else:
                        image_url = f"http://127.0.0.1:8000{url}"
                
                return Response({
                    'id': photo.id,
                    'photo': PhotoDetailSerializer(photo, context={'request': request}).data,
                    'disease': None,
                    'analysis_date': photo.capture_date.isoformat() if photo.capture_date else None,
                    'risk_level': '분석 대기',
                    'class_probs': {},
                    'grad_cam_path': '',
                    'vlm_analysis_text': None,
                    'followup_check': None,
                    'user': {
                        'name': photo.user.name or photo.user.email,
                        'sex': photo.meta_sex if photo.meta_sex else (photo.user.sex if hasattr(photo.user, 'sex') else '모름'),
                        'age': photo.meta_age if photo.meta_age else (photo.user.age if hasattr(photo.user, 'age') else None),
                        'family_history': photo.user.family_history if hasattr(photo.user, 'family_history') else '없음',
                    }
                }, status=status.HTTP_200_OK)
            except Photos.DoesNotExist:
                return Response(
                    {'error': 'Record not found'},
                    status=status.HTTP_404_NOT_FOUND
                )


# --------------------------------------------------------
# 4. 기록 수정 뷰 (PATCH: /api/dashboard/records/<int:pk>/)
# --------------------------------------------------------
class RecordUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        """기록(Photo) 수정 - 파일명, 신체 부위 등"""
        try:
            # Photos로 먼저 시도
            try:
                photo = Photos.objects.get(pk=pk)
                # 권한 확인
                if photo.user != request.user and not request.user.is_doctor:
                    return Response(
                        {'error': 'Permission denied'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # 수정 가능한 필드만 업데이트
                if 'file_name' in request.data:
                    photo.file_name = request.data['file_name']
                if 'body_part' in request.data:
                    photo.body_part = request.data['body_part']
                if 'folder_name' in request.data:
                    photo.folder_name = request.data['folder_name']
                
                photo.save()
                
                return Response({
                    'message': 'Record updated successfully',
                    'id': photo.id,
                    'file_name': photo.file_name,
                    'body_part': photo.body_part,
                    'folder_name': photo.folder_name,
                }, status=status.HTTP_200_OK)
            except Photos.DoesNotExist:
                # Results로 시도 (Results는 photo를 통해 접근)
                result = Results.objects.get(pk=pk)
                if result.photo.user != request.user and not request.user.is_doctor:
                    return Response(
                        {'error': 'Permission denied'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                photo = result.photo
                if 'file_name' in request.data:
                    photo.file_name = request.data['file_name']
                if 'body_part' in request.data:
                    photo.body_part = request.data['body_part']
                if 'folder_name' in request.data:
                    photo.folder_name = request.data['folder_name']
                
                photo.save()
                
                return Response({
                    'message': 'Record updated successfully',
                    'id': result.id,
                    'file_name': photo.file_name,
                    'body_part': photo.body_part,
                    'folder_name': photo.folder_name,
                }, status=status.HTTP_200_OK)
        except (Photos.DoesNotExist, Results.DoesNotExist):
            return Response(
                {'error': 'Record not found'},
                status=status.HTTP_404_NOT_FOUND
            )


# --------------------------------------------------------
# 5. 기록 삭제 뷰 (DELETE: /api/dashboard/records/<int:pk>/)
# --------------------------------------------------------
class RecordDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        """단일 기록(Photo 또는 Result) 삭제"""
        try:
            # Photos로 먼저 시도
            try:
                photo = Photos.objects.get(pk=pk)
                # 권한 확인: 본인의 사진이거나 의사가 담당한 사진
                if photo.user != request.user and not request.user.is_doctor:
                    return Response(
                        {'error': 'Permission denied'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                # Photos 삭제 시 연결된 Results도 CASCADE로 삭제됨
                photo.delete()
                return Response(
                    {'message': 'Record deleted successfully'},
                    status=status.HTTP_200_OK
                )
            except Photos.DoesNotExist:
                # Results로 시도
                result = Results.objects.get(pk=pk)
                if result.photo.user != request.user and not request.user.is_doctor:
                    return Response(
                        {'error': 'Permission denied'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                # Result 삭제 시 연결된 Photo도 함께 삭제됨
                result.photo.delete()
                return Response(
                    {'message': 'Record deleted successfully'},
                    status=status.HTTP_200_OK
                )
        except (Photos.DoesNotExist, Results.DoesNotExist):
            return Response(
                {'error': 'Record not found'},
                status=status.HTTP_404_NOT_FOUND
            )


# --------------------------------------------------------
# 6. 일괄 삭제 뷰 (DELETE: /api/dashboard/records/bulk/)
# --------------------------------------------------------
class BulkDeleteRecordsView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        """여러 기록을 한 번에 삭제"""
        record_ids = request.data.get('ids', [])
        if not record_ids:
            return Response(
                {'error': 'No IDs provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        deleted_count = 0
        errors = []
        
        for record_id in record_ids:
            try:
                try:
                    photo = Photos.objects.get(pk=record_id)
                    if photo.user != request.user and not request.user.is_doctor:
                        errors.append(f'Permission denied for record {record_id}')
                        continue
                    photo.delete()
                    deleted_count += 1
                except Photos.DoesNotExist:
                    try:
                        result = Results.objects.get(pk=record_id)
                        if result.photo.user != request.user and not request.user.is_doctor:
                            errors.append(f'Permission denied for record {record_id}')
                            continue
                        result.photo.delete()
                        deleted_count += 1
                    except Results.DoesNotExist:
                        errors.append(f'Record {record_id} not found')
            except Exception as e:
                errors.append(f'Error deleting record {record_id}: {str(e)}')
        
        return Response({
            'deleted_count': deleted_count,
            'errors': errors if errors else None
        }, status=status.HTTP_200_OK)


# --------------------------------------------------------
# 7. 폴더 수정 뷰 (PATCH: /api/dashboard/folders/<folder_name>/update/)
# --------------------------------------------------------
class FolderUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, folder_name):
        """폴더명 변경 (해당 폴더의 모든 Photos의 folder_name 업데이트)"""
        new_folder_name = request.data.get('folder_name')
        if not new_folder_name:
            return Response(
                {'error': 'folder_name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user_id = request.query_params.get('user')
        
        if user_id:
            try:
                target_user = Users.objects.get(id=user_id)
            except Users.DoesNotExist:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            target_user = request.user
        
        # 권한 확인
        if target_user != request.user and not request.user.is_doctor:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # 폴더 내 모든 Photos의 folder_name 업데이트
        photos = Photos.objects.filter(user=target_user, folder_name=folder_name)
        count = photos.update(folder_name=new_folder_name)
        
        return Response({
            'message': 'Folder renamed successfully',
            'old_folder_name': folder_name,
            'new_folder_name': new_folder_name,
            'updated_count': count
        }, status=status.HTTP_200_OK)


# --------------------------------------------------------
# 8. 폴더 삭제 뷰 (DELETE: /api/dashboard/folders/<folder_name>/)
# --------------------------------------------------------
class FolderDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, folder_name):
        """폴더 내 모든 파일 삭제"""
        user_id = request.query_params.get('user')
        
        if user_id:
            try:
                target_user = Users.objects.get(id=user_id)
            except Users.DoesNotExist:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            target_user = request.user
        
        # 권한 확인
        if target_user != request.user and not request.user.is_doctor:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # 폴더 내 모든 Photos 삭제 (Results는 CASCADE로 자동 삭제)
        photos = Photos.objects.filter(user=target_user, folder_name=folder_name)
        count = photos.count()
        photos.delete()
        
        return Response({
            'message': f'Folder deleted successfully',
            'deleted_count': count
        }, status=status.HTTP_200_OK)


# --------------------------------------------------------
# 9. 환자 목록 뷰 (GET: /api/dashboard/patients/)
# --------------------------------------------------------
# FE의 '의사용 환자 목록' 페이지에서 사용
class PatientsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 의사만 접근 가능
        if not request.user.is_doctor:
            return Response(
                {'error': 'Permission denied. Doctor access only.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            doctor_record = request.user.doctor_profile
            doctor_id = doctor_record.uid.id
        except Doctors.DoesNotExist:
            return Response(
                {'error': 'Doctor profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # filter 파라미터로 필터링
        filter_param = request.query_params.get('filter', '전체 보기')
        
        # ✅ 변경: user.doctor가 해당 의사인 모든 환자를 먼저 조회 (Results가 없어도 표시)
        # 1. 해당 의사에게 할당된 모든 환자 가져오기
        assigned_patients = Users.objects.filter(
            doctor=doctor_record,
            is_doctor=False
        ).select_related('doctor')
        
        # 2. 환자별로 Results와 FollowUpCheck 정보 수집
        patients_dict = {}
        for patient in assigned_patients:
            patient_id = patient.id
            
            # 해당 환자의 모든 Results 가져오기
            patient_results = Results.objects.filter(
                photo__user=patient
            ).select_related('photo__user', 'followup_check').order_by('-analysis_date')
            
            # 필터에 따라 Results 필터링 (필터가 '전체 보기'가 아니면)
            filtered_results = patient_results
            if filter_param != '전체 보기':
                if filter_param == '주의 환자':
                    filtered_results = patient_results.filter(
                        followup_check__doctor_risk_level__in=['즉시 주의', '경과 관찰']
                    )
                elif filter_param in ['즉시 주의', '경과 관찰', '정상', '추가검사 필요', '치료 완료']:
                    filtered_results = patient_results.filter(
                        followup_check__doctor_risk_level=filter_param
                    )
            
            # 필터링된 Results가 없으면 해당 환자는 건너뛰기 (필터가 적용된 경우)
            if filter_param != '전체 보기' and not filtered_results.exists():
                continue
            
            # Results가 없어도 환자는 표시 (필터가 '전체 보기'인 경우)
            if patient_id not in patients_dict:
                # 최신 Results의 FollowUpCheck 가져오기
                latest_result = patient_results.first()
                latest_followup = latest_result.followup_check if latest_result and hasattr(latest_result, 'followup_check') else None
                
                patients_dict[patient_id] = {
                    'id': patient.id,
                    'name': patient.name or patient.email,
                    'latest_note': latest_followup.doctor_note if latest_followup and latest_followup.doctor_note else None,
                    'has_attention': latest_followup and latest_followup.doctor_risk_level == '즉시 주의' if latest_followup else False,
                    'doctor_risk_level': latest_followup.doctor_risk_level if latest_followup and latest_followup.doctor_risk_level else None,
                    'needs_review': latest_followup is None or (latest_followup.doctor_risk_level == '소견 대기' if latest_followup else True),
                }
            
            # 환자별 최고 위험도 계산 (여러 Results가 있는 경우)
            for result in patient_results:
                current_followup = getattr(result, 'followup_check', None)
                current_risk = current_followup.doctor_risk_level if current_followup and current_followup.doctor_risk_level and current_followup.doctor_risk_level != '소견 대기' else None
                
                # 위험도 우선순위
                risk_priority = {
                    '즉시 주의': 5,
                    '경과 관찰': 4,
                    '추가검사 필요': 3,
                    '정상': 2,
                    '치료 완료': 1,
                }
                
                # 최고 위험도 업데이트
                if current_risk:
                    existing_risk = patients_dict[patient_id].get('doctor_risk_level')
                    existing_priority = risk_priority.get(existing_risk, 0) if existing_risk else 0
                    current_priority = risk_priority.get(current_risk, 0)
                    
                    if current_priority > existing_priority:
                        patients_dict[patient_id]['doctor_risk_level'] = current_risk
                        patients_dict[patient_id]['has_attention'] = current_risk == '즉시 주의'
                
                # 소견 미작성 여부 업데이트
                if current_followup is None or (current_followup.doctor_risk_level == '소견 대기' if current_followup else True):
                    patients_dict[patient_id]['needs_review'] = True
        
        patients_list = list(patients_dict.values())
        
        return Response(patients_list, status=status.HTTP_200_OK)


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