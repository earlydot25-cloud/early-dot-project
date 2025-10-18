# 🩺 EARLY DOT: AI 기반 피부 진단 시스템

## 📚 기술 스택 (Tech Stack)

| 구분 | 기술 |
| :--- | :--- |
| **백엔드 (API)** | Python 3.10, Django, DRF, SimpleJWT, MySQL |
| **모델 서빙** | FastAPI, PyTorch, OpenCV, NCP Cloud S3 |
| **프론트엔드 (UI)** | React (TypeScript), React Router |
| **환경 관리** | Conda / npm |

---

## 💻 1. 개발 환경 설정

### 1.1. 백엔드 환경 (Conda & Python)

1.  프로젝트 루트에서 백엔드 폴더로 이동 후 Conda 환경 활성화:
    ```bash
    cd backend
    conda activate early_dot_env
    ```
2.  Conda 및 Pip 패키지 설치:
    ```bash
    conda install -c conda-forge --file environment.yml
    pip install -r requirements.txt
    ```
3.  **`backend/`** 폴더에 **`.env` 파일 생성** 후 환경 변수 입력 (아래 3번 항목 참조).
4.  DB 마이그레이션:
    ```bash
    python manage.py makemigrations
    python manage.py migrate
    ```

### 1.2. 프론트엔드 환경 (Node/NPM)

1.  프론트엔드 폴더로 이동 후 의존성 설치:
    ```bash
    cd ../frontend
    npm install
    ```

---

## 🚀 2. 프로젝트 실행

터미널 2개를 열어 각각 실행합니다.

| 구분 | 실행 위치 | 명령어 | 주소 |
| :--- | :--- | :--- | :--- |
| **백엔드 (API)** | `backend/` | `python manage.py runserver` | `http://127.0.0.1:8000` |
| **프론트엔드 (UI)** | `frontend/` | `npm start` | `http://localhost:3000` |

---

## 🤝 3. 협업 및 폴더 구조

* **백엔드**: `backend/` 폴더의 각 앱(users, diagnosis 등)에 분담된 API를 구현합니다.
* **프론트엔드**: `frontend/src/pages/` 아래의 기능 폴더(auth, capture, history)에 UI를 구현합니다.

