"""Admin-authored announcements for the member home page.

Visibility is computed in SQL rather than filtered in Python so the feed query
and its count can never disagree: an entry shows when it is published and either
has no expiry or the expiry is still in the future. Pinned entries sort first,
then newest.
"""

_UPDATABLE_COLUMNS = {
    "title",
    "body",
    "priority",
    "pinned",
    "published",
    "expires_at",
    "event_id",
}

# Whitelist for ORDER BY so the sort parameter never reaches SQL directly.
# The feed order is the default and is what the home page relies on.
_SORT_COLUMNS = {
    "feed": "a.pinned DESC, a.created_at DESC",
    "created_at": "a.created_at DESC",
    "title": "a.title ASC",
    "priority": """
        CASE a.priority
            WHEN 'urgent' THEN 0
            WHEN 'important' THEN 1
            ELSE 2
        END,
        a.created_at DESC
    """,
}

_SELECT = """
    SELECT
        a.id,
        a.title,
        a.body,
        a.created_by,
        a.author_label,
        a.priority,
        a.pinned,
        a.published,
        a.expires_at,
        a.event_id,
        a.created_at,
        a.updated_at,
        e.title,
        u.first_name,
        u.last_name,
        u.username
    FROM announcements a
    LEFT JOIN events e ON e.id = a.event_id
    LEFT JOIN users u ON u.id = a.created_by
"""


def _iso(value):
    return value.isoformat() if value else None


def _row(row):
    # Prefer the live user record so a rename is reflected, but fall back to the
    # denormalised label if the author has since been deleted.
    author = row[4]
    if row[13] is not None:
        author = f"{row[13]} {row[14]} (@{row[15]})"

    return {
        "id": row[0],
        "title": row[1],
        "body": row[2],
        "created_by": row[3],
        "author_label": author,
        "priority": row[5],
        "pinned": row[6],
        "published": row[7],
        "expires_at": _iso(row[8]),
        "event_id": row[9],
        "created_at": _iso(row[10]),
        "updated_at": _iso(row[11]),
        "event_title": row[12],
    }


def create_announcement(db, announcement, created_by: int, author_label: str | None):
    db.execute(
        """
        INSERT INTO announcements
            (title, body, created_by, author_label, priority, pinned, published,
             expires_at, event_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (
            announcement.title,
            announcement.body,
            created_by,
            author_label,
            announcement.priority,
            announcement.pinned,
            announcement.published,
            announcement.expires_at,
            announcement.event_id,
        ),
    )
    return db.fetchone()[0]


def _announcement_filters(
    include_unpublished: bool = False,
    include_expired: bool = False,
    search: str | None = None,
    event_id: int | None = None,
    priority: str | None = None,
):
    clause = ""
    params: list = []

    if not include_unpublished:
        clause += " AND a.published = TRUE"

    if not include_expired:
        clause += " AND (a.expires_at IS NULL OR a.expires_at > NOW())"

    if search:
        clause += " AND (a.title ILIKE %s OR a.body ILIKE %s)"
        like = f"%{search}%"
        params.extend([like, like])

    if event_id is not None:
        clause += " AND a.event_id = %s"
        params.append(event_id)

    if priority:
        clause += " AND a.priority = %s"
        params.append(priority)

    return clause, params


def get_announcements(
    db,
    limit: int = 25,
    offset: int = 0,
    include_unpublished: bool = False,
    include_expired: bool = False,
    search: str | None = None,
    event_id: int | None = None,
    priority: str | None = None,
    sort: str = "feed",
):
    clause, params = _announcement_filters(
        include_unpublished, include_expired, search, event_id, priority
    )
    order_by = _SORT_COLUMNS.get(sort, _SORT_COLUMNS["feed"])

    db.execute(
        f"""
        {_SELECT}
        WHERE 1=1 {clause}
        ORDER BY {order_by}, a.id DESC
        LIMIT %s OFFSET %s;
        """,
        tuple(params + [limit, offset]),
    )
    return [_row(row) for row in db.fetchall()]


def count_announcements(
    db,
    include_unpublished: bool = False,
    include_expired: bool = False,
    search: str | None = None,
    event_id: int | None = None,
    priority: str | None = None,
):
    clause, params = _announcement_filters(
        include_unpublished, include_expired, search, event_id, priority
    )
    db.execute(
        f"SELECT COUNT(*) FROM announcements a WHERE 1=1 {clause};",
        tuple(params),
    )
    return db.fetchone()[0]


def get_announcement_by_id(db, announcement_id: int):
    db.execute(
        f"""
        {_SELECT}
        WHERE a.id = %s;
        """,
        (announcement_id,),
    )
    row = db.fetchone()
    return _row(row) if row else None


def update_announcement(db, announcement_id: int, announcement):
    """Partial update driven by exclude_unset, so an explicit null clears the
    expiry (making a notice permanent again) while an absent field is left
    untouched."""
    payload = announcement.model_dump(exclude_unset=True)

    fields = []
    values = []
    for column, value in payload.items():
        if column not in _UPDATABLE_COLUMNS:
            continue
        fields.append(f"{column} = %s")
        values.append(value)

    if not fields:
        return None

    fields.append("updated_at = NOW()")

    db.execute(
        f"""
        UPDATE announcements
        SET {", ".join(fields)}
        WHERE id = %s
        RETURNING id;
        """,
        tuple(values + [announcement_id]),
    )
    row = db.fetchone()
    return row[0] if row else None


def delete_announcement(db, announcement_id: int):
    db.execute(
        """
        DELETE FROM announcements
        WHERE id = %s
        RETURNING id;
        """,
        (announcement_id,),
    )
    row = db.fetchone()
    return row[0] if row else None


def get_announcement_stats(db):
    """Counts for the admin tab header. `live` is what members actually see."""
    db.execute(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (
                WHERE published
                  AND (expires_at IS NULL OR expires_at > NOW())
            ) AS live,
            COUNT(*) FILTER (WHERE pinned) AS pinned,
            COUNT(*) FILTER (WHERE NOT published) AS drafts,
            COUNT(*) FILTER (
                WHERE expires_at IS NOT NULL AND expires_at <= NOW()
            ) AS expired
        FROM announcements;
        """
    )
    row = db.fetchone()
    return {
        "total": row[0],
        "live": row[1],
        "pinned": row[2],
        "drafts": row[3],
        "expired": row[4],
    }
