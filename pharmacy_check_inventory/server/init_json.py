import pandas as pd
import json
import os

# "약 이름", "약 코드", "필요 재고" or "위치"를 열로 가지는 엑셀 파일로 JSON 파일을 업데이트하는 함수 (처음에 초기화할 때 사용)

def update_json_from_excel(file_path: str, med_type: str):
    # 파일 경로 정의
    needs_path = f"needs_{med_type}.json"
    locations_path = f"locations_{med_type}.json"

    # 기존 JSON 로딩 (없으면 빈 딕셔너리)
    def load_json(path):
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    needs_data = load_json(needs_path)
    locations_data = load_json(locations_path)

    # 엑셀 파일 읽기
    df = pd.read_excel(file_path)

    for _, row in df.iterrows():
        name = str(row.get("약 이름", "")).strip()
        code = str(row.get("약 코드", "")).strip()
        key = f"{name}::{code}"

        if "필요 재고" in row and pd.notna(row["필요 재고"]):
            try:
                needs_data[key] = float(row["필요 재고"])
            except ValueError:
                print(f"[경고] 필요 재고 값이 숫자가 아닙니다: {key}")

        if "위치" in row and pd.notna(row["위치"]):
            locations_data[key] = str(row["위치"]).strip()

    # 저장
    with open(needs_path, "w", encoding="utf-8") as f:
        json.dump(needs_data, f, ensure_ascii=False, indent=2)

    with open(locations_path, "w", encoding="utf-8") as f:
        json.dump(locations_data, f, ensure_ascii=False, indent=2)

    print(f"✅ {med_type} 약 정보 업데이트 완료!")

# 예시 사용:
# update_json_from_excel("업데이트_파일.xlsx", "professional")
# update_json_from_excel("업데이트_파일.xlsx", "general")
