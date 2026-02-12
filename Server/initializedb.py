from db import connect_db


def initialize_user_table(db, conn):
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
    conn.commit()


def initialize_event_table(db, conn):
    db.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            title VARCHAR(100) NOT NULL,
            description VARCHAR(255),
            start_date TIMESTAMP NOT NULL,
            end_date TIMESTAMP NOT NULL,
            created_by INTEGER NOT NULL,
            location VARCHAR(100),
            max_attendees INT,
            FOREIGN KEY (created_by) REFERENCES users(id)
        );
    """)
    conn.commit()


def initialize_attendee_table(db, conn):
    db.execute("""
    CREATE TABLE IF NOT EXISTS attendances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    status VARCHAR(100) NOT NULL,
    notes VARCHAR(255) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id)
    );
    """)
    conn.commit()


def initialize_tasks_table(db, conn):
    db.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    assigned_to INTEGER,
    created_by INTEGER NOT NULL,
    due_date TIMESTAMP,
    event_id INTEGER,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id)
    );
    """)
    conn.commit()


if __name__ == "__main__":
    conn = connect_db()
    if conn:
        cur = conn.cursor()
    else:
        raise Exception("Database connection failed")

    initialize_user_table(cur, conn)
    initialize_event_table(cur, conn)
    initialize_attendee_table(cur, conn)
    initialize_tasks_table(cur, conn)
