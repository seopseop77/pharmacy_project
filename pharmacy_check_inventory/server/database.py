import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()  # .env 파일 로딩

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL이 설정되지 않았습니다.")

def get_conn():
    """
    커넥션을 새로 연결하고, 연결이 닫혀 있다면 재연결을 시도합니다.
    """
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn
