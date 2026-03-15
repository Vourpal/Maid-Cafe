import psycopg2


def connect_db():
    try:
        conn = psycopg2.connect(
            dbname="Maid_Cafe",
            user="postgres",
            password="Eurekasan2478!",
            host="localhost",
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
