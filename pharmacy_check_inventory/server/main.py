from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
import json
import shutil
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from database import conn
import io 
import logging

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://pharmacy-frontend-zkt4.onrender.com", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
) 
 
logger = logging.getLogger(__name__)

#
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=False,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# FastAPI에서 supabase로 테이블 연결 
# @app.get("/needs")
# def get_all_needs():
#     with conn.cursor() as cur:
#         cur.execute("SELECT * FROM needs ORDER BY id")
#         rows = cur.fetchall()
#         return rows

def load_inventory(user_id: str, med_type: str) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT * FROM needs
            WHERE user_id = %s AND type = %s
        """, (user_id, med_type))
        rows = cur.fetchall()

    if not rows:
        return pd.DataFrame(columns=["약 이름", "약 코드", "현재 재고", "위치", "필요 재고", "통당 수량", "필요 통 수", "현재 통 수", "주문 통 수"])

    df = pd.DataFrame(rows)

    try:
        df["현재 재고"] = df["present_count"].astype(str).str.replace(",", "", regex=False).astype(float)
        df["필요 재고"] = df["need_count"].astype(str).str.replace(",", "", regex=False).astype(float)
        df["통당 수량"] = df["unit_count"].astype(str).str.replace(",", "", regex=False).astype(float)
    except ValueError as e:
        raise ValueError(f"재고 수치 변환 중 오류 발생: {e}")

    df["필요 통 수"] = df["필요 재고"] / df["통당 수량"]
    df["현재 통 수"] = df["현재 재고"] / df["통당 수량"]
    df["주문 통 수"] = df["필요 통 수"] - df["현재 통 수"]

    # 열 이름 통일 (기존과 호환되도록)
    df = df.rename(columns={
        "drug_name": "약 이름",
        "drug_code": "약 코드",
        "location": "위치"
    })

    return df[["약 이름", "약 코드", "현재 재고", "위치", "필요 재고", "통당 수량", "필요 통 수", "현재 통 수", "주문 통 수"]] 

# xls 파일을 CSV로 파싱하는 헬퍼 함수
def parse_fake_xls_as_csv(file_bytes, encoding="utf-8"):
    """
    이진 파일 내용을 문자열로 디코딩하여 CSV처럼 파싱
    - 파일 내용은 실질적으로 CSV 포맷이어야 함
    - 파일 확장자는 .xls일 수 있음
    """
    try:
        # 1단계: 문자열로 디코딩 (일부 깨진 문자 무시)
        text = file_bytes.decode(encoding, errors="ignore")

        # 2단계: 한 줄씩 나눈 뒤, 헤더 탐색
        lines = text.splitlines()
        csv_lines = [line for line in lines if "," in line and len(line.split(",")) >= 3]

        if not csv_lines:
            raise ValueError("CSV 구조를 가진 줄을 찾을 수 없습니다.")

        # 3단계: CSV 내용만 따로 추출해서 StringIO에 넣기
        csv_text = "\n".join(csv_lines)
        csv_stream = io.StringIO(csv_text)

        # 4단계: 판다스로 CSV 읽기
        df = pd.read_csv(csv_stream)
        return df

    except Exception as e:
        raise ValueError(f"파일을 CSV로 파싱할 수 없습니다: {e}")

# 업로드 API → 엑셀 파일을 파싱해서 Supabase DB에 삽입
@app.post("/upload-inventory")
async def upload_inventory(
    type: str = Query(...),
    user_id: str = Query("default"),
    file: UploadFile = File(...)
):
    # 1. 파일 확장자 확인
    extension = file.filename.split(".")[-1].lower()
    content = await file.read()  # 바이트로 읽기

    # 2. 파일 읽기 (csv 또는 excel)
    try:
        logger.warning(f"📦 업로드된 파일: {file.filename}, 확장자: {extension}, 약종: {type}")

        if extension in ["xls", "xlsx"]:
            excel_io = io.BytesIO(content)
            try:
                df = pd.read_excel(excel_io, engine="pyxlsb", dtype=str)
                logger.info("✅ pyxlsb 엔진으로 파싱 성공")
            except Exception as e_px:
                logger.warning(f"⚠️ pyxlsb 파싱 실패: {e_px}. 기존 엔진으로 재시도")
                # 3. 기존 헤더 검사 + engine 결정 로직
                excel_io.seek(0)
                header = excel_io.read(2)
                excel_io.seek(0)

                if header == b'PK' or extension == "xlsx":
                    engine = "openpyxl"
                else:
                    engine = "xlrd"  # .xls

                try:
                    df = pd.read_excel(excel_io, engine=engine, dtype=str)
                    logger.info(f"✅ pandas.{engine} 엔진으로 파싱 성공")
                except Exception as e_orig:
                    logger.error(f"❌ 엑셀 파싱 모두 실패: pyxlsb({e_px}), {engine}({e_orig})")
                    raise HTTPException(
                        status_code=400,
                        detail=f"Excel 파일 파싱 실패: pyxlsb error: {e_px}; {engine} error: {e_orig}"
        )

            if type == "general":
                df = df.rename(columns={
                    "상품명": "약 이름",
                    "바코드": "약 코드",
                    "재고수량": "현재 재고"
                })
            else:
                df = df.rename(columns={
                    "약품명": "약 이름",
                    "약품코드": "약 코드",
                    "재고합계": "현재 재고"
                })

        elif extension == "csv":
            # logger.info("📥 .csv 파일 파싱 시도 중")
            text_stream = io.StringIO(content.decode("utf-8"))

            if type == "general":
                df = pd.read_csv(text_stream, skiprows=[1])
                df = df.rename(columns={
                    "상품명": "약 이름",
                    "바코드": "약 코드",
                    "재고수량": "현재 재고"
                })
            else:
                df = pd.read_csv(text_stream)
                df = df.rename(columns={
                    "약품명": "약 이름",
                    "약품코드": "약 코드",
                    "재고합계": "현재 재고"
                })
            # logger.info("✅ CSV 파일 정상 파싱 완료")
        else:
            logger.warning(f"❌ 지원되지 않는 파일 형식: {extension}")
            raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다. csv, xls, xlsx만 가능합니다.")
    except Exception as e:
        logger.error(f"❌ 최종 파일 파싱 오류: {e}")
        raise HTTPException(status_code=400, detail=f"파일 파싱 오류: {e}")

    # 3. 현재 재고 숫자화
    try:
        df["현재 재고"] = df["현재 재고"].astype(str).str.replace(",", "", regex=False).astype(float)
    except:
        df["현재 재고"] = 0.0

    # 4. Supabase에 삽입 또는 갱신
    with conn.cursor() as cur:
        for _, row in df.iterrows():
            drug_name = row["약 이름"]
            drug_code = str(row["약 코드"])
            present_count = row["현재 재고"]

            # 기존 데이터 조회
            cur.execute("""
                SELECT need_count, location, unit_count FROM needs
                WHERE user_id = %s AND type = %s AND drug_name = %s AND drug_code = %s
            """, (user_id, type, drug_name, drug_code))
            existing = cur.fetchone()

            if existing:
                # 기존 약: 현재 재고만 갱신
                cur.execute("""
                    UPDATE needs
                    SET present_count = %s
                    WHERE user_id = %s AND type = %s AND drug_name = %s AND drug_code = %s
                """, (present_count, user_id, type, drug_name, drug_code))
            else:
                # 신규 약: 기본값으로 삽입
                cur.execute("""
                    INSERT INTO needs (
                        user_id, type, drug_name, drug_code,
                        present_count, need_count, location, unit_count
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    user_id,
                    type,
                    drug_name,
                    drug_code,
                    present_count,
                    10,           # 기본 필요 재고
                    "미지정",     # 기본 위치
                    1             # 기본 통당 수량
                ))
        conn.commit()

    return {"status": "ok", "message": f"{type} 재고가 성공적으로 Supabase에 저장되었습니다."}

# 검색 API → Supabase에서 사용자별 약 목록 조회
@app.get("/search")
def search_medicine(
    name: str = Query("", alias="name"),
    code: str = Query("", alias="code"),
    type: str = Query("professional"),
    user_id: str = Query("default")
):
    with conn.cursor() as cur:
        if name == "all" or code == "all":
            cur.execute("SELECT * FROM needs WHERE user_id = %s AND type = %s", (user_id, type))
        elif name:
            cur.execute("SELECT * FROM needs WHERE user_id = %s AND type = %s AND drug_name ILIKE %s", (user_id, type, f"%{name}%"))
        elif code:
            cur.execute("SELECT * FROM needs WHERE user_id = %s AND type = %s AND drug_code ILIKE %s", (user_id, type, f"%{code}%"))
        else:
            return []

        rows = cur.fetchall()

    df = pd.DataFrame(rows)

    if df.empty:
        return []

    df = df.rename(columns={
        "drug_name": "약 이름",
        "drug_code": "약 코드",
        "present_count": "현재 재고",
        "need_count": "필요 재고",
        "location": "위치",
        "unit_count": "통당 수량"
    })

    try:
        df["필요 통 수"] = df["필요 재고"] / df["통당 수량"]
        df["현재 통 수"] = df["현재 재고"] / df["통당 수량"]
        df["주문 통 수"] = df["필요 통 수"] - df["현재 통 수"]
    except:
        df["필요 통 수"] = 0
        df["현재 통 수"] = 0
        df["주문 통 수"] = 0

    df = df.sort_values(by=["약 이름", "약 코드"])  # ✅ 정렬 기준 추가

    return JSONResponse(content=df.fillna("NaN").to_dict(orient="records"))

# 자동완성
@app.get("/autocomplete")
def autocomplete(
    partial: str,
    type: str = Query("professional"),
    user_id: str = Query("default")
):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT drug_name FROM needs
            WHERE user_id = %s AND type = %s AND drug_name ILIKE %s
        """, (user_id, type, f"%{partial}%"))

        matches = [row["drug_name"] for row in cur.fetchall() if row["drug_name"]]

    return matches

# 최근 검색어 저장 관련
@app.post("/add-search")
def add_recent_search(keyword: str = Query(...), type: str = Query("professional"), user_id: str = Query("default")):
    keyword = keyword.strip()
    if not keyword:
        return {"status": "empty"}

    with conn.cursor() as cur:
        # 중복 제거
        cur.execute("""
            DELETE FROM recent_searches
            WHERE user_id = %s AND type = %s AND keyword = %s
        """, (user_id, type, keyword))

        # 삽입
        cur.execute("""
            INSERT INTO recent_searches (user_id, type, keyword, created_at)
            VALUES (%s, %s, %s, NOW())
        """, (user_id, type, keyword))
        conn.commit()

    return {"status": "ok"}

@app.get("/recent-searches")
def get_recent_searches(type: str = Query("professional"), user_id: str = Query("default")):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT keyword FROM recent_searches
            WHERE user_id = %s AND type = %s
            ORDER BY created_at DESC
            LIMIT 10
        """, (user_id, type))
        keywords = [row["keyword"] for row in cur.fetchall()]
    return keywords 

# 필요 재고 및 위치 수정 및 저장 
@app.get("/low-stock")
def get_low_stock_medicines(
    type: str = Query(...),
    user_id: str = Query("default")
):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT * FROM needs
            WHERE user_id = %s AND type = %s
        """, (user_id, type))
        rows = cur.fetchall()

    if not rows:
        return []

    import pandas as pd
    df = pd.DataFrame(rows)

    df = df.rename(columns={
        "drug_name": "약 이름",
        "drug_code": "약 코드",
        "present_count": "현재 재고",
        "need_count": "필요 재고",
        "location": "위치",
        "unit_count": "통당 수량"
    })

    try:
        df["필요 통 수"] = df["필요 재고"] / df["통당 수량"]
        df["현재 통 수"] = df["현재 재고"] / df["통당 수량"]
        df["주문 통 수"] = df["필요 통 수"] - df["현재 통 수"]
    except:
        df["필요 통 수"] = 0
        df["현재 통 수"] = 0
        df["주문 통 수"] = 0

    def get_status(row):
        if row["현재 재고"] < row["필요 재고"]:
            return "심각"
        elif row["현재 재고"] < row["필요 재고"] + 3:
            return "주의"
        else:
            return "충분"

    df["부족상태"] = df.apply(get_status, axis=1)

    filtered = df[df["부족상태"].isin(["심각", "주의"])] 

    df = df.sort_values(by=["약 이름", "약 코드"])  # ✅ 정렬 기준 추가

    return JSONResponse(content=filtered.fillna("NaN").to_dict(orient="records"))

# 필요 재고 및 위치 수정 및 저장
@app.patch("/update-info")
def update_info(data: dict):
    name = data.get("name")
    code = data.get("code")
    med_type = data.get("type")
    new_need = data.get("need")
    new_location = data.get("location")
    new_unit_count = data.get("unitCount")
    user_id = data.get("user_id", "default")  # 기본값 설정

    if not all([name, code, med_type]):
        raise HTTPException(status_code=400, detail="name, code, type는 필수입니다.")

    updates = []
    params = []

    if new_need is not None:
        updates.append("need_count = %s")
        params.append(new_need)
    if new_location is not None:
        updates.append("location = %s")
        params.append(new_location)
    if new_unit_count is not None:
        updates.append("unit_count = %s")
        params.append(new_unit_count)

    if not updates:
        raise HTTPException(status_code=400, detail="수정할 항목이 없습니다.")

    params.extend([user_id, name, code, med_type])
    set_clause = ", ".join(updates)

    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE needs SET {set_clause}
            WHERE user_id = %s AND drug_name = %s AND drug_code = %s AND type = %s
        """, params)
        conn.commit()

    return {"status": "ok", "message": f"{name}({code}) 정보가 Supabase에 저장되었습니다."}


