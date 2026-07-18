from models import Attendance, NewAttendance, UpdatedAttendance


def get_attendances_by_user(db, user_id: int):
    db.execute(
        """
        SELECT id, user_id, event_id, status, notes
        FROM attendances
        WHERE user_id = %s;
        """,
        (user_id,),
    )
    rows = db.fetchall()
    if not rows:
        return []

    return [
        Attendance(
            id=row[0],
            user_id=row[1],
            event_id=row[2],
            status=row[3],
            notes=row[4],
        )
        for row in rows
    ]


def get_attendance_by_id(db, attendance_id: int):
    db.execute(
        """
        SELECT id, user_id, event_id, status, notes, role, seats_available
        FROM attendances
        WHERE id = %s;
        """,
        (attendance_id,),
    )
    row = db.fetchone()
    if row is None:
        return None
    return Attendance(
        id=row[0],
        user_id=row[1],
        event_id=row[2],
        status=row[3],
        notes=row[4],
        role=row[5],
        seats_available=row[6],
    )


def get_carpool_snapshot(db, event_id: int):
    # Lock every attendance row for this event
    db.execute(
        """
        SELECT id
        FROM attendances
        WHERE event_id = %s
        FOR UPDATE;
        """,
        (event_id,),
    )

    # Now safely calculate totals
    db.execute(
        """
        SELECT
            COALESCE(SUM(CASE
                WHEN role = 'Driver'
                THEN COALESCE(seats_available, 0)
                ELSE 0
            END), 0),
            COUNT(CASE
                WHEN role = 'Passenger'
                THEN 1
            END)
        FROM attendances
        WHERE event_id = %s;
        """,
        (event_id,),
    )

    total_seats, passengers = db.fetchone()
    return int(total_seats), int(passengers)


def post_attendance(db, user: NewAttendance):
    db.execute(
        """
        INSERT INTO attendances (user_id, event_id, status, notes, role, seats_available)
        VALUES (%s,%s,%s,%s,%s,%s)
        RETURNING id;
        """,
        (
            user.user_id,
            user.event_id,
            user.status,
            user.notes,
            user.role,
            user.seats_available,
        ),
    )
    return db.fetchone()[0]


def update_attendance(db, attendance_id: int, data: UpdatedAttendance):

    fields = []
    values = []

    if data.status is not None:
        fields.append("status = %s")
        values.append(data.status)
    if data.seats_available is not None:
        fields.append("seats_available = %s")
        values.append(data.seats_available)
    if data.role is not None:
        fields.append("role = %s")
        values.append(data.role)

    if not fields:
        return None

    sql = f"""
        UPDATE attendances
        SET {", ".join(fields)}
        WHERE id = %s
        RETURNING id;
    """
    values.append(attendance_id)
    db.execute(sql, tuple(values))

    row = db.fetchone()
    return row[0] if row else None


def delete_attendance(db, attendance_id: int):
    db.execute(
        """
        DELETE FROM attendances
        WHERE id = %s
        RETURNING id;
        """,
        (attendance_id,),
    )
    row = db.fetchone()
    return row[0] if row else None


def insert_practice_attendance(db, practice_id: int, attendees: list[int]):
    for user_id in attendees:
        db.execute(
            """
            INSERT INTO practices (user_id, practice_session_id, attended)
            VALUES (%s, %s, TRUE)
            ON CONFLICT (user_id, practice_session_id) DO NOTHING;
            """,
            (user_id, practice_id),
        )