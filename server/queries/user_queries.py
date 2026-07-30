from models import (
    AdminStaffMember,
    UserAuthorization,
    UserBase,
    UserMe,
)

from psycopg2.extras import Json

# Columns update_user is allowed to write. Anything else in the payload is
# ignored rather than interpolated into SQL.
_UPDATABLE_COLUMNS = {
    "first_name",
    "last_name",
    "email",
    "username",
    "password",
    "type",
    "availability",
    "admin",
    "active",
}

# Whitelist for ORDER BY so the sort parameter can never reach SQL directly.
_SORT_COLUMNS = {
    "name": "last_name, first_name",
    "username": "username",
    "email": "email",
    "type": "type",
    "admin": "admin",
    "active": "active",
}


# TODO: Add logic to check for duplicates before creating a new user
def create_user(db, user: UserAuthorization):
    db.execute(
        """
        INSERT INTO users (first_name, last_name, email, username, password, admin, active)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (
            user.first_name,
            user.last_name,
            user.email,
            user.username,
            user.password,
            user.admin,
            user.active,
        ),
    )
    return db.fetchone()[0]
    # Do not commit inside queries — only commit in routes to avoid partial writes


def _user_filters(search=None, user_type=None, admin_only=False, active=None):
    clause = ""
    params: list = []

    if search:
        clause += """
            AND (
                first_name ILIKE %s
                OR last_name ILIKE %s
                OR username ILIKE %s
                OR email ILIKE %s
                OR (first_name || ' ' || last_name) ILIKE %s
            )
        """
        like = f"%{search}%"
        params.extend([like] * 5)

    if user_type:
        clause += " AND type = %s"
        params.append(user_type)

    if admin_only:
        clause += " AND admin = TRUE"

    if active is not None:
        clause += " AND active = %s"
        params.append(active)

    return clause, params


def get_users(
    db,
    limit: int = 25,
    offset: int = 0,
    search: str | None = None,
    sort: str = "name",
    direction: str = "asc",
    user_type: str | None = None,
    admin_only: bool = False,
    active: bool | None = None,
):
    """Paginated, searchable, sortable staff directory."""
    clause, params = _user_filters(search, user_type, admin_only, active)

    order_by = _SORT_COLUMNS.get(sort, _SORT_COLUMNS["name"])
    order_dir = "DESC" if str(direction).lower() == "desc" else "ASC"

    db.execute(
        f"""
        SELECT id, first_name, last_name, email, username, admin, active, type, availability
        FROM users
        WHERE 1=1 {clause}
        ORDER BY {order_by} {order_dir}, id ASC
        LIMIT %s OFFSET %s;
        """,
        tuple(params + [limit, offset]),
    )

    return [
        AdminStaffMember(
            id=row[0],
            first_name=row[1],
            last_name=row[2],
            email=row[3],
            username=row[4],
            admin=row[5],
            active=row[6],
            type=row[7],
            availability=row[8],
        )
        for row in db.fetchall()
    ]


def count_users(
    db,
    search: str | None = None,
    user_type: str | None = None,
    admin_only: bool = False,
    active: bool | None = None,
):
    clause, params = _user_filters(search, user_type, admin_only, active)
    db.execute(
        f"SELECT COUNT(*) FROM users WHERE 1=1 {clause};",
        tuple(params),
    )
    return db.fetchone()[0]


def count_admins(db, excluding_user_id: int | None = None):
    """Used to refuse the demotion that would leave the site with no admin."""
    if excluding_user_id is None:
        db.execute("SELECT COUNT(*) FROM users WHERE admin = TRUE;")
    else:
        db.execute(
            "SELECT COUNT(*) FROM users WHERE admin = TRUE AND id <> %s;",
            (excluding_user_id,),
        )
    return db.fetchone()[0]


def get_user_admin_state(db, user_id: int):
    """Pre-change snapshot of the fields the audit log cares about."""
    db.execute(
        """
        SELECT id, first_name, last_name, email, username, admin, active, type
        FROM users
        WHERE id = %s;
        """,
        (user_id,),
    )
    row = db.fetchone()
    if row is None:
        return None

    return {
        "id": row[0],
        "first_name": row[1],
        "last_name": row[2],
        "email": row[3],
        "username": row[4],
        "admin": row[5],
        "active": row[6],
        "type": row[7],
    }


# TODO: consider adding isActive in this for future reference
def get_me(db, user_id: int):
    db.execute(
        """
        SELECT id, first_name, last_name, email, username, admin, type, availability
        FROM users
        WHERE id = %s;
        """,
        (user_id,),
    )
    row = db.fetchone()
    if row is None:
        return None

    id, first_name, last_name, email, username, admin, user_type, availability = row

    return UserMe(
        id=id,
        first_name=first_name,
        last_name=last_name,
        email=email,
        username=username,
        admin=admin,
        type=user_type,
        availability=availability,
    )


def get_user_by_id(db, user_id: int):
    db.execute(
        """
        SELECT first_name, last_name, email, username
        FROM users
        WHERE id = %s;
        """,
        (user_id,),
    )
    row = db.fetchone()
    if row is None:
        return None

    first_name, last_name, email, username = row
    return UserBase(
        first_name=first_name, last_name=last_name, email=email, username=username
    )


def get_user_by_email(db, email: str):
    db.execute(
        """
        SELECT id, first_name, last_name, email, username, password, admin, active
        FROM users
        WHERE email = %s;
        """,
        (email,),
    )
    row = db.fetchone()
    if row is None:
        return None

    return UserAuthorization(
        id=row[0],
        first_name=row[1],
        last_name=row[2],
        email=row[3],
        username=row[4],
        password=row[5],
        admin=row[6],
        active=row[7],
    )


def update_user(db, user_id: int, user):
    """Partial update driven by which fields the caller actually sent.

    Uses exclude_unset rather than None-checks so an explicit null can clear a
    nullable column (e.g. resetting `type` back to unset). Accepts UserUpdate
    or AdminUserUpdate — the route decides which model to parse with, so the
    admin/active columns are only reachable when an admin is calling.
    """
    payload = user.model_dump(exclude_unset=True)

    fields = []
    values = []

    for column, value in payload.items():
        if column not in _UPDATABLE_COLUMNS:
            continue
        fields.append(f"{column} = %s")
        values.append(Json(value) if column == "availability" else value)

    if not fields:
        return None

    sql = f"""
        UPDATE users
        SET {", ".join(fields)}
        WHERE id = %s
        RETURNING id;
    """

    values.append(user_id)
    db.execute(sql, tuple(values))

    row = db.fetchone()
    return row[0] if row else None


def delete_user(db, user_id: int):
    db.execute(
        """
        DELETE FROM users
        WHERE id = %s
        RETURNING id;
        """,
        (user_id,),
    )
    row = db.fetchone()
    return row[0] if row else None
