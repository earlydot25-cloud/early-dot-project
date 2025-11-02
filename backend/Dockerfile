# backend/Dockerfile (conda 기반, unified_environment.yml 사용)
FROM continuumio/miniconda3

# 작업 디렉터리 설정
WORKDIR /app

# conda 환경 파일 복사 (이름 변경됨)
COPY unified_environment.yml .
COPY requirements_base.txt .

# mamba 설치 및 환경 생성
RUN conda install -n base -c conda-forge mamba -y || true \
    && (mamba env create -f unified_environment.yml || conda env create -f unified_environment.yml) \
    && conda clean -afy

# conda 환경 이름을 early_dot_env 로 설정
SHELL ["conda", "run", "-n", "early_dot_env", "/bin/bash", "-c"]

# requirements_base.txt 복사 (yml에서 pip install -r 참조 중)
COPY requirements_base.txt .

# 프로젝트 전체 복사
COPY . .

# 포트 개방
EXPOSE 8000

# 장고 서버 실행 (개발용)
CMD ["conda", "run", "--no-capture-output", "-n", "early_dot_env", "python", "manage.py", "runserver", "0.0.0.0:8000"]
