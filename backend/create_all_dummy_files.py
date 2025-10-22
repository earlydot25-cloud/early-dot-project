import os
from PIL import Image

# --- 기본 설정 ---
# 이 스크립트를 Django 프로젝트의 루트 폴더에 두었다고 가정합니다.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 생성할 파일 목록
IMAGE_IDS = range(1, 11)  # photo_id 1번부터 10번까지
DOCTOR_IDS = range(1001, 1006)  # doctor_uid 1001번부터 1005번까지


# --- 파일 생성 함수 ---

def create_dummy_png_image(file_path):
    """더미 200x200 PNG 이미지를 생성합니다."""
    try:
        img = Image.new('RGB', (200, 200), color=(50, 150, 200))  # 파란색 계열
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        img.save(file_path, 'PNG')
        return "✅ PNG 이미지"
    except Exception as e:
        return f"❌ 생성 오류: {e}"


def create_dummy_pdf_file(file_path):
    """더미 PDF (텍스트 파일로 대체)를 생성합니다."""
    try:
        content = "Dummy Certification Document for testing.\nUID: " + \
                  os.path.basename(file_path).split('_')[1].split('.')[0]
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w') as f:
            f.write(content)
        return "✅ PDF (Dummy Text)"
    except Exception as e:
        return f"❌ 생성 오류: {e}"


# --- 경로별 파일 생성 ---

def create_dummy_files():
    print("--- 모든 더미 파일 생성 시작 ---")

    # 💡 MEDIA_ROOT 경로를 BASE_DIR/media 로 명시적으로 설정
    MEDIA_BASE_DIR = os.path.join(BASE_DIR, 'media')
    os.makedirs(MEDIA_BASE_DIR, exist_ok=True)  # media 폴더가 없을 경우 대비하여 생성

    # 1. photos.storage_path 파일 생성 (/uploads/{id}/image_{id}.png)
    print("\n[1/3] Photos Storage Images 생성:")
    for i in IMAGE_IDS:
        # 파일 경로가 media/uploads/i/image_i.png가 되도록 MEDIA_BASE_DIR 사용
        relative_path = os.path.join('uploads', str(i), f'image_{i}.png')
        full_path = os.path.join(MEDIA_BASE_DIR, relative_path)
        result = create_dummy_png_image(full_path)
        print(f"  {os.path.join('media', relative_path)}: {result}")

    # 2. doctors.cert_path 파일 생성 (/certs/cert_{uid}.pdf)
    print("\n[2/3] Doctors Certifications (PDF) 생성:")
    for uid in DOCTOR_IDS:
        # 파일 경로가 media/certs/cert_uid.pdf가 되도록 MEDIA_BASE_DIR 사용
        relative_path = os.path.join('certs', f'cert_{uid}.pdf')
        full_path = os.path.join(MEDIA_BASE_DIR, relative_path)
        result = create_dummy_pdf_file(full_path)
        print(f"  {os.path.join('media', relative_path)}: {result}")

    # 3. results.grad_cam_path 파일 생성 (/cams/image_{id}.png)
    print("\n[3/3] Results Grad-CAM Images 생성:")
    for i in IMAGE_IDS:
        # 파일 경로가 media/cams/image_i.png가 되도록 MEDIA_BASE_DIR 사용
        relative_path = os.path.join('cams', f'image_{i}.png')
        full_path = os.path.join(MEDIA_BASE_DIR, relative_path)
        result = create_dummy_png_image(full_path)
        print(f"  {os.path.join('media', relative_path)}: {result}")

    print("\n--- 모든 더미 파일 생성 완료 ---")


if __name__ == "__main__":
    create_dummy_files()
