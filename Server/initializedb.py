from db import connect_db

def initialize_user_table(db):

    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            admin BOOLEAN NOT NULL DEFAULT FALSE,
            active BOOLEAN NOT NULL DEFAULT TRUE
        );
    """)
    db.commit()


if __name__ == "__main__":
    conn = connect_db()
    if conn:
        cur = conn.cursor()
    else:
        raise Exception("Database connection failed")

    initialize_user_table(cur)