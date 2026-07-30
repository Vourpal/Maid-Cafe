"""Who knows which routine, and how well.

One row per (member, routine) pair with a level of learning / can_perform /
lead. The interesting derived number is readiness: how many people could
perform a routine today, compared with how many bodies the formation needs
(routines.member_count).
"""

# Anything at can_perform or above counts as stage-ready.
LEVELS = ("learning", "can_perform", "lead")


def _iso(value):
    return value.isoformat() if value else None


def set_proficiency(db, routine_id: int, entry):
    """Upsert one pair. Re-setting the same level still bumps updated_at, which
    is what makes "last assessed" meaningful."""
    db.execute(
        """
        INSERT INTO routine_proficiency (user_id, routine_id, level, notes)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, routine_id)
        DO UPDATE SET
            level = EXCLUDED.level,
            notes = EXCLUDED.notes,
            updated_at = NOW()
        RETURNING id;
        """,
        (entry.user_id, routine_id, entry.level, entry.notes),
    )
    return db.fetchone()[0]


def delete_proficiency(db, routine_id: int, user_id: int):
    db.execute(
        """
        DELETE FROM routine_proficiency
        WHERE routine_id = %s AND user_id = %s
        RETURNING id;
        """,
        (routine_id, user_id),
    )
    row = db.fetchone()
    return row[0] if row else None


def get_routine_proficiency(db, routine_id: int):
    """Everybody with a record for one routine, best first."""
    db.execute(
        """
        SELECT
            rp.id,
            rp.user_id,
            u.first_name,
            u.last_name,
            u.username,
            u.type,
            u.active,
            rp.level,
            rp.notes,
            rp.updated_at
        FROM routine_proficiency rp
        JOIN users u ON u.id = rp.user_id
        WHERE rp.routine_id = %s
        ORDER BY
            CASE rp.level
                WHEN 'lead' THEN 0
                WHEN 'can_perform' THEN 1
                ELSE 2
            END,
            u.last_name,
            u.first_name;
        """,
        (routine_id,),
    )

    return [
        {
            "id": row[0],
            "user_id": row[1],
            "first_name": row[2],
            "last_name": row[3],
            "username": row[4],
            "type": row[5],
            "active": row[6],
            "level": row[7],
            "notes": row[8],
            "updated_at": _iso(row[9]),
        }
        for row in db.fetchall()
    ]


def get_user_proficiency(db, user_id: int):
    """One member's own list — every routine they have a record for."""
    db.execute(
        """
        SELECT
            rp.routine_id,
            r.name,
            rp.level,
            rp.notes,
            rp.updated_at,
            r.music_url,
            r.video_url,
            r.duration_seconds,
            r.bpm,
            r.difficulty
        FROM routine_proficiency rp
        JOIN routines r ON r.id = rp.routine_id
        WHERE rp.user_id = %s
        ORDER BY
            CASE rp.level
                WHEN 'lead' THEN 0
                WHEN 'can_perform' THEN 1
                ELSE 2
            END,
            r.name;
        """,
        (user_id,),
    )

    return [
        {
            "routine_id": row[0],
            "name": row[1],
            "level": row[2],
            "notes": row[3],
            "updated_at": _iso(row[4]),
            "music_url": row[5],
            "video_url": row[6],
            "duration_seconds": row[7],
            "bpm": row[8],
            "difficulty": row[9],
        }
        for row in db.fetchall()
    ]


def get_proficiency_entries(db):
    """Flat (user, routine, level) list. The grid is assembled client-side from
    this plus the member and routine lists, which keeps the payload one row per
    real record instead of members × routines mostly-empty cells.
    """
    db.execute(
        """
        SELECT rp.user_id, rp.routine_id, rp.level, rp.notes, rp.updated_at
        FROM routine_proficiency rp;
        """
    )

    return [
        {
            "user_id": row[0],
            "routine_id": row[1],
            "level": row[2],
            "notes": row[3],
            "updated_at": _iso(row[4]),
        }
        for row in db.fetchall()
    ]


def get_routine_readiness(db, routine_id: int | None = None):
    """Per-routine head counts by level.

    `ready` counts can_perform + lead. Only active members count towards it —
    somebody who has left the troupe should not make a routine look coverable.
    `short_by` compares that against routines.member_count when one is set.
    """
    clause = "WHERE r.id = %s" if routine_id is not None else ""
    params = (routine_id,) if routine_id is not None else ()

    db.execute(
        f"""
        SELECT
            r.id,
            r.name,
            r.member_count,
            COUNT(rp.id) FILTER (WHERE rp.level = 'learning') AS learning,
            COUNT(rp.id) FILTER (WHERE rp.level = 'can_perform') AS can_perform,
            COUNT(rp.id) FILTER (WHERE rp.level = 'lead') AS lead,
            COUNT(rp.id) FILTER (
                WHERE rp.level IN ('can_perform', 'lead') AND u.active
            ) AS ready
        FROM routines r
        LEFT JOIN routine_proficiency rp ON rp.routine_id = r.id
        LEFT JOIN users u ON u.id = rp.user_id
        {clause}
        GROUP BY r.id, r.name, r.member_count
        ORDER BY r.name;
        """,
        params,
    )

    rows = []
    for row in db.fetchall():
        needed = row[2]
        ready = row[6]
        rows.append(
            {
                "routine_id": row[0],
                "name": row[1],
                "member_count": needed,
                "learning": row[3],
                "can_perform": row[4],
                "lead": row[5],
                "ready": ready,
                "short_by": max(needed - ready, 0) if needed else None,
                "performable": ready >= needed if needed else ready > 0,
            }
        )

    return rows
