import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()  # .env 파일 로딩

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL이 설정되지 않았습니다.")

conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
