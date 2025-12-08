# backend/dashboard/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from diagnosis.models import Results, Photos
from users.models import Users, Doctors
from .models import FollowUpCheck
from .serializers import ResultMainSerializer, DoctorCardSerializer, FollowUpCheckSerializer
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
                # 이미지 URL 생성 (상대 경로 반환)
                image_url = ''
                if latest_photo.upload_storage_path:
                    url = latest_photo.upload_storage_path.url
                    if url.startswith('http'):
                        # 내부 호스트명(django, project_django)이 포함된 경우 경로만 추출
                        if 'django' in url or 'project_django' in url:
                            import re
                            match = re.search(r'/media/.*$', url)
                            if match:
                                image_url = match.group(0)
                            else:
                                image_url = url
                        else:
                            image_url = url
                    else:
                        # 상대 경로 그대로 반환 (프론트엔드에서 처리)
                        image_url = url
                
                # 해당 폴더의 최고 위험도 계산
                # 폴더 내 모든 Photos의 Results를 확인하여 최고 위험도 찾기
                folder_photos = Photos.objects.filter(
                    user=target_user,
                    folder_name=folder['folder_name']
                )
                folder_results = Results.objects.filter(photo__in=folder_photos).select_related('photo', 'photo__user', 'disease', 'followup_check')
                
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
                needs_opinion_count = 0  # 소견 작성 필요 개수
                
                for folder_result in folder_results:
                    # 의사 소견 우선, 없으면 AI 위험도
                    risk = None
                    try:
                        if hasattr(folder_result, 'followup_check') and folder_result.followup_check:
                            followup = folder_result.followup_check
                            if followup.doctor_risk_level and followup.doctor_risk_level != '소견 대기':
                                risk = followup.doctor_risk_level
                    except Exception:
                        pass  # followup_check가 없으면 무시
                    
                    # 의사 소견이 없으면 AI 위험도 사용
                    if not risk:
                        risk = folder_result.risk_level if hasattr(folder_result, 'risk_level') else '분석 대기'
                    
                    priority = risk_levels_priority.get(risk, 0)
                    if priority > max_priority:
                        max_priority = priority
                        max_risk_level = risk
                    
                    # 소견 작성 필요 개수 계산
                    try:
                        followup = getattr(folder_result, 'followup_check', None)
                        # 소견이 없거나, 소견 대기 상태이거나, doctor_note가 없으면 소견 작성 필요
                        if not followup or \
                           not followup.doctor_risk_level or \
                           followup.doctor_risk_level == '소견 대기' or \
                           not followup.doctor_note or \
                           not followup.doctor_note.strip():
                            needs_opinion_count += 1
                    except Exception:
                        # followup_check가 없으면 소견 작성 필요
                        needs_opinion_count += 1
                
                result.append({
                    'folder_name': folder['folder_name'],
                    'body_part': latest_photo.body_part,
                    'capture_date': folder['latest_date'].isoformat() if folder['latest_date'] else None,
                    'upload_storage_path': image_url,
                    'max_risk_level': max_risk_level,  # 추가: 최고 위험도
                    'needs_opinion_count': needs_opinion_count,  # 추가: 소견 작성 필요 개수
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
        results = Results.objects.filter(photo__in=photos_query).select_related('photo', 'photo__user', 'disease', 'followup_check').order_by('-analysis_date')
        
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
                # 이미지 URL 생성 (상대 경로 반환)
                image_url = ''
                if photo.upload_storage_path:
                    url = photo.upload_storage_path.url
                    if url.startswith('http'):
                        # 내부 호스트명(django, project_django)이 포함된 경우 경로만 추출
                        if 'django' in url or 'project_django' in url:
                            import re
                            match = re.search(r'/media/.*$', url)
                            if match:
                                image_url = match.group(0)
                            else:
                                image_url = url
                        else:
                            image_url = url
                    else:
                        # 상대 경로 그대로 반환 (프론트엔드에서 처리)
                        image_url = url
                
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
                
                # 🔴 Photos.id로 조회했지만, 연결된 Results가 있는지 확인
                try:
                    # photo와 연결된 Results가 있는지 확인 (OneToOne 관계)
                    result = Results.objects.select_related('photo', 'photo__user', 'disease', 'followup_check').get(photo=photo)
                    # Results가 있으면 ResultDetailSerializer로 반환
                    serializer = ResultDetailSerializer(result, context={'request': request})
                    return Response(serializer.data, status=status.HTTP_200_OK)
                except Results.DoesNotExist:
                    # Results가 없을 때만 Photos만 있는 경우로 처리
                    pass
                
                # Photos만 있을 때의 응답 구조 (Results 형태와 호환)
                # PhotoDetailSerializer가 이미 context를 받아서 절대 URL을 생성하므로
                # 여기서는 별도로 image_url을 만들 필요 없음
                
                return Response({
                    'id': photo.id,
                    'photo': PhotoDetailSerializer(photo, context={'request': request}).data,
                    'disease': None,
                    'analysis_date': photo.capture_date.isoformat() if photo.capture_date else None,
                    'risk_level': '분석 대기',
                    'class_probs': {},
                    'grad_cam_path': '',
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
            
            # 해당 환자의 모든 Results 가져오기 (photo도 함께 가져오기)
            patient_results = Results.objects.filter(
                photo__user=patient
            ).select_related('photo__user', 'followup_check', 'photo').order_by('-analysis_date')
            
            # 필터에 따라 Results 필터링 (필터가 '전체 보기'가 아니면)
            filtered_results = patient_results
            if filter_param != '전체 보기':
                if filter_param == '주의 환자':
                    filtered_results = patient_results.filter(
                        followup_check__doctor_risk_level__in=['즉시 주의', '경과 관찰']
                    )
                elif filter_param in ['즉시 주의', '경과 관찰', '정상', '소견 대기']:
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
                
                # doctor_risk_level이 있고 '소견 대기'가 아닌 최신 followup_check 찾기
                # 최신 업데이트 시간(last_updated_at)을 기준으로 가장 최근 소견 선택
                latest_followup = None
                latest_followup_with_note = None
                latest_update_time = None
                latest_update_time_with_note = None
                
                for result in patient_results:
                    # hasattr로 안전하게 확인
                    if hasattr(result, 'followup_check'):
                        try:
                            followup = result.followup_check
                            if followup:
                                # doctor_risk_level이 있고 '소견 대기'가 아닌 경우
                                if followup.doctor_risk_level and followup.doctor_risk_level != '소견 대기':
                                    update_time = followup.last_updated_at if hasattr(followup, 'last_updated_at') else None
                                    
                                    # doctor_note가 있는 경우 우선 선택 (가장 최신 것)
                                    if followup.doctor_note and followup.doctor_note.strip():
                                        if latest_update_time_with_note is None or (update_time and update_time > latest_update_time_with_note):
                                            latest_followup_with_note = followup
                                            latest_update_time_with_note = update_time
                                    
                                    # doctor_note가 없어도 최신 것 선택
                                    if latest_update_time is None or (update_time and update_time > latest_update_time):
                                        latest_followup = followup
                                        latest_update_time = update_time
                        except Exception:
                            # followup_check가 없는 경우 무시
                            continue
                
                # doctor_note가 있는 것을 우선 사용, 없으면 doctor_risk_level만 있는 것 사용
                if latest_followup_with_note:
                    latest_followup = latest_followup_with_note
                elif latest_followup is None:
                    # doctor_risk_level이 없으면 최신 followup_check 사용
                    latest_followup = latest_result.followup_check if latest_result and hasattr(latest_result, 'followup_check') else None
                
                # 최신 AI 위험도 가져오기
                latest_ai_risk = latest_result.risk_level if latest_result else None
                
                # 환자 연령 및 성별 정보 (의사 메인 페이지와 동일한 방식: photo.meta_age, photo.meta_sex 우선)
                patient_age = None
                patient_sex = None
                
                # 최신 photo의 메타 정보 우선 사용
                if latest_result and hasattr(latest_result, 'photo'):
                    photo = latest_result.photo
                    if hasattr(photo, 'meta_age') and photo.meta_age:
                        patient_age = photo.meta_age
                    if hasattr(photo, 'meta_sex') and photo.meta_sex:
                        patient_sex = photo.meta_sex
                
                # photo 메타 정보가 없으면 Users 모델의 정보 사용
                if patient_age is None:
                    if hasattr(patient, 'birth_date') and patient.birth_date:
                        from datetime import date
                        today = date.today()
                        patient_age = today.year - patient.birth_date.year - (
                            (today.month, today.day) < (patient.birth_date.month, patient.birth_date.day)
                        )
                    elif hasattr(patient, 'age') and patient.age:
                        patient_age = patient.age
                
                if patient_sex is None:
                    patient_sex = getattr(patient, 'sex', None)
                
                # 소견 작성 필요 개수 계산
                needs_opinion_count = 0
                for result in patient_results:
                    try:
                        followup = getattr(result, 'followup_check', None)
                        # 소견이 없거나, 소견 대기 상태이거나, doctor_note가 없으면 소견 작성 필요
                        if not followup or \
                           not followup.doctor_risk_level or \
                           followup.doctor_risk_level == '소견 대기' or \
                           not followup.doctor_note or \
                           not followup.doctor_note.strip():
                            needs_opinion_count += 1
                    except Exception:
                        # followup_check가 없으면 소견 작성 필요
                        needs_opinion_count += 1
                
                # 마지막 소견 작성 시간
                latest_note_updated_at = None
                if latest_followup_with_note and hasattr(latest_followup_with_note, 'last_updated_at'):
                    latest_note_updated_at = latest_followup_with_note.last_updated_at
                elif latest_followup and hasattr(latest_followup, 'last_updated_at'):
                    latest_note_updated_at = latest_followup.last_updated_at
                
                patients_dict[patient_id] = {
                    'id': patient.id,
                    'name': patient.name or patient.email,
                    'sex': patient_sex,
                    'age': patient_age,
                    'ai_risk_level': latest_ai_risk,
                    'latest_note': latest_followup.doctor_note if latest_followup and latest_followup.doctor_note and latest_followup.doctor_note.strip() else None,
                    'latest_note_updated_at': latest_note_updated_at.isoformat() if latest_note_updated_at else None,
                    'has_attention': latest_followup and latest_followup.doctor_risk_level == '즉시 주의' if latest_followup else False,
                    'doctor_risk_level': latest_followup.doctor_risk_level if latest_followup and latest_followup.doctor_risk_level else None,
                    'needs_review': latest_followup is None or (latest_followup.doctor_risk_level == '소견 대기' if latest_followup else True),
                    'needs_opinion_count': needs_opinion_count,  # 소견 작성 필요 개수 추가
                }
            
            # 최신 소견을 이미 설정했으므로, 최고 위험도 계산 로직 제거
            # 대신 최신 소견의 위험도를 그대로 사용
            # (이미 latest_followup에서 최신 소견을 선택했으므로 추가 계산 불필요)
        
        # 최종 정리: 소견 필요 여부를 의사 판정 기준으로 다시 계산
        for patient_data in patients_dict.values():
            doctor_risk = patient_data.get('doctor_risk_level')
            # 전문의 판정이 없거나 '소견 대기'이면 항상 소견 필요 상태로 표시
            patient_data['needs_review'] = doctor_risk is None or doctor_risk == '소견 대기'
        
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
        # request.user를 사용합니다.
        user = request.user

        # 1. 최근 진단 내역 (Top 5)
        # photo__user=user 쿼리셋을 사용하여 특정 유저의 데이터만 가져옵니다.
        recent_history = Results.objects.filter(photo__user=user).order_by('-analysis_date')[:5]

        # 🔴 ResultMainSerializer 사용 시 photo, disease, followup_check 데이터가 없으면 오류 발생 가능성 있음
        #    -> 이 부분은 서버 실행 후 500 에러가 발생하면 디버깅해야 합니다.
        try:
            history_data = ResultMainSerializer(recent_history, many=True, context={'request': request}).data
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
        try:
            # 1. request.user는 이미 인증된 Users 객체입니다.
            user = request.user
            print(f"[DoctorDashboardMainView] 요청 사용자: {user.email} (ID: {user.id}, is_doctor: {user.is_doctor})")

            # 1. 의사 여부 확인
            if not user.is_doctor:
                print(f"[DoctorDashboardMainView] 접근 거부: {user.email}은 의사 계정이 아닙니다.")
                return Response({'error': '접근 권한이 없습니다. 의사 계정으로 로그인해야 합니다.'}, status=status.HTTP_403_FORBIDDEN)

            # 2. 🚨 로그인한 Users와 연결된 Doctors 레코드의 ID 가져오기
            doctor_id = None
            try:
                # related_name='doctor_profile'을 통해 Doctors 인스턴스를 가져옵니다.
                # Doctors.DoesNotExist 또는 AttributeError를 모두 처리합니다.
                doctor_record = Doctors.objects.get(uid=user)
                doctor_id = doctor_record.uid.id  # Users의 ID와 동일
                print(f"[DoctorDashboardMainView] Doctors 레코드 발견: doctor_id={doctor_id}")

            except (Doctors.DoesNotExist, AttributeError) as e:
                print(f"[DoctorDashboardMainView] WARNING: {user.email} (ID: {user.id}) 사용자는 is_doctor=True 이지만 Doctors 테이블에 레코드가 없습니다.")
                print(f"[DoctorDashboardMainView] Exception type: {type(e).__name__}, Message: {str(e)}")
                # Doctors 레코드가 없으면 자동으로 생성
                try:
                    doctor_record = Doctors.objects.create(
                        uid=user,
                        name=user.name if hasattr(user, 'name') else user.email.split('@')[0],
                        specialty='피부과',  # 기본값
                        hospital='',  # 기본값
                        status='승인'  # 기본값
                    )
                    doctor_id = doctor_record.uid.id
                    print(f"[DoctorDashboardMainView] SUCCESS: Doctors 레코드를 자동으로 생성했습니다. (ID: {doctor_id})")
                except Exception as create_error:
                    print(f"[DoctorDashboardMainView] ERROR: Doctors 레코드 자동 생성 실패: {type(create_error).__name__}: {str(create_error)}")
                    import traceback
                    print(f"[DoctorDashboardMainView] Traceback: {traceback.format_exc()}")
                    return Response(
                        {'error': 'Doctors 테이블에 의사 정보가 누락되었고, 자동 생성에도 실패했습니다. 관리자에게 문의하세요.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            except Exception as e:
                print(f"[DoctorDashboardMainView] ERROR: 의사 정보 조회 중 예상치 못한 오류 발생: {type(e).__name__}: {str(e)}")
                import traceback
                print(f"[DoctorDashboardMainView] Traceback: {traceback.format_exc()}")
                return Response(
                    {'error': f'의사 정보 조회 중 오류가 발생했습니다: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            if doctor_id is None:
                print(f"[DoctorDashboardMainView] ERROR: doctor_id가 None입니다.")
                return Response(
                    {'error': '의사 ID를 확인할 수 없습니다.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # 3. 쿼리 로직 수정: 의사에게 할당된 환자들의 진단 결과 조회
            print(f"[DoctorDashboardMainView] 쿼리 시작: doctor_id={doctor_id}")
            # 의사에게 할당된 환자들의 모든 진단 결과 조회 (FollowUpCheck 유무와 관계없이)
            all_results = Results.objects.filter(
                photo__user__doctor=doctor_record  # 의사에게 할당된 환자들의 진단 결과
            ).select_related('photo__user', 'disease', 'followup_check').order_by('-analysis_date')
            print(f"[DoctorDashboardMainView] 전체 쿼리 결과 개수: {all_results.count()}")

            # 3-1. 주의가 필요한 환자 필터링 (최대 5개)
            # 의사 위험도가 '즉시 주의'이거나, 의사 소견에 '즉시 주의'가 포함된 경우
            attention_results = []
            for result in all_results:
                # followup_check가 있는지 안전하게 확인
                try:
                    followup_check = result.followup_check
                    doctor_risk_level = followup_check.doctor_risk_level if followup_check else None
                    doctor_note = followup_check.doctor_note if followup_check else ''
                except Exception:
                    doctor_risk_level = None
                    doctor_note = ''
                
                if doctor_risk_level == '즉시 주의' or (doctor_note and '즉시 주의' in doctor_note):
                    attention_results.append(result)
                    if len(attention_results) >= 5:
                        break
            
            # 3-2. 소견작성 필요 환자 필터링 (최대 5개)
            # 소견이 없거나 소견 대기 상태인 경우
            need_opinion_results = []
            for result in all_results:
                # followup_check가 있는지 안전하게 확인
                try:
                    followup_check = result.followup_check
                    has_opinion = followup_check and followup_check.doctor_note and followup_check.doctor_risk_level != '소견 대기'
                except Exception:
                    has_opinion = False
                
                if not has_opinion:
                    need_opinion_results.append(result)
                    if len(need_opinion_results) >= 5:
                        break

            # 🔴 DoctorCardSerializer를 사용하여 환자 정보 및 증상을 포함하여 직렬화합니다.
            try:
                attention_data = DoctorCardSerializer(attention_results, many=True, context={'request': request}).data
                need_opinion_data = DoctorCardSerializer(need_opinion_results, many=True, context={'request': request}).data
                print(f"[DoctorDashboardMainView] 시리얼라이즈 완료: attention={len(attention_data)}개, need_opinion={len(need_opinion_data)}개")
            except Exception as e:
                print(f"[DoctorDashboardMainView] Serializer Error: {type(e).__name__}: {str(e)}")
                import traceback
                print(f"[DoctorDashboardMainView] Traceback: {traceback.format_exc()}")
                return Response(
                    {'error': f'시리얼라이즈 과정 오류 발생: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # 2. 요약 정보 계산
            total_assigned_count = Users.objects.filter(
                doctor=doctor_record,
                is_doctor=False  # 의사가 아닌 환자만 카운트
            ).count()
            
            # 즉시 주의 건수 (의사 소견이 '즉시 주의'인 경우)
            immediate_attention_count = Results.objects.filter(
                photo__user__doctor=doctor_record,
                followup_check__doctor_risk_level='즉시 주의'
            ).count()
            
            # 소견 작성 완료 건수 (소견이 있고 '소견 대기'가 아닌 경우)
            completed_opinions_count = Results.objects.filter(
                photo__user__doctor=doctor_record,
                followup_check__doctor_note__isnull=False,
                followup_check__doctor_risk_level__isnull=False
            ).exclude(
                followup_check__doctor_risk_level='소견 대기'
            ).count()
            
            # 소견작성 필요 건수 (전체 기준으로 정확하게 계산)
            # 소견이 없거나 소견 대기 상태인 경우
            need_opinion_count = 0
            for result in all_results:
                try:
                    followup_check = result.followup_check
                    has_opinion = followup_check and followup_check.doctor_note and followup_check.doctor_risk_level != '소견 대기'
                except Exception:
                    has_opinion = False
                
                if not has_opinion:
                    need_opinion_count += 1
            
            print(f"[DoctorDashboardMainView] 요약 정보: total={total_assigned_count}, immediate_attention={immediate_attention_count}, completed_opinions={completed_opinions_count}, need_opinion={need_opinion_count}")

            summary_data = {
                'total_assigned_count': total_assigned_count,
                'immediate_attention_count': immediate_attention_count,
                'completed_opinions_count': completed_opinions_count,
                'need_opinion_count': need_opinion_count,  # 소견작성 필요 건수 추가
            }

            # 3. 최종 응답 (각 섹션별로 최대 5개씩 반환)
            print(f"[DoctorDashboardMainView] 응답 생성 완료")
            return Response({
                'summary': summary_data,
                'attention_history': attention_data,  # 주의가 필요한 환자 최대 5개
                'need_opinion_history': need_opinion_data  # 소견작성 필요 환자 최대 5개
            })
        except Exception as e:
            print(f"[DoctorDashboardMainView] FATAL ERROR: {type(e).__name__}: {str(e)}")
            import traceback
            print(f"[DoctorDashboardMainView] Full Traceback:\n{traceback.format_exc()}")
            return Response(
                {'error': f'의사 대시보드 데이터를 불러오는 중 오류가 발생했습니다: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# --------------------------------------------------------
# 전문의 소견 신청 뷰
# --------------------------------------------------------
class RequestFollowUpView(APIView):
    """
    Results에 대해 전문의 소견을 신청하는 API
    POST: /api/dashboard/records/<result_id>/request-followup/
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        try:
            # pk는 Results.id
            result = Results.objects.select_related('photo__user').get(pk=pk)
            
            # 권한 확인: 본인의 결과여야 함
            if result.photo.user != request.user:
                return Response(
                    {'error': 'Permission denied'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # 이미 FollowUpCheck가 있는지 확인
            if hasattr(result, 'followup_check'):
                return Response(
                    {'message': '이미 전문의 소견이 신청되었습니다.', 'followup_check_id': result.followup_check.id},
                    status=status.HTTP_200_OK
                )
            
            # FollowUpCheck 생성
            patient_user = result.photo.user
            # 담당 의사 찾기 (환자에게 할당된 의사가 있으면 사용)
            assigned_doctor = None
            if hasattr(patient_user, 'doctor'):
                assigned_doctor = patient_user.doctor
            
            followup_check = FollowUpCheck.objects.create(
                result=result,
                user=patient_user,
                doctor=assigned_doctor,
                current_status='요청중',
                doctor_risk_level=None,
                doctor_note=None,
            )
            
            return Response(
                {
                    'message': '전문의 소견 신청이 완료되었습니다.',
                    'followup_check_id': followup_check.id
                },
                status=status.HTTP_201_CREATED
            )
            
        except Results.DoesNotExist:
            return Response(
                {'error': 'Result not found'},
                status=status.HTTP_404_NOT_FOUND
            )


# --------------------------------------------------------
# 전문의 소견 작성/수정 뷰
# --------------------------------------------------------
class FollowUpUpdateView(APIView):
    """
    전문의가 FollowUpCheck에 소견과 위험도를 입력/수정하는 API
    PATCH: /api/dashboard/records/<result_id>/followup/update/
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        # 의사만 작성 가능
        if not request.user.is_doctor:
            return Response(
                {'error': 'Permission denied. Doctor access only.'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            result = Results.objects.select_related('photo__user').get(pk=pk)
        except Results.DoesNotExist:
            return Response(
                {'error': 'Result not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        followup = getattr(result, 'followup_check', None)
        doctor_profile = getattr(request.user, 'doctor_profile', None)

        if not followup:
            followup = FollowUpCheck.objects.create(
                result=result,
                user=result.photo.user,
                doctor=doctor_profile,
                current_status='요청중',
                doctor_risk_level='소견 대기',
                doctor_note=''
            )
        elif doctor_profile and followup.doctor is None:
            followup.doctor = doctor_profile

        doctor_risk_level = request.data.get('doctor_risk_level')
        doctor_note = request.data.get('doctor_note')
        current_status = request.data.get('current_status')

        risk_choices = [choice[0] for choice in FollowUpCheck._meta.get_field('doctor_risk_level').choices]
        status_choices = [choice[0] for choice in FollowUpCheck._meta.get_field('current_status').choices]

        if doctor_risk_level:
            if doctor_risk_level not in risk_choices:
                return Response(
                    {'error': f'Invalid doctor_risk_level. Allowed: {risk_choices}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            followup.doctor_risk_level = doctor_risk_level

        if doctor_note is not None:
            followup.doctor_note = doctor_note

        if current_status:
            if current_status not in status_choices:
                return Response(
                    {'error': f'Invalid current_status. Allowed: {status_choices}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            followup.current_status = current_status
        elif doctor_risk_level or doctor_note is not None:
            followup.current_status = '확인 완료'

        followup.save()

        serializer = FollowUpCheckSerializer(followup)
        return Response(serializer.data, status=status.HTTP_200_OK)