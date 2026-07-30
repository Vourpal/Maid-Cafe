from models import PracticeSession


def get_all_practice_sessions(db):
    db.execute(
        """
    SELECT id, title, location, date, notes FROM practice_sessions
    """
    )
    data = db.fetchall()
    if not data:
        return []

    return [
        PracticeSession(id=id, title=title, location=location, date=date, notes=notes)
        for (id, title, location, date, notes) in data
    ]


def post_practice_sessions(db, session: PracticeSession):
    db.execute(
        """
        INSERT INTO practice_sessions (title, location, date, notes)
        VALUES (%s, %s, %s, %s)
        RETURNING id""",
        (session.title, session.location, session.date_utc, session.notes),
    )
    return db.fetchone()[0]


def delete_practice_sessions(db, practice_id: int):
    db.execute(
        """
        DELETE FROM practice_sessions
        where id = %s
        RETURNING id""",
        (practice_id,),
    )
    row = db.fetchone()
    return row[0] if row else None


def add_practice_attendance(db, practice_id: int, attendees: list[int]):
    for user_id in attendees:
        db.execute(
            """
            INSERT INTO practices (user_id, practice_session_id, attended)
            VALUES (%s, %s, TRUE)
            ON CONFLICT (user_id, practice_session_id)
            DO UPDATE SET attended = TRUE;
            """,
            (user_id, practice_id),
        )


def get_practice_attendance(db, practice_id: int):
    db.execute(
        """
        SELECT 
            p.id,
            p.user_id,
            u.first_name,
            u.last_name,
            p.attended,
            p.late,
            p.notes
        FROM practices p
        JOIN users u ON u.id = p.user_id
        WHERE p.practice_session_id = %s;
        """,
        (practice_id,),
    )

    rows = db.fetchall()

    return [
        {
            "id": row[0],
            "user_id": row[1],
            "first_name": row[2],
            "last_name": row[3],
            "attended": row[4],
            "late": row[5],
            "notes": row[6],
        }
        for row in rows
    ]


def get_all_routines(db):
    """Routine catalog with how many sessions each routine is attached to, so
    admins can see what is safe to delete."""
    db.execute(
        """
        SELECT
            r.id,
            r.name,
            r.notes,
            COUNT(pr.id) AS usage_count,
            MAX(ps.date) AS last_used
        FROM routines r
        LEFT JOIN practice_session_routines pr ON pr.routine_id = r.id
        LEFT JOIN practice_sessions ps ON ps.id = pr.practice_session_id
        GROUP BY r.id, r.name, r.notes
        ORDER BY r.name;
        """
    )

    rows = db.fetchall()

    return [
        {
            "id": row[0],
            "name": row[1],
            "notes": row[2],
            "usage_count": row[3],
            "last_used": row[4].isoformat() if row[4] else None,
        }
        for row in rows
    ]


def get_routine_by_id(db, routine_id: int):
    db.execute(
        """
        SELECT r.id, r.name, r.notes, COUNT(pr.id)
        FROM routines r
        LEFT JOIN practice_session_routines pr ON pr.routine_id = r.id
        WHERE r.id = %s
        GROUP BY r.id, r.name, r.notes;
        """,
        (routine_id,),
    )
    row = db.fetchone()
    if row is None:
        return None

    return {
        "id": row[0],
        "name": row[1],
        "notes": row[2],
        "usage_count": row[3],
    }


def create_routine_standalone(db, name: str, notes: str | None):
    """Add a routine to the catalog without attaching it to a session.

    Unlike create_routine this reports a name collision instead of silently
    returning the existing row, so the caller can surface a 409.
    """
    db.execute(
        """
        INSERT INTO routines (name, notes)
        VALUES (%s, %s)
        ON CONFLICT (name) DO NOTHING
        RETURNING id;
        """,
        (name, notes),
    )
    row = db.fetchone()
    return row[0] if row else None


def delete_routine(db, routine_id: int):
    """Remove a routine from the catalog. The join table is ON DELETE CASCADE,
    so this also detaches it from every practice session."""
    db.execute(
        """
        DELETE FROM routines
        WHERE id = %s
        RETURNING id;
        """,
        (routine_id,),
    )
    row = db.fetchone()
    return row[0] if row else None


def update_practice_session(
    db,
    practice_id: int,
    session: PracticeSession,
):
    db.execute(
        """
        UPDATE practice_sessions
        SET title = %s,
            location = %s,
            date = %s,
            notes = %s
        WHERE id = %s
        RETURNING id;
        """,
        (
            session.title,
            session.location,
            session.date_utc,
            session.notes,
            practice_id,
        ),
    )

    row = db.fetchone()

    return row[0] if row else None


def update_practice_attendance(db, updates: list):
    """Bulk-edit attendance rows. Rows without an `id` are skipped rather than
    raising a KeyError, and absent flags keep their stored value."""
    updated = 0

    for record in updates:
        if not isinstance(record, dict) or record.get("id") is None:
            continue

        db.execute(
            """
            UPDATE practices
            SET attended = COALESCE(%s, attended),
                late = COALESCE(%s, late),
                notes = %s
            WHERE id = %s
            RETURNING id;
            """,
            (
                record.get("attended"),
                record.get("late"),
                record.get("notes"),
                record["id"],
            ),
        )
        if db.fetchone():
            updated += 1

    return updated


def create_routine(db, name: str, notes: str | None):
    db.execute(
        """
        INSERT INTO routines (name, notes)
        VALUES (%s, %s)
        ON CONFLICT (name)
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id;
        """,
        (name, notes),
    )
    return db.fetchone()[0]


def add_routine_to_practice(db, practice_id: int, routine_id: int):
    db.execute(
        """
        INSERT INTO practice_session_routines (practice_session_id, routine_id)
        VALUES (%s, %s)
        ON CONFLICT DO NOTHING;
        """,
        (practice_id, routine_id),
    )


def get_routines_by_practice(db, practice_id: int):
    db.execute(
        """
        SELECT r.id, r.name, r.notes
        FROM routines r
        JOIN practice_session_routines pr
          ON pr.routine_id = r.id
        WHERE pr.practice_session_id = %s;
        """,
        (practice_id,),
    )

    rows = db.fetchall()

    return [{"id": row[0], "name": row[1], "notes": row[2]} for row in rows]


def update_routine(db, routine_id: int, routine):
    """Partial update. Previously this always wrote both columns, so a PATCH
    carrying only `notes` would null out the NOT NULL `name` column."""
    payload = routine.model_dump(exclude_unset=True)

    fields = []
    values = []

    for column in ("name", "notes"):
        if column in payload:
            fields.append(f"{column} = %s")
            values.append(payload[column])

    if not fields:
        return None

    db.execute(
        f"""
        UPDATE routines
        SET {", ".join(fields)}
        WHERE id = %s
        RETURNING id;
        """,
        tuple(values + [routine_id]),
    )

    row = db.fetchone()
    return row[0] if row else None


def remove_routine_from_practice(db, practice_id: int, routine_id: int):
    db.execute(
        """
        DELETE FROM practice_session_routines
        WHERE practice_session_id = %s
          AND routine_id = %s
        RETURNING id;
        """,
        (practice_id, routine_id),
    )

    row = db.fetchone()
    return row[0] if row else None


def update_routines_bulk(db, routines: list[dict]):
    """Rows missing an `id` are skipped, and a missing/blank `name` keeps the
    stored one instead of violating the NOT NULL constraint."""
    updated = []

    for r in routines:
        if not isinstance(r, dict) or r.get("id") is None:
            continue

        name = r.get("name")

        db.execute(
            """
            UPDATE routines
            SET name = COALESCE(NULLIF(%s, ''), name),
                notes = %s
            WHERE id = %s
            RETURNING id, name, notes;
            """,
            (
                name,
                r.get("notes"),
                r["id"],
            ),
        )

        row = db.fetchone()
        if row:
            updated.append(
                {
                    "id": row[0],
                    "name": row[1],
                    "notes": row[2],
                }
            )

    return updated


# ────────────────────────────────────────────────────────────
# Attendance history & reliability reporting
# ────────────────────────────────────────────────────────────


def get_practice_session_by_id(db, practice_id: int):
    db.execute(
        """
        SELECT id, title, location, date, notes
        FROM practice_sessions
        WHERE id = %s;
        """,
        (practice_id,),
    )
    row = db.fetchone()
    if row is None:
        return None

    return PracticeSession(
        id=row[0], title=row[1], location=row[2], date=row[3], notes=row[4]
    )


def get_user_practice_history(db, user_id: int, past_only: bool = True):
    """Every practice session this user has a record for, newest first.

    `past_only` keeps future sessions out of the reliability numbers — a
    session that has not happened yet should not read as an absence.
    """
    clause = "AND ps.date <= NOW()" if past_only else ""

    db.execute(
        f"""
        SELECT
            p.id,
            ps.id,
            ps.title,
            ps.date,
            ps.location,
            p.attended,
            p.late,
            p.notes
        FROM practices p
        JOIN practice_sessions ps ON ps.id = p.practice_session_id
        WHERE p.user_id = %s {clause}
        ORDER BY ps.date DESC;
        """,
        (user_id,),
    )

    return [
        {
            "id": row[0],
            "practice_session_id": row[1],
            "title": row[2],
            "date": row[3].isoformat() if row[3] else None,
            "location": row[4],
            "attended": row[5],
            "late": row[6],
            "notes": row[7],
        }
        for row in db.fetchall()
    ]


def get_user_practice_summary(db, user_id: int):
    """Attendance/lateness rates for one user across sessions already held."""
    db.execute(
        """
        SELECT
            COUNT(*) AS recorded,
            COUNT(*) FILTER (WHERE p.attended) AS attended,
            COUNT(*) FILTER (WHERE p.late) AS late
        FROM practices p
        JOIN practice_sessions ps ON ps.id = p.practice_session_id
        WHERE p.user_id = %s AND ps.date <= NOW();
        """,
        (user_id,),
    )
    recorded, attended, late = db.fetchone()

    # Sessions held overall, so the caller can show "recorded on 8 of 12 held".
    db.execute("SELECT COUNT(*) FROM practice_sessions WHERE date <= NOW();")
    sessions_held = db.fetchone()[0]

    return {
        "recorded": recorded,
        "attended": attended,
        "late": late,
        "absent": recorded - attended,
        "sessions_held": sessions_held,
        "attendance_rate": round(attended / recorded * 100, 1) if recorded else None,
        "late_rate": round(late / recorded * 100, 1) if recorded else None,
    }


def get_practice_attendance_report(db, sort: str = "attendance_rate"):
    """Per-user reliability across all practice sessions already held.

    Users with no records at all are still returned (rate = null) so nobody
    silently disappears from the report.
    """
    db.execute(
        """
        SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.username,
            u.type,
            u.active,
            COUNT(p.id) AS recorded,
            COUNT(p.id) FILTER (WHERE p.attended) AS attended,
            COUNT(p.id) FILTER (WHERE p.late) AS late,
            MAX(ps.date) FILTER (WHERE p.attended) AS last_attended
        FROM users u
        LEFT JOIN practices p ON p.user_id = u.id
        LEFT JOIN practice_sessions ps
            ON ps.id = p.practice_session_id AND ps.date <= NOW()
        WHERE p.id IS NULL OR ps.id IS NOT NULL
        GROUP BY u.id, u.first_name, u.last_name, u.username, u.type, u.active
        ORDER BY u.last_name, u.first_name;
        """
    )

    rows = db.fetchall()

    db.execute("SELECT COUNT(*) FROM practice_sessions WHERE date <= NOW();")
    sessions_held = db.fetchone()[0]

    report = []
    for row in rows:
        recorded = row[6]
        attended = row[7]
        report.append(
            {
                "user_id": row[0],
                "first_name": row[1],
                "last_name": row[2],
                "username": row[3],
                "type": row[4],
                "active": row[5],
                "recorded": recorded,
                "attended": attended,
                "late": row[8],
                "absent": recorded - attended,
                "last_attended": row[9].isoformat() if row[9] else None,
                "attendance_rate": (
                    round(attended / recorded * 100, 1) if recorded else None
                ),
                "late_rate": round(row[8] / recorded * 100, 1) if recorded else None,
            }
        )

    if sort == "attendance_rate":
        # Never-recorded users sort last rather than reading as 0%.
        report.sort(
            key=lambda r: (
                r["attendance_rate"] is None,
                r["attendance_rate"] or 0,
            )
        )
    elif sort == "late":
        report.sort(key=lambda r: r["late"], reverse=True)

    return {"sessions_held": sessions_held, "rows": report}


def get_session_attendance_summary(db, limit: int = 10):
    """Turnout per session, most recent first — the other axis of the report."""
    db.execute(
        """
        SELECT
            ps.id,
            ps.title,
            ps.date,
            COUNT(p.id) AS recorded,
            COUNT(p.id) FILTER (WHERE p.attended) AS attended,
            COUNT(p.id) FILTER (WHERE p.late) AS late
        FROM practice_sessions ps
        LEFT JOIN practices p ON p.practice_session_id = ps.id
        WHERE ps.date <= NOW()
        GROUP BY ps.id, ps.title, ps.date
        ORDER BY ps.date DESC
        LIMIT %s;
        """,
        (limit,),
    )

    return [
        {
            "id": row[0],
            "title": row[1],
            "date": row[2].isoformat() if row[2] else None,
            "recorded": row[3],
            "attended": row[4],
            "late": row[5],
            "attendance_rate": round(row[4] / row[3] * 100, 1) if row[3] else None,
        }
        for row in db.fetchall()
    ]
