import os
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get("DATABASE_URL")  # Render나 fly.io 환경변수에서 읽기

conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
