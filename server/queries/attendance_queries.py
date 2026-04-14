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


# TODO: Testing race conditions

# with get_db() as (conn, cur):
#     # Lock the event row so no one else can read it until we're done
#     cur.execute("""
#         SELECT remaining_seats
#         FROM events
#         WHERE id = %s
#         FOR UPDATE
#     """, (event_id,))

#     row = cur.fetchone()
#     if not row:
#         raise APIError("EVENT_NOT_FOUND", ...)

#     seats = row[0]

#     if seats <= 0:
#         raise APIError("FULL", "No seats left")

#     # Decrement seat count
#     cur.execute("""
#         UPDATE events
#         SET remaining_seats = remaining_seats - 1
#         WHERE id = %s
#     """, (event_id,))

#     # Insert attendance
#     cur.execute("""
#         INSERT INTO attendances (...)
#         RETURNING id
#     """, (...))
