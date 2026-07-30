from models import Attendance, NewAttendance, UpdatedAttendance


def get_attendances_by_user(db, user_id: int):
    db.execute(
        """
        SELECT id, user_id, event_id, status, notes, role, seats_available
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
            role=row[5],
            seats_available=row[6],
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


_ATTENDANCE_COLUMNS = ("status", "seats_available", "role", "notes")


def update_attendance(db, attendance_id: int, data):
    """Partial update. Accepts UpdatedAttendance (member editing their own RSVP)
    or AdminAttendanceUpdate (admin override, which may also set notes).

    Driven by exclude_unset so an explicit null clears a column — that is how an
    admin removes a carpool role.
    """
    payload = data.model_dump(exclude_unset=True)

    fields = []
    values = []

    for column in _ATTENDANCE_COLUMNS:
        if column in payload:
            fields.append(f"{column} = %s")
            values.append(payload[column])

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


# ────────────────────────────────────────────────────────────
# Admin roster views
# ────────────────────────────────────────────────────────────


def get_event_attendances(db, event_id: int):
    """Full roster for one event, including the attendance id so an admin can
    edit or remove any row. get_admin_event_info deliberately omits the ids
    (it is a read-only summary), which is why this exists separately.
    """
    db.execute(
        """
        SELECT
            a.id,
            a.user_id,
            u.first_name,
            u.last_name,
            u.username,
            u.type,
            a.status,
            a.role,
            a.seats_available,
            a.notes
        FROM attendances a
        JOIN users u ON u.id = a.user_id
        WHERE a.event_id = %s
        ORDER BY u.last_name, u.first_name;
        """,
        (event_id,),
    )

    return [
        {
            "id": row[0],
            "user_id": row[1],
            "first_name": row[2],
            "last_name": row[3],
            "username": row[4],
            "type": row[5],
            "status": row[6],
            "role": row[7],
            "seats_available": row[8],
            "notes": row[9],
        }
        for row in db.fetchall()
    ]


def get_attendance_by_user_and_event(db, user_id: int, event_id: int):
    db.execute(
        """
        SELECT id
        FROM attendances
        WHERE user_id = %s AND event_id = %s;
        """,
        (user_id, event_id),
    )
    row = db.fetchone()
    return row[0] if row else None


def count_event_signups(db, event_id: int, status: str = "going"):
    db.execute(
        """
        SELECT COUNT(*)
        FROM attendances
        WHERE event_id = %s AND status = %s;
        """,
        (event_id, status),
    )
    return db.fetchone()[0]


def get_event_attendance_report(db):
    """Per-user event participation, for the reliability report."""
    db.execute(
        """
        SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.username,
            u.type,
            COUNT(a.id) AS rsvps,
            COUNT(a.id) FILTER (WHERE a.status = 'going') AS going,
            COUNT(a.id) FILTER (WHERE a.status = 'maybe') AS maybe,
            COUNT(a.id) FILTER (WHERE a.status NOT IN ('going', 'maybe')) AS declined,
            COUNT(a.id) FILTER (WHERE a.role = 'Driver') AS driving
        FROM users u
        LEFT JOIN attendances a ON a.user_id = u.id
        GROUP BY u.id, u.first_name, u.last_name, u.username, u.type
        ORDER BY u.last_name, u.first_name;
        """
    )

    return [
        {
            "user_id": row[0],
            "first_name": row[1],
            "last_name": row[2],
            "username": row[3],
            "type": row[4],
            "rsvps": row[5],
            "going": row[6],
            "maybe": row[7],
            "declined": row[8],
            "driving": row[9],
        }
        for row in db.fetchall()
    ]
