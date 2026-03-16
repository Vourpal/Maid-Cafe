
from models import Attendance


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