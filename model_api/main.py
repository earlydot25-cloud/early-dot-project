# model_api/main.py

# 이것도 사실 아님.
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Input(BaseModel):
    text: str

@app.post("/predict")
def predict(inp: Input):
    # 여기에 실제 모델 로드/추론 로직을 넣으세요.
    # 예: model.predict(...)
    return {"prediction": f"dummy processed: {inp.text}"}
