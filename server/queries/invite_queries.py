import random
import string
from datetime import datetime, timezone


# ────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────


def generate_code():
    return "CLUB-" + "".join(
        random.choices(string.ascii_uppercase + string.digits, k=6)
    )


def invite_row_to_dict(row):
    return {
        "id": row[0],
        "code": row[1],
        "created_by": row[2],
        "max_uses": row[3],
        "uses": row[4],
        "expires_at": row[5],
    }


# ────────────────────────────────────────────────────────────
# Create Invite
# ────────────────────────────────────────────────────────────


def create_invite(db, created_by: int, max_uses: int, expires_at):
    code = generate_code()

    db.execute(
        """
        INSERT INTO invite_codes (code, created_by, max_uses, expires_at)
        VALUES (%s, %s, %s, %s)
        RETURNING id, code, created_by, max_uses, uses, expires_at;
        """,
        (code, created_by, max_uses, expires_at),
    )

    row = db.fetchone()
    return invite_row_to_dict(row)


# ────────────────────────────────────────────────────────────
# Get All Invites
# ────────────────────────────────────────────────────────────


def get_invites(db):
    db.execute(
        """
        SELECT id, code, created_by, max_uses, uses, expires_at
        FROM invite_codes
        ORDER BY created_at DESC;
        """
    )

    rows = db.fetchall()
    return [invite_row_to_dict(row) for row in rows]


# ────────────────────────────────────────────────────────────
# Validate Invite
# ────────────────────────────────────────────────────────────


def validate_invite(db, code: str):
    db.execute(
        """
        SELECT id, code, created_by, max_uses, uses, expires_at
        FROM invite_codes
        WHERE code = %s;
        """,
        (code,),
    )

    row = db.fetchone()
    if not row:
        return None

    invite = invite_row_to_dict(row)

    now = datetime.now(timezone.utc)

    expires_at = invite["expires_at"]

    # normalize postgres timestamp -> UTC aware
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    # expired
    if expires_at and expires_at < now:
        return None

    # usage exceeded
    if invite["uses"] >= invite["max_uses"]:
        return None

    return invite


# ────────────────────────────────────────────────────────────
# Use Invite (atomic)
# ────────────────────────────────────────────────────────────


def use_invite(db, code: str):
    db.execute(
        """
        UPDATE invite_codes
        SET uses = uses + 1
        WHERE code = %s AND uses < max_uses
        RETURNING id, code, created_by, max_uses, uses, expires_at;
        """,
        (code,),
    )

    row = db.fetchone()
    return invite_row_to_dict(row) if row else None


def delete_invite(db, invite_id: int):
    db.execute(
        """
        DELETE FROM invite_codes
        WHERE id = %s
        RETURNING id;
        """,
        (invite_id,),
    )

    row = db.fetchone()
    return row[0] if row else None
