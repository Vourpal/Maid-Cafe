"""Position catalog and event job assignments (shifts).

Positions are a lookup table rather than an enum in the model layer: the job
list is operational data that differs per venue and gets renamed over time, and
an admin must be able to edit it without a migration or a deploy. Assignments
carry a real FK, so renaming a position updates every historical assignment at
once — which a stored string could not do.

event_assignments intentionally has no unique constraint on (event_id, user_id):
the same person may hold several positions at one event so the day can be run
as shifts.
"""

# Whitelist for ORDER BY so the sort parameter never reaches SQL directly.
_ASSIGNMENT_SORT = {
    "time": "a.starts_at ASC NULLS FIRST, p.name ASC",
    "position": "p.name ASC, a.starts_at ASC NULLS FIRST",
    "person": "u.last_name ASC, u.first_name ASC, a.starts_at ASC NULLS FIRST",
}

# Columns update_assignment is allowed to write.
_UPDATABLE_ASSIGNMENT_COLUMNS = {
    "user_id",
    "position_id",
    "starts_at",
    "ends_at",
    "notes",
}

_UPDATABLE_POSITION_COLUMNS = {"name", "description", "color", "active"}

_ASSIGNMENT_SELECT = """
    SELECT
        a.id,
        a.event_id,
        a.user_id,
        a.position_id,
        a.starts_at,
        a.ends_at,
        a.notes,
        a.created_at,
        u.first_name,
        u.last_name,
        u.username,
        u.type,
        p.name,
        p.color,
        e.title,
        e.start_date,
        e.end_date,
        e.location,
        e.status
    FROM event_assignments a
    JOIN users u ON u.id = a.user_id
    JOIN positions p ON p.id = a.position_id
    JOIN events e ON e.id = a.event_id
"""


def _iso(value):
    return value.isoformat() if value else None


def _assignment_row(row):
    return {
        "id": row[0],
        "event_id": row[1],
        "user_id": row[2],
        "position_id": row[3],
        "starts_at": _iso(row[4]),
        "ends_at": _iso(row[5]),
        "notes": row[6],
        "created_at": _iso(row[7]),
        "first_name": row[8],
        "last_name": row[9],
        "username": row[10],
        "type": row[11],
        "position_name": row[12],
        "position_color": row[13],
        "event_title": row[14],
        "event_start": _iso(row[15]),
        "event_end": _iso(row[16]),
        "event_location": row[17],
        "event_status": row[18],
    }


# ── Position catalog ─────────────────────────────────────────────────────────


def get_positions(db, include_inactive: bool = False):
    """Job catalog with how many assignments reference each row, so an admin can
    see what is safe to delete before trying."""
    clause = "" if include_inactive else " WHERE p.active = TRUE"

    db.execute(
        f"""
        SELECT
            p.id,
            p.name,
            p.description,
            p.color,
            p.active,
            COUNT(a.id) AS usage_count
        FROM positions p
        LEFT JOIN event_assignments a ON a.position_id = p.id
        {clause}
        GROUP BY p.id, p.name, p.description, p.color, p.active
        ORDER BY p.active DESC, p.name;
        """
    )

    return [
        {
            "id": row[0],
            "name": row[1],
            "description": row[2],
            "color": row[3],
            "active": row[4],
            "usage_count": row[5],
        }
        for row in db.fetchall()
    ]


def get_position_by_id(db, position_id: int):
    db.execute(
        """
        SELECT
            p.id,
            p.name,
            p.description,
            p.color,
            p.active,
            COUNT(a.id)
        FROM positions p
        LEFT JOIN event_assignments a ON a.position_id = p.id
        WHERE p.id = %s
        GROUP BY p.id, p.name, p.description, p.color, p.active;
        """,
        (position_id,),
    )
    row = db.fetchone()
    if row is None:
        return None

    return {
        "id": row[0],
        "name": row[1],
        "description": row[2],
        "color": row[3],
        "active": row[4],
        "usage_count": row[5],
    }


def create_position(db, position):
    """Returns None on a name collision so the route can answer 409 instead of
    letting a UniqueViolation reach the global handler as a 500."""
    db.execute(
        """
        INSERT INTO positions (name, description, color, active)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (name) DO NOTHING
        RETURNING id;
        """,
        (position.name, position.description, position.color, position.active),
    )
    row = db.fetchone()
    return row[0] if row else None


def update_position(db, position_id: int, position):
    """Partial update driven by exclude_unset, so an explicit null clears a
    nullable column while an absent field is left untouched."""
    payload = position.model_dump(exclude_unset=True)

    fields = []
    values = []
    for column, value in payload.items():
        if column not in _UPDATABLE_POSITION_COLUMNS:
            continue
        fields.append(f"{column} = %s")
        values.append(value)

    if not fields:
        return None

    db.execute(
        f"""
        UPDATE positions
        SET {", ".join(fields)}
        WHERE id = %s
        RETURNING id;
        """,
        tuple(values + [position_id]),
    )
    row = db.fetchone()
    return row[0] if row else None


def delete_position(db, position_id: int):
    db.execute(
        """
        DELETE FROM positions
        WHERE id = %s
        RETURNING id;
        """,
        (position_id,),
    )
    row = db.fetchone()
    return row[0] if row else None


# ── Assignments ──────────────────────────────────────────────────────────────


def create_assignment(db, event_id: int, assignment):
    db.execute(
        """
        INSERT INTO event_assignments
            (event_id, user_id, position_id, starts_at, ends_at, notes)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (
            event_id,
            assignment.user_id,
            assignment.position_id,
            assignment.starts_at,
            assignment.ends_at,
            assignment.notes,
        ),
    )
    return db.fetchone()[0]


def get_assignment_by_id(db, assignment_id: int):
    db.execute(
        f"""
        {_ASSIGNMENT_SELECT}
        WHERE a.id = %s;
        """,
        (assignment_id,),
    )
    row = db.fetchone()
    return _assignment_row(row) if row else None


def get_event_assignments(db, event_id: int, sort: str = "time"):
    order_by = _ASSIGNMENT_SORT.get(sort, _ASSIGNMENT_SORT["time"])

    db.execute(
        f"""
        {_ASSIGNMENT_SELECT}
        WHERE a.event_id = %s
        ORDER BY {order_by}, a.id ASC;
        """,
        (event_id,),
    )
    return [_assignment_row(row) for row in db.fetchall()]


def get_user_assignments(db, user_id: int, upcoming_only: bool = True):
    """Shifts for one member. `upcoming_only` keeps finished events out of the
    "your shifts" surface on the home page."""
    clause = " AND e.end_date >= NOW()" if upcoming_only else ""

    db.execute(
        f"""
        {_ASSIGNMENT_SELECT}
        WHERE a.user_id = %s {clause}
        ORDER BY e.start_date ASC, a.starts_at ASC NULLS FIRST, a.id ASC;
        """,
        (user_id,),
    )
    return [_assignment_row(row) for row in db.fetchall()]


def update_assignment(db, assignment_id: int, assignment):
    """Partial update. An explicit null on starts_at/ends_at converts a timed
    shift back into a whole-event assignment."""
    payload = assignment.model_dump(exclude_unset=True)

    fields = []
    values = []
    for column, value in payload.items():
        if column not in _UPDATABLE_ASSIGNMENT_COLUMNS:
            continue
        fields.append(f"{column} = %s")
        values.append(value)

    if not fields:
        return None

    db.execute(
        f"""
        UPDATE event_assignments
        SET {", ".join(fields)}
        WHERE id = %s
        RETURNING id;
        """,
        tuple(values + [assignment_id]),
    )
    row = db.fetchone()
    return row[0] if row else None


def delete_assignment(db, assignment_id: int):
    db.execute(
        """
        DELETE FROM event_assignments
        WHERE id = %s
        RETURNING id;
        """,
        (assignment_id,),
    )
    row = db.fetchone()
    return row[0] if row else None


def delete_event_assignments_for_user(db, event_id: int, user_id: int):
    """Used when an admin removes somebody from the roster entirely — an
    assignment for a person who is no longer signed up is a scheduling trap."""
    db.execute(
        """
        DELETE FROM event_assignments
        WHERE event_id = %s AND user_id = %s
        RETURNING id;
        """,
        (event_id, user_id),
    )
    return [row[0] for row in db.fetchall()]


def get_unassigned_signups(db, event_id: int):
    """People on the roster with no job yet — the other half of "unfilled".

    Declined RSVPs are excluded: somebody who said they are not coming is not an
    unstaffed body. The status column is free text and has been written both ways
    over time, so both spellings are filtered.
    """
    db.execute(
        """
        SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.username,
            u.type,
            att.status
        FROM attendances att
        JOIN users u ON u.id = att.user_id
        WHERE att.event_id = %s
          AND att.status NOT IN ('not going', 'not_going', 'declined')
          AND NOT EXISTS (
              SELECT 1
              FROM event_assignments a
              WHERE a.event_id = att.event_id AND a.user_id = att.user_id
          )
        ORDER BY u.last_name, u.first_name;
        """,
        (event_id,),
    )

    return [
        {
            "user_id": row[0],
            "first_name": row[1],
            "last_name": row[2],
            "username": row[3],
            "type": row[4],
            "status": row[5],
        }
        for row in db.fetchall()
    ]


def get_event_shift_summary(db, future_only: bool = True, limit: int = 25):
    """One row per event: how many shifts are scheduled and how many of the
    signed-up members already have a job. Drives the admin coverage list."""
    clause = "WHERE e.end_date >= NOW()" if future_only else ""

    db.execute(
        f"""
        SELECT
            e.id,
            e.title,
            e.start_date,
            e.end_date,
            e.location,
            e.status,
            (SELECT COUNT(*) FROM event_assignments a WHERE a.event_id = e.id),
            (SELECT COUNT(DISTINCT a.position_id) FROM event_assignments a
                WHERE a.event_id = e.id),
            (SELECT COUNT(*) FROM attendances att WHERE att.event_id = e.id),
            (SELECT COUNT(DISTINCT a.user_id) FROM event_assignments a
                WHERE a.event_id = e.id)
        FROM events e
        {clause}
        ORDER BY e.start_date ASC
        LIMIT %s;
        """,
        (limit,),
    )

    return [
        {
            "event_id": row[0],
            "title": row[1],
            "start_datetime": _iso(row[2]),
            "end_datetime": _iso(row[3]),
            "location": row[4],
            "status": row[5],
            "assignments": row[6],
            "positions_filled": row[7],
            "signups": row[8],
            "people_assigned": row[9],
            "people_unassigned": max(row[8] - row[9], 0),
        }
        for row in db.fetchall()
    ]
