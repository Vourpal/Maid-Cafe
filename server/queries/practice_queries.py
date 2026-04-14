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
        (session.title, session.location, session.date, session.notes),
    )
    return db.fetchone()[0]

def delete_practice_sessions(db, practice_id: int):
    db.execute(
        """
        DELETE FROM practice_sessions
        where id = %s
        RETURNING id""",
        (practice_id,)
    )
    row = db.fetchone()
    return row[0] if row else None


def add_practice_attendance(db, practice_id: int, attendees: list[int]):
    for user_id in attendees:
        db.execute(
            """
            INSERT INTO practices (user_id, practice_session_id, attended)
            VALUES (%s, %s, TRUE)
            ON CONFLICT (user_id, practice_session_id) DO NOTHING;
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

def update_practice_attendance(db, updates: list):
    for record in updates:
        db.execute(
            """
            UPDATE practices
            SET attended = %s,
                late = %s,
                notes = %s
            WHERE id = %s;
            """,
            (
                record["attended"],
                record["late"],
                record.get("notes"),
                record["id"],
            ),
        )