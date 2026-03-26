from models import UserBase, UserAuthorization, UserMe, UserUpdate


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


def get_users(db):
    db.execute("""
        SELECT id, first_name, last_name, email, username, admin
        FROM users
    """)

    data = db.fetchall()
    if not data:
        return []

    return [
        UserMe(
            id=id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            username=username,
            admin=admin
        )
        for (id, first_name, last_name, email, username, admin) in data
    ]


# TODO: consider adding isActive in this for future reference
def get_me(db, user_id: int):
    db.execute(
        """
        SELECT id, first_name, last_name, email, username, admin
        FROM users
        WHERE id = %s;
        """,
        (user_id,),
    )
    row = db.fetchone()
    if row is None:
        return None

    id, first_name, last_name, email, username, admin = row
    return UserMe(
        first_name=first_name,
        last_name=last_name,
        email=email,
        username=username,
        id=id,
        admin=admin,
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


def update_user(db, user_id: int, user: UserUpdate):
    fields = []
    values = []

    if user.first_name is not None:
        fields.append("first_name = %s")
        values.append(user.first_name)
    if user.last_name is not None:
        fields.append("last_name = %s")
        values.append(user.last_name)
    if user.email is not None:
        fields.append("email = %s")
        values.append(user.email)
    if user.username is not None:
        fields.append("username = %s")
        values.append(user.username)
    if user.password is not None:
        fields.append("password = %s")
        values.append(user.password)

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
