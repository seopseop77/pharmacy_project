from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
import json
import shutil
from fastapi.responses import JSONResponse
from pydantic import BaseModel

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CSV 파일 경로
INVENTORY_FILES = {
    "professional": "전문약_재고.csv",
    "general": "일반약_재고.csv"
}

# 데이터 표준화 함수
def load_inventory(med_type: str):
    if med_type not in INVENTORY_FILES:
        raise HTTPException(status_code=400, detail="약 종류는 professional 또는 general 이어야 합니다.")

    path = INVENTORY_FILES[med_type]
    if not os.path.exists(path):
        return pd.DataFrame(columns=["약 이름", "약 코드", "현재 재고", "위치", "필요 재고", "유통기한"])

    # ✅ 일반약일 경우 두 번째 행 건너뛰기
    if med_type == "general":
        df = pd.read_csv(path, encoding="utf-8", skiprows=[1])
    else:
        df = pd.read_csv(path, encoding="utf-8")

    # 열 이름 통일
    if med_type == "professional":
        df = df.rename(columns={
            "약품명": "약 이름",
            "약품코드": "약 코드",
            "재고합계": "현재 재고"
        })
    else:
        df = df.rename(columns={
            "상품명": "약 이름",
            "바코드": "약 코드",
            "재고수량": "현재 재고"
        })

    custom_needs = load_custom_needs(med_type)
    custom_locations = load_custom_locations(med_type)

    # 사용자 설정 필요 재고 반영 
    df["필요 재고"] = df.apply(
        lambda row: custom_needs.get(f"{row['약 이름']}::{row['약 코드']}", 10),
        axis=1
    )
    
    # 사용자 설정 위치 반영
    df["위치"] = df.apply(
        lambda row: custom_locations.get(f"{row['약 이름']}::{row['약 코드']}", "미지정"),
        axis=1
    ) 

    # 통당 수량 계산
    unit_counts = load_unit_counts(med_type)
    df["통당 수량"] = df.apply(
        lambda row: unit_counts.get(f"{row['약 이름']}::{row['약 코드']}", 1),
        axis=1
    )

    # ✅ 콤마 제거 + 숫자 변환 (오류 발생 시 명시적으로 예외 처리)
    try:
        df["현재 재고"] = df["현재 재고"].astype(str).str.replace(",", "", regex=False).astype(float)
        df["필요 재고"] = df["필요 재고"].astype(str).str.replace(",", "", regex=False).astype(float)
        df["통당 수량"] = df["통당 수량"].astype(str).str.replace(",", "", regex=False).astype(float)
    except ValueError as e:
        raise ValueError(f"재고 수치 변환 중 오류 발생: {e}") 
    
    df["필요 통 수"] = df["필요 재고"] / df["통당 수량"]
    df["현재 통 수"] = df["현재 재고"] / df["통당 수량"]
    df["주문 통 수"] = df["필요 통 수"] - df["현재 통 수"]

    # 기본값 설정 
    # df["유통기한"] = df.get("유통기한", "미지정")

    return df


# 업로드 API
@app.post("/upload-inventory")
async def upload_inventory(type: str = Query(...), file: UploadFile = File(...)):
    if type not in INVENTORY_FILES:
        raise HTTPException(status_code=400, detail="type은 professional 또는 general 이어야 합니다.")

    filename = INVENTORY_FILES[type]
    with open(filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"status": "ok", "message": f"{type} 재고가 성공적으로 업데이트되었습니다."}

# 검색 API
@app.get("/search")
def search_medicine(
    name: str = Query("", alias="name"),
    code: str = Query("", alias="code"),
    type: str = Query("professional")
):
    df = load_inventory(type)
    name = name.strip()
    code = code.strip()

    if name == "all" or code == "all":
        result = df
    elif name:
        result = df[df["약 이름"].str.contains(name, case=False, regex=False, na=False)]
    elif code:
        df["약 코드"] = df["약 코드"].astype(str)
        result = df[df["약 코드"].str.contains(code, case=False, regex=False, na=False)]
    else:
        result = pd.DataFrame()
    return JSONResponse(content=result.fillna("NaN").to_dict(orient="records"))

# 자동완성
@app.get("/autocomplete")
def autocomplete(partial: str, type: str = Query("professional")):
    df = load_inventory(type)
    matches = df[df["약 이름"].str.contains(partial, case=False, regex=False, na=False)]
    return matches["약 이름"].dropna().unique().tolist()

# 최근 검색어 저장 관련
RECENT_SEARCH_FILE = "recent_searches.json" 

def get_recent_search_file(med_type: str):
    if med_type not in ["professional", "general"]:
        raise HTTPException(status_code=400, detail="type은 professional 또는 general 이어야 합니다.")
    return f"recent_searches_{med_type}.json"

def load_recent_searches(med_type: str):
    path = get_recent_search_file(med_type)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_recent_searches(keywords, med_type: str):
    path = get_recent_search_file(med_type)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(keywords, f, ensure_ascii=False)


@app.post("/add-search")
def add_recent_search(
    keyword: str = Query(...),
    type: str = Query("professional")
):
    keyword = keyword.strip()
    if not keyword:
        return {"status": "empty"}

    recent = load_recent_searches(type)
    if keyword in recent:
        recent.remove(keyword)
    recent.insert(0, keyword)
    recent = recent[:10]
    save_recent_searches(recent, type)

    return {"status": "ok"}

@app.get("/recent-searches")
def get_recent_searches(type: str = Query("professional")):
    return load_recent_searches(type)

# 재고 부족 필터링
@app.get("/low-stock")
def get_low_stock_medicines(type: str = Query(..., alias="type")):
    df = load_inventory(type)

    def get_status(row):
        if row["현재 재고"] < row["필요 재고"]:
            return "심각"
        elif row["현재 재고"] < row["필요 재고"] + 3:
            return "주의"
        else:
            return "충분"

    df["부족상태"] = df.apply(get_status, axis=1)

    # ✅ 부족 상태(심각, 주의)인 항목만 필터링
    filtered = df[df["부족상태"].isin(["심각", "주의"])]

    return JSONResponse(content=filtered.fillna("NaN").to_dict(orient="records"))

# 필요 재고 및 위치 수정 및 저장 
def get_needs_file(type: str):
    return f"needs_{type}.json"

def load_custom_needs(type: str):
    path = get_needs_file(type)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_custom_needs(type: str, data: dict):
    path = get_needs_file(type)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)  

def get_location_file(type: str):
    return f"locations_{type}.json"

def load_custom_locations(type: str):
    path = get_location_file(type)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_custom_locations(type: str, data: dict):
    path = get_location_file(type)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

def get_unit_file(type: str):
    return f"unit_counts_{type}.json"

def load_unit_counts(type: str):
    path = get_unit_file(type)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_unit_counts(type: str, data: dict):
    path = get_unit_file(type)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


@app.patch("/update-info")
def update_info(data: dict):
    name = data.get("name")
    code = data.get("code")
    med_type = data.get("type")
    new_need = data.get("need")
    new_location = data.get("location")
    new_unit_count = data.get("unitCount")

    if not all([name, code, med_type]):
        raise HTTPException(status_code=400, detail="name, code, type는 필수입니다.")

    key = f"{name}::{code}"

    # 필요 재고 저장 (기존에 없어도 상관없음)
    if new_need is not None:
        needs = load_custom_needs(med_type)
        needs[key] = new_need
        save_custom_needs(med_type, needs)

    # 위치 저장 (기존에 없어도 상관없음)
    if new_location is not None:
        locations = load_custom_locations(med_type)
        locations[key] = new_location
        save_custom_locations(med_type, locations) 
    
    # 필요 통수 저장 (기존에 없어도 상관없음)
    if new_unit_count is not None:
        unit_counts = load_unit_counts(med_type)
        unit_counts[key] = new_unit_count
        save_unit_counts(med_type, unit_counts)

    return {"status": "ok", "message": f"{name}({code}) 정보가 저장되었습니다."}

