FROM continuumio/miniconda3

# 작업 디렉터리 설정
WORKDIR /app

# 1. 환경 파일 복사
COPY unified_environment.yml .
COPY requirements_base.txt .

# 2. Mamba 설치
RUN conda install -n base -c conda-forge mamba -y

# 3. 환경 생성 (Conda 패키지만 설치)
# 이제 unified_environment.yml에 pip 패키지 목록이 없으므로 성공해야 합니다.
RUN mamba env create -f unified_environment.yml \
    && conda clean -afy  # 캐시 정리

# conda 환경 이름을 early_dot_env 로 설정하고, 이후 명령어를 이 환경에서 실행하도록 준비
SHELL ["conda", "run", "-n", "early_dot_env", "/bin/bash", "-c"]

# ❗ 4. Pip 패키지 설치 단계 추가 ❗
# Conda 환경이 생성된 후, 그 환경 안에서 requirements_base.txt를 설치합니다.
RUN pip install --no-cache-dir -r requirements_base.txt

# 5. 프로젝트 전체 복사
COPY . .

# 포트 개방
EXPOSE 8000

# 장고 서버 실행
CMD ["conda", "run", "--no-capture-output", "-n", "early_dot_env", "python", "manage.py", "runserver", "0.0.0.0:8000"]


