# 🩺 EARLY DOT: AI 기반 피부 진단 시스템

## 📚 기술 스택 (Tech Stack)

| 구분 | 기술 |
| :--- | :--- |
| **백엔드 (API)** | Python 3.10, Django, DRF, SimpleJWT, MySQL |
| **모델 서빙** | FastAPI, PyTorch, OpenCV, NCP Cloud S3 |
| **프론트엔드 (UI)** | React (TypeScript), React Router |
| **환경 관리** | Conda / npm |

---
0. pip 변경시 수정 [관리자]
    ```bash
    # 1. Conda 환경 활성화
   conda activate early_dot_env

   # 2. requirements.in 파일을 읽어 requirements_base.txt를 최신 상태로 갱신
   #    (OS 호환성을 위해 pip-tools가 모든 종속성을 깨끗하게 계산하여 저장)
   pip-compile requirements.in -o requirements_base.txt

   # 3. 변경된 파일(requirements.in, requirements_base.txt)을 Git에 커밋 후 공유
   pip freeze > requirements_base.txt => 한 후 관리자한테 파일 전달 
   
   ```
1. 환경 업데이트 적용 [팀원]
    ```bash
    cd backend
    
   # 현재 거 제거 필요  # 본인 환경 이름 제거 하면 다시 아래 것으로 생김
   conda env remove -n early_dot_env
   
   # 현재 거 있으면 비활성화 할 것 
   conda deactivate
   
    # 0.최초 환경 생성	
    conda env create -f unified_environment.yml
   
    # 1. 가상환경 활성화 
    conda activate early_dot_env
    
    # 2. 콘다 update  - 파일 내용의 변경이 있을 때만 사용
    conda env update -f unified_environment.yml
    
    # 3. pip base 활성 - 자동으로 됌. 처음 시 바로 아래로 ### 이거 핍 업데이트 받기 
    pip install -r requirements_base.txt --upgrade # 업그레이드 
    
    # 3-1. 맥 사용자
    pip install -r requirements_macos.txt # 처음
    pip install -r requirements_macos.txt --upgrade # 업그레이드
    
    # 3-2. 윈도우 사용자
    pip install -r requirements_windows.txt #처음 
    pip install -r requirements_windows.txt --upgrade # 업그레이드 
    
   # 4. 설치된 conda list 확인 
    conda list
    ```
2.  Conda 및 Pip 패키지 업데이트 (본인이 뭔가를 다운 받았을 때):
    ```bash
    conda env update -f unified_environment.yml
    # 관리자한테 노티 
    ```

3. **`backend/`** 폴더에 **`.env` 파일 생성** 후 환경 변수 입력 (아래 3번 항목 참조).
   DB 마이그레이션:
   - **모델 변경 시 작업할 것**. 그 이외에는 굳이 하지 말 것.
   - 변경 된 앱만 migration 해도 됨 
    ```bash
    cd backend
    # mysql 접속
    mysql -u root -p # 이건 원하는 대로 
   
   # users, diagnosis, dashboard 폴더의 마이그레이션 폴더 제거 
   
    # db 지우고 다시 
    DROP DATABASE early_dot_db;
    # db 다시 생성 
    CREATE DATABASE early_dot_db;
   
    # mysql 나와서 다시 ctrl+ d -> mysql 종료
    python manage.py makemigrations users
    python manage.py makemigrations diagnosis
    python manage.py makemigrations dashboard
    python manage.py migrate
   
    # 디비버에서 예시 덤프 sql 실행시킬 것.
    ```

### 1.2. 프론트엔드 환경 (Node/NPM)

1.  프론트엔드 폴더로 이동 후 의존성 설치:
    ```bash
    cd frontend
    npm install # 새로 할 때마다 이거 해줄 것 
    npm start
    ```

   2. 맥 m1/m2 runserver 시 에러 뜨면, 환경설정 인터프리터에서 바로 패키지 설치할 것 
   ```bash
    # mysqlclient==2.2.7 
    # 검색하면 나옴
   ```
    
---

## 🚀 2. 프로젝트 실행

터미널 2개를 열어 각각 실행합니다.

| 구분 | 실행 위치 | 명령어                                       | 주소 |
| :--- | :--- |:------------------------------------------| :--- |
| **백엔드 (API)** | `backend/` | `cd backend` `python manage.py runserver` | `http://127.0.0.1:8000` |
| **프론트엔드 (UI)** | `frontend/` | `cd frontend` `npm start`                 | `http://localhost:3000` |

## 🚀 2-1. IP 바뀜 걱정없이 프로젝트 실행 - Mac 환경 한정 ( Win 환경 추가 예정 )

### 내 Mac 호스트명 확인 ( 꼭 기억해야함.)
 - `scutil --get LocalHostName`
 - `ex) sondongbin-ui-MacBookPro`

### 수정해야 하는 부분
 - backend / .env
   - `REACT_APP_API_BASE_URL=http://<내맥호스트명>.local:8000`
   - `VITE_API_BASE=http://<내맥호스트명>.local:8000`


 - early_dot / settings.py - 주석 달아놓음.
   - ALLOWED_HOSTS
   - CORS_ALLOWED_ORIGINS
   - CSRF_TRUSTED_ORIGINS

| 구분        | 실행 위치       | 명령어                                                                       | 주소                           |
|:----------| :---------- |:--------------------------------------------------------------------------| :--------------------------- |
| **백엔드**   | `backend/`  | `cd backend`<br>`python manage.py runserver 0.0.0.0:8000`                 | `http://<내맥호스트명>.local:8000` |
| **프론트**   | `frontend/` | `cd frontend`<br>`DANGEROUSLY_DISABLE_HOST_CHECK=true \`<br/>`WDS_SOCKET_HOST=<내맥호스트명>.local \`<br/>`HOST=0.0.0.0 PORT=3000 \`<br/>`npm start`                  | `http://<내맥호스트명>.local:3000` |
| **핸드폰**   | `걍 핸드폰`        |                                                                           | `http://<내맥호스트명>.local:3000` |



---

## 🤝 3. 협업 및 폴더 구조

* **백엔드**: `backend/` 폴더의 각 앱(users, diagnosis 등)에 분담된 API를 구현합니다.
* **프론트엔드**: `frontend/src/pages/` 아래의 기능 폴더(auth, capture, history)에 UI를 구현합니다.

