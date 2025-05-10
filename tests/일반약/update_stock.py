import pandas as pd

# 숫자 파싱 헬퍼 함수
def parse_number(x, column_name):
    try:
        if pd.isna(x) or str(x).strip() == '':
            return 0.0
        return float(str(x).replace(',', '').strip())
    except Exception as e:
        print(f"Error parsing '{x}' in column '{column_name}': {e}")
        return 0.0

# 일반약 재고 업데이트 함수
def update_general_stock(stock_path, incoming_path, sales_path, output_path):
    # CSV 로드
    stock_df = pd.read_csv(stock_path)
    incoming_df = pd.read_csv(incoming_path)
    sales_df = pd.read_csv(sales_path)

    # 요약 행 제거: 'no' 컬럼이 숫자인 행만 유지
    for df in [stock_df, incoming_df, sales_df]:
        if 'no' in df.columns:
            df = df[df['no'].apply(lambda x: str(x).isdigit())]

    # 상품명 컬럼 통일 및 공백 제거
    stock_df['상품명'] = stock_df['상품명'].fillna('').astype(str).str.strip()
    incoming_df['상품명'] = incoming_df['상품명'].fillna('').astype(str).str.strip()
    sales_df['상품명'] = sales_df['상품명'].fillna('').astype(str).str.strip()

    # 유효한 상품명만
    stock_df = stock_df[stock_df['상품명'] != '']
    incoming_df = incoming_df[incoming_df['상품명'] != '']
    sales_df = sales_df[sales_df['상품명'] != '']

    # 수량 컬럼 파싱
    stock_df['기존재고'] = stock_df.get('재고수량', pd.Series()).apply(lambda x: parse_number(x, '재고수량'))
    incoming_qty_col = '수량' if '수량' in incoming_df.columns else incoming_df.columns[-1]
    sales_qty_col = '수량' if '수량' in sales_df.columns else sales_df.columns[-1]
    incoming_df['입고수량'] = incoming_df[incoming_qty_col].apply(lambda x: parse_number(x, incoming_qty_col))
    sales_df['판매수량'] = sales_df[sales_qty_col].apply(lambda x: parse_number(x, sales_qty_col))

    # 집계
    stock_summary = stock_df.groupby('상품명')['기존재고'].sum().reset_index()
    incoming_summary = incoming_df.groupby('상품명')['입고수량'].sum().reset_index()
    sales_summary = sales_df.groupby('상품명')['판매수량'].sum().reset_index()

    # 모든 상품키 결합
    keys = pd.concat([
        stock_summary[['상품명']],
        incoming_summary[['상품명']],
        sales_summary[['상품명']]
    ], ignore_index=True).drop_duplicates().reset_index(drop=True)

    # 병합
    merged = keys.merge(stock_summary, on='상품명', how='left')
    merged['기존재고'] = merged['기존재고'].fillna(0)
    merged = merged.merge(incoming_summary, on='상품명', how='left')
    merged['입고수량'] = merged['입고수량'].fillna(0)
    merged = merged.merge(sales_summary, on='상품명', how='left')
    merged['판매수량'] = merged['판매수량'].fillna(0)

    # 신규품목 표시
    merged['신규품목'] = merged['기존재고'].eq(0) & (merged['입고수량'].gt(0) | merged['판매수량'].gt(0))

    # 최종 재고
    merged['최종재고'] = merged['기존재고'] + merged['입고수량'] - merged['판매수량']

    # 결과 저장 및 반환
    final_df = merged[['상품명', '기존재고', '입고수량', '판매수량', '최종재고', '신규품목']]
    final_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    return final_df

# 실행 예시
if __name__ == '__main__':
    df = update_general_stock(
        '일반약 재고현황_20250415.csv',
        '입고상세내역_20250421-20250510 일반약.csv',
        '판매상세내역_20250421-20250510 일반약.csv',
        '최종_일반약재고현황_202050510.csv'
    )
    print(df.head())
