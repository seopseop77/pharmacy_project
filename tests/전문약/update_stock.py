import pandas as pd

# Helper function for numeric parsing with comma removal

def parse_number(x, column_name):
    try:
        if pd.isna(x) or str(x).strip() == '':
            return 0.0
        s = str(x).replace(',', '').strip()
        return float(s)
    except Exception as e:
        print(f"Error parsing '{x}' in column '{column_name}': {e}")
        return 0.0


def update_stock(purchase_path, sales_path, stock_path, output_path):
    # CSV 로드
    purchase_df = pd.read_csv(purchase_path)
    sales_df = pd.read_csv(sales_path)
    stock_df = pd.read_csv(stock_path)

    # 문자열 필드 정제
    purchase_df['약 품 명'] = purchase_df['약 품 명'].fillna('').astype(str).str.strip()
    sales_df['약품명'] = sales_df['약품명'].fillna('').astype(str).str.strip()
    stock_df['약품명'] = stock_df['약품명'].fillna('').astype(str).str.strip()

    # 잘못된 행(숫자만 있는 약품명) 제거
    purchase_df = purchase_df[~purchase_df['약 품 명'].str.isdigit()]
    sales_df = sales_df[~sales_df['약품명'].str.isdigit()]
    stock_df = stock_df[~stock_df['약품명'].str.isdigit()]

    # 약품코드 정규화
    def normalize_code(x):
        try:
            if pd.isna(x) or str(x).strip() == '':
                return ''
            return str(int(float(str(x).replace(',', '').strip())))
        except:
            return str(x).strip()

    sales_df['약품코드'] = sales_df['약품코드'].apply(normalize_code)
    stock_df['약품코드'] = stock_df['약품코드'].apply(normalize_code)

    # 재고 DataFrame 전처리
    stock_df = stock_df[['약품명', '약품코드', '개수']].copy()
    stock_df['개수'] = stock_df['개수'].apply(lambda x: parse_number(x, '개수'))

    # 구매 집계 (약품명 기준)
    purchase_df = purchase_df.rename(columns={'약 품 명': '약품명'})
    purchase_df['수량'] = purchase_df['수량'].apply(lambda x: parse_number(x, '수량'))
    purchase_summary = (
        purchase_df
        .groupby('약품명')['수량']
        .sum()
        .reset_index()
        .rename(columns={'수량': '구매수량'})
    )

    # 판매 집계 (약품명, 약품코드 기준)
    sales_df['조제수량'] = sales_df['조제수량'].apply(lambda x: parse_number(x, '조제수량'))
    sales_summary = (
        sales_df
        .groupby(['약품명', '약품코드'])['조제수량']
        .sum()
        .reset_index()
        .rename(columns={'조제수량': '판매수량'})
    )

    # 키 결합: 재고 키 + 신규 판매 키
    stock_keys = stock_df[['약품명', '약품코드']].drop_duplicates()
    sales_keys = sales_summary[['약품명', '약품코드']].drop_duplicates()
    new_keys = sales_keys.merge(
        stock_keys,
        on=['약품명', '약품코드'],
        how='left',
        indicator=True
    )
    new_keys = new_keys[new_keys['_merge']=='left_only'][['약품명','약품코드']]
    all_keys = pd.concat([stock_keys, new_keys], ignore_index=True)
    all_keys = all_keys[all_keys['약품명']!='']

    # 재고 합치기
    merged = pd.merge(
        all_keys,
        stock_df,
        on=['약품명', '약품코드'],
        how='left'
    )
    merged['개수'] = merged['개수'].fillna(0)

    # 구매정보 병합
    merged = pd.merge(
        merged,
        purchase_summary,
        on='약품명',
        how='left'
    )
    merged['구매수량'] = merged['구매수량'].fillna(0)

    # 판매정보 병합
    merged = pd.merge(
        merged,
        sales_summary,
        on=['약품명','약품코드'],
        how='left'
    )
    merged['판매수량'] = merged['판매수량'].fillna(0)

    # 최종 재고 계산
    merged['최종재고'] = merged['개수'] + merged['구매수량'] - merged['판매수량']

    # 결과 저장
    final_df = merged[['약품명','약품코드','개수','구매수량','판매수량','최종재고']]
    final_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    return final_df


if __name__=='__main__':
    df = update_stock(
        '약품 매입 현황.csv',
        '약품별조제판매현황.csv',
        '전문약 재고현황(필약국).csv',
        '최종_약품재고현황.csv'
    )
    print(df.head())
