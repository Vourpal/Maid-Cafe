"""Aggregate queries backing the admin dashboard.

Each helper is a single round trip so the dashboard endpoint stays cheap; the
route stitches them together into one response.
"""


def get_staff_stats(db):
    db.execute(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE active) AS active,
            COUNT(*) FILTER (WHERE NOT active) AS inactive,
            COUNT(*) FILTER (WHERE admin) AS admins,
            COUNT(*) FILTER (WHERE type = 'maid') AS maids,
            COUNT(*) FILTER (WHERE type = 'butler') AS butlers,
            COUNT(*) FILTER (WHERE type IS NULL) AS untyped,
            COUNT(*) FILTER (
                WHERE availability IS NULL OR availability = '{}'::jsonb
            ) AS no_availability
        FROM users;
        """
    )
    row = db.fetchone()
    return {
        "total": row[0],
        "active": row[1],
        "inactive": row[2],
        "admins": row[3],
        "maids": row[4],
        "butlers": row[5],
        "untyped": row[6],
        "no_availability": row[7],
    }


def get_event_stats(db):
    db.execute(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE end_date >= NOW()) AS upcoming,
            COUNT(*) FILTER (WHERE end_date < NOW()) AS past,
            COUNT(*) FILTER (WHERE status = 'draft') AS draft,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
        FROM events;
        """
    )
    row = db.fetchone()
    return {
        "total": row[0],
        "upcoming": row[1],
        "past": row[2],
        "draft": row[3],
        "cancelled": row[4],
    }


def get_upcoming_events_with_signups(db, limit: int = 5):
    """Upcoming events with sign-up counts against capacity, plus carpool
    supply/demand — the numbers an admin checks before an event."""
    db.execute(
        """
        SELECT
            e.id,
            e.title,
            e.start_date,
            e.end_date,
            e.location,
            e.max_attendees,
            e.status,
            COUNT(a.id) AS rsvps,
            COUNT(a.id) FILTER (WHERE a.status = 'going') AS going,
            COUNT(a.id) FILTER (WHERE a.role = 'Driver') AS drivers,
            COALESCE(SUM(a.seats_available) FILTER (WHERE a.role = 'Driver'), 0) AS seats_offered,
            COUNT(a.id) FILTER (WHERE a.role = 'Passenger') AS passengers
        FROM events e
        LEFT JOIN attendances a ON a.event_id = e.id
        WHERE e.end_date >= NOW()
        GROUP BY e.id, e.title, e.start_date, e.end_date, e.location,
                 e.max_attendees, e.status
        ORDER BY e.start_date ASC
        LIMIT %s;
        """,
        (limit,),
    )

    rows = []
    for row in db.fetchall():
        max_attendees = row[5]
        going = row[8]
        seats_offered = int(row[10])
        passengers = row[11]

        rows.append(
            {
                "id": row[0],
                "title": row[1],
                "start_datetime": row[2].isoformat() if row[2] else None,
                "end_datetime": row[3].isoformat() if row[3] else None,
                "location": row[4],
                "max_attendees": max_attendees,
                "status": row[6],
                "rsvps": row[7],
                "going": going,
                "drivers": row[9],
                "seats_offered": seats_offered,
                "passengers": passengers,
                "seats_left": max(0, seats_offered - passengers),
                "spots_left": (max_attendees - going) if max_attendees else None,
                "over_capacity": bool(max_attendees and going > max_attendees),
            }
        )

    return rows


def get_practice_stats(db):
    db.execute(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE date >= NOW()) AS upcoming,
            COUNT(*) FILTER (WHERE date < NOW()) AS held
        FROM practice_sessions;
        """
    )
    total, upcoming, held = db.fetchone()

    # Overall attendance rate across every recorded row for sessions already held.
    db.execute(
        """
        SELECT
            COUNT(*) AS recorded,
            COUNT(*) FILTER (WHERE p.attended) AS attended
        FROM practices p
        JOIN practice_sessions ps ON ps.id = p.practice_session_id
        WHERE ps.date <= NOW();
        """
    )
    recorded, attended = db.fetchone()

    return {
        "total": total,
        "upcoming": upcoming,
        "held": held,
        "records": recorded,
        "attended": attended,
        "attendance_rate": round(attended / recorded * 100, 1) if recorded else None,
    }


def get_next_practice_session(db):
    db.execute(
        """
        SELECT id, title, date, location
        FROM practice_sessions
        WHERE date >= NOW()
        ORDER BY date ASC
        LIMIT 1;
        """
    )
    row = db.fetchone()
    if row is None:
        return None

    return {
        "id": row[0],
        "title": row[1],
        "date": row[2].isoformat() if row[2] else None,
        "location": row[3],
    }


def get_invite_stats(db):
    db.execute(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (
                WHERE uses < max_uses
                  AND (expires_at IS NULL OR expires_at > NOW())
            ) AS active,
            COUNT(*) FILTER (WHERE uses >= max_uses) AS used_up,
            COUNT(*) FILTER (
                WHERE expires_at IS NOT NULL AND expires_at <= NOW()
            ) AS expired
        FROM invite_codes;
        """
    )
    row = db.fetchone()
    return {
        "total": row[0],
        "active": row[1],
        "used_up": row[2],
        "expired": row[3],
    }


def get_link_stats(db):
    db.execute("SELECT COUNT(*) FROM links;")
    return {"total": db.fetchone()[0]}
