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
