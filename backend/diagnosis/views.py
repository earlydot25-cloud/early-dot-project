
# backend/diagnosis/views.py

from django.conf import settings
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
# IsAuthenticated: 로그인한 사용자만 접근 가능하게 함
import requests
import os

from .models import Photos, Results, DiseaseInfo
from .serializers import PhotoUploadSerializer, PhotoDetailSerializer
from dashboard.models import FollowUpCheck


# (만약 기존에 views.py에 다른 코드가 있었다면 그 아래에 추가하세요)


class PhotoUploadView(APIView):
    """
    React에서 보낸 사진(File)과 데이터(FormData)를 받아
    Photos 모델에 저장하는 API 뷰
    """
    # MultiPartParser: 'image' 같은 파일 데이터를 처리
    # FormParser: 'body_part' 같은 폼 데이터를 처리
    parser_classes = (MultiPartParser, FormParser)

    # 중요: 이 API는 로그인한 사용자만 호출할 수 있도록 설정
    # (만약 테스트 중이라 로그인이 필요 없다면 이 줄을 주석 처리)
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # 중요: 'user' 필드를 request에서 자동으로 가져와 주입
        # 시리얼라이저는 'user'를 제외한 나머지 데이터를 받음

        # request.data는 프론트에서 보낸 FormData 객체를 담고 있습니다.
        # many=False (기본값) : 단일 객체를 생성합니다.
        # request context를 전달하여 이미지 URL을 절대 경로로 변환할 수 있도록 함
        serializer = PhotoUploadSerializer(data=request.data, context={'request': request})

        if not serializer.is_valid():
            # 유효성 검사 실패 시 (예: 필수 필드가 누락된 경우)
            # 프론트엔드에 어떤 필드가 잘못되었는지 오류 메시지를 반환합니다.
            import json
            if settings.DEBUG:
                print(f"[DEBUG] Validation errors: {json.dumps(serializer.errors, indent=2, ensure_ascii=False)}")
                print(f"[DEBUG] Received data keys: {list(request.data.keys())}")
                # request.data에 파일이 포함될 수 있으므로 크기만 표시
                data_summary = {}
                for key, value in request.data.items():
                    if hasattr(value, 'size'):  # 파일인 경우
                        data_summary[key] = f"<File: {value.size} bytes>"
                    elif isinstance(value, (str, bytes)) and len(str(value)) > 100:
                        data_summary[key] = f"<String: {len(str(value))} chars>"
                    else:
                        data_summary[key] = value
                print(f"[DEBUG] Received data (요약): {data_summary}")
            return Response(
                {"error": "Validation failed", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # serializer.save()를 호출하기 전에 'user'를 추가합니다.
        # request.user는 IsAuthenticated 권한을 통해 인증된 사용자 객체입니다.
        try:
            photo_instance = serializer.save(user=request.user)
            
            # Results ID 추적 (AI 예측 성공 시 사용)
            result_id = None
            
            # 털 제거 파이프라인 호출 (전처리 모델 역할)
            # FastAPI 서버에 이미지 전송하여 털 제거 처리
            # 중요: 원본 이미지는 이미 저장되어 있으므로, 처리 실패해도 문제 없음
            processed_image_bytes = None
            image_path = None
            file_name = None
            fastapi_url = os.getenv('FASTAPI_URL', 'http://fastapi:8001')
            
            try:
                # 저장된 이미지 파일 읽기
                if photo_instance.upload_storage_path:
                    image_path = photo_instance.upload_storage_path.path
                    file_name = os.path.basename(image_path)
                    
                    # 이미지 파일 존재 확인
                    if not os.path.exists(image_path):
                        print(f"[Diagnosis] 경고: 이미지 파일이 존재하지 않습니다: {image_path}")
                    else:
                        print(f"[Diagnosis] ========== 전체 파이프라인 시작 (총 5단계) ==========")
                        print(f"[Diagnosis] 이미지 파일 확인: {image_path} (크기: {os.path.getsize(image_path)} bytes)")
                        
                        with open(image_path, 'rb') as f:
                            image_bytes = f.read()
                        
                        # FastAPI 서버 호출 (털 제거)
                        print(f"[Diagnosis] [1/5] 털 제거 파이프라인 시작: {fastapi_url}/remove-hair")
                        
                        response = requests.post(
                            f"{fastapi_url}/remove-hair",
                            files={"file": (file_name, image_bytes, "image/jpeg")},
                            timeout=300  # 5분 타임아웃 (처리 시간이 길 수 있음)
                        )
                        
                        if response.status_code == 200:
                            # 처리된 이미지로 원본 파일 덮어쓰기
                            processed_image_bytes = response.content
                            print(f"[Diagnosis] [1/5] 처리된 이미지 크기: {len(processed_image_bytes)} bytes")
                            
                            # 기존 파일 백업 (선택적)
                            backup_path = f"{image_path}.backup"
                            if os.path.exists(image_path):
                                import shutil
                                shutil.copy2(image_path, backup_path)
                            
                            with open(image_path, 'wb') as f:
                                f.write(processed_image_bytes)
                            print(f"[Diagnosis] [1/5] 털 제거 파이프라인 완료: Photo ID {photo_instance.id}")
                        else:
                            print(f"[Diagnosis] 털 제거 처리 실패: {response.status_code}")
                            print(f"[Diagnosis] 응답 내용: {response.text[:500]}")  # 처음 500자만 출력
                            print(f"[Diagnosis] 원본 이미지로 AI 예측을 진행합니다.")
                            # 원본 이미지는 그대로 유지됨
                else:
                    print(f"[Diagnosis] 이미지 파일이 없어 털 제거 처리를 건너뜁니다: Photo ID {photo_instance.id}")
            except requests.exceptions.RequestException as e:
                # 네트워크 에러 등
                print(f"[Diagnosis] FastAPI 요청 실패 (이미지는 저장됨): {str(e)}")
                print(f"[Diagnosis] 원본 이미지로 AI 예측을 진행합니다.")
                import traceback
                if settings.DEBUG:
                    traceback.print_exc()
            except Exception as e:
                # 기타 에러
                print(f"[Diagnosis] 털 제거 처리 중 오류 발생 (이미지는 저장됨): {str(e)}")
                print(f"[Diagnosis] 원본 이미지로 AI 예측을 진행합니다.")
                import traceback
                if settings.DEBUG:
                    traceback.print_exc()
            
            # AI 모델 예측 호출 (털 제거 성공/실패 여부와 관계없이 실행)
            # 털 제거된 이미지가 있으면 사용, 없으면 원본 이미지 사용
            if image_path and os.path.exists(image_path):
                try:
                    print(f"[Diagnosis] [2/5] 환부 분류 파이프라인 시작: {fastapi_url}/predict")
                    
                    # 털 제거된 이미지가 있으면 사용, 없으면 원본 이미지 사용
                    if processed_image_bytes:
                        image_bytes_for_predict = processed_image_bytes
                        print(f"[Diagnosis] [2/5] 털 제거된 이미지로 예측 진행")
                        content_type = "image/png"
                    else:
                        # 원본 이미지로 예측 시도
                        with open(image_path, 'rb') as f:
                            image_bytes_for_predict = f.read()
                        print(f"[Diagnosis] [2/5] 원본 이미지로 예측 진행 (털 제거 실패 또는 건너뜀)")
                        content_type = "image/jpeg"
                    
                    print(f"[Diagnosis] [2/5] 이미지 크기: {len(image_bytes_for_predict)} bytes")
                    
                    predict_response = requests.post(
                        f"{fastapi_url}/predict",
                        files={"file": (file_name, image_bytes_for_predict, content_type)},
                        params={"generate_gradcam": True},  # GradCAM 생성 활성화
                        timeout=300  # 5분 타임아웃
                    )
                    
                    print(f"[Diagnosis] [2/5] 예측 응답 상태 코드: {predict_response.status_code}")
                    
                    if predict_response.status_code == 200:
                        prediction_data = predict_response.json()
                        print(f"[Diagnosis] [2/5] 환부 분류 파이프라인 완료")
                        
                        # 예측 데이터를 간결하게 로그 출력 (base64 이미지 데이터는 크기만 표시)
                        print(f"[Diagnosis] [2/5] disease_name_ko: {prediction_data.get('disease_name_ko')}")
                        print(f"[Diagnosis] [2/5] disease_name_en: {prediction_data.get('disease_name_en')}")
                        print(f"[Diagnosis] [2/5] risk_level: {prediction_data.get('risk_level')}")
                        
                        # 클래스 확률 (상위 3개만 표시)
                        class_probs = prediction_data.get('class_probs')
                        if class_probs and isinstance(class_probs, dict):
                            sorted_probs = sorted(class_probs.items(), key=lambda x: x[1], reverse=True)[:3]
                            prob_str = ", ".join([f"{k}: {v:.4f}" for k, v in sorted_probs])
                            print(f"[Diagnosis] [2/5] 클래스 확률 (상위 3개): {prob_str}")
                        else:
                            print(f"[Diagnosis] [2/5] 클래스 확률: {type(class_probs).__name__} (크기: {len(str(class_probs))}자)" if class_probs else "[Diagnosis] [2/5] 클래스 확률: 없음")
                        
                        # GradCAM 이미지 크기만 표시
                        grad_cam_bytes = prediction_data.get('grad_cam_bytes')
                        if grad_cam_bytes:
                            # base64 문자열의 크기 계산 (디코딩하지 않고 대략적인 크기 추정)
                            grad_cam_size = len(grad_cam_bytes) * 3 // 4  # base64는 약 4:3 비율
                            print(f"[Diagnosis] [2/5] GradCAM 이미지: {len(grad_cam_bytes)}자 (base64), 추정 바이너리 크기: 약 {grad_cam_size} bytes")
                        else:
                            print(f"[Diagnosis] [2/5] GradCAM 이미지: 없음")
                        
                        # DiseaseInfo에서 질병 찾기 또는 생성
                        disease_name_ko = prediction_data.get("disease_name_ko", "알 수 없음")
                        disease_name_en = prediction_data.get("disease_name_en", "Unknown")
                        
                        print(f"[Diagnosis] DiseaseInfo 조회/생성 시작: name_ko={disease_name_ko}")
                        disease, created = DiseaseInfo.objects.get_or_create(
                            name_ko=disease_name_ko,
                            defaults={
                                "name_en": disease_name_en,
                                "classification": "기타",  # 기본값, 필요시 수정
                                "description": None,
                                "recommendation": None,
                            }
                        )
                        
                        if created:
                            print(f"[Diagnosis] [3/5] 새로운 질병 정보 생성: {disease_name_ko} (ID: {disease.id})")
                        else:
                            print(f"[Diagnosis] [3/5] 기존 질병 정보 사용: {disease_name_ko} (ID: {disease.id})")
                        
                        # GradCAM 이미지 저장 (있는 경우)
                        grad_cam_path = None
                        if prediction_data.get("grad_cam_bytes"):
                            import base64
                            from django.core.files.base import ContentFile
                            
                            grad_cam_bytes = base64.b64decode(prediction_data["grad_cam_bytes"])
                            grad_cam_filename = f"gradcam_{photo_instance.id}.png"
                            grad_cam_path = ContentFile(grad_cam_bytes, name=grad_cam_filename)
                        
                        # Results 테이블에 저장
                        print(f"[Diagnosis] [4/5] Results 생성 시작: photo_id={photo_instance.id}, disease_id={disease.id}")
                        result = Results.objects.create(
                            photo=photo_instance,
                            risk_level=prediction_data.get("risk_level", "중간"),
                            class_probs=prediction_data.get("class_probs", {}),
                            grad_cam_path=grad_cam_path,
                            disease=disease,
                        )
                        result_id = result.id  # Results ID 저장
                        print(f"[Diagnosis] [4/5] Results 저장 완료: Result ID {result.id}, Disease ID {result.disease.id}, Disease Name: {result.disease.name_ko}")
                        
                        # FollowUpCheck 자동 생성 (환자의 담당 의사가 있는 경우)
                        print(f"[Diagnosis] [5/5] FollowUpCheck 생성 시작")
                        patient_user = photo_instance.user
                        if patient_user.doctor:
                            try:
                                # FollowUpCheck가 이미 존재하는지 확인
                                followup_check, created = FollowUpCheck.objects.get_or_create(
                                    result=result,
                                    defaults={
                                        'user': patient_user,
                                        'doctor': patient_user.doctor,
                                        'current_status': '요청중',
                                        'doctor_risk_level': None,  # 의사가 아직 소견을 작성하지 않음
                                        'doctor_note': None,
                                    }
                                )
                                if created:
                                    print(f"[Diagnosis] [5/5] FollowUpCheck 자동 생성: FollowUpCheck ID {followup_check.id}, 의사 ID {patient_user.doctor.uid.id}")
                                else:
                                    print(f"[Diagnosis] [5/5] FollowUpCheck 이미 존재: FollowUpCheck ID {followup_check.id}")
                            except Exception as e:
                                print(f"[Diagnosis] [5/5] FollowUpCheck 생성 실패: {e}")
                                import traceback
                                traceback.print_exc()
                        else:
                            print(f"[Diagnosis] [5/5] 환자에게 담당 의사가 없어 FollowUpCheck를 생성하지 않습니다.")
                        
                        print(f"[Diagnosis] ========== 전체 파이프라인 완료 ==========")
                    else:
                        print(f"[Diagnosis] [2/5] AI 예측 실패: 상태 코드 {predict_response.status_code}")
                        # 응답 내용도 크기만 표시 (긴 에러 메시지일 수 있음)
                        response_text = predict_response.text
                        print(f"[Diagnosis] [2/5] 응답 크기: {len(response_text)}자")
                        if response_text:
                            print(f"[Diagnosis] [2/5] 응답 내용 (처음 200자): {response_text[:200]}")
                        # 예측 실패해도 Photos는 저장되어 있음
                except requests.exceptions.RequestException as e:
                    print(f"[Diagnosis] [2/5] AI 예측 요청 실패: {str(e)}")
                    import traceback
                    if settings.DEBUG:
                        traceback.print_exc()
                except Exception as e:
                    print(f"[Diagnosis] [2/5] AI 예측 처리 중 오류 발생: {str(e)}")
                    import traceback
                    print(f"[Diagnosis] [2/5] 에러 상세:\n{traceback.format_exc()}")
                    if settings.DEBUG:
                        traceback.print_exc()
            else:
                print(f"[Diagnosis] 이미지 파일이 없어 AI 예측을 건너뜁니다: Photo ID {photo_instance.id}")
            
            # 저장 성공 후 ID를 포함한 응답 반환 (프론트엔드에서 결과 페이지로 이동하기 위해 필요)
            # serializer.data는 to_representation을 통해 이미지 URL이 절대 경로로 변환됨
            # AI 예측이 성공하여 Results가 생성되었다면 result.id를, 아니라면 photo.id를 반환
            response_id = result_id if result_id else photo_instance.id

            return Response(
                {
                    "id": response_id,
                    "photo_id":photo_instance.id, #촬영 이미지 ID 반환
                    "result_id":result_id, #진단 결과 ID 반환   
                    "message": "Photo uploaded successfully",
                    **serializer.data
                },
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            # (디버깅용) user 할당에 실패하거나 다른 DB 오류가 발생한 경우
            import traceback
            error_trace = traceback.format_exc()
            return Response(
                {
                    "error": f"Failed to save data: {str(e)}",
                    "traceback": error_trace if settings.DEBUG else None
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

