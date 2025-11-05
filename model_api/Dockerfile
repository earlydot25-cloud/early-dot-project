FROM continuumio/miniconda3

# 작업 디렉터리 설정
WORKDIR /app

# 1. 환경 파일 복사
COPY model_environment.yml .
# COPY requirements_base.txt .

# 2. Mamba 설치
RUN conda install -n base -c conda-forge mamba -y

# 3. 환경 생성 (Conda 패키지만 설치)
RUN mamba env create -f model_environment.yml || conda env create -f model_environment.yml \
    && conda clean -afy

# conda 환경 이름을 model_env 로 설정하고, 이후 명령어를 이 환경에서 실행하도록 준비
SHELL ["conda", "run", "-n", "model_env", "/bin/bash", "-c"]

# 4. Pip 패키지 설치 단계는 현재 model_api 폴더에 requirements.txt가 없으므로 주석 처리

# 5. 프로젝트 전체 복사
COPY . .

# 포트 개방
EXPOSE 8000

# ❗ 장고 서버 CMD가 아닌, FastAPI 서버 CMD로 변경해야 합니다 ❗
CMD ["conda", "run", "--no-capture-output", "-n", "model_env", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]