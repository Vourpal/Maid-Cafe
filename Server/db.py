from datetime import datetime

import psycopg2
from pydantic import BaseModel


# Pydantic is mostly for validation
class UserBase(BaseModel):
    first_name: str
    last_name: str
    email: str
    username: str


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    username: str | None = None
    password: str | None = None


class UserAuthorization(UserBase):
    password: str
    admin: bool = False
    active: bool = True


class Event(BaseModel):
    id: int | None = None
    title: str
    description: str | None = None
    start_datetime: datetime
    end_datetime: datetime
    created_by: int  # user_id
    location: str | None = None
    max_attendees: int | None = None


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
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


# TODO: Figure out how to send frontend info as a pydantic model
def create_user(db, user: UserAuthorization):
    db.execute(
        """
    INSERT INTO users (first_name,last_name,email,username,password,admin,active)
    VALUES (%s,%s,%s,%s,%s,%s,%s)
    RETURNING id;""",
        (
            user.first_name,
            user.last_name,
            user.email,
            user.username,
            user.password,  # dont forget to hash this part
            user.admin,
            user.active,
        ),
    )
    new_id = db.fetchone()[0]
    return new_id
    # Do not keep commits inside db, only in routes to avoid partial writes


def create_event(db, event: Event):
    db.execute(
        """
        INSERT INTO events (title, description, start_date, end_date, created_by, location, max_attendees)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
    """,
        (
            event.title,
            event.description,
            event.start_datetime,  # maps to start_date
            event.end_datetime,  # maps to end_date
            event.created_by,
            event.location,
            event.max_attendees,
        ),
    )

    new_id = db.fetchone()[0]
    return new_id


def create_attendance(db, attendance: Attendance):
    db.execute(
        """
    INSERT INTO attendances (user_id, event_id, status, notes)
    VALUES (%s, %s, %s, %s)
    RETURNING id;
    """,
        (attendance.user_id, attendance.event_id, attendance.status, attendance.notes),
    )
    new_id = db.fetchone()[0]
    return new_id


def create_task(db, task: Task):
    db.execute(
        """
    INSERT INTO tasks (title, description, assigned_to, created_by, due_date, event_id, completed)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    RETURNING id;
    """,
        (
            task.title,
            task.description,
            task.assigned_to,
            task.created_by,
            task.due_date,
            task.event_id,
            task.completed,
        ),
    )
    new_id = db.fetchone()[0]
    return new_id


def get_user_by_id(db, user_id: int):
    db.execute(
        """
        SELECT first_name, last_name, email, username
        FROM users
        WHERE id = %s;
    """,
        (user_id,),
    )

    row = db.fetchone()
    if row is None:
        return None  # or raise an error

    first_name, last_name, email, username = row
    return UserBase(
        first_name=first_name, last_name=last_name, email=email, username=username
    )


def get_event_by_id(db, event_id: int):
    db.execute(
        """
        SELECT id, title, description, start_date, end_date, created_by, location, max_attendees
        FROM events
        WHERE id = %s;
    """,
        (event_id,),
    )

    row = db.fetchone()
    if row is None:
        return None

    (
        id,
        title,
        description,
        start_date,
        end_date,
        created_by,
        location,
        max_attendees,
    ) = row

    return Event(
        id=id,
        title=title,
        description=description,
        start_datetime=start_date,  # already a datetime object
        end_datetime=end_date,  # already a datetime object
        created_by=created_by,
        location=location,
        max_attendees=max_attendees,
    )


def get_all_events(db):
    db.execute("""
        SELECT id, title, description, start_date, end_date, created_by, location, max_attendees
        FROM events;
    """)

    rows = db.fetchall()
    if not rows:
        return []  # return empty list instead of None

    events = []
    for row in rows:
        (
            id,
            title,
            description,
            start_date,
            end_date,
            created_by,
            location,
            max_attendees,
        ) = row

        events.append(
            Event(
                id=id,
                title=title,
                description=description,
                start_datetime=start_date,  # already datetime
                end_datetime=end_date,  # already datetime
                created_by=created_by,
                location=location,
                max_attendees=max_attendees,
            )
        )

    return events

def get_events_paginated(db, limit, offset):
    db.execute("""
        SELECT id, title, description, start_date, end_date, created_by, location, max_attendees
        FROM events
        ORDER BY id
        LIMIT %s OFFSET %s;
    """, (limit, offset))

    rows = db.fetchall()
    if not rows:
        return []

    events = []
    for row in rows:
        (
            id,
            title,
            description,
            start_date,
            end_date,
            created_by,
            location,
            max_attendees,
        ) = row

        events.append(Event(
            id=id,
            title=title,
            description=description,
            start_datetime=start_date,
            end_datetime=end_date,
            created_by=created_by,
            location=location,
            max_attendees=max_attendees,
        ))

    return events

def get_total_events(cur):
    cur.execute("SELECT COUNT(*) FROM events;")
    return cur.fetchone()[0]



def get_tasks_for_event(db, event_id: int):
    db.execute(
        """
    SELECT id, title, description, assigned_to, created_by, due_date, event_id, completed

    FROM tasks
    WHERE event_id = %s;
    """,
        (event_id,),
    )
    rows = db.fetchall()
    if not rows:
        return []
    tasks = []
    for row in rows:
        (
            id,
            title,
            description,
            assigned_to,
            created_by,
            due_date,
            event_id,
            completed,
        ) = row
        tasks.append(
            Task(
                id=id,
                title=title,
                description=description,
                assigned_to=assigned_to,
                created_by=created_by,
                due_date=due_date,
                event_id=event_id,
                completed=completed,
            )
        )
    return tasks


# TODO: fix this later to be like the other update functions
def update_task(db, task_id: int, task: Task):
    db.execute(
        """
        UPDATE tasks
        SET title = %s,
            description = %s,
            assigned_to = %s,
            due_date = %s,
            event_id = %s,
            completed = %s
        WHERE id = %s
        RETURNING id;
    """,
        (
            task.title,
            task.description,
            task.assigned_to,
            task.due_date,
            task.event_id,
            task.completed,
            task_id,
        ),
    )

    row = db.fetchone()
    return row[0] if row else None


def update_event(db, event_id: int, event: EventUpdate):
    fields = []
    values = []

    if event.title is not None:
        fields.append("title = %s")
        values.append(event.title)

    if event.description is not None:
        fields.append("description = %s")
        values.append(event.description)

    if event.start_datetime is not None:
        fields.append("start_date = %s")
        values.append(event.start_datetime)

    if event.end_datetime is not None:
        fields.append("end_date = %s")
        values.append(event.end_datetime)

    if event.location is not None:
        fields.append("location = %s")
        values.append(event.location)

    if event.max_attendees is not None:
        fields.append("max_attendees = %s")
        values.append(event.max_attendees)

    if not fields:
        return None

    sql = f"""
        UPDATE events
        SET {", ".join(fields)}
        WHERE id = %s
        RETURNING id;
    """

    values.append(event_id)
    db.execute(sql, tuple(values))

    row = db.fetchone()
    return row[0] if row else None


def update_user(db, user_id: int, user: UserUpdate):
    fields = []
    values = []

    if user.first_name is not None:
        fields.append("first_name = %s")
        values.append(user.first_name)

    if user.last_name is not None:
        fields.append("last_name = %s")
        values.append(user.last_name)

    if user.email is not None:
        fields.append("email = %s")
        values.append(user.email)

    if user.username is not None:
        fields.append("username = %s")
        values.append(user.username)

    if user.password is not None:
        fields.append("password = %s")
        values.append(user.password)

    if not fields:
        return None  # nothing to update

    sql = f"""
        UPDATE users
        SET {", ".join(fields)}
        WHERE id = %s
        RETURNING id;
    """

    values.append(user_id)
    db.execute(sql, tuple(values))

    row = db.fetchone()
    return row[0] if row else None


def delete_task(db, task_id: int):
    db.execute(
        """
        DELETE FROM tasks
        WHERE id = %s
        RETURNING id;
    """,
        (task_id,),
    )

    row = db.fetchone()
    return row[0] if row else None


def delete_event(db, event_id: int):
    db.execute(
        """
    DELETE FROM events
    WHERE id = %s
    RETURNING id;
    """,
        (event_id,),
    )
    row = db.fetchone()
    return row[0] if row else None


def delete_user(db, user_id: int):
    db.execute(
        """
    DELETE FROM users
    WHERE id = %s
    RETURNING id;
    """,
        (user_id,),
    )  # comma important to be treated as a tuple
    row = db.fetchone()
    return row[0] if row else None


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
