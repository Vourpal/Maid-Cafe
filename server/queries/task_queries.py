from models import Task


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
    return db.fetchone()[0]


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

    return [
        Task(
            id=row[0],
            title=row[1],
            description=row[2],
            assigned_to=row[3],
            created_by=row[4],
            due_date=row[5],
            event_id=row[6],
            completed=row[7],
        )
        for row in rows
    ]


# TODO: fix this to use dynamic fields like update_event and update_user
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
