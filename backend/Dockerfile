# backend/Dockerfile (conda 기반, unified_environment.yml 사용)
FROM continuumio/miniconda3

# 작업 디렉터리 설정
WORKDIR /app

# 0. MySQL 클라이언트 빌드에 필요한 시스템 의존성 설치 (추가)
# Conda 환경을 만들기 전에 시스템 라이브러리를 설치해야 합니다.
# RUN apt-get update && apt-get install -y \
#     default-libmysqlclient-dev \
#     gcc \
#     && apt-get clean && rm -rf /var/lib/apt/lists/*

# 1. 환경 파일 복사 (Pip 섹션이 제거된 yml 사용)
COPY unified_environment.yml .
COPY requirements_base.txt .

# 2. Mamba 설치
RUN conda install -n base -c conda-forge mamba -y

# 3. 환경 생성 (Conda 패키지만 설치)
RUN mamba env create -f unified_environment.yml -y || conda env create -f unified_environment.yml -y \
    && conda clean -afy

# conda 환경 이름을 early_dot_env 로 설정
SHELL ["conda", "run", "-n", "early_dot_env", "/bin/bash", "-c"]

# ❗ 4. Pip 패키지 설치 단계 (분리) ❗
# Conda 환경이 생성된 후, 그 환경 안에서 requirements_base.txt를 설치합니다.
RUN pip install --no-cache-dir -r requirements_base.txt

# 5. 프로젝트 전체 복사
COPY . .

# 6. 포트 개방
EXPOSE 8000

# 7. 장고 서버 실행 (개발용)
CMD ["conda", "run", "--no-capture-output", "-n", "early_dot_env", "python", "manage.py", "runserver", "0.0.0.0:8000"]
