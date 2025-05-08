from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SAVE_PATH = "zones_layout.json"


# 구역 저장 및 불러오기 API 
@app.post("/save-zones")
async def save_zones(request: Request):
    data = await request.json()
    with open(SAVE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return {"status": "saved"} 

@app.get("/load-zones")
async def load_zones():
    if not os.path.exists(SAVE_PATH):
        return []
    with open(SAVE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data
