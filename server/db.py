import psycopg2
import psycopg2.pool
import os
from dotenv import load_dotenv

load_dotenv()


def _connection_kwargs():
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return {"dsn": database_url}
    return {
        "dbname": os.getenv("DATABASE_NAME"),
        "user": os.getenv("DATABASE_USER"),
        "password": os.getenv("DATABASE_PASSWORD"),
        "host": os.getenv("DATABASE_HOST"),
        "port": os.getenv("DATABASE_PORT", 5432),
    }


_pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=2,
    maxconn=10,
    keepalives=1,
    keepalives_idle=30,
    keepalives_interval=10,
    keepalives_count=5,
    **_connection_kwargs(),
)


def connect_db():
    return _pool.getconn()


def release_db(conn):
    _pool.putconn(conn)


if __name__ == "__main__":
    conn = connect_db()
    cur = conn.cursor()
    print("Connected to the database!")
    release_db(conn)