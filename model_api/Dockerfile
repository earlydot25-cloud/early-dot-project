FROM continuumio/miniconda3

# 작업 디렉터리 설정
WORKDIR /app

# 1. 환경 파일 및 요구사항 파일 복사 (레이어 캐싱 효율을 위해 먼저 복사)
COPY model_environment.yml .
COPY requirements_model.txt .

# 2. Mamba 설치
RUN conda install -n base -c conda-forge mamba -y

# 3. 환경 생성 (Conda 패키지만 설치)
# 이 단계는 이제 numpy, opencv, python, pip 만 설치하므로 충돌이 발생할 확률이 극히 낮습니다.
RUN mamba env create -f model_environment.yml -y || conda env create -f model_environment.yml -y \
    && conda clean -afy

# conda 환경 이름을 model_env 로 설정하고, 이후 명령어를 이 환경에서 실행하도록 준비
SHELL ["conda", "run", "-n", "model_env", "/bin/bash", "-c"]

# 4. Pip 패키지 설치
# Conda 환경이 생성된 후, 해당 환경 내에서 Pip으로 의존성을 설치합니다.
# RUN pip install -r requirements_model.txt  # 코드만 수정할 때는 주석 처리

# 5. 프로젝트 전체 복사
COPY . .

# 포트 개방
EXPOSE 8001

# FastAPI 서버 CMD (access 로그 비활성화하여 base64 응답 본문 출력 방지)
CMD ["conda", "run", "--no-capture-output", "-n", "model_env", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--no-access-log"]

