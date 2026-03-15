from models import Event, EventUpdate


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
            event.start_datetime,
            event.end_datetime,
            event.created_by,
            event.location,
            event.max_attendees,
        ),
    )
    return db.fetchone()[0]


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

    id, title, description, start_date, end_date, created_by, location, max_attendees = row
    return Event(
        id=id,
        title=title,
        description=description,
        start_datetime=start_date,
        end_datetime=end_date,
        created_by=created_by,
        location=location,
        max_attendees=max_attendees,
    )


def get_events_paginated(db, limit, offset, min_capacity=None):
    query = """
        SELECT id, title, description, start_date, end_date, created_by, location, max_attendees
        FROM events
        WHERE 1=1
    """
    params = []

    if min_capacity:
        query += " AND max_attendees >= %s"
        params.append(min_capacity)

    query += " ORDER BY id LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    db.execute(query, params)
    rows = db.fetchall()
    if not rows:
        return []

    return [
        Event(
            id=row[0],
            title=row[1],
            description=row[2],
            start_datetime=row[3],
            end_datetime=row[4],
            created_by=row[5],
            location=row[6],
            max_attendees=row[7],
        )
        for row in rows
    ]


def get_total_events(db):
    db.execute("SELECT COUNT(*) FROM events;")
    return db.fetchone()[0]


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
