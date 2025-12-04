#!/bin/bash

# Docker 데몬이 실행 중인지 확인
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 데몬이 실행되지 않았습니다."
    echo "Docker Desktop을 실행해주세요."
    exit 1
else
    echo "✅ Docker 데몬이 실행 중입니다."
    docker compose up -d
fi
