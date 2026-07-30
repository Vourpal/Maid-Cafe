from models import Task

# Columns update_task is allowed to write.
_UPDATABLE_COLUMNS = {
    "title",
    "description",
    "assigned_to",
    "due_date",
    "event_id",
    "completed",
}

# Whitelist for ORDER BY so the sort parameter never reaches SQL directly.
# Nulls last on due_date keeps undated tasks out of the way of urgent ones.
_SORT_COLUMNS = {
    "due_date": "t.due_date ASC NULLS LAST",
    "created_at": "t.created_at DESC",
    "title": "t.title ASC",
    "assignee": "u.last_name ASC NULLS LAST, u.first_name ASC",
    "status": "t.completed ASC, t.due_date ASC NULLS LAST",
}

_SELECT = """
    SELECT
        t.id,
        t.title,
        t.description,
        t.assigned_to,
        t.created_by,
        t.due_date,
        t.event_id,
        t.completed,
        t.created_at,
        u.first_name,
        u.last_name,
        u.username,
        c.first_name,
        c.last_name,
        e.title
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assigned_to
    LEFT JOIN users c ON c.id = t.created_by
    LEFT JOIN events e ON e.id = t.event_id
"""


def _row_to_dict(row):
    assignee = None
    if row[3] is not None and row[9] is not None:
        assignee = {
            "id": row[3],
            "first_name": row[9],
            "last_name": row[10],
            "username": row[11],
        }

    creator = None
    if row[4] is not None and row[12] is not None:
        creator = {"id": row[4], "first_name": row[12], "last_name": row[13]}

    due_date = row[5]

    return {
        "id": row[0],
        "title": row[1],
        "description": row[2],
        "assigned_to": row[3],
        "created_by": row[4],
        "due_date": due_date.isoformat() if due_date else None,
        "event_id": row[6],
        "completed": row[7],
        "created_at": row[8].isoformat() if row[8] else None,
        "assignee": assignee,
        "creator": creator,
        "event_title": row[14],
    }


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


def _task_filters(
    assigned_to=None,
    event_id=None,
    completed=None,
    search=None,
    overdue_only=False,
    unassigned=False,
):
    clause = ""
    params: list = []

    if assigned_to is not None:
        clause += " AND t.assigned_to = %s"
        params.append(assigned_to)

    if unassigned:
        clause += " AND t.assigned_to IS NULL"

    if event_id is not None:
        clause += " AND t.event_id = %s"
        params.append(event_id)

    if completed is not None:
        clause += " AND t.completed = %s"
        params.append(completed)

    if overdue_only:
        clause += " AND t.completed = FALSE AND t.due_date IS NOT NULL AND t.due_date < NOW()"

    if search:
        clause += " AND (t.title ILIKE %s OR t.description ILIKE %s)"
        params.extend([f"%{search}%", f"%{search}%"])

    return clause, params


def get_tasks(
    db,
    limit: int = 50,
    offset: int = 0,
    assigned_to: int | None = None,
    event_id: int | None = None,
    completed: bool | None = None,
    search: str | None = None,
    overdue_only: bool = False,
    unassigned: bool = False,
    sort: str = "status",
):
    clause, params = _task_filters(
        assigned_to, event_id, completed, search, overdue_only, unassigned
    )
    order_by = _SORT_COLUMNS.get(sort, _SORT_COLUMNS["status"])

    db.execute(
        f"""
        {_SELECT}
        WHERE 1=1 {clause}
        ORDER BY {order_by}, t.id DESC
        LIMIT %s OFFSET %s;
        """,
        tuple(params + [limit, offset]),
    )

    return [_row_to_dict(row) for row in db.fetchall()]


def count_tasks(
    db,
    assigned_to: int | None = None,
    event_id: int | None = None,
    completed: bool | None = None,
    search: str | None = None,
    overdue_only: bool = False,
    unassigned: bool = False,
):
    clause, params = _task_filters(
        assigned_to, event_id, completed, search, overdue_only, unassigned
    )
    db.execute(
        f"SELECT COUNT(*) FROM tasks t WHERE 1=1 {clause};",
        tuple(params),
    )
    return db.fetchone()[0]


def get_task_by_id(db, task_id: int):
    db.execute(
        f"""
        {_SELECT}
        WHERE t.id = %s;
        """,
        (task_id,),
    )
    row = db.fetchone()
    return _row_to_dict(row) if row else None


def get_tasks_for_event(db, event_id: int):
    db.execute(
        f"""
        {_SELECT}
        WHERE t.event_id = %s
        ORDER BY t.completed ASC, t.due_date ASC NULLS LAST;
        """,
        (event_id,),
    )
    return [_row_to_dict(row) for row in db.fetchall()]


def update_task(db, task_id: int, task):
    """Partial update driven by which fields the caller sent, so an explicit
    null can unassign a task or clear its due date."""
    payload = task.model_dump(exclude_unset=True)

    fields = []
    values = []

    for column, value in payload.items():
        if column not in _UPDATABLE_COLUMNS:
            continue
        fields.append(f"{column} = %s")
        values.append(value)

    if not fields:
        return None

    db.execute(
        f"""
        UPDATE tasks
        SET {", ".join(fields)}
        WHERE id = %s
        RETURNING id;
        """,
        tuple(values + [task_id]),
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


def get_task_stats(db):
    """Counts for the admin dashboard."""
    db.execute(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE NOT completed) AS open,
            COUNT(*) FILTER (WHERE completed) AS completed,
            COUNT(*) FILTER (
                WHERE NOT completed AND due_date IS NOT NULL AND due_date < NOW()
            ) AS overdue,
            COUNT(*) FILTER (WHERE NOT completed AND assigned_to IS NULL) AS unassigned
        FROM tasks;
        """
    )
    row = db.fetchone()
    return {
        "total": row[0],
        "open": row[1],
        "completed": row[2],
        "overdue": row[3],
        "unassigned": row[4],
    }
