import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()


def connect_db():
    try:
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            conn = psycopg2.connect(database_url)
        else:
            conn = psycopg2.connect(
                dbname=os.getenv("DATABASE_NAME"),
                user=os.getenv("DATABASE_USER"),
                password=os.getenv("DATABASE_PASSWORD"),
                host=os.getenv("DATABASE_HOST"),
                port=os.getenv("DATABASE_PORT", 5432),
            )
        print("Connected to the database!")
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None


if __name__ == "__main__":
    conn = connect_db()
    if conn:
        cur = conn.cursor()
