from datetime import datetime

import psycopg2
from pydantic import BaseModel

class UserBase(BaseModel):
    first_name: str
    last_name: str
    email: str
    username: str

class UserAuthorization(UserBase):
    password: str
    admin: bool
    active: bool

class Event(BaseModel):
    id: int | None = None
    title: str
    description: str | None = None
    start_datetime: datetime
    end_datetime: datetime
    created_by: int  # user_id
    location: str | None = None
    max_attendees: int | None = None

class Attendance(BaseModel):
    id: int | None = None
    user_id: int
    event_id: int
    status: str  # "going", "not_going", "maybe"
    notes: str | None = None

class Task(BaseModel):
    id: int | None = None
    title: str
    description: str | None = None
    assigned_to: int | None = None  # user_id
    created_by: int
    due_date: datetime | None = None
    event_id: int | None = None
    completed: bool = False

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
